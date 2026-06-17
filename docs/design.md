# Design System — PSB (Personal Smart Banking)

## Overview

PSB uses a CSS custom-property–driven design system that supports 5 runtime-switchable color themes, two font families, a consistent spacing/radius scale, and CSS-powered accessibility modes. All design tokens live in `frontend/src/index.css`; Tailwind extends those tokens via `frontend/tailwind.config.js`.

---

## Typography

| Role | Font | Fallbacks | Used For |
|------|------|-----------|---------|
| Display | **Fraunces** | Georgia, serif | All headings `h1–h6`, letter-spacing `-0.02em` |
| Body | **Manrope** | Segoe UI, sans-serif | Body text, labels, UI copy |

`--font-scale: 1` controls a global font-size multiplier (`font-size: calc(16px * var(--font-scale))`), used by the Large Text accessibility mode.

---

## Spacing & Shape

| Token | Value | Usage |
|-------|-------|-------|
| `--border-radius` | `16px` | Default card/container radius |
| `--border-radius-sm` | `10px` | Small elements (badges, chips) |
| `--border-radius-lg` | `20px` | Large cards, modals |
| `--border-radius-xl` | `28px` | Hero/feature cards |
| `--sidebar-width` | `272px` | Expanded sidebar |
| `--sidebar-collapsed` | `84px` | Collapsed sidebar |
| `--header-height` | `76px` | Top navigation bar |

---

## Motion / Transitions

| Token | Value |
|-------|-------|
| `--transition-fast` | `0.15s ease` |
| `--transition-normal` | `0.25s ease` |
| `--transition-slow` | `0.4s cubic-bezier(0.4, 0, 0.2, 1)` |

---

## Semantic / Status Colors (shared across all themes)

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#0f9d58` | Positive states, gains |
| `--success-bg` | `rgba(15, 157, 88, 0.12)` | Success badge backgrounds |
| `--warning` | `#d97706` | Alerts, caution states |
| `--warning-bg` | `rgba(217, 119, 6, 0.12)` | Warning badge backgrounds |
| `--danger` | `#dc2626` | Errors, losses, critical alerts |
| `--danger-bg` | `rgba(220, 38, 38, 0.12)` | Danger badge backgrounds |
| `--info` | `#2563eb` | Informational states |
| `--info-bg` | `rgba(37, 99, 235, 0.12)` | Info badge backgrounds |

---

## Chart Colors

Defined in `frontend/src/theme/chartTheme.ts`. Used across all themes (chart colors do not change per theme).

| Name | Hex | Role |
|------|-----|------|
| Primary | `#0ea5e9` | Main data series |
| Secondary | `#14b8a6` | Secondary data series |
| Accent | `#f59e0b` | Highlight / third series |
| Danger | `#ef4444` | Negative / loss data |
| Success | `#22c55e` | Positive / gain data |
| Violet | `#8b5cf6` | Additional series |
| Cyan | `#06b6d4` | Additional series |
| Rose | `#f43f5e` | Additional series |

**Ordered palette** (used for auto-assigning series colors):
`#0ea5e9` → `#14b8a6` → `#f59e0b` → `#8b5cf6` → `#22c55e` → `#f43f5e` → `#06b6d4` → `#ef4444`

Chart grid lines: `rgba(100, 116, 139, 0.18)` | Chart axis labels: `#64748b`

---

## The 5 Color Themes

Themes are applied via `data-theme` attribute on `<html>`. Switching is handled by Zustand store (`useUIStore`) and persisted to the user profile in the database.

**Theme cycle order:** `linen → midnight → sepia → aurora → graphite → linen`

---

### 1. Linen (Default)

> Bright editorial surface — warm off-white with teal and amber accents. The default experience.

| Token | Hex / Value | Description |
|-------|-------------|-------------|
| `--bg-primary` | `#f4efe7` | Main page background — warm linen |
| `--bg-secondary` | `#fbf7f1` | Secondary background — near white |
| `--bg-card` | `#fffdf8` | Card surfaces |
| `--bg-card-hover` | `#fffaf3` | Card hover state |
| `--bg-input` | `#f7f2ea` | Input field backgrounds |
| `--bg-sidebar` | `rgba(255, 252, 247, 0.82)` | Frosted-glass sidebar |
| `--text-primary` | `#142033` | Body text — deep navy-black |
| `--text-secondary` | `#4b5b70` | Secondary labels |
| `--text-muted` | `#73819a` | Placeholder / de-emphasized text |
| `--accent-primary` | `#0f766e` | CTA buttons, links — teal |
| `--accent-primary-hover` | `#115e59` | Teal hover state (darker) |
| `--accent-secondary` | `#ca8a04` | Secondary accent — amber |
| `--accent-gradient` | `linear-gradient(135deg, #0f766e 0%, #14b8a6 55%, #f59e0b 100%)` | Teal → mid-teal → amber gradient |
| `--bg-glow-a` | `rgba(20, 184, 166, 0.18)` | Radial glow top-left — teal |
| `--bg-glow-b` | `rgba(245, 158, 11, 0.14)` | Radial glow top-right — amber |
| `--border-color` | `rgba(20, 32, 51, 0.12)` | Subtle borders |
| `--shadow-sm` | `0 1px 2px rgba(20, 32, 51, 0.05)` | Micro shadow |
| `--shadow-md` | `0 12px 28px rgba(20, 32, 51, 0.08)` | Card shadow |
| `--shadow-lg` | `0 24px 52px rgba(20, 32, 51, 0.12)` | Elevated modal shadow |
| `--shadow-glow` | `0 0 28px rgba(15, 118, 110, 0.18)` | Teal glow on focused elements |

---

### 2. Midnight

> High-contrast dark mode — deep navy backgrounds with cyan-blue accents.

| Token | Hex / Value | Description |
|-------|-------------|-------------|
| `--bg-primary` | `#07111f` | Darkest navy — main background |
| `--bg-secondary` | `#0d1728` | Secondary surface |
| `--bg-card` | `#0f1b31` | Card surfaces |
| `--bg-card-hover` | `#12213a` | Card hover — slightly lighter |
| `--bg-input` | `#12243e` | Input field backgrounds |
| `--bg-sidebar` | `rgba(8, 15, 28, 0.9)` | Near-opaque dark sidebar |
| `--text-primary` | `#eef4ff` | Body text — cool off-white |
| `--text-secondary` | `#b6c2d8` | Secondary labels — blue-gray |
| `--text-muted` | `#7f8ba3` | Muted text |
| `--accent-primary` | *(inherits Linen)* `#0f766e` → overridden by glow colors | Glow: cyan `#0ea5e9` |
| `--bg-glow-a` | `rgba(14, 165, 233, 0.2)` | Cyan radial glow |
| `--bg-glow-b` | `rgba(45, 212, 191, 0.16)` | Teal radial glow |
| `--border-color` | `rgba(176, 195, 224, 0.14)` | Cool-tinted subtle border |
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.3)` | Heavy micro shadow |
| `--shadow-md` | `0 16px 32px rgba(0, 0, 0, 0.24)` | Deep card shadow |
| `--shadow-lg` | `0 28px 60px rgba(0, 0, 0, 0.32)` | Strong elevated shadow |

*Note: accent-primary, accent-secondary, accent-gradient, and status colors inherit from the Linen root unless further overridden.*

---

### 3. Sepia

> Warm low-glare reading mode — aged paper tones with brown and golden accents.

| Token | Hex / Value | Description |
|-------|-------------|-------------|
| `--bg-primary` | `#f5efe3` | Warm cream background |
| `--bg-secondary` | `#fcf6eb` | Lighter warm cream |
| `--bg-card` | `#fffaf2` | Off-white card surface |
| `--bg-card-hover` | `#fff4e4` | Warm peach hover |
| `--bg-input` | `#f8f0dd` | Input fields — parchment |
| `--bg-sidebar` | `rgba(255, 250, 241, 0.88)` | Frosted warm sidebar |
| `--text-primary` | `#2f2418` | Dark warm brown — main text |
| `--text-secondary` | `#6a5845` | Medium brown — secondary labels |
| `--text-muted` | `#88715b` | Light brown — muted text |
| `--accent-primary` | `#7c5c2f` | Deep brown — CTA / links |
| `--accent-primary-hover` | `#5e4525` | Darker brown on hover |
| `--accent-secondary` | `#d68a1f` | Warm golden orange |
| `--accent-gradient` | `linear-gradient(135deg, #7c5c2f 0%, #c58a3a 55%, #d68a1f 100%)` | Brown → mid-tan → gold gradient |
| `--bg-glow-a` | `rgba(197, 138, 58, 0.2)` | Warm amber radial glow |
| `--bg-glow-b` | `rgba(235, 179, 92, 0.16)` | Pale gold radial glow |

---

### 4. Aurora

> Color-rich blue-cyan palette — cool light mode with gradient accents inspired by the aurora borealis.

| Token | Hex / Value | Description |
|-------|-------------|-------------|
| `--bg-primary` | `#f2f8ff` | Soft sky blue background |
| `--bg-secondary` | `#eefaf8` | Very light cyan-tinted surface |
| `--bg-card` | `#fcffff` | Almost-white card surface |
| `--bg-card-hover` | `#f5fbff` | Pale blue hover |
| `--bg-input` | `#eef8ff` | Faint blue input background |
| `--bg-sidebar` | `rgba(247, 254, 255, 0.88)` | Frosted near-white sidebar |
| `--text-primary` | `#0b213a` | Deep ocean navy — main text |
| `--text-secondary` | `#35526c` | Medium slate blue — secondary |
| `--text-muted` | `#5c7691` | Muted blue-gray |
| `--accent-primary` | `#0f6cbd` | Royal blue — CTA / links |
| `--accent-primary-hover` | `#0a5a9f` | Deeper blue on hover |
| `--accent-secondary` | `#0891b2` | Cyan — secondary accent |
| `--accent-gradient` | `linear-gradient(135deg, #0f6cbd 0%, #0ea5e9 45%, #14b8a6 100%)` | Blue → sky → teal gradient |
| `--border-color` | `rgba(11, 33, 58, 0.12)` | Subtle navy border |
| `--bg-glow-a` | `rgba(14, 165, 233, 0.24)` | Sky blue radial glow |
| `--bg-glow-b` | `rgba(45, 212, 191, 0.18)` | Teal radial glow |

---

### 5. Graphite

> Neutral executive dark mode — true dark charcoal with high-energy orange and yellow accents.

| Token | Hex / Value | Description |
|-------|-------------|-------------|
| `--bg-primary` | `#101317` | Near-black charcoal background |
| `--bg-secondary` | `#171c22` | Slightly lighter dark |
| `--bg-card` | `#1b222a` | Card surface — dark blue-gray |
| `--bg-card-hover` | `#252f3a` | Lighter hover state |
| `--bg-input` | `#202933` | Input background |
| `--bg-sidebar` | `rgba(15, 19, 23, 0.9)` | Near-opaque dark sidebar |
| `--text-primary` | `#f6f8fb` | Cool off-white — main text |
| `--text-secondary` | `#c3ccd8` | Light gray-blue — secondary |
| `--text-muted` | `#8f9aa8` | Muted blue-gray |
| `--accent-primary` | `#f97316` | Bright orange — CTA / links |
| `--accent-primary-hover` | `#ea580c` | Deeper orange on hover |
| `--accent-secondary` | `#facc15` | Vivid yellow — secondary accent |
| `--accent-gradient` | `linear-gradient(135deg, #f97316 0%, #fb923c 44%, #facc15 100%)` | Orange → peach → yellow gradient |
| `--border-color` | `rgba(203, 213, 225, 0.16)` | Pale cool border |
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.34)` | Heavier dark shadow |
| `--shadow-md` | `0 16px 32px rgba(0, 0, 0, 0.3)` | Deep card shadow |
| `--shadow-lg` | `0 28px 60px rgba(0, 0, 0, 0.38)` | Strong elevated shadow |
| `--bg-glow-a` | `rgba(249, 115, 22, 0.18)` | Orange radial glow |
| `--bg-glow-b` | `rgba(250, 204, 21, 0.14)` | Yellow radial glow |

---

## Theme Comparison at a Glance

| Theme | Mode | Background | Primary Text | Accent Primary | Accent Secondary | Vibe |
|-------|------|------------|-------------|----------------|------------------|------|
| **Linen** | Light | `#f4efe7` | `#142033` | `#0f766e` (Teal) | `#ca8a04` (Amber) | Warm editorial |
| **Midnight** | Dark | `#07111f` | `#eef4ff` | `#0ea5e9` (Cyan) | `#2dd4bf` (Teal) | High-contrast dark |
| **Sepia** | Light | `#f5efe3` | `#2f2418` | `#7c5c2f` (Brown) | `#d68a1f` (Gold) | Warm parchment |
| **Aurora** | Light | `#f2f8ff` | `#0b213a` | `#0f6cbd` (Blue) | `#0891b2` (Cyan) | Cool ocean |
| **Graphite** | Dark | `#101317` | `#f6f8fb` | `#f97316` (Orange) | `#facc15` (Yellow) | Executive dark |

---

## Background Rendering

Every page background is a layered composite:

```css
body {
  background:
    radial-gradient(circle at top left, var(--bg-glow-a), transparent 36%),
    radial-gradient(circle at 80% 10%, var(--bg-glow-b), transparent 28%),
    linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%);
}
```

A subtle dot-grid texture is overlaid via `body::before` (opacity `0.45`):

```css
body::before {
  background-image: radial-gradient(rgba(20, 32, 51, 0.03) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

---

## Accessibility Modes

Controlled via `data-*` attributes on `<html>`, managed by `useUIStore.accessibility`.

| Mode | Data Attribute | Effect |
|------|---------------|--------|
| High Contrast | `data-contrast="high"` | Stronger borders (`0.42` opacity) and outline-style shadows |
| Reduced Motion | `data-reduced-motion` | Disables transitions and animations |
| Large Text | `data-large-text` | Increases `--font-scale` |
| Compact Density | `data-compact` | Reduces spacing and padding |
| Voice Navigation | `data-voice-nav` | Focus ring enhancements |
| Screen Reader | `data-screen-reader` | Additional ARIA and visibility helpers |

---

## Tailwind Integration

CSS variables are bridged into Tailwind utility classes via `tailwind.config.js`:

```js
colors: {
  accent: {
    primary:   'var(--accent-primary)',
    secondary: 'var(--accent-secondary)',
  },
  bg: {
    primary:   'var(--bg-primary)',
    secondary: 'var(--bg-secondary)',
    card:      'var(--bg-card)',
  },
  text: {
    primary:   'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    muted:     'var(--text-muted)',
  }
}
```

This means classes like `bg-bg-card`, `text-text-primary`, and `text-accent-primary` all respond to the active theme automatically.

---

## Theme Implementation

**State:** `useUIStore` (Zustand) in `frontend/src/store.ts`
**Type:** `ThemeMode = 'linen' | 'midnight' | 'sepia' | 'aurora' | 'graphite'`
**Applied in:** `PreferenceApplier.tsx` — sets `document.documentElement.dataset.theme`
**Persisted to:** User profile in database (`theme_mode` field)
**UI selector:** Settings page (`frontend/src/pages/Settings.tsx`)

---

*Source files: `frontend/src/index.css`, `frontend/tailwind.config.js`, `frontend/src/theme/chartTheme.ts`, `frontend/src/store.ts`*
