import { createHash, timingSafeEqual } from "node:crypto";

export function verifyAnswersChecksum(answers: string, expected: string): boolean {
  const actualBuffer = Buffer.from(createHash("md5").update(answers, "utf8").digest("hex"), "ascii");
  const expectedBuffer = Buffer.from(expected, "ascii");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
