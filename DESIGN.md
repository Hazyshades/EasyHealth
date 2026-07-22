---
name: EasyHealth
description: A calm, trustworthy personal health record app with an indigo-and-teal system UI on clean neutral surfaces.
colors:
  foreground: "oklch(0.145 0 0)"
  background: "oklch(1 0 0)"
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  border: "oklch(0.922 0 0)"
  input: "oklch(0.922 0 0)"
  ring: "oklch(0.708 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
  canvas: "#f8fafc"
  page-bg: "#eaf8fc"
  brand: "#4f46e5"
  brand-soft: "#eef2ff"
  health: "#008c84"
  text-primary: "#0f172a"
  text-secondary: "#64748b"
  text-muted: "#94a3b8"
  chip-green-bg: "#eaf8ef"
  chip-green-text: "#1e7a4d"
typography:
  display:
    fontFamily: "var(--font-figtree)"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "var(--font-figtree)"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "var(--font-figtree)"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "var(--font-figtree)"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-figtree)"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.06em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  card: "18px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  page: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "oklch(0.205 0 0 / 0.9)"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.xl}"
    padding: "8px 16px"
  surface-card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "24px"
  nav-item:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.xl}"
    padding: "11px 12px"
  search-input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "0 12px 0 36px"
---

# Design System: EasyHealth

## 1. Overview

**Creative North Star: "The Calm Record"**

EasyHealth is a task-first personal health record. The interface reads as a quiet, well-lit workspace: white surfaces, a restrained indigo accent, and teal health signals that only appear when they carry meaning. The goal is to remove noise so users can review labs, documents, and summaries without anxiety. Motion is short and reactive, not theatrical. Density is moderate — enough to act, not so much that medical data feels overwhelming.

This system explicitly rejects the anti-references in PRODUCT.md: it is not a developer console, it does not use alarmist clinical language, and it does not force technical choices before the source document supports them.

**Key Characteristics:**
- One sans-serif family (Figtree) carries every UI surface.
- Color strategy is **restrained**: indigo is the primary action color; teal signals health/biology; neutrals carry 80%+ of the surface.
- Surfaces are mostly flat; shadows are used sparingly and structurally.
- Rounded corners are modest — buttons and inputs stay near-rectangular, while chips and status pills are fully rounded.
- Motion is 150–250 ms, transform/opacity only, with a strong ease-out curve.

## 2. Colors

The palette is built around neutral ink and white, with indigo for primary actions and teal for health-specific contexts.

### Primary
- **Soft Indigo** (`oklch(0.205 0 0)` / `#4f46e5`): Primary actions, active navigation, focus rings, and the brand mark.
- **Indigo Tint** (`#eef2ff`): Soft hover/selected backgrounds, badge backgrounds, and logo container fill.

### Health / Semantic Accents
- **Health Teal** (`#008c84`): Body-map markers, health-visualization accents, upload-drop active state, and links back to health views.
- **Positive Green** (`#eaf8ef` bg / `#1e7a4d` text): "Normal" or "completed" status chips.

### Neutral
- **True White** (`oklch(1 0 0)`): App cards, popovers, modal backgrounds.
- **Canvas** (`#f8fafc`): Main content area behind cards and tables; table row hover wash.
- **Page Wash** (`#eaf8fc`): Body-map background / subtle health-tinted zones.
- **Ink Primary** (`#0f172a`): Headings, primary text.
- **Ink Secondary** (`#64748b`): Labels, supporting text, placeholder hints.
- **Ink Muted** (`#94a3b8`: Disabled hints, metadata, table headers.
- **Hairline** (`#e5eaf0` / `oklch(0.922 0 0)`): Card, table, and section borders.
- **Destructive** (`oklch(0.577 0.245 27.325)`): Errors and destructive actions.

### Named Rules
**The One Accent Rule.** Indigo is the only action accent. Use it on ≤10% of any screen. Teal and green are health-context colors, not decorative accents.

## 3. Typography

**Display / UI Font:** Figtree (Google Fonts), with system-ui fallback.
**Mono Font:** Geist Mono, for timestamps, identifiers, and any code/metadata displays.

**Character:** Friendly geometric sans in humanist proportions. One family carries everything — hierarchy is created with weight, size, and color, not by mixing faces.

### Hierarchy
- **Headline** (`text-2xl`, weight 700, tracking `-0.01em`, line-height 1.2): Page titles in the TopBar and major section headers.
- **Title** (`text-xl / md:text-2xl`, weight 600, line-height 1.2, tracking `-0.01em`): `eh-page-title`. Section/page titles in `PageHeader`.
- **Body** (`text-sm` / `0.9375rem` desktop, weight 400, line-height 1.5): Paragraphs, descriptions, card copy. Max line length 65–75ch for prose.
- **Label** (`text-xs`, weight 500, uppercase, letter-spacing `0.06em`, color text-muted): Data-table headers, filter labels, small captions.
- **Metric** (`text-4xl`, weight 600, tracking tight): Dashboard metric-card values.

### Named Rules
**The Balance Rule.** Use `text-wrap: balance` on `h1`–`h3` and `text-wrap: pretty` on long prose blocks.
**The 65ch Rule.** Body paragraphs, disclaimers, and explanatory copy are capped at 65–75ch.

## 4. Elevation

The system is mostly flat. Depth is usually conveyed by a slight background shift (`white` card on `canvas`) or a hairline border, not by drop shadow.

### Shadow Vocabulary
- **Card Resting** (`0 1px 3px rgba(15,23,42,0.04), 0 8px 24px -8px rgba(15,23,42,0.08)`): SurfaceCard default.
- **Card Hover** (`0 4px 12px rgba(15,23,42,0.08), 0 16px 32px -12px rgba(15,23,42,0.12)`): SurfaceCard hover lift.
- **Active Nav** (`0 10px 22px rgba(79,70,229,0.24)`): Active nav-item glow.
- **Menu / Dropdown** (`shadow-md`, 0–4px blur): Radix menus and filter panels.

### Named Rules
**The One-or-the-Other Rule.** A card at rest may have a border OR a small structural shadow, not a 1px border plus a wide diffuse shadow. Prefer borders for scannable lists and tables; reserve shadows for hover feedback and floating menus.

## 5. Components

### Buttons
- **Shape:** `rounded-md` (8px). Heights: 32px sm, 36px default, 40px lg, 36px icon.
- **Primary:** Near-black fill (`bg-primary`), white text, subtle shadow-xs, hover at 90% opacity.
- **Outline:** White fill, medium gray border, hover tint (`bg-accent`).
- **Ghost:** Transparent, hover tint only.
- **Link:** Primary text with underline on hover.
- **Destructive:** Red fill, white text.
- **Focus:** 3px ring in the “ring” color (indigo/neutral), visible only on keyboard focus.

### SurfaceCard / MetricCard
- **Corner Style:** `18px` (`rounded-[18px]`). *Aspiration: reduce to 14–16px to stay within the product-card ceiling.*
- **Background:** white, border `var(--eh-border)`.
- **Shadow:** Card Resting shadow, lifted on hover with a small `-translate-y-0.5`.
- **Internal Padding:** `16px` (sm), `24px` (md, default), `32px` (lg).

### StatusChip
- **Style:** Pill (`rounded-full`), border, small text, color-coded background.
- **Variants:** default, success (green), warning (amber), error (red), info (sky), neutral (canvas).
- **Rule:** always use text + hue; never color alone.

### FilterChip
- **Style:** Pill (`rounded-full`), border.
- **Inactive:** white bg, gray border, secondary text.
- **Active:** indigo border + soft indigo bg + indigo text.

### SearchInput
- **Style:** `rounded-xl` (14px), white bg, hairline border, left Search icon, focus ring on brand.
- **Height:** 40px.

### NavItem
- **Style:** `rounded-[14px]` (14px), 44px tall min, gap 10px, 12px horizontal padding.
- **Active:** indigo fill, white text, subtle indigo shadow.
- **Inactive:** slate text, hover to canvas gray.
- **Collapsed sidebar:** icon-only with `sr-only` label and visible `title` attribute for discoverability.
- **Focus:** 2px indigo ring + ring-offset.

### DataTable
- **Container:** `rounded-[14px]` (14px), white bg, border, subtle shadow, `overflow-x-auto`.
- **Header:** canvas background, uppercase label text, bottom hairline.
- **Rows:** divide-y soft, hover wash at 80% canvas opacity.
- **Cells:** 16px horizontal, 14px vertical padding.

### Inputs / Selects
- **Input:** `rounded-md` (8px), transparent bg, hairline border, focus ring.
- **Select:** same radius, subtle chevron icon, popper-positioned content with zoom/fade animation.

## 6. Do's and Don'ts

### Do:
- **Do** use Figtree for every label, button, heading, and body string; Geist Mono only for code, identifiers, or timestamps.
- **Do** keep page titles to the `eh-page-title` scale: concise, balanced, ≤ 75ch.
- **Do** reserve indigo for primary actions and current selection; it should never become the dominant screen color.
- **Do** pair status colors with text and/or shape so meaning survives for color-blind users.
- **Do** use `focus-visible:` rings for every interactive control.
- **Do** support `prefers-reduced-motion` for any custom animations (already in place for body-map animations).
- **Do** use rounded corners consistently: buttons and inputs 8px, nav items and cards 14px, badges/chips/pills full.

### Don't:
- **Don't** use side-stripe borders (`border-left/right` ≥ 2px) as accent on cards, alerts, or list items.
- **Don't** use gradient text (`background-clip: text`) or gradient buttons for decoration.
- **Don't** use glassmorphism or backdrop blur as a default card style. Mobile bottom nav uses a minimal blur only because it overlays content.
- **Don't** pair a 1px border on cards with a wide diffuse shadow (blur ≥ 16px). Use a border OR a small shadow, not both as decoration.
- **Don't** exceed 16px corner radius on cards/sections. Buttons and tags can be fully rounded, but surface cards should top out at 14–16px.
- **Don't** repeat the same icon-plus-heading-plus-body card pattern identically across every module without varying density, layout, or content type.
- **Don't** use tiny uppercase tracked eyebrows above every section unless they are genuine data-table header labels.
- **Don't** rely on color alone to communicate result status (normal/abnormal) — always add text and shape context.
- **Don't** introduce display fonts, serif pairings, or multi-font compositions in the product UI.
