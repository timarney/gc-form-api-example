import path from "node:path";
import { writeCsv } from "./writer.js";

const [formId, versionText] = process.argv.slice(2);
const formVersion = Number(versionText);

if (!formId || !Number.isSafeInteger(formVersion) || formVersion < 1) {
  throw new Error("Usage: npm run csv -- <form-id> <version>");
}

const outputDir = path.resolve(process.env.OUTPUT_DIR ?? "./output");
const csvPath = await writeCsv(outputDir, formId, formVersion);
console.info(`CSV written to ${csvPath}`);
