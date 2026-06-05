Fix inconsistent navigation between homepage and inner pages.

**Problem:** The app has two headers with different nav items:
- `PageShell` (homepage `/lake-geneva`): Today, Jobs, Directory, Advertise
- `PublicHeader` (all other pages): Today, Events, Local Love, Directory, Submit

This means Local Love, Events, and Submit are invisible from the homepage — users only discover them after clicking a link that happens to use `PublicHeader`.

**Fix:** Update `PageShell.tsx` to include the same nav items as `PublicHeader.tsx`:
1. Replace `PageShell`'s `navItems` with the full set: Today, Events, Local Love, Directory, Submit
2. Remove "Jobs" and "Advertise" from the top nav (Jobs already has a widget on the homepage; Advertise is in the footer)
3. Adjust mobile nav in `PageShell` — currently it slices to first 3 items, which would hide Local Love and Submit on mobile. Show all items or use a scrollable row.

**Out of scope:** Unifying the two header components into one. Keep `PageShell` and `PublicHeader` separate for now; just align their nav contents.

**Files to change:**
- `src/components/PageShell.tsx` — update `navItems` array and mobile nav rendering

**No backend changes. No new dependencies. ~15 min.**