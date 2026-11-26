import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { mapAnswers, orderAnswersByTemplate } from "@gcforms/core";
import type { FormProperties } from "@gcforms/types";
import type { Attachment, FormattedSubmission, RawAnswers, SavedAttachment } from "../types.js";

function safeFileName(input: string): string {
  const leaf = path.basename(input).replace(/[\u0000-\u001f<>:"\/\\|?*]/g, "_").trim();
  return leaf && leaf !== "." ? leaf : "attachment";
}

async function atomicWrite(filePath: string, data: string | Uint8Array): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, data, { mode: 0o600, flag: "wx" });
  await rename(tempPath, filePath);
}

export async function saveTemplate(outputDir: string, version: number, template: FormProperties): Promise<void> {
  await atomicWrite(
    path.join(outputDir, "templates", `v${version}.json`),
    `${JSON.stringify(template, null, 2)}\n`,
  );
}

export async function saveRawSubmission(
  outputDir: string,
  submissionId: string,
  rawJson: string,
): Promise<void> {
  await atomicWrite(path.join(outputDir, "source", `${safeFileName(submissionId)}.json`), `${rawJson}\n`);
}

export async function downloadAttachments(
  outputDir: string,
  submissionId: string,
  attachments: Attachment[] = [],
): Promise<SavedAttachment[]> {
  const usedNames = new Set<string>();
  return Promise.all(
    attachments.map(async (attachment) => {
      const url = new URL(attachment.downloadLink);
      if (url.protocol !== "https:") throw new Error(`Refusing non-HTTPS attachment URL for ${attachment.id}`);
      const original = safeFileName(attachment.name);
      const extension = path.extname(original);
      const base = original.slice(0, original.length - extension.length);
      let actualName = original;
      let suffix = 1;
      while (usedNames.has(actualName.toLowerCase())) {
        actualName = `${base} (${suffix++})${extension}`;
      }
      usedNames.add(actualName.toLowerCase());

      const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error(`Attachment download failed with HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const folder = attachment.isPotentiallyMalicious ? "attachments/potentially-malicious" : "attachments";
      const relativePath = path.posix.join(folder, safeFileName(submissionId), actualName);
      await atomicWrite(path.join(outputDir, ...relativePath.split("/")), bytes);
      return { ...attachment, savedAs: relativePath };
    }),
  );
}

export async function saveFormattedSubmission(
  outputDir: string,
  submissionId: string,
  createdAt: number,
  formId: string,
  formVersion: number,
  template: FormProperties,
  rawAnswers: RawAnswers,
  attachments: SavedAttachment[],
): Promise<FormattedSubmission> {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid createdAt for submission ${submissionId}`);
  const attachmentMap = new Map(
    attachments.map((attachment) => [
      attachment.id,
      {
        originalName: attachment.name,
        actualName: path.basename(attachment.savedAs),
        isPotentiallyMalicious: attachment.isPotentiallyMalicious,
      },
    ]),
  );
  const result: FormattedSubmission = {
    submissionId,
    createdAt: date.toISOString(),
    formId,
    formVersion,
    formTitleEn: template.titleEn,
    formTitleFr: template.titleFr,
    answers: orderAnswersByTemplate(
      mapAnswers({
        formTemplate: template,
        rawAnswers,
        attachments: attachmentMap,
      }),
      template,
    ),
    attachments: attachments.map(({ id, name, savedAs, isPotentiallyMalicious, md5 }) => ({
      id,
      originalName: name,
      savedAs,
      isPotentiallyMalicious,
      ...(md5 ? { md5 } : {}),
    })),
  };
  await atomicWrite(
    path.join(outputDir, "responses", `${safeFileName(submissionId)}.json`),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  return result;
}
