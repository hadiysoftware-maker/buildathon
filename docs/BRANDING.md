# Campus 2035 branding (v2)

Brand board: `public/brand/board.html` (served at `/brand/board.html`).

**Positioning.** For schools, Campus 2035 is the smart-classroom OS that turns a student's ID card into their whole school day.
Attributes: friendly, reliable, modern.

## Logo
A bold "C" ring (Campus) with one amber square in its opening: a single cell of a Smart ID code. The card is the product's front door; the mark shows it opening.

| File | Use |
|---|---|
| `public/brand/mark.svg` | Colour mark on light backgrounds |
| `public/brand/mark-mono.svg` | One-colour (print, stamps) |
| `public/brand/mark-inverted.svg` | On deep teal or photos with a teal overlay |
| `src/app/icon.svg` | Favicon and app tile (white C on deep teal) |
| `src/components/ui/Logo.tsx` | `LogoMark` and `Logo` (variants: color, mono, inverted, tile) |

Clear space: at least the amber square's height (a quarter of the mark) on every side. Minimum size 16 px (the favicon is tested at 24 px).
Wordmark: "Campus" in Poppins Bold, "2035" in teal (amber on dark).

Don't: recolour the ring or square, rotate or outline the mark, use the square alone, or place the mark on a busy photo.

## Colour (6 colours, contrast checked)
| HEX | Job | Contrast |
|---|---|---|
| `#0F766E` | Primary: buttons, links | 5.47:1 on white |
| `#0B4F4A` | Deep teal: top bar, app tile | 9.41:1 with white text |
| `#0B2A2C` | Ink: body text | 15.2:1 on white |
| `#E8F3F1` | Mint: page background | ink on mint 13.4:1 |
| `#F5B83D` | Accent: the square, active toggles | 8.54:1 with ink |
| `#4B6B6D` | Muted text | 5.8:1 on white |

Dashboard tiles also use soft pink, amber, mint and teal tints, for decoration only.

## Type
Poppins (headlines) and Montserrat (text), both SIL Open Font License, loaded through `next/font`. Scale ×1.25.

## Top bar
Deep-teal gradient (`#0B4F4A` to `#0F766E`), rounded bottom corners, translucent white controls, amber focus ring and amber "pressed" state for the Copilot toggle.

## Mascot
Nova (`src/components/ui/Mascot.tsx`) is the companion for empty states, login and the Copilot. It never replaces the logo.

## Voice
Plain, warm, short. Say what happened and what to do next. No exclamation marks in errors.
