# DESIGN.md — UKK TKJ Paket 2 Documentation (Clean Light Docs Style)

## 1. Visual Theme & Atmosphere
- **Mood:** Professional, calm technical documentation. Light-first reading surface with navy/teal brand identity.
- **Density:** Balanced whitespace; step cards grouped as readable timeline.
- **Philosophy:** Clarity-first docs product feel — structured cards, quiet borders, no heavy decoration, no emoji in UI.

## 2. Design Tokens (CSS variables in `style.css`)
Light theme (default, `:root`):
- **Background (`--bg`):** `#F6F8FA` off-white
- **Surface (`--surface`):** `#FFFFFF`
- **Primary (`--primary`):** `#0E2A4F` midnight navy — headings, brand
- **Accent (`--accent`):** `#0E9488` teal — active nav, steps, markers
- **Text:** `#17233B` primary / `#5D6B82` muted / `#93A0B2` dim
- **Border:** `#E5E9EF` / `#D3DAE3` strong
- **Code surface:** `#0C1526` (kept dark in both themes)
- **Status:** success `#1B7F4B`, warning `#B45309`, danger `#C2410C`, info `#2563EB`

Dark theme (`html[data-theme="dark"]`):
- Background `#0B1220`, surface `#121C30`, text `#E3E9F4`, accent `#35C4B5`

## 3. Typography
- **Sans:** `'Plus Jakarta Sans'` — headings 700–800, body 400–600
- **Mono:** `'JetBrains Mono'` — code, badges, lang labels
- H1 `1.9rem/800`, H2 `1.4rem/800` with teal marker bar, H3 `1.08rem/700` with teal dot, body `0.95rem`, line-height `1.68`

## 4. Layout
- **Topbar (fixed, 56px):** breadcrumb kiri ("Dokumentasi · UKK TKJ Paket 2") + toggle tema kanan (`space-between`), tombol mobile di mobile. Blurred translucent background.
- **Sidebar (fixed 300px, below topbar):** brand mark + logo, search filter, hierarchical nav (group titles + sub links) with scroll-spy active state.
- **Main (max 940px):** H1 + lead + hero-meta stat cards (grid 4 → 2 → 1), topology spec card, then section steps.
- Anchor scroll offset via `scroll-padding-top` accounting for topbar.

## 5. Components
- **Hero meta stat cards:** white surface, teal top border, navy value.
- **Topology table:** card-wrapped, uppercase micro headers, hover rows, horizontal scroll on small screens.
- **Steps:** card-per-step connected by vertical timeline line + teal node dot; numbered pill badge (mono, navy).
- **Code blocks:** always-dark terminal panel with lang pill + Copy button (`copied` class feedback in teal).
- **Callouts:** tinted background + 3px left border (info teal, warning amber).
- **Lightbox:** dark blurred overlay, prev/next circle buttons, counter caption pill, close on click/Esc/Arows.
- **Buttons:** `.icon-btn` / `.code-copy` systems with hover, active scale, focus-visible states.

## 6. Interaction
- Transitions `0.18s ease`; hover on cards (border + subtle shadow), nav links, rows.
- `prefers-reduced-motion` disables transitions/smooth scroll.
- Respect `prefers-color-scheme` on first visit; toggle persists to `localStorage['ukk-theme']`; inline head script sets theme pre-paint (no flash).

## 7. Responsive Behavior
- `<=1023px`: sidebar becomes off-canvas drawer (overlay + close on navigation), menu button visible in topbar.
- `<=480px`: hero meta stacks 2 columns, breadcrumb condensed.

## 8. Do's and Don'ts
- **DO** keep CLI commands in copyable `<pre><code>` blocks at exact positions per `mapping.md`.
- **DO** use only design tokens; never hardcode colors in components.
- **DON'T** force `width: 100%` on screenshot `<img>`.
- **DON'T** use emoji as UI icons; use inline SVG only.
