# Package-manager bootstrap

EasyHealth uses the pnpm version pinned in `package.json`. Corepack activates that version without requiring a globally installed pnpm.

## Context

Supported Node runtimes include Corepack. A machine without a pnpm shim can use the `corepack pnpm` command directly; this matters on Windows installations where `corepack enable` cannot write system-wide shims without elevation.

## Bootstrap pnpm

From the repository root, activate the pinned pnpm release and install dependencies without creating a global shim:

```bash
corepack prepare pnpm@9.15.4 --activate
corepack pnpm install --frozen-lockfile
```

If your Node installation permits shim creation, you may additionally run `corepack enable` once and then use `pnpm` directly. The package script below refreshes the pinned Corepack release; invoke it through Corepack on a fresh machine:

```bash
corepack pnpm run pnpm:bootstrap
```

After activation, use `corepack pnpm <command>` until a local pnpm shim is available. This is equivalent to `pnpm <command>` for repository scripts.

## npm fallback

If Corepack is unavailable in an emergency local environment, npm can install dependencies from `package-lock.json`:

```bash
npm ci
```

This fallback is not interchangeable with the pnpm workflow: do not use it to update `pnpm-lock.yaml`, run CI commands, or substitute a different package-manager version. Restore the Corepack path before making dependency changes.

## Verification

```bash
corepack pnpm check:package-manager
```

The verifier confirms that `package.json` still declares `pnpm@9.15.4`. CI enables Corepack before it sets up or invokes pnpm.