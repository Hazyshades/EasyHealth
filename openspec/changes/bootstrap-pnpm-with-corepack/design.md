## Context

`package.json` declares `pnpm@9.15.4`, but contributors can start with no global pnpm shim. CI currently provisions pnpm with `pnpm/action-setup`, while local setup has no checked-in bootstrap or recovery guide. Node 22 supplies Corepack, which can activate the exact package manager version declared by the project. On Windows systems where Node is installed under `Program Files`, `corepack enable` can require elevation to write global shims.

## Goals / Non-Goals

**Goals:**
- Activate Corepack before CI invokes pnpm.
- Give local contributors a no-admin command that runs the pinned package manager.
- Check package-manager metadata without depending on a globally installed pnpm.

**Non-Goals:**
- Supporting arbitrary pnpm versions.
- Replacing pnpm with npm or changing dependency lockfile policy.
- Requiring contributors to modify system-wide package-manager shims.

## Decisions

### Use explicit Corepack activation in CI

Run `corepack enable` after Node setup and before pnpm setup/install. Hosted CI runners permit this operation, which makes the package-manager source explicit before pnpm commands execute.

### Use Corepack's direct pnpm command locally

Document `corepack prepare pnpm@9.15.4 --activate` and `corepack pnpm` as the default local path. `corepack enable` is optional because it can fail without elevation on Windows. The `pnpm:bootstrap` script refreshes the pinned release when invoked through `corepack pnpm`.

Alternative: use a `prepare` package lifecycle script. Rejected because it runs too late when pnpm is missing and can add installation-time side effects.

### Verify declared package-manager policy statically

A small Node verifier reads `package.json` and confirms the exact `packageManager` declaration. CI's install step remains the executable Corepack/pnpm proof; local verification does not mutate global shims.

## Risks / Trade-offs

- `corepack pnpm` is more verbose than a global pnpm shim but works without administrator access.
- Corepack can be disabled by a host image; the command fails clearly instead of silently falling back to an arbitrary global pnpm.
- npm remains an emergency metadata/install fallback only; it cannot replace pnpm for locked CI commands.