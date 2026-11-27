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
  submittedAt: string;
  form: {
    id: string;
    version: number;
    title: string | {
      en: string;
      fr: string;
    };
  };
  answers: Array<{
    question: string | {
      en: string;
      fr: string;
    };
    answer?: string;
    rows?: Array<Array<{
      question: string | {
        en: string;
        fr: string;
      };
      answer?: string;
    }>>;
  }>;
  attachments?: Array<{
    id: string;
    originalName: string;
    savedAs: string;
    isPotentiallyMalicious: boolean;
    md5?: string;
  }>;
}

