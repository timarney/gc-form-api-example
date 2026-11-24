import type { FormElement, FormProperties, Response } from "@gcforms/types";
import type { Attachment, MappedAnswer, RawAnswers } from "../types.js";
import { orderFormElements } from "./order-form-elements.js";

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function questionKey(element: FormElement): string {
  return element.properties.questionId?.trim() || `element:${element.id}`;
}

function formatDate(answer: unknown, requestedFormat: string | undefined): string {
  let value: unknown = answer;
  if (typeof answer === "string") {
    try {
      value = JSON.parse(answer) as unknown;
    } catch {
      return answer;
    }
  }
  if (!value || typeof value !== "object") return stringify(answer);
  const date = value as Record<string, unknown>;
  if (typeof date.YYYY !== "number" || typeof date.MM !== "number" || typeof date.DD !== "number") {
    return "-";
  }
  const format = ["YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY"].includes(requestedFormat ?? "")
    ? requestedFormat!
    : "YYYY-MM-DD";
  return format
    .replace("YYYY", String(date.YYYY))
    .replace("MM", String(date.MM).padStart(2, "0"))
    .replace("DD", String(date.DD).padStart(2, "0"));
}

function formatAddress(answer: unknown, split: boolean | undefined): string {
  let value: unknown = answer;
  if (typeof answer === "string") {
    try {
      value = JSON.parse(answer) as unknown;
    } catch {
      return answer;
    }
  }
  if (!value || typeof value !== "object") return stringify(answer);
  const address = value as Record<string, unknown>;
  const fields = ["streetAddress", "city", "province", "postalCode", "country"] as const;
  if (fields.every((field) => !address[field])) return "";
  if (split) {
    const labels: Record<(typeof fields)[number], string> = {
      streetAddress: "Street address / Adresse municipale",
      city: "City / Ville",
      province: "Province or state / Province ou État",
      postalCode: "Postal code / Code postal",
      country: "Country / Pays",
    };
    return fields.map((field) => `${labels[field]}: ${stringify(address[field])}`).join("\n");
  }
  return `${stringify(address.streetAddress)}, ${stringify(address.city)}, ${stringify(address.province)} ${stringify(address.postalCode)} ${stringify(address.country)}`;
}

function mapSingle(
  question: FormElement,
  raw: unknown,
  attachments: Map<string, Attachment>,
): MappedAnswer {
  if (question.type === "dynamicRow" && Array.isArray(raw)) {
    const subElements = (question.properties.subElements ?? []).filter((sub) => sub.type !== "richText");
    const rows: MappedAnswer[][] = raw.map((row) => {
      const values = Array.isArray(row) ? row : Object.values((row ?? {}) as Record<string, unknown>);
      return values.map((value, index) => {
        const subQuestion = subElements[index];
        return subQuestion
          ? mapSingle(subQuestion, value, attachments)
          : {
              type: "-",
              questionId: index,
              questionKey: `dynamic:${index}`,
              tags: [],
              answer: stringify(value),
            };
      });
    });
    return createMappedAnswer(question, rows);
  }

  let answer = raw;
  if (question.type === "checkbox" && Array.isArray(raw)) answer = raw.join(", ");
  if (question.type === "formattedDate" && raw) answer = formatDate(raw, question.properties.dateFormat);
  if (question.type === "addressComplete" && raw) {
    answer = formatAddress(raw, question.properties.addressComponents?.splitAddress);
  }
  if (question.type === "fileInput" && raw && typeof raw === "object") {
    const response = raw as { id?: string; name?: string | null };
    const attachment = response.id ? attachments.get(response.id) : undefined;
    answer = attachment
      ? `${attachment.isPotentiallyMalicious ? "⚠️ " : ""}${attachment.name}`
      : response.name ?? "";
  }
  return createMappedAnswer(question, stringify(answer));
}

function createMappedAnswer(question: FormElement, answer: MappedAnswer["answer"]): MappedAnswer {
  return {
    type: String(question.type),
    questionId: question.id,
    questionKey: questionKey(question),
    questionEn: question.properties.titleEn,
    questionFr: question.properties.titleFr,
    tags: question.properties.tags ?? [],
    answer,
    ...(question.type === "formattedDate" && question.properties.dateFormat
      ? { dateFormat: question.properties.dateFormat }
      : {}),
  };
}

export function mapAnswers(
  form: FormProperties,
  rawAnswers: RawAnswers,
  attachments: Attachment[],
): MappedAnswer[] {
  const attachmentMap = new Map(attachments.map((attachment) => [attachment.id, attachment]));
  const elements = orderFormElements(form).filter((element) => element.type !== "richText");
  const elementById = new Map(elements.map((element) => [String(element.id), element]));
  const mapped: MappedAnswer[] = [];
  const consumed = new Set<string>();

  for (const question of elements) {
    const key = String(question.id);
    if (!Object.hasOwn(rawAnswers, key)) continue;
    consumed.add(key);
    mapped.push(mapSingle(question, rawAnswers[key], attachmentMap));
  }

  // Keep any answer whose question is absent from this version's template visible.
  for (const [key, answer] of Object.entries(rawAnswers)) {
    if (consumed.has(key)) continue;
    const id = Number(key);
    const known = elementById.get(key);
    mapped.push(
      known
        ? mapSingle(known, answer, attachmentMap)
        : {
            type: "-",
            questionId: Number.isFinite(id) ? id : 0,
            questionKey: `unknown:${key}`,
            questionEn: "Unmatched answer",
            questionFr: "Réponse non associée",
            tags: [],
            answer: stringify(answer as Response),
          },
    );
  }
  return mapped;
}
