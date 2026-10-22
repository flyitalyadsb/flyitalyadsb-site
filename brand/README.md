# FlyItalyADSB brand

The same marks and colours everywhere we show up outside the site: Stripe
Checkout and customer portal, MCP directories, social cards. The site's own
CSS (`src/styles/global.css`, `@theme`) is the source of truth for colours:
if one changes there, change it here and in the places listed below.

## Logo

`flyitalyadsb-icon.png`: the plane in a circle, 460 × 460 px, PNG, 130 KB, no
metadata. It is the GitHub organisation's avatar (the original upload, there
is no larger one), the site's favicon and header logo (`public/logo.png`,
same file) and the map's tab icon.

Never redraw it or swap it for a generic icon. Strip metadata before
publishing any new export (`exiftool -all=`).

## Colours

| Role | Hex | Where it comes from |
|---|---|---|
| **Brand** (backgrounds) | `#070d1a` | page background, `--color-bg-base`, `theme-color` |
| **Primary / accent** (buttons, links) | `#38bdf8` | `--color-sky-accent`, links and focus ring |
| Surface | `#0f1929` | `--color-bg-surface` |
| Card | `#111e30` | `--color-bg-card` |
| Border | `#1e3048` | `--color-border` |
| Text | `#cbd5e1` | body text |
| Headings | `#f0f9ff` | `h1`–`h3` |

The logo's own palette, for reference only: navy `#001d2d`, steel `#1f4457`,
sky grey `#a7c5d5`, white `#f5f8f9`.

The accent is light: text on it is dark (`#070d1a`), never white.

## Type

- Body: the system sans-serif stack (Tailwind's default).
- Numbers, code, data: JetBrains Mono, self-hosted (`public/fonts`, OFL).

## Name

FlyItalyADSB, one word, in prose and titles. The research project is
weather32.

## Where the brand is set by hand

| Place | Setting |
|---|---|
| Stripe → Settings → Branding (account Nesso Labs srl) | icon `flyitalyadsb-icon.png`, brand colour `#070d1a`, accent colour `#38bdf8` |
