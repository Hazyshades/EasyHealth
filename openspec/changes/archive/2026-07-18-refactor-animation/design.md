## Context

The authenticated app shell (`auth-shell` domain) renders the sidebar nav (`src/components/layout/sidebar.tsx` → `src/components/ui/nav-item.tsx`), the top bar (`src/components/layout/top-bar.tsx`), and all `/app/*` routes. A coherent motion language already exists in `src/app/globals.css:210-302` (`--ease-out-strong`, `body-map-enter` / `body-map-summary-enter` keyframes, transform+opacity transitions), but it is **scoped exclusively to `.body-map-*`**. The rest of the shell has:

- `nav-item.tsx:47` → only `transition-colors duration-150` (color tween, no transform/press feedback).
- `top-bar.tsx:33` → the *only* control with press feedback (`active:scale-[0.97]`), on Sign-out alone.
- No `template.tsx` / `loading.tsx` anywhere under `src/app` → route changes snap with no transition.
- `motion` (Framer Motion v12, `package.json` dep `^12.42.0`) is available but unused for shell transitions.

This design adds a consistent, accessible motion layer over the existing shell without altering routing, data flow, or visual identity.

## Goals / Non-Goals

**Goals:**
- One shared motion token set usable by nav, buttons, cards, and route transitions.
- Animated route enter transition on every `/app/*` navigation.
- Press/active feedback on nav items and primary buttons.
- Full `prefers-reduced-motion` support (no motion for users who opt out).

**Non-Goals:**
- Fixing client-side data-fetch latency (separate change).
- Changing nav structure, labels, routes, or color/active states.
- Restyling the body-map component.

## Decisions

### D1 — Promote motion tokens to app-wide utilities (globals.css)
Define a shared duration scale and keep the existing `--ease-out-strong` (`:root` at `globals.css:212`), then expose small utility classes:
```css
:root { --eh-ease: cubic-bezier(0.23, 1, 0.32, 1); --eh-dur-fast: 120ms; --eh-dur-med: 180ms; --eh-dur-slow: 250ms; }
.eh-press { transition: transform var(--eh-dur-fast) var(--eh-ease); }
.eh-press:active { transform: scale(0.98); }
```
**Rationale:** single source of truth; today the tokens are duplicated and stranded inside `.body-map-*`. **Alternative considered:** per-component inline Tailwind — rejected as it re-fragments the system and repeats the original mistake.

### D2 — Route enter transition via `src/app/app/template.tsx`
Next.js `template.tsx` re-mounts its subtree on every navigation, making it the correct hook for an **enter** animation. Implement with `motion` (already a dependency) for transform+opacity:
```tsx
"use client";
import { motion } from "motion/react";
import { useReducedMotion } from "motion/react";
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="contents"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
    >{children}</motion.div>
  );
}
```
**Rationale:** `motion` is already in `package.json` and uses the same easing the body-map uses, so the feel stays consistent; `useReducedMotion` gives a built-in a11y switch. **Alternative considered:** pure-CSS keyframe in `template.tsx` — simpler but offers no coordinated reduced-motion handling and no future exit/layout animation path. **Caveat:** App Router `template.tsx` animates **enter only** (no cross-route exit without `AnimatePresence` + a shared layout); enter-only is sufficient for the reported symptom.

### D3 — Press feedback via Tailwind utilities (no JS)
Add `eh-press` (D1) to `nav-item.tsx` (both desktop and `compact` mobile branches) and to `src/components/ui/button.tsx`. This mirrors the existing Sign-out pattern (`top-bar.tsx:33`) but as a shared utility. **Rationale:** CSS-only press feedback is zero-runtime, no re-render, and identical across controls. **Alternative considered:** `motion` `whileTap` — rejected; unnecessary JS for a static scale and would diverge from the button primitive.

### D4 — Global reduced-motion safety net
Add to `globals.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```
plus the `useReducedMotion()` check in `template.tsx`. **Rationale:** belt-and-suspenders so any future motion also respects the OS setting; the existing `.body-map-*` animations are also neutralized.

## Risks / Trade-offs

- **`template.tsx` wrapper div:** a wrapping element can disturb flex/grid layouts. Mitigation: use `className="contents"` so the motion node does not create a layout box (verify in browser across Dashboard, Health Profile, Documents).
- **Bundle:** importing `motion/react` in `template.tsx` adds client JS, but `motion` is already a dependency and the template is the only new client boundary — negligible.
- **Over-animation / jank:** keep durations ≤250ms and animate **transform+opacity only** (GPU-composited), per the existing Emil design-eng comment at `globals.css:210`. Avoid animating layout properties (width/height/margin).
- **Reduced-motion regression:** if the safety-net media query is forgotten, motion could fire for sensitive users — D4 covers it explicitly.
- **Enter-only transitions:** route exits are not animated; acceptable and called out in D2.
