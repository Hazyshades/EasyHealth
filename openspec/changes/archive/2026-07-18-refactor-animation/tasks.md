## 1. Shared motion tokens (globals.css)

- [x] 1.1 Add `--eh-ease`, `--eh-dur-fast/med/slow`, and an `.eh-press` utility class to `src/app/globals.css` (keep existing `--ease-out-strong` at `:root`)
- [x] 1.2 Verify the `.body-map-*` motion (badges, connectors, markers) still works unchanged after the token promotion

## 2. Route enter transition

- [x] 2.1 Create `src/app/app/template.tsx` as a `"use client"` `motion.div` wrapper using `motion/react` with fade + translate enter (≤250ms, `--eh-ease`)
- [x] 2.2 Use `className="contents"` on the wrapper so it does not alter existing flex/grid layouts
- [x] 2.3 Gate the enter animation with `useReducedMotion()` from `motion/react` (no transform when reduced)

## 3. Press / active feedback

- [x] 3.1 Apply `.eh-press` to both branches of `src/components/ui/nav-item.tsx` (desktop + `compact` mobile)
- [x] 3.2 Apply `.eh-press` to the primary `Button` in `src/components/ui/button.tsx` (preserve existing variant styles)
- [x] 3.3 Confirm the Sign-out button in `src/components/layout/top-bar.tsx:33` remains consistent with the shared utility

## 4. Reduced-motion safety net

- [x] 4.1 Add a `prefers-reduced-motion: reduce` media query to `src/app/globals.css` that neutralizes `animation-duration` / `transition-duration`
- [x] 4.2 Confirm nav press, button press, route enter, and `.body-map-*` animations are all neutralized under reduced motion

## 5. Verification

- [x] 5.1 Run `pnpm typecheck` (or `corepack pnpm typecheck`) and fix any type errors
- [x] 5.2 Run `pnpm build` and confirm no new warnings/errors
- [ ] 5.3 Smoke-test in browser: navigate Dashboard → Health Profile → Biomarkers → Documents; confirm fade/translate enter, nav/button press feedback, and that layouts are intact
- [ ] 5.4 Toggle OS reduced-motion and confirm all motion is disabled

## Tracking

- GitHub issue: #85 — https://github.com/Hazyshades/EasyHealth/issues/85 (motion/animation layer only; client data-fetch perf is a separate change)
