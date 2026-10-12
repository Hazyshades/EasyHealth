## Why

EasyHealth already has a Dockerized Next.js web service and a long-running document worker, but the worker image does not use a deterministic dependency-install contract for the repository's separate worker lockfile. A Railway MVP needs a repeatable web/worker deployment path that preserves the current Supabase-backed upload pipeline without introducing physician-patient sharing or public report capabilities.

## What Changes

- Make the web and worker Docker builds reproducible from the repository root context.
- Define Railway service configuration for one public Next.js service and one private persistent worker service.
- Make the build-time and runtime environment contract explicit for Supabase, the application origin, the upload broker, and AI extraction.
- Keep document originals and derived artifacts in private Supabase Storage; do not use Railway filesystem state as application storage.
- Document hosted Supabase migration, Auth redirect, secret, and smoke-test handoff requirements.
- **BREAKING** Do not expose or enable public share links, trusted-ingress routes, physician-patient relationship features, or doctor-facing sharing in this MVP deployment.

## Capabilities

### New Capabilities

- `railway-mvp-deployment`: Reproducible Docker and Railway deployment contract for the private EasyHealth MVP.

### Modified Capabilities

None. This change alters deployment packaging and operations, not product-domain requirements.

## Impact

- `Dockerfile` and `worker/Dockerfile` build context and dependency installation.
- `.env.example` and deployment configuration for Railway variables.
- Optional Railway service configuration files and deployment handoff documentation.
- Hosted Supabase Auth, migrations, private storage, and service-role access.
- Railway web and worker services, resource limits, restart behavior, and build/runtime verification.
- Public share routes remain outside the deployment contract and are not a launch dependency.
