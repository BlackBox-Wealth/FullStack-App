# UI Beautification Skill — Vite + React + Tailwind CSS
> **Scope**: Visual layer only. Zero backend changes. Zero logic changes. Pure UI uplift.

---

## What This Skill Does

When asked to **beautify, redesign, or upgrade the UI** of an existing Vite + React project:

- Rewrites **only** styles, layout, colors, typography, animations, and visual composition
- Uses **Tailwind CSS utility classes** as the primary styling system — no per-component `.css` files
- Delivers output as **reusable React components** — one `.jsx` file per component
- Preserves all props, event handlers, API calls, state, and data flow **exactly as-is**
- Custom design tokens live in `tailwind.config.js` — never hardcoded in className strings

---

## Rules (Non-Negotiable)

```
✅ Touch:  JSX structure, className (Tailwind utilities), tailwind.config.js, index.css keyframes
❌ Never:  props API, state logic, hooks, useEffect data fetching, API calls, routing
```

If a component has `onClick={handleSubmit}` — keep it. If it fetches `/api/data` — keep it.
Only the **appearance** of the component changes.

**No separate `.css` files per component.** All styling via Tailwind classes.
Custom keyframes and base styles go in `index.css` only.

---

## Setup — Tailwind in Vite

### 1. Install

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 2. `tailwind.config.js` — Design Token System

All colors, fonts, shadows, and animations are defined here.
**Never hardcode values directly in classNames.**

```js
// tailwind.config.js
import { fontFamily } from 'tailwindcss/defaultTheme'

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg:      'oklch(9% 0.01 260)',
        surface: 'oklch(14% 0.015 260)',
        border:  'oklch(22% 0.02 260)',
        accent:  'oklch(72% 0.22 195)',
        accent2: 'oklch(65% 0.18 320)',
        text:    'oklch(95% 0.01 260)',
        muted:   'oklch(55% 0.02 260)',
      },
      fontFamily: {
        display: ['Syne', ...fontFamily.sans],
        body:    ['DM Sans', ...fontFamily.sans],
        mono:    ['JetBrains Mono', ...fontFamily.mono],
      },
      boxShadow: {
        glow:  '0 0 40px oklch(72% 0.22 195 / 0.25)',
        card:  '0 8px 32px oklch(0% 0 0 / 0.4)',
        float: '0 24px 64px oklch(0% 0 0 / 0.5)',
      },
      transitionTimingFunction: {
        expo:   'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(32px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition:  '200% center' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        borderPulse: {
          '0%, 100%': { borderColor: 'oklch(72% 0.22 195)' },
          '50%':      { borderColor: 'oklch(65% 0.18 320)' },
        },
      },
      animation: {
        'fade-up':      'fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in':      'fadeIn 0.4s ease both',
        'shimmer':      'shimmer 2s linear infinite',
        'float':        'float 3s ease-in-out infinite',
        'border-pulse': 'borderPulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
```

### 3. `src/index.css` — Base Styles Only

```css
/* src/index.css */
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;400;500;1,9..40,300&family=JetBrains+Mono:wght@400;500&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { @apply bg-bg text-text font-body; }
  h1, h2, h3, h4 { @apply font-display; }
}

/* Scroll-reveal utility — toggled by IntersectionObserver */
@layer utilities {
  .reveal         { @apply opacity-0 translate-y-6 transition-all duration-700 ease-expo; }
  .reveal.in-view { @apply opacity-100 translate-y-0; }

  .text-gradient {
    @apply bg-clip-text text-transparent;
    background-image: linear-gradient(135deg, oklch(72% 0.22 195), oklch(65% 0.18 320));
  }

  .shimmer-bg {
    background: linear-gradient(90deg, transparent 0%, oklch(72% 0.22 195 / 0.15) 50%, transparent 100%);
    background-size: 200% 100%;
    @apply animate-shimmer;
  }
}
```

---

## Project Structure

```
src/
├── index.css                    ← Tailwind directives, base styles, reveal + gradient utilities
├── components/
│   ├── ui/
│   │   ├── Button.jsx           ← Reusable animated button (primary / outline / ghost)
│   │   ├── Card.jsx             ← Hover 3D tilt + glow card
│   │   ├── Badge.jsx            ← Status / tag badge
│   │   ├── Divider.jsx          ← Gradient section divider
│   │   └── AnimatedText.jsx     ← Scroll-reveal wrapper
│   └── layout/
│       ├── Section.jsx          ← Full-width section wrapper
│       └── Grid.jsx             ← Responsive grid layout
├── hooks/
│   └── useInView.js             ← IntersectionObserver hook
└── tailwind.config.js           ← All design tokens
```

One file per component. No co-located CSS. All styling in `className`.

---

## `useInView.js` Hook

```js
// src/hooks/useInView.js
import { useEffect, useRef } from 'react'

export default function useInView(options = {}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add('in-view') },
      { threshold: 0.15, ...options }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return ref
}
```

---

## Reusable Components

### `Button.jsx`

```jsx
// src/components/ui/Button.jsx
const variants = {
  primary: 'bg-accent text-bg hover:brightness-110 shadow-glow',
  outline: 'bg-transparent text-accent border border-accent hover:bg-accent/10',
  ghost:   'bg-transparent text-muted hover:text-text hover:bg-surface',
}

export default function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={`
        relative overflow-hidden
        px-6 py-2.5 rounded-full
        font-body font-semibold text-sm
        transition-all duration-300 ease-spring
        hover:-translate-y-0.5 active:translate-y-0
        cursor-pointer select-none
        ${variants[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  )
}
```

---

### `Card.jsx`

```jsx
// src/components/ui/Card.jsx
import { useRef } from 'react'

export default function Card({ children, glow = false, className = '', ...props }) {
  const ref = useRef(null)

  function onMouseMove(e) {
    const { left, top, width, height } = ref.current.getBoundingClientRect()
    const x = ((e.clientX - left) / width - 0.5) * 12
    const y = ((e.clientY - top) / height - 0.5) * -12
    ref.current.style.transform = `perspective(800px) rotateX(${y}deg) rotateY(${x}deg)`
  }

  function onMouseLeave() {
    ref.current.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)'
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`
        bg-surface border border-border rounded-2xl p-6
        shadow-card transition-all duration-300 ease-expo
        will-change-transform
        ${glow ? 'hover:shadow-glow' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}
```

---

### `AnimatedText.jsx`

```jsx
// src/components/ui/AnimatedText.jsx
import useInView from '../../hooks/useInView'

export default function AnimatedText({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
}) {
  const ref = useInView()

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  )
}
```

---

### `Badge.jsx`

```jsx
// src/components/ui/Badge.jsx
const colors = {
  accent:  'bg-accent/10 text-accent border-accent/20',
  accent2: 'bg-accent2/10 text-accent2 border-accent2/20',
  muted:   'bg-surface text-muted border-border',
}

export default function Badge({ children, color = 'accent', className = '' }) {
  return (
    <span
      className={`
        inline-flex items-center gap-1
        px-3 py-0.5 rounded-full
        text-xs font-mono font-medium
        border
        ${colors[color]}
        ${className}
      `}
    >
      {children}
    </span>
  )
}
```

---

### `Divider.jsx`

```jsx
// src/components/ui/Divider.jsx
export default function Divider({ className = '' }) {
  return (
    <div
      className={`w-full h-px bg-gradient-to-r from-transparent via-border to-transparent ${className}`}
    />
  )
}
```

---

### `Section.jsx`

```jsx
// src/components/layout/Section.jsx
export default function Section({ children, id, tight = false, className = '' }) {
  return (
    <section
      id={id}
      className={`w-full px-6 ${tight ? 'py-16' : 'py-32'} ${className}`}
    >
      <div className="max-w-6xl mx-auto">
        {children}
      </div>
    </section>
  )
}
```

---

### `Grid.jsx`

```jsx
// src/components/layout/Grid.jsx
const colMap = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}

export default function Grid({ children, cols = 3, className = '' }) {
  return (
    <div className={`grid gap-6 ${colMap[cols] ?? colMap[3]} ${className}`}>
      {children}
    </div>
  )
}
```

---

## Font Pairings — Pick One Per Project

Add the chosen `<link>` to `index.html` `<head>`. Update `tailwind.config.js` `fontFamily` to match.

```html
<!-- Option A: Editorial (Syne + DM Sans) — bold, modern -->
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:opsz,wght@9..40,300;400;500&display=swap" rel="stylesheet">

<!-- Option B: Refined (Cormorant + Outfit) — elegant, literary -->
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet">

<!-- Option C: Technical (Space Mono + Figtree) — precise, dev-coded -->
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Figtree:wght@300;400;600&display=swap" rel="stylesheet">
```

**Never use**: Inter, Roboto, Arial, system-ui as a display/heading typeface.

---

## Before → After Example

**Before** (existing component — logic untouched):
```jsx
export default function ProjectCard({ title, desc, tag, onClick }) {
  return (
    <div style={{ background: '#fff', padding: '16px' }} onClick={onClick}>
      <span>{tag}</span>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  )
}
```

**After** (visual redesign, `onClick` and props untouched):
```jsx
import Card from './ui/Card'
import Badge from './ui/Badge'
import AnimatedText from './ui/AnimatedText'

export default function ProjectCard({ title, desc, tag, onClick }) {
  return (
    <Card glow onClick={onClick} className="group cursor-pointer relative">

      <Badge className="mb-4">{tag}</Badge>

      <AnimatedText
        as="h3"
        className="font-display text-xl text-text mb-2
                   group-hover:text-accent transition-colors duration-300"
      >
        {title}
      </AnimatedText>

      <AnimatedText
        as="p"
        delay={80}
        className="font-body text-sm text-muted leading-relaxed"
      >
        {desc}
      </AnimatedText>

      <span className="
        absolute top-6 right-6
        text-accent text-base
        opacity-0 group-hover:opacity-100
        group-hover:translate-x-0.5 group-hover:-translate-y-0.5
        transition-all duration-300
      ">
        ↗
      </span>

    </Card>
  )
}
```

`onClick` passes through Card's `...props` spread — zero changes to behavior.

---

## Checklist Before Delivering Any Component

```
[ ] All colors, shadows, fonts defined in tailwind.config.js — not hardcoded in className
[ ] No per-component .css file — only index.css for base/utilities/keyframes
[ ] Every component accepts className and ...props spread for extensibility
[ ] Scroll animations use useInView hook + reveal/in-view classes
[ ] Hover/interaction states use Tailwind variants: hover:, group-hover:, active:, focus:
[ ] Component props API (onClick, onChange, value, etc.) unchanged from original
[ ] No import of any backend module, API util, or store
[ ] Fonts loaded via Google Fonts in index.html — not imported in JS
[ ] Each component in its own .jsx file under components/ui/ or components/layout/
[ ] Section + Grid wrappers used to enforce consistent spacing and responsiveness
```

---

*This skill applies to any Vite + React + Tailwind project. One component per file. All styling in className. Zero backend changes.*