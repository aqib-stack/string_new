# StringGlobe — Redesign Notes

The visual design was completely rebuilt. **No app logic, routes, data, Firebase or Stripe code was changed** — only the design layer.

## What changed
- `src/app/globals.css` — fully rewritten as a new design system ("pro-shop" dark sport-luxe: deep ink + electric volt accent). Same class names, so every page transforms automatically.
- `public/stringglobe-logo.svg`, `public/stringglobe-mark.svg`, `public/racquet-card.svg`, `public/hero-real-racquet.svg`, `src/app/icon.svg`, `public/icons/icon-192.png`, `public/icons/icon-512.png` — re-themed to volt-on-dark.
- `public/manifest.json` — theme/background color updated to `#0a0c0a`.

## Typography (loaded via Google Fonts @import in globals.css)
- Display headings: **Bricolage Grotesque**
- Body: **Hanken Grotesk**
- Codes / numerals / kickers: **JetBrains Mono**

## Run it
```
npm install
npm run dev
```
node_modules, .next and .git were omitted from this zip to keep it light — they regenerate on install/build.
