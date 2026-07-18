## Why

The app already defines a motion language — `--ease-out-strong`, enter keyframes, transform+opacity transitions (see `src/app/globals.css:210-302`) — but it is applied to **only one component** (`.body-map-*`). The rest of the UI has no animation at all: the sidebar nav (`src/components/ui/nav-item.tsx`), tab/route switches, and buttons give no press feedback, and route changes snap instantly with no transition. Users report that clicking nav items and buttons provides no visual acknowledgment ("непонятно что я нажал") and that navigation feels lifeless. This is a perceived-performance / polish gap, not a data-speed issue.

Note: this change intentionally scopes to the **motion/animation layer** only. The separate "tabs open slowly / data loads slowly" symptom (root cause: client-fetch-after-navigation with no caching — `src/app/app/*/page.tsx` are all `"use client"` and fetch via `/api/*` in `useEffect`, with no SWR/React Query) is a distinct, larger architectural fix and is proposed as its own sibling change (see Non-Goals).

## What Changes

- **Promote orphaned motion tokens.** Move the transition tokens currently scoped to `.body-map-*` in `src/app/globals.css` into a shared, app-wide transition utility (e.g. a `--eh-ease` curve + a duration scale: 100/150/200/250ms) usable by nav, buttons, cards, and route transitions.
- **Add a route enter transition.** Introduce `src/app/app/template.tsx` that wraps routed content in a `motion` (Framer Motion v12, already a dependency) fade + subtle scale/translate on every `/app/*` navigation, so route changes animate consistently.
- **Add press/active feedback to controls.** Give nav items (`src/components/ui/nav-item.tsx`) and the shared button (`src/components/ui/button.tsx`) an `active:scale` + transition, matching the only existing example (Sign-out in `src/components/layout/top-bar.tsx:33` uses `active:scale-[0.97]`).
- **Guard with `prefers-reduced-motion`.** All new motion MUST be disabled (or reduced to opacity-only) when the user requests reduced motion, consistent with accessibility expectations.
- **No behavior change.** Navigation targets, routing, data flows, and existing color/active states are unchanged — only the *feel* of interaction and transition is added.

## Non-Goals / Out of Scope

- **Client-side data-fetch latency (RC-A).** Converting `src/app/app/*` pages from client-fetch-in-`useEffect` to a cached data layer (SWR/React Query or Server Components) is a separate, larger change and is NOT part of this proposal. It should be proposed as its own change.
- Restyling the body-map component (its motion already works).
- Changing navigation structure, labels, or routes.

## Capabilities

### New Capabilities

- None. This refactors the existing motion system; it introduces no new product capability.

### Modified Capabilities

- `app-shell`: extend the authenticated app shell requirements with motion/transition expectations — a route enter transition on `/app/*` navigation, press/active feedback on nav items and primary buttons, and `prefers-reduced-motion` support. (See delta spec `specs/app-shell/spec.md`.)
## Tracking

- GitHub issue: #85 — https://github.com/Hazyshades/EasyHealth/issues/85
