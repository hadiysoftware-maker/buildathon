# Design system

The visual language, CSS and layout shell come from the supplied reference UI (`globals.css`, `dashboard.css`, the dashboard layout). Nothing was redesigned; the class names and tokens are kept so the look is identical.

## Files

| File | Role |
|---|---|
| `src/app/globals.css` | Tokens (`--md-*`), themes, typography, base elements, Tailwind v4 entry (`@config`) |
| `src/app/dashboard.css` | Component class families for the workspace |
| `tailwind.config.js`, `postcss.config.mjs` | Tailwind v4 setup |
| `src/app/layout.tsx` | Fonts (Montserrat, Poppins), pre-paint theme script, toast container |

## Class families

| Prefix | Used for |
|---|---|
| `ds-` | Overview surfaces: hero, stat tiles, mini cards, empty states, buttons (`ds-btn`, `tonal`, `outline`, `sm`) |
| `dk-` | Lists and tables: `dk-table`, `dk-table-wrap`, `dk-seg` (segmented control), `dk-icon-btn` |
| `dk2-` | Dense list/detail variants |
| `cd-` | Cards, chips (`cd-chip`), banners, grids (`cd-grid`), muted text (`cd-muted`) |
| `lg-` | Login pages |
| `st-` | Status pages |

## Themes and text size

Light, dark and system themes, plus three text sizes, are stored in `localStorage` (`c35_theme`, `c35_font_size`). A tiny inline script applies them before first paint to avoid a flash. The account dialog changes them through `src/lib/theme.ts`.

## Icons

Hugeicons only. Components never import icon packages directly; they use `<Icon name="…" />` from `src/components/ui/Icon.tsx`, a registry mapping short names (`dashboard`, `qr`, `done`, `edit`, `archive`, …) to Hugeicons. Add a name there to use a new icon.

## Responsive behaviour

Desktop uses the sidebar; below the tablet breakpoint a bottom navigation bar and responsive tables take over. Sheets become full-width on phones. Controls keep a minimum 44 px touch target.

## Accessibility

Visible focus rings; icon-only buttons carry `aria-label`; status is never conveyed by colour alone (chips carry text); the current period uses `aria-current`; modals and sheets trap focus and close on Escape.

## Brand

The "Dac" owl mascot is kept (`Mascot.tsx`); the EduCore logo (`Logo.tsx`, a mortarboard with a spark) replaces the previous mark.
