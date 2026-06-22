## Goal

Make "[RIGHT NOW]" actually surface live hyperlocal incidents again. Today the pipeline is dead: 511 returns server errors, NWS sees no alerts (working but quiet), two City of Lake Geneva RSS feeds are in `error` state, and every Facebook-based scanner was switched off May 18. Result: only Milwaukee crime stories sit in `incidents`, the local filter (correctly) hides them, and the sidebar shows "All Clear" forever.

## What I'll do

### 1. Wisconsin 511 — fix the parser
- `/api/getevents` returns HTTP 500 from the upstream API; `/api/getalerts` returns 200 but 0 items. The function silently swallows the 500 and reports success.
- Add proper retry + endpoint fallback: try `getevents` → on 5xx, fall back to `geteventsbybbox` (Walworth bounding box) → then `getincidents`. Log the upstream payload shape so future shape changes don't go silent.
- Tighten the local filter so a Walworth-bbox hit is enough (today it also requires a keyword match, which is why state-wide alerts get dropped).
- Mark the source `health_severity = warning` whenever the upstream returns 5xx, so it shows on the Source Health dashboard instead of looking green.

### 2. NWS Weather Alerts — confirm + widen zones
- The function is working correctly: WIZ063 just has no active alerts right now. That's why ingest dates look frozen.
- Add the adjacent county zones (WIZ062 Rock, WIZ057 Jefferson) so a Lake-Geneva-relevant Special Weather Statement issued for the regional grid still lands. Keep the local filter on output.
- Add a synthetic "All Clear" heartbeat row update on `sources` so dashboard doesn't keep flagging it critical when no alerts is the correct state.

### 3. City of Lake Geneva Police + Fire RSS
- Both feeds are `status='error'` since June 8. The CivicEngage RSS URL pattern (`/RSSFeed.aspx?ModID=63&CID=Police-4`) is the legacy ASP.NET endpoint — likely returning 403/redirect now.
- Switch both to the current CivicPlus JSON feed pattern and re-test. If the city moved off CivicEngage entirely, mark the rows `status='retired'` so they stop polluting source health, and replace them with the Lake Geneva Police Department's Facebook page (via the n8n scanner below).

### 4. Retire confirmed-dead sources
- Move these from `active` to `retired` so the Source Health dashboard goes green and we stop wasting fetch budget:
  - Fontana Village Alerts (1,582 zero-runs)
  - Google News – Walworth County (613 zero-runs, dup of Walworth County Community News)
  - TMJ4 Walworth County RSS (147 zero-runs — the feed is empty upstream)
  - Spectrum News Wisconsin Weather (2,021 zero-runs)

### 5. Facebook scanner — wire via n8n (not in-app)
Per the project's existing pattern (n8n handles bot-protected sources, edge functions only ingest), the Facebook side runs on the VPS and POSTs into an ingest endpoint. I'll build the ingest side; the n8n workflow itself you set up on the VPS using the same Puppeteer pattern as LakeGenevaNews.

- New edge function `ingest-incident` (mirrors `ingest-news`): accepts authenticated POST from n8n with `{ source, title, description, location, incident_type, started_at, external_id, lat, lon }`, dedupes on `external_id`, inserts directly into `public.incidents` with `status='active'`, geo-checks against the Walworth bbox + local keyword list before accepting.
- Reuse the existing `CIVIC_INGEST_SECRET` (already configured) for auth — same `Authorization: Bearer …` header pattern as `ingest-news`.
- Add source rows for the 6 scanner pages (Walworth County Scanner, Lake Geneva Fire, Walworth County WI, Town of Linn Fire, Walworth Fire Rescue, Lake Geneva Police) with `status='active'` and `metadata.ingest_method = 'n8n_facebook_scanner'`.
- Write a short `docs/facebook-scanner-n8n-setup.md` with the n8n workflow shape: schedule trigger → Puppeteer node visiting each page → extract recent posts → POST array to `ingest-incident`. Documented per-page CSS selectors; rate-limited to 1 page / 30s; runs every 15 minutes.

### 6. Auto-resolve tuning
- Today's `auto-resolve-incidents` cron resolves anything older than 6h, which is why the only active rows are 12h-old Milwaukee news the backfill keeps recreating. Tighten it: news-source incidents (`source='backfill'`) auto-resolve after 2h, real scanner/511/NWS incidents keep the 6h window.

## What you'll need to do (on your side)

Only one thing: stand up the n8n workflow on your VPS using the doc I'm adding. Everything else (parsers, endpoints, source rows, auto-resolve) is in this PR.

## Technical details

- **Files added**: `supabase/functions/ingest-incident/index.ts`, `docs/facebook-scanner-n8n-setup.md`.
- **Files edited**: `supabase/functions/sync-511-traffic/index.ts`, `supabase/functions/sync-nws-alerts/index.ts`, `supabase/functions/auto-resolve-incidents/index.ts`.
- **Migration**: retire 4 dead sources, fix LG Police/Fire URLs (or retire), insert 6 Facebook scanner source rows, add a check constraint that `incidents.external_id` is unique per `source`.
- **Secrets**: none new — `CIVIC_INGEST_SECRET` is already present.
- **No frontend changes** — `LiveIncidentsSidebar` filter logic is correct and stays as-is.

## Verification after merge

1. Manually invoke `sync-511-traffic` and confirm log shows a real event count (or a clear "0 events in Walworth bbox, upstream healthy" line).
2. POST a synthetic test payload to `ingest-incident` and confirm a row appears in `incidents` with `source='facebook_scanner'`.
3. Confirm Source Health dashboard drops from 7 critical rows to 0.
4. Once you have the n8n flow running, watch `/` — first real scanner post should appear in "[RIGHT NOW]" within ~15 minutes.
