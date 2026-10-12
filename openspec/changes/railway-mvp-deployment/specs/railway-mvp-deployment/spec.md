## ADDED Requirements

### Requirement: Web image is Railway-compatible

The web Docker image SHALL build from the repository root `Dockerfile` with the root `pnpm-lock.yaml`, SHALL compile the public Supabase and site-origin values at build time, and SHALL start the custom Next.js server on the Railway-provided `PORT` and a bind address reachable by Railway.

#### Scenario: Web service starts on Railway port

- **WHEN** Railway starts the web container with a valid `PORT`
- **THEN** the Next.js server listens on that port and accepts requests from Railway's public proxy

#### Scenario: Public build values are available

- **WHEN** Railway builds the web image with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL`
- **THEN** the resulting client and metadata build uses those values rather than localhost or the default production domain

### Requirement: Worker image is reproducible

The worker Docker image SHALL build from repository root context, SHALL install root dependencies from the root lockfile, SHALL install worker dependencies from `worker/pnpm-lock.yaml` with frozen-lockfile behavior, SHALL include Poppler, and SHALL retain shared root source modules required by the worker.

#### Scenario: Worker image has required runtime tools

- **WHEN** the worker image is built
- **THEN** `pdftoppm`, `pdftotext`, Node.js, the worker package dependencies, and the shared root modules are available to the worker command

#### Scenario: Worker dependency drift is rejected

- **WHEN** the worker package manifest and `worker/pnpm-lock.yaml` are inconsistent during image build
- **THEN** the dependency installation fails instead of silently resolving a different dependency graph

### Requirement: Railway services use the existing queue contract

The deployment SHALL run one persistent worker service alongside one web service, SHALL not add a second queue or Railway volume, and SHALL provide the worker with the hosted Supabase URL, service-role key, OpenAI key, application origin, and upload broker origin.

#### Scenario: Queued document is processed

- **WHEN** an authenticated user uploads an allowed synthetic PDF or image and the web service enqueues a `full_pipeline` job
- **THEN** the single worker claims the job, processes it with the existing pipeline, writes previews and extracted staging rows to Supabase, and updates the document processing status

#### Scenario: Worker origin is not localhost

- **WHEN** the worker calls the upload broker during a hosted deployment
- **THEN** it uses `DOCUMENT_UPLOAD_BROKER_URL` or `APP_URL` set to the deployed web origin and does not fall back to `http://localhost:3000`

### Requirement: Hosted Supabase is the durable backend

The deployment SHALL apply the repository migrations to a dedicated hosted Supabase project, SHALL configure Auth for the deployed origin and `/auth/callback`, SHALL keep `lab-documents` private, and SHALL keep service-role credentials server-side.

#### Scenario: Auth callback returns to deployed origin

- **WHEN** a user completes a magic-link sign-in from the deployed web origin
- **THEN** Supabase accepts the callback URL and the application establishes the session through `/auth/callback`

#### Scenario: Uploaded document remains private

- **WHEN** an authenticated user uploads a synthetic document
- **THEN** the original and derived page artifacts are stored in the private Supabase bucket and the client receives only the existing authorized signed-URL projection

### Requirement: Physician sharing is excluded from the Railway MVP

The Railway MVP SHALL NOT expose public report or raw-document share links, trusted-ingress/mTLS routes, physician-patient relationship features, or doctor-facing sharing. The deployment SHALL not claim those capabilities are available.

#### Scenario: Direct share route is not a launch path

- **WHEN** a deployment operator follows the MVP smoke flow
- **THEN** the flow uses private authenticated Documents, Review, and Timeline surfaces only and does not require `/share/*` or `/api/share/*`

#### Scenario: Trusted-ingress secrets are absent

- **WHEN** Railway service variables are configured for the MVP
- **THEN** trusted-proxy attestation and share token secrets are not required for the private upload and review flow

### Requirement: MVP deployment is smoke-verifiable

The deployment SHALL provide a repeatable smoke path covering authentication, upload, asynchronous processing, review evidence, acceptance, timeline visibility, and worker liveness reporting using synthetic data.

#### Scenario: End-to-end synthetic smoke flow

- **WHEN** the operator signs in, uploads a synthetic lab document, waits for worker processing, opens the review surface, accepts an extracted value, and opens the timeline
- **THEN** each step succeeds against the deployed web and worker services and the accepted observation is visible in the authenticated timeline

#### Scenario: Worker failure is visible

- **WHEN** the worker service is stopped after a document enters processing
- **THEN** the web document surface eventually reports the worker as offline through the existing heartbeat contract rather than claiming successful processing
