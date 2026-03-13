

# Brand System Alignment Plan

## Summary
Align the PMS app with the completed Rhosonics Brand System style guide. The brand system defines specific color values, typography rules, logo design, gradients, shadows, and component utilities. The current PMS app has diverged in several areas.

## Key Differences Found

### 1. Color Values — Need Alignment
The brand system uses a different color foundation:
- **Brand green**: `125 50% 40%` (brand) vs `138 68% 28%` (current PMS)
- **Obsidian**: `224 22% 10%` (brand) vs `215 33% 10%` (current)
- **Slate scale**: Brand uses 224° hue family; PMS uses mixed 210-222° hues
- **Brand adds**: Primary 50-900 scale, Mineral Neutrals, Eco tints with different values
- **Gradients**: Brand defines `--gradient-brand`, `--gradient-obsidian`, `--gradient-hero`, `--gradient-ore`, `--gradient-mineral`, etc.
- **Chamfer clips**: Brand defines clip-path variables for industrial aesthetic

### 2. Logo — Replace with Newest Version
Brand system logo has 3 waves (solid corner fill + 2 arcs) with a 3-stop gradient (`#7DC42E → #4CAF50 → #2D8636`), supports `variant` prop (gradient/white/dark), uses unique gradient IDs to avoid SVG collisions, and supports animation. Current PMS logo is older (3 arcs, 2-stop gradient, no variant support).

### 3. Typography — `font-logo` with Primetime
Brand system defines `font-logo` as Unbounded by default, with a `body.logo-primetime` override that switches to Primetime font. The PMS currently uses `font-display` (Unbounded) in the sidebar. Need to:
- Add Primetime font-face declaration (copy woff2 from brand project)
- Rename `font-display` usage to `font-logo` 
- Add Primetime body class support
- `font-data` class still exists in Auth.tsx and Production.tsx — replace with `font-semibold uppercase tracking-wider` or the label-ui pattern

### 4. Tailwind Config — Color Structure
Brand system adds: `rho.*`, `eco.*`, `info.*`, `warning.*`, `success.*`, `error.*`, `mineral.*` color groups, and `primary.50-900` scale. Current PMS has some of these but with different values/structure.

### 5. CSS Utilities to Import (selectively)
From brand system, relevant to PMS app:
- Card variants: `card-base`, `card-eco`, `card-obsidian` (useful)
- Label classes: `label-ui` (replaces `font-data uppercase tracking-wider` pattern)
- `gradient-text`, `hover-lift`, selection color
- Drop: billboard.js styles, swatches, nav-link styles, pattern backgrounds, print styles — these are brand-guide-specific, not PMS

## Implementation Plan

### Task 1: Copy Primetime font and update logo
- Copy `primetime-light.woff2` from brand project to `public/fonts/`
- Add `@font-face` for Primetime in `index.css`
- Add `font-logo` class (Unbounded default + Primetime override via body class)
- Replace `RhosonicsLogo.tsx` with the brand system's newest version (3-wave design with variant support, unique gradient IDs)
- Update `AppSidebar.tsx` to use `font-logo` instead of `font-display`
- Update `Auth.tsx` to use `font-logo` instead of `font-logo` (already correct there)

### Task 2: Align color tokens to brand system
- Update `:root` CSS variables to match brand system's exact values:
  - `--rho-green: 125 50% 40%` (replaces `--rhosonics-green: 138 68% 28%`)
  - `--rho-obsidian: 224 22% 10%` (replaces `--obsidian: 215 33% 10%`)
  - Slate scale to 224° hue family
  - Add primary 50-900 scale
  - Add mineral neutral tokens
  - Update eco surface values
  - Add gradient and shadow custom properties
  - Add chamfer clip-path variables
- Update dark mode tokens to match
- Keep all existing semantic tokens (status colors, chart colors) but re-point them to new base values
- Update `tailwind.config.ts` color mappings to use `rho.*` naming and add `mineral.*`, `primary.50-900`

### Task 3: Remove `font-data` class usage
- Replace all `font-data` occurrences in `Auth.tsx` and `Production.tsx` with `label-ui` class (defined as `font-ui text-xs uppercase tracking-wider font-medium`) or inline equivalents
- Add `label-ui` and `label-tech` utility classes to `index.css`

### Task 4: Add brand component utilities
- Add `card-eco`, `card-obsidian`, `card-gradient`, `card-mineral` styles
- Add `gradient-text` utility
- Add `::selection` brand color
- Add `noise-overlay` utility
- Add chamfer shape classes

### What to Drop (brand-guide-only, not for PMS)
- Billboard.js chart theme (PMS uses Recharts)
- Pattern backgrounds (topo, minerals, dredging, wave, terrain, etc.)
- Print/PDF styles for case studies
- Font selector / Work Sans alternative
- Swatch styles
- Navigation link styles (PMS has its own nav system)
- Case study document styles
- JetBrains Mono references (already removed from PMS)

## Technical Notes
- The brand system's `font-data` class references JetBrains Mono — we will NOT import this, consistent with the established rule. The `label-tech` pattern in PMS will use Instrument Sans with semibold + tabular nums.
- The Primetime font will be loaded via `@font-face` with `font-display: swap` for performance.
- SVG gradient ID collision fix in the new logo uses React's `useId()` hook.
- The `cleanReactId` utility from the brand project needs to be added (simple string sanitizer for SVG IDs).

