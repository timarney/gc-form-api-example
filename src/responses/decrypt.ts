import { createDecipheriv, privateDecrypt } from "node:crypto";
import type { EncryptedSubmission, PrivateApiKey } from "../types.js";

export function decryptSubmission(encrypted: EncryptedSubmission, apiKey: PrivateApiKey): string {
  try {
    const privateKey = { key: apiKey.key, oaepHash: "sha256" } as const;
    const key = privateDecrypt(privateKey, Buffer.from(encrypted.encryptedKey, "base64"));
    const nonce = privateDecrypt(privateKey, Buffer.from(encrypted.encryptedNonce, "base64"));
    const authTag = privateDecrypt(privateKey, Buffer.from(encrypted.encryptedAuthTag, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAuthTag(authTag);
    const ciphertext = Buffer.from(encrypted.encryptedResponses, "base64");
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (error) {
    throw new Error("Could not decrypt the GC Forms submission", { cause: error });
  }
}
