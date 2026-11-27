import type { MappedAnswer } from "@gcforms/core";
import type { FormattedSubmission } from "../types.js";

export type ResponseLocale = "en" | "fr" | "both";
type ReadableLabel = string | { en: string; fr: string };
type ReadableAnswer = {
  question: ReadableLabel;
  answer?: string;
  rows?: ReadableAnswer[][];
};

function label(en: string | undefined, fr: string | undefined, locale: ResponseLocale): ReadableLabel {
  const english = en ?? "-";
  const french = fr ?? "-";
  if (locale === "en") return english;
  if (locale === "fr") return french;
  return { en: english, fr: french };
}

function mapAnswer(answer: MappedAnswer, locale: ResponseLocale): ReadableAnswer {
  if (Array.isArray(answer.answer)) {
    return {
      question: label(answer.questionEn, answer.questionFr, locale),
      rows: answer.answer.map((row) => row.map((subAnswer) => mapAnswer(subAnswer, locale))),
    };
  }
  return {
    question: label(answer.questionEn, answer.questionFr, locale),
    answer: answer.answer,
  };
}

export function toReadableSubmission(
  submission: {
    submissionId: string;
    createdAt: string;
    formId: string;
    formVersion: number;
    formTitleEn: string;
    formTitleFr: string;
    answers: MappedAnswer[];
    attachments?: FormattedSubmission["attachments"];
  },
  locale: ResponseLocale,
): FormattedSubmission {
  return {
    submissionId: submission.submissionId,
    submittedAt: submission.createdAt,
    form: {
      id: submission.formId,
      version: submission.formVersion,
      title: label(submission.formTitleEn, submission.formTitleFr, locale),
    },
    answers: submission.answers.map((answer) => mapAnswer(answer, locale)),
    ...(submission.attachments && submission.attachments.length > 0
      ? { attachments: submission.attachments }
      : {}),
  };
}
