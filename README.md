# GC Forms response puller

A small TypeScript worker that retrieves new GC Forms submissions, verifies and decrypts them, formats answers against the exact template version used for each submission, and saves JSON and attachment files locally.

The response pipeline follows the GC Forms API and the Forms client responses pilot: RSA-OAEP-SHA256 unwraps the AES-256-GCM key material, the MD5 checksum is verified before mapping, and template element ordering follows the shared `@gcforms/core` layout and response-mapping utilities. The `@gcforms/types` package provides the shared template types.

## Setup

1. Install Node.js 22 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in `FORMS_PROJECT_ID`.
4. Put the GC Forms API key JSON file in `credentials/`.
5. Run `npm run typecheck`, then `npm start` for a one-time poll or `npm run watch` for continuous polling.

Each submission is written as its own JSON file. The response includes its form version and is formatted using the template for that same version. Templates are saved separately by version. Answers follow the Forms client layout and group ordering.

To export a form version's formatted responses to CSV, build the project and run:

```sh
npm run build
# npm run csv -- cmwxulejz000001yif1xgqv95 1
npm run csv -- <form-id> <version>
```

The CSV is written to `output/csv/<form-id>/v<version>.csv`.

## Background mode

`npm run watch` polls every `POLL_INTERVAL_SECONDS` (minimum 10 seconds). Keep it running under your process manager of choice (for example, `systemd`, `launchd`, or a container restart policy). It handles `SIGINT` and `SIGTERM` and continues after individual response or polling failures.

For a simple background run on macOS or Linux:

```sh
mkdir -p output
npm run build
nohup npm start -- --watch > output/worker.log 2>&1 &
echo $! > output/worker.pid
```

View `output/worker.log` for progress. Stop the process with `kill "$(cat output/worker.pid)"`.

By default, a submission is confirmed only after its raw source, template, attachments, and formatted JSON have been written successfully. If a step fails, the worker leaves it unconfirmed for a later poll. Set `CONFIRM_AFTER_SUCCESS=false` to retain submissions at GC Forms after export.

Attachment download links expire quickly, so the worker downloads attachments immediately after decrypting a response. Files flagged as potentially malicious are saved under `attachments/potentially-malicious/` and marked in the JSON and Sheet. Do not open those files without following your organization's security process.

## Output

```text
output/
  source/                 # Decrypted API payloads, including receipt codes
  templates/<form-id>/v3.json       # Exact form template used by version 3 responses
  responses/<form-id>/v3/<name>.json   # Formatted, template-ordered answer records
  attachments/<name>/     # Downloaded attachments
```

This directory contains sensitive submission data. Keep it out of version control and apply your department's storage and access controls.

## Settings

Use staging API and identity-provider URLs for staging forms. Keep private API key files out of source control.
