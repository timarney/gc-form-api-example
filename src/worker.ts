import type { Config } from "./config.js";
import { AccessTokenManager } from "./auth/token-manager.js";
import { FormsApiClient } from "./api/forms-api-client.js";
import { decryptSubmission } from "./responses/decrypt.js";
import { verifyAnswersChecksum } from "./responses/integrity.js";
import { downloadAttachments, saveFormattedSubmission, saveRawSubmission, saveTemplate } from "./storage/files.js";
import type { DecryptedSubmission, NewSubmission, PrivateApiKey, RawAnswers } from "./types.js";

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

function parseAnswers(serialized: string): RawAnswers {
  const parsed: unknown = JSON.parse(serialized);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Submission answers must be a JSON object");
  }
  return parsed as RawAnswers;
}

export class ResponsePuller {
  private readonly api: FormsApiClient;

  public constructor(
    private readonly config: Config,
    private readonly apiKey: PrivateApiKey,
  ) {
    const tokens = new AccessTokenManager(config.identityProviderUrl, config.projectId, apiKey);
    this.api = new FormsApiClient(config.apiUrl, apiKey.formId, tokens);
  }

  public async pollOnce(): Promise<number> {
    const submissions = await this.api.getNewSubmissions();
    console.info(`${new Date().toISOString()} — ${submissions.length} new submission(s)`);
    for (const item of submissions) {
      try {
        await this.processSubmission(item);
      } catch (error) {
        console.error(`Failed to process ${item.name}; it remains unconfirmed for the next poll.`, error);
      }
    }
    return submissions.length;
  }

  public async watch(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      let submissionCount = 0;
      try {
        submissionCount = await this.pollOnce();
      } catch (error) {
        console.error("Polling failed; will try again after the configured interval.", error);
      }
      if (submissionCount > 0) {
        console.info(`Retrieved ${submissionCount} submission(s); polling immediately for the next batch.`);
        continue;
      }
      console.info(`Waiting ${this.config.pollIntervalMs / 1000}s before the next poll.`);
      await sleep(this.config.pollIntervalMs, signal);
    }
  }

  private async processSubmission(item: NewSubmission): Promise<void> {
    if (!Number.isSafeInteger(item.version) || item.version < 1) {
      throw new Error(`Submission ${item.name} has no valid form version`);
    }
    console.info(`Processing ${item.name} (form v${item.version})`);

    const [encrypted, template] = await Promise.all([
      this.api.getSubmission(item.name),
      this.api.getTemplate(item.version),
    ]);
    const rawJson = decryptSubmission(encrypted, this.apiKey);
    const decrypted = JSON.parse(rawJson) as DecryptedSubmission;
    if (decrypted.version !== undefined && decrypted.version !== item.version) {
      throw new Error(`Version mismatch for ${item.name}: list says ${item.version}, payload says ${decrypted.version}`);
    }
    if (!verifyAnswersChecksum(decrypted.answers, decrypted.checksum)) {
      throw new Error(`Answer checksum mismatch for ${item.name}`);
    }
    const rawAnswers = parseAnswers(decrypted.answers);

    // Keep the raw receipt, attachment files, and template before any confirmation.
    await saveRawSubmission(this.config.outputDir, item.name, rawJson);
    await saveTemplate(this.config.outputDir, this.apiKey.formId, item.version, template);
    const attachments = await downloadAttachments(this.config.outputDir, item.name, decrypted.attachments);
    const formatted = await saveFormattedSubmission(
      this.config.outputDir,
      item.name,
      decrypted.createdAt || item.createdAt,
      this.apiKey.formId,
      item.version,
      template,
      rawAnswers,
      attachments,
      this.config.responseLocale,
    );

    if (this.config.confirmAfterSuccess) {
      await this.api.confirmSubmission(item.name, decrypted.confirmationCode);
      console.info(`Saved and confirmed ${item.name}`);
    } else {
      console.info(`Saved ${item.name}; confirmation is disabled`);
    }
  }
}
