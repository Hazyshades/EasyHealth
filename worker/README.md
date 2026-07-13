# Document processing worker

Background worker for EasyHealth document intelligence pipeline: page previews, OCR text, and biomarker extraction.

## Requirements

- Node.js 20+
- [poppler-utils](https://poppler.freedesktop.org/) (`pdftoppm`, `pdftotext`) on the host or in Docker
- Supabase service role key and OpenAI API key (same as the Next.js app)

### Windows (local dev)

The Chocolatey package `poppler` installs **source code only** — it does **not** ship `pdftoppm.exe`. Use one of:

```powershell
# Recommended: prebuilt binaries via winget
winget install oschwartz10612.Poppler
```

After install, either add Poppler's `Library\bin` folder to your user `PATH`, or set in `worker/.env`:

```env
POPPLER_BIN_DIR=C:\path\to\poppler\Library\bin
```

Verify in a **new** terminal: `pdftoppm -v`

Alternatively run the worker in Docker (poppler included in `worker/Dockerfile`).

## Environment

Copy variables from the app `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
# Optional provider keys (if profiles use them)
DEEPSEEK_API_KEY=
OWL_ALPHA_API_KEY=
WORKER_POLL_INTERVAL_MS=5000
# Windows only — if pdftoppm is not on PATH:
# POPPLER_BIN_DIR=C:\path\to\poppler\Library\bin
```

## Local development

```bash
cd worker
pnpm install
pnpm dev
```

Run from repo root with app `.env` present. The worker polls `document_processing_jobs` every 5 seconds.

## Docker

```bash
docker build -f worker/Dockerfile -t easyhealth-worker .
docker run --env-file .env easyhealth-worker
```

## Deploy (Railway / Fly.io / Render)

1. Create a worker service from `worker/Dockerfile`.
2. Attach the same environment variables as the web app (service role, OpenAI).
3. Keep **one** worker instance for Postgres polling in MVP.
4. Ensure poppler-utils is available (included in the Dockerfile).

## What it does

1. Claims `queued` jobs with `job_type = full_pipeline`
2. Downloads the original from private `lab-documents` storage
3. Generates `thumb.webp` and `pages/page-N.webp`
4. Runs `pdftotext` for digital PDFs
5. Extracts biomarkers via LLM into `document_extracted_biomarkers` (`needs_review`)
6. Sets `documents.processing_status` to `needs_review` or `ready`
