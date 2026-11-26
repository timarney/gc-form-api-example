import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sortByGroups } from "@gcforms/core";
import type { MappedAnswer } from "@gcforms/core";
import type { FormElement, FormProperties } from "@gcforms/types";

interface FormattedSubmission {
  submissionId: string;
  createdAt: string;
  formId: string;
  formVersion: number;
  answers: MappedAnswer[];
}

function csvField(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function answerText(answer: MappedAnswer["answer"]): string {
  if (!Array.isArray(answer)) return answer || "-";
  const text = answer
    .map((row) =>
      row
        .map((subAnswer) => `${subAnswer.questionEn}\n${subAnswer.questionFr}: ${subAnswer.answer}\n`)
        .join(""),
    )
    .join("\n");
  return text || "-";
}

function getHeaders(elements: FormElement[]): string[] {
  return [
    "Submission ID\nIdentifiant de soumission",
    "Date of submission\nDate de soumission",
    ...elements.map((element) => `${element.properties.titleEn}\n${element.properties.titleFr}`),
  ];
}

function getRow(submission: FormattedSubmission, elements: FormElement[]): string[] {
  const answersByQuestionId = new Map(submission.answers.map((answer) => [answer.questionId, answer]));
  return [
    submission.submissionId,
    new Date(submission.createdAt).toISOString(),
    ...elements.map((element) => answerText(answersByQuestionId.get(element.id)?.answer ?? "-")),
  ];
}

function validateSubmission(
  submission: FormattedSubmission,
  formId: string,
  formVersion: number,
  fileName: string,
): void {
  if (submission.formId !== formId || submission.formVersion !== formVersion) {
    throw new Error(`Response ${fileName} does not match form ${formId} version ${formVersion}`);
  }
}

export async function writeCsv(
  outputDir: string,
  formId: string,
  formVersion: number,
): Promise<string> {
  if (!formId || formId !== path.basename(formId) || formId === "." || formId === "..") {
    throw new Error(`Invalid form ID: ${formId}`);
  }
  const formDirectory = path.join(outputDir, "responses", formId, `v${formVersion}`);
  const templatePath = path.join(outputDir, "templates", formId, `v${formVersion}.json`);
  const csvPath = path.join(outputDir, "csv", formId, `v${formVersion}.csv`);
  const template = JSON.parse(await readFile(templatePath, "utf8")) as FormProperties;
  const elements = sortByGroups({
    form: template,
    elements: (template.elements ?? []).filter((element) => element.type !== "richText"),
  });
  const entries = await readdir(formDirectory, { withFileTypes: true });
  const responseFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  const rows = await Promise.all(
    responseFiles.map(async (fileName) => {
      const submission = JSON.parse(
        await readFile(path.join(formDirectory, fileName), "utf8"),
      ) as FormattedSubmission;
      validateSubmission(submission, formId, formVersion, fileName);
      return getRow(submission, elements);
    }),
  );
  const csv = [
    "\uFEFF" + getHeaders(elements).map(csvField).join(","),
    ...rows.map((row) => row.map(csvField).join(",")),
    "",
  ].join("\n");
  await mkdir(path.dirname(csvPath), { recursive: true });
  await writeFile(csvPath, csv, "utf8");
  return csvPath;
}
