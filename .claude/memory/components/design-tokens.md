---
title: design-tokens
tags: [ui, component]
code: [docs/assets/styles.css, docs/admin.html]
related: [[index]], [[ui-pipeline]], [[theme-system]]
updated: 2026-06-03
---

# Design Tokens — Soft Cloud Candy

## Typography
- Display font: **`Baloo 2`** (Google Fonts) — headings, team names, UI labels
- Body font: **`Nunito`** (Google Fonts) — body text, form inputs, descriptions

## Color palette (main app)
```css
--bg:      #FBF7FF   /* soft lavender background */
--surface: #FFFFFF   /* white surface/card */
--card:    rgba(255,255,255,.80)  /* semi-transparent card */
--text:    #4A4063   /* dark purple text */
--muted:   #6F6690   /* muted text */
--muted-2: #A79FC0   /* lighter muted */
--line:    rgba(124,115,150,.14)  /* light borders */
--err:     #FF6B8A   /* error/warning red-pink */
--accent:  #A98CFF   /* purple accent */
--candy:   linear-gradient(135deg,#C9B4FF,#A98CFF,#FFB3D1)  /* purple→pink gradient */
```

## Color palette (admin panel — separate theme)
```css
--bg:      #F4F2FC
--surface: #FFFFFF
--pri:     #7857E6   /* primary purple */
--accent:  #A98CFF
--grad:    linear-gradient(135deg, #7857E6, #A98CFF)
```

## Shadows (soft diffuse)
- `--sh-soft` — regular cards
- `--sh-card` — team tiles
- `--sh-pop` — modals/popups

## Border radius
12px, 18px, 26px, 34px — không có scale cố định, dùng theo context

## Motion
- Easing: `--bounce: cubic-bezier(.34,1.56,.64,1)` — elastic/spring feel
- Keyframes: `rise`, `wobble`, `popIn`, `fade`, `jmPop` (confetti), `cfFall`
- Respect `prefers-reduced-motion: reduce` — animations disabled

## Responsive
- Breakpoint: `@media (max-width: 560px)` — mobile layout

## Theming
- Default (trên) = giao diện gốc, bất biến. Đổi giao diện qua **1 cờ** — xem
  [[theme-system]] (CSS vars + `data-theme` + `ACTIVE_THEME`; theme `tech`).
