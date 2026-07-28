---
name: UI chrome rules (anti-generic)
description: Radius, palette, emoji, gradient, and font rules that keep the site reading as a newspaper rather than a generated SaaS template
type: constraint
---
Decided in the Jul 2026 design audit. The homepage was well-crafted; secondary
pages had drifted into generated defaults. These rules close that gap — the
inconsistency between pages is what reads as "AI-built," so consistency is the
product feature here.

**Radius — sharp, always.** `--radius: 0.125rem` (2px) is deliberate and is NOT
the shadcn default. Never use `rounded-xl` / `rounded-2xl` / `rounded-3xl` on
public pages; use `rounded-sm`. `rounded-full` is fine for dots, pills, and
avatars.

**Palette — lake tokens + semantic only.** Allowed: the lake tokens
(`lake-light|blue|deep|navy|sand`, `shore-terracotta`), neutral slate/stone, and
semantic states — red (active alert), amber/orange (developing/warning), green
(all clear/resolved), blue (links). **Never** purple, pink, fuchsia, violet,
indigo, cyan, teal, or emerald. A purple→pink gradient is the single most
recognizable "an AI made this" signature on the web; it is banned outright.

**Gradients — rare and lake-only.** Prefer flat surfaces. A gradient is
acceptable only as a large hero wash using lake tokens. Never three-stop
gradients, never decorative SVG pattern overlays.

**Emoji are never UI chrome.** No emoji in status labels, headings, buttons,
list bullets, or category markers. Status is a small colored dot
(`h-1.5 w-1.5 rounded-full` + a semantic bg). Emoji in reader-submitted or
source-provided text is data, not chrome, and is left alone.

**Icons never sit inside headings.** Section headers are type only. Lucide
icons are for controls and inline meta, not decoration.

**Fonts — both must be loaded.** Playfair Display (headlines) + Inter (body)
are both loaded in `index.html`. Inter was declared in `tailwind.config.ts` for
months without being loaded, so the whole site silently rendered in system-ui —
if body text ever looks generic again, check the font link first.

**Why this matters:** a human designer produces boring consistency. Per-page
visual variety is the tell. When adding a page, copy the type/radius/palette of
the homepage rather than generating a fresh hero treatment.

**Known open item:** the Fish Fry guide hero (`src/pages/FishFryGuide.tsx`)
still uses a generated multi-stop hero with a base64 SVG pattern overlay. Its
palette and radius were normalized, but the treatment itself should be rebuilt
in the masthead style.
