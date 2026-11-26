import type { FormProperties } from "@gcforms/types";
import type { MappedAnswer, RawAnswers } from "@gcforms/core";
export type { RawAnswers } from "@gcforms/core";

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

