import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PrivateApiKey } from "./types.js";

export interface Config {
  apiUrl: string;
  identityProviderUrl: string;
  projectId: string;
  apiKeyFile: string;
  outputDir: string;
  pollIntervalMs: number;
  confirmAfterSuccess: boolean;
  responseLocale: "en" | "fr" | "both";
  watch: boolean;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseResponseLocale(value: string | undefined): "en" | "fr" | "both" {
  const locale = value?.trim().toLowerCase() || "both";
  if (locale !== "en" && locale !== "fr" && locale !== "both") {
    throw new Error("RESPONSE_LOCALE must be en, fr, or both");
  }
  return locale;
}

export async function loadConfig(watch: boolean): Promise<{ config: Config; apiKey: PrivateApiKey }> {
  const apiKeyFile = path.resolve(process.env.FORMS_API_KEY_FILE ?? "./credentials/form_private_api_key.json");
  const apiKeyValue: unknown = JSON.parse(await readFile(apiKeyFile, "utf8"));
  if (!apiKeyValue || typeof apiKeyValue !== "object") {
    throw new Error(`Invalid API key JSON in ${apiKeyFile}`);
  }
  const apiKey = apiKeyValue as Partial<PrivateApiKey>;
  for (const field of ["keyId", "key", "userId", "formId"] as const) {
    if (typeof apiKey[field] !== "string" || !apiKey[field]) {
      throw new Error(`API key JSON is missing a valid ${field}`);
    }
  }

  const pollSeconds = Number(process.env.POLL_INTERVAL_SECONDS ?? "60");
  if (!Number.isFinite(pollSeconds) || pollSeconds < 10) {
    throw new Error("POLL_INTERVAL_SECONDS must be at least 10");
  }

  return {
    apiKey: apiKey as PrivateApiKey,
    config: {
      apiUrl: (process.env.FORMS_API_URL ?? "https://api.forms-formulaires.alpha.canada.ca/v1").replace(/\/$/, ""),
      identityProviderUrl: (process.env.FORMS_IDP_URL ?? "https://auth.forms-formulaires.alpha.canada.ca").replace(/\/$/, ""),
      projectId: requiredEnv("FORMS_PROJECT_ID"),
      apiKeyFile,
      outputDir: path.resolve(process.env.OUTPUT_DIR ?? "./output"),
      pollIntervalMs: pollSeconds * 1000,
      confirmAfterSuccess: parseBoolean(process.env.CONFIRM_AFTER_SUCCESS, true),
      responseLocale: parseResponseLocale(process.env.RESPONSE_LOCALE),
      watch,
    },
  };
}
