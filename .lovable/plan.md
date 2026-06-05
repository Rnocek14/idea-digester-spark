## Lake Status Line — subtle water wave under the header

Replace the flat `border-b border-slate-200` on the sticky header in `src/components/PageShell.tsx` with a 2px SVG wave that sits flush at the bottom of the header. Sitewide via PageShell — no per-page changes.

### Visual spec
- **Color:** soft lake blue, `rgba(125, 170, 210, 0.35)` stroke (per your direction — not slate, not gradient).
- **Shape:** single smooth sine wave, 1.5px stroke, ~2px amplitude, repeating every ~80px so it tiles seamlessly across any viewport width.
- **Height:** 4px tall strip; replaces the existing 1px border so header height is unchanged.
- **Implementation:** inline SVG with a `<pattern>` of one wave cycle, then a full-width `<rect>` filled with the pattern. Tiling = clean repeat at any width, no JS resize logic.

### Motion (per your answer: only on hover of header)
- Default state: **static wave**, no animation. Calm lake.
- On `header:hover`: pattern's `patternTransform` animates a slow horizontal drift, 12s linear infinite loop. Translates by exactly one wave wavelength so the loop is seamless.
- Disabled under `@media (prefers-reduced-motion: reduce)` — stays static even on hover.
- Pointer-events: none on the SVG so it never interferes with the header's own hover targets (logo, nav links, search).

### Future hook (not built now, but designed for)
The wave's amplitude and animation speed are driven by two CSS variables on the header: `--lake-amplitude` (default `2`) and `--lake-speed` (default `12s`). Later, a `useLakeConditions()` hook can set these from a weather source — wind advisory bumps amplitude to `3.5`, storm to `5`, winter calms to `1`. No component refactor needed when that lands.

The "21 mi shoreline" Easter-egg link tying to `/guides/lake-geneva-shore-path` is **not** in this change — flagged for a follow-up so we can place it carefully without crowding the right-side nav.

### Files touched
- `src/components/PageShell.tsx` — remove `border-b border-slate-200` from the `<header>`, append a new `<LakeLine />` component positioned at the bottom edge.
- `src/components/LakeLine.tsx` *(new)* — the SVG + scoped keyframes (via a `<style>` block or Tailwind arbitrary `[@keyframes]`). Self-contained, ~30 lines.

### Acceptance
1. Header bottom edge shows a barely-there blue wave instead of a slate line.
2. Hovering anywhere in the header starts a slow, seamless drift; mouse out pauses smoothly.
3. With reduced-motion enabled, wave is static even on hover.
4. Header layout/height unchanged across all pages using PageShell.
5. No console errors, no z-index conflict with the sticky header or page content.
