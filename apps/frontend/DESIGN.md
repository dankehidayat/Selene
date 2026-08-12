---
name: Selene
description: Lunar instrumentation — a calm, precise energy & climate telemetry dashboard
colors:
  instrument-signal-blue: "#3B82F6"
  signal-blue-deep: "#2563EB"
  signal-blue-deeper: "#1D4ED8"
  amber-current: "#F59E0B"
  violet-apparent: "#8B5CF6"
  red-reactive: "#EF4444"
  emerald-comfort: "#10B981"
  cyan-cool: "#06B6D4"
  economical-green: "#2ECC71"
  wasteful-red: "#E74C3C"
  paper-light: "#EEF1F6"
  night-navy: "#0B0F17"
  night-void: "#030712"
  surface-white: "#FFFFFF"
  surface-dark: "#111827"
  ink-light: "#111827"
  ink-dark: "#F3F4F6"
  muted-light: "#6B7280"
  muted-dark: "#9CA3AF"
  hairline-light: "#F3F4F6"
  hairline-dark: "#1F2937"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 2vw, 1.5rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal-blue-deep}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-primary-hover:
    backgroundColor: "{colors.signal-blue-deeper}"
  control-chrome:
    backgroundColor: "rgba(249, 250, 251, 0.9)"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  card:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.xl}"
    padding: "20px"
---

# Design System: Selene

## Overview

**Creative North Star: "Lunar Instrumentation"**

Selene reads like a precision instrument bathed in moonlight. It is, above all,
a measuring device: crisp tabular numerals, clean dials, unambiguous states, and
an engineering-grade clarity that treats every visitor as an operator who needs
the truth of a reading, not decoration. The lunar half is the atmosphere, never
the content — a cool, quiet celestial wash (the mesh + grain background) that
sits behind the instruments and reminds you of the brand without ever shouting.
Technical first, poetic second.

The atmosphere is **calm and precise**: generous negative space, restrained
color, and numbers that align to the pixel. Data is the protagonist; chrome is
a supporting actor. Color is used with intent — a distinct hue per metric so a
glance separates series instantly — while interaction itself stays within a cool,
neutral family. Depth is soft: cards lift gently off the background on diffuse
shadows, floating rather than pressing. Motion is brief, eased, and functional —
an entrance, a press, a state change — and is disabled when the visitor asks for
reduced motion.

**Key Characteristics:**
- Single typeface (Inter) used across every role; hierarchy from weight and size, not family.
- Cool, airy layouts with generous whitespace; mobile-first.
- Categorical data palette (blue / amber / violet / red / emerald) — one distinct hue per metric.
- Soft lifted cards on hairline borders over a textured mesh background.
- Tactile, confident controls: subtle inset rings, gentle press-scale, decisive focus states.
- Tabular numerals for every measurement so columns of figures align.

## Colors

A cool, lunar palette: a near-neutral canvas and ink, one committed interactive
blue, and a categorical set reserved strictly for data.

### Primary
- **Instrument Signal Blue** (#3B82F6): the live signal. Chart series (power),
  active nav, focus rings, info accents, and the flagship data color.
- **Signal Blue Deep** (#2563EB): primary button fill and saturated interactive
  states; hover deepens to **Signal Blue Deeper** (#1D4ED8).

### Neutral
- **Paper Light** (#EEF1F6): the light-mode page canvas beneath the mesh wash.
- **Night Navy** (#0B0F17): the dark-mode page canvas; **Night Void** (#030712)
  is the darkest root (html.dark).
- **Surface White** (#FFFFFF) / **Surface Dark** (#111827): card and panel fills.
- **Ink Light** (#111827) / **Ink Dark** (#F3F4F6): primary text on light/dark.
- **Muted Light** (#6B7280) / **Muted Dark** (#9CA3AF): secondary text, axis
  labels, chart ticks.
- **Hairline Light** (#F3F4F6) / **Hairline Dark** (#1F2937): card and divider
  borders.

### Data (categorical)
- **Amber Current** (#F59E0B): electric current, and the "warm" comfort band.
- **Violet Apparent** (#8B5CF6): apparent power; also a dark-mode mesh wash.
- **Red Reactive** (#EF4444): reactive power, temperature, and the HOT band.
- **Emerald Comfort** (#10B981): the COMFORTABLE comfort band; **Economical Green**
  (#2ECC71) marks efficient energy; **Wasteful Red** (#E74C3C) marks waste.
- **Cyan Cool** (#06B6D4): the COOL comfort band.

### Named Rules
**The One Signal Rule.** Instrument Signal Blue is the only hue that means
"interactive." Data series may use the full categorical palette, but actions,
active states, and focus belong to blue alone. Its restraint is what makes it legible.

**The Data-Only Chroma Rule.** Saturated hues exist to separate metrics, not to
decorate. If a color is not encoding a reading or a status, it should be neutral.

## Typography

**Display / Body Font:** Inter (with ui-sans-serif, system-ui, sans-serif fallback)

**Character:** One geometric-humanist grotesque does everything. Hierarchy comes
from weight (400 → 600) and size, never from a second family. Numbers are set in
tabular figures so telemetry columns align. The voice is quiet, exact, and confident.

### Hierarchy
- **Display** (600, clamp 1.25–1.5rem, line-height 1.2, tracking -0.01em): page
  titles and section headings ("Analytics", "Energy Analysis").
- **Title** (600, 15px, line-height 1.3): card and chart titles.
- **Body** (400, 14px, line-height 1.5): descriptions, table cells, prose.
- **Label** (600, 12px, tracking 0.02em, often UPPERCASE): section eyebrows,
  stat-card captions, axis legends.
- **Numerals:** always `tabular-nums` for measurements (voltage, kWh, cost).

### Named Rules
**The Tabular Figures Rule.** Any value a visitor might compare across rows or
over time uses tabular numerals. Shifting digits are a defect.

**The Single-Family Rule.** Inter is the only face. Do not introduce a display
serif or a mono — emphasis comes from weight, size, and case.

## Layout

Mobile-first with a persistent sidebar shell. The sidebar is 248px when expanded
and collapses to a 64px icon rail; the top bar is sticky. Content sits in a
fluid main column with `space-y` rhythm of 24–32px between sections. Stat tiles
lay out `grid-cols-2` on small screens up to `xl:grid-cols-4`; chart + aside
pairs use `lg:grid-cols-[1fr_320px]`. Spacing steps on a 4px base
(sm 8 / md 12 / lg 16 / xl 20 / 2xl 24). Density is comfortable, never cramped:
whitespace is treated as a feature of a calm instrument, not wasted space.
Touch targets respect mobile-first sizing (PRODUCT.md names the smartphone a
primary device).

## Elevation & Depth

**Soft lifted layers.** Cards do not sit flat on the canvas; they float gently
above the mesh background on a diffuse, low-contrast shadow. Depth is ambient
and quiet — never a hard drop shadow, never a heavy outline. In dark mode the
shadow recedes and tonal surface + hairline border carry the separation.
Popovers, dropdowns, and modals lift higher than resting cards to read as
transient overlays.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 1px 2px rgba(16,24,40,0.05), 0 12px 32px -8px rgba(16,24,40,0.10)`):
  the default floating card. A tight contact shadow plus a wide diffuse ambient.
- **Overlay** (`box-shadow: 0 16px 40px -12px rgba(16,24,40,0.16)`): popovers,
  dropdown menus, and modal panels above the page.

### Named Rules
**The Floating Card Rule.** Every resting card carries the soft two-part shadow
and a hairline border; no card uses a hard, close drop shadow. The mesh behind
must remain perceptible around the card's edges.

## Shapes

Rounded and friendly-but-precise. Cards use a generous 16px corner (rounded-2xl);
interactive controls use 8px (rounded-lg) or 12px (rounded-xl); pills and status
chips are fully round (9999px). Borders are hairline (1px) and low-contrast —
structure comes from surface tone and radius, not from heavy strokes. There is no
clipping, no sharp 0px corners on surfaces, and no decorative geometry beyond the
soft corner radius.

## Components

### Buttons
- **Shape:** rounded-lg (8px).
- **Primary:** Signal Blue Deep (#2563EB) fill, white text, padding 6px 12px,
  text-xs/semibold. Hover → #1D4ED8. Focus → 2px blue ring.
- **Tactile press:** `active:scale(0.98)` on all pressable controls for a
  confident, physical response.

### Control Chrome (range pickers, toggles, filter chips)
- **Style:** translucent gray fill (`bg-gray-50/90`, dark `bg-gray-800/70`),
  ink text, inset hairline ring (`ring-1 ring-inset`), rounded-lg, padding 6px 10px.
- **State:** hover darkens fill; `active:scale(0.98)`; focus → 2px blue ring.
  This is the recurring "instrument toggle" look for chart headers.

### Cards / Containers
- **Corner Style:** rounded-2xl (16px).
- **Background:** Surface White (light) / Surface Dark (#111827, dark).
- **Shadow Strategy:** the Floating Card Rule (see Elevation).
- **Border:** 1px Hairline Light / Hairline Dark.
- **Internal Padding:** 20px (p-5); header-to-body gap 16px.

### Stat Tiles
- **Style:** compact card variant; icon (color-coded) + label caption (Label
  style) + large tabular value + optional unit and sub-line.
- **State:** value transitions 0.3s ease on update (live telemetry feedback).

### Tabs (segmented control)
- **Style:** gray-100 (dark gray-800) rounded-xl track with 4px padding; each
  segment is a button with icon + label.
- **State:** active segment lifts to Surface White (dark gray-700) with a soft
  shadow; inactive segments are transparent with muted ink.

### Inputs / Fields
- **Style:** 1px hairline border, Surface White (dark gray-900) fill, rounded-lg,
  text-xs/sm padding 6–8px.
- **Focus:** border shifts to Signal Signal Blue with a soft 2px blue ring.

### Navigation (sidebar)
- **Style:** 248px expanded / 64px icon rail; grouped sections with Label-style
  eyebrows; each item is icon + text (text hidden in compact mode, tooltip via
  aria-label/title).
- **State:** active item gets a tinted fill + ink text; hover lightens fill;
  hairline dividers separate groups in compact mode.

### Signature Component — Mesh + Grain Background
The page canvas is not flat: layered radial gradients (blue / violet / emerald /
sky at low alpha) over Paper Light or Night Navy, plus an SVG fractal-noise grain.
It is the lunar atmosphere. Cards float above it; it never competes with data.
On mobile, prefer `background-attachment: scroll` (or a static gradient) to keep
scroll performance smooth.

## Do's and Don'ts

### Do:
- **Do** keep Instrument Signal Blue exclusive to interactive meaning (The One Signal Rule).
- **Do** set every measurement in tabular numerals and align numeric columns.
- **Do** give cards the soft two-part shadow + hairline border so they float.
- **Do** use a distinct categorical hue per metric and keep it consistent across charts.
- **Do** keep motion short (0.2–0.28s ease-out) and honor `prefers-reduced-motion`.
- **Do** design mobile-first; verify touch targets and single-column flow before desktop.

### Don't:
- **Don't** introduce a second typeface, gradient text, or glass/blur decoration on scroll-heavy surfaces.
- **Don't** use saturated color for anything that is not data or status.
- **Don't** use hard drop shadows, heavy outlines, or colored side borders on cards.
- **Don't** fabricate readings, users, or testimonials — real data only (PRODUCT.md).
- **Don't** let the mesh background overpower content; it is atmosphere, not subject.
