## Context

EasyHealth is a Next.js application with a custom Node server, Supabase Auth/Postgres/Storage, and a separate Node document worker. The web image is built from the repository root `Dockerfile`. The worker image needs Poppler, worker-only dependencies, and shared modules under the root `src` directory. The current worker Dockerfile installs through a root-context filter fallback but does not copy the worker lockfile before installation.

Railway will host two persistent services from the same GitHub branch: a public web service and a private worker service. Supabase remains the source of truth for Auth, Postgres, private document storage, jobs, heartbeats, and derived document artifacts. Railway's ephemeral filesystem is not application storage.

The MVP intentionally excludes unauthenticated report/document sharing, the trusted-ingress/mTLS deployment path, physician-patient relationship features, and doctor-facing sharing. Those capabilities remain outside this deployment change.

## Goals / Non-Goals

**Goals:**

- Produce reproducible Docker builds for the web and worker services.
- Preserve the worker's shared-root imports while installing its own locked dependencies.
- Define the Railway service topology, build context, port, restart, healthcheck, and environment contract.
- Make hosted Supabase migration, Auth redirect, private bucket, and secret handoff explicit.
- Provide a synthetic-data smoke path for upload, processing, review, and timeline behavior.

**Non-Goals:**

- Deploying or redesigning public share links or trusted ingress.
- Adding a physician-patient relationship or doctor-facing collaboration model.
- Moving Postgres, Auth, or document storage into Railway.
- Adding Redis, BullMQ, Kubernetes, or another queue service.
- Claiming that an external Railway or Supabase account has been configured by repository changes alone.

## Decisions

### 1. Use two Railway persistent services

The web service uses the root `Dockerfile` and exposes the Railway-injected `PORT`. The worker service uses `/worker/Dockerfile` with repository root as its build context and has no public domain. One worker replica is the MVP invariant because the existing worker polls the Postgres-backed queue and the repository deployment guidance specifies one instance for MVP.

A Railway legacy `railway.json` or `railway.toml` file is not added. Railway now documents Config as Code as deprecated for new services, and the two services require different Dockerfile paths. Service settings remain explicit dashboard configuration for this first deployment.

### 2. Install root and worker dependencies from their own lockfiles

The worker image copies root manifests and installs the root dependency graph, then copies `worker/package.json` and `worker/pnpm-lock.yaml` and installs the worker graph with `pnpm --dir worker install --frozen-lockfile`. The full repository is copied afterward so worker imports from root `src` remain available. The worker command remains `pnpm start` from `/app/worker`.

This removes the current filter fallback and prevents the image from silently installing an incomplete or unpinned worker dependency graph.

### 3. Keep public Supabase values available at web build time

The web Dockerfile declares build arguments for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL`, then exports them before `pnpm build`. Railway service variables provide these values during the build. Server-only secrets are runtime variables and are never placed in `NEXT_PUBLIC_*` variables. The worker receives the same Supabase URL and anon key at runtime because its imported root health-profile modules validate the client environment, in addition to its service-role and AI-provider secrets.

### 4. Use Supabase for all durable document state

Original documents, page previews, OCR artifacts, processing jobs, observations, and worker heartbeats remain in Supabase. No Railway volume is required. The `lab-documents` bucket stays private and clients receive signed URLs through existing application boundaries.

### 5. Use the existing worker liveness contract

The web service does not require a new worker HTTP endpoint. The existing worker heartbeat is used by document APIs to report an offline worker. The web deployment may use `/` as a deployment healthcheck because the public landing route is available without authentication. Railway healthchecks are deployment-time checks only.

### 6. Fail closed by omitting the share surface from MVP operations

The Railway MVP does not configure share key-ring, trusted-proxy, attestation, or public share deployment variables. Share links are not presented as an available launch capability. The existing trusted-ingress/mTLS artifact is not partially adapted to Railway because a partial adaptation would either break access or weaken the direct-origin boundary.

## Risks / Trade-offs

- **[Risk]** Railway Free limits each service to 0.5 GB RAM and provides only $1 monthly resource credit. **Mitigation:** keep one worker replica, disable volumes, use synthetic smoke data, monitor usage, and treat Free as a temporary demo tier.
- **[Risk]** Poppler, `sharp`, and OCR can exceed the worker memory ceiling on large documents. **Mitigation:** test the maximum MVP document size and keep the worker concurrency at one; upgrade the service or move to a VPS if the smoke path exceeds the limit.
- **[Risk]** A Limited Railway Trial may restrict outbound access needed by Supabase, AI providers, and `next/font/google`. **Mitigation:** use a verified Full Trial or prove the build and runtime from the target account before inviting users.
- **[Risk]** Hosted Supabase settings are external to the repository. **Mitigation:** require migration application, Auth redirect configuration, private bucket verification, and a recorded smoke result before declaring the deployment live.
- **[Risk]** Docker Desktop or BuildKit may be unavailable in a local development environment. **Mitigation:** keep both images buildable from the repository root and repeat the same builds in CI or the Railway builder.
- **[Risk]** A worker crash can exhaust the Free-plan restart limit. **Mitigation:** keep the process long-running, set `On Failure`, inspect logs, and use the existing stale-job reclaim path.

## Migration Plan

1. Apply the Docker and environment-contract changes on `deploy/railway-mvp`.
2. Build the web image and worker image from the repository root context in CI or a machine with Docker.
3. Create or select a dedicated hosted Supabase project and apply all repository migrations.
4. Verify the private `lab-documents` bucket and configure Auth Site URL plus `/auth/callback`.
5. Create a Railway project from the target branch.
6. Create the web service with the root Dockerfile and the worker service with `/worker/Dockerfile`.
7. Add build-time public variables and runtime server/worker secrets through Railway Variables.
8. Deploy web, then worker, and execute the synthetic upload-to-timeline smoke flow.
9. Roll back by redeploying the previous image or previous commit; do not roll back database migrations automatically. Supabase migrations are forward-only unless a separately reviewed rollback exists.

## Open Questions

- Which Railway account, region, and custom domain will be used?
- Which hosted Supabase project and Auth email delivery settings will be used?
- Which AI provider and model budget are approved for the synthetic MVP?
- What maximum PDF/image size and page count should the Free-tier worker accept?
