import type { FormProperties, Response } from "@gcforms/types";

export interface PrivateApiKey {
  keyId: string;
  key: string;
  userId: string;
  formId: string;
}

export interface NewSubmission {
  name: string;
  createdAt: number;
  version: number;
}

export interface EncryptedSubmission {
  encryptedKey: string;
  encryptedNonce: string;
  encryptedAuthTag: string;
  encryptedResponses: string;
}

export interface Attachment {
  id: string;
  name: string;
  downloadLink: string;
  isPotentiallyMalicious: boolean;
  md5?: string;
}

export interface SavedAttachment extends Attachment {
  savedAs: string;
}

export interface DecryptedSubmission {
  createdAt: number;
  status: string;
  confirmationCode: string;
  answers: string;
  checksum: string;
  attachments?: Attachment[];
  version?: number;
}

export interface MappedAnswer {
  type: string;
  questionId: number;
  questionKey: string;
  questionEn?: string;
  questionFr?: string;
  tags: string[];
  answer: string | MappedAnswer[][];
  dateFormat?: string;
}

export interface FormattedSubmission {
  submissionId: string;
  createdAt: string;
  formId: string;
  formVersion: number;
  formTitleEn: string;
  formTitleFr: string;
  answers: MappedAnswer[];
  attachments: Array<{
    id: string;
    originalName: string;
    savedAs: string;
    isPotentiallyMalicious: boolean;
    md5?: string;
  }>;
}

export type RawAnswers = Record<string, Response>;
