
# From Newspaper to Daily Habit: The Lake Geneva Information Network

You're right — chasing breaking news in a town of 8,000 is a losing fight. The audit identified the symptom (thin civic spine, too much Milwaukee crime); you've identified the cure (broaden what counts as content). This plan operationalizes that shift.

## Guiding principle

**AI organizes and expands real information. AI never invents it.** Every generated piece must trace back to a real source row: a business profile, a directory entry, a poll result, a Facebook signal we logged, a historical record we ingested, a community submission. No invented quotes, no invented outcomes, no fabricated reporting.

## The eight content pillars

Target mix for a 7-day window (~50 pieces):

| Pillar | Weekly target | Source of truth |
|---|---|---|
| Hard news (civic, public safety, schools) | 10–14 | Revived civic spine + filtered Tier-0 |
| Events (preview + recap) | 8–10 | Visit Lake Geneva + venues + AI recaps from real event rows |
| Business coverage (new on menu, owner spotlights, behind-the-business) | 6–8 | `business_profiles` + `restaurants` + owner-submitted updates |
| Schools & youth sports | 4–6 | Revived district feeds + community submissions |
| Community signals ("what people are talking about") | 5–7 | New `community_signals` table fed by n8n FB/Nextdoor watcher |
| Community Voices (essays, opinion, recaps) | 2–3 | Existing `community_submissions` + `community_posts` |
| Polls + poll-result follow-ups | 2 (poll + result) | New `polls` table |
| Local history ("Today in Lake Geneva History") | 7 (daily) | New `history_entries` table, seeded once |

That math gets us to a steady 7–8 daily items without needing 7–8 daily news events.

## What we build, in order

### Phase 1 — Stop the bleeding (week 1)
Direct fixes to the audit findings, no new surfaces.

1. **Tier-0 cap rule** — modify the publish/promote logic so Tier-0 (state/regional) cannot exceed 25% of any day's published slate. Surplus rolls to `editorial_later` or is held.
2. **Milwaukee-noise filter** — on Fox6/TMJ4 regional feeds, require the story body to mention Walworth County or a town within ~30 miles, else auto-hold with `hold_reason = 'out_of_geo'`.
3. **Cross-channel dedupe** — extend the `normalized_url` constraint with a fuzzy title+date check so the same Fox6/TMJ4 wire story doesn't publish twice.
4. **Kill dead restaurant scrapers** — flip the 8+ zero-yield bar/restaurant sources to `status='retired'` so the Source Health dashboard stops crying wolf.

### Phase 2 — Revive the civic spine (week 1–2)
The single biggest unlock the audit identified.

5. **City of Lake Geneva via n8n bot-protected webhook** — apply the existing pattern (`docs/civicengage-n8n-webhook-setup.md`) to council agendas, police blotter, public works alerts, fire alerts.
6. **Schools** — same pattern for Badger HS, LG School District, Williams Bay. During school year only (Sep–May), one genuine local school item/day.
7. **Library, parks, public meetings** — same pattern.

### Phase 3 — The Business Coverage engine (week 2–3)
This is the biggest *new* lever and the one that doubles as monetization.

8. **`business_stories` table** — typed rows (`new_on_menu`, `owner_spotlight`, `behind_the_business`, `history`, `seasonal_update`) linked to `business_profiles.id`. Each row is the *real input* (the menu item, the owner quote, the photo, the fact). AI then expands it into a 150–300 word piece on publish.
9. **Two intake paths**:
   - Owner self-serve form (logged-in business owner submits "new on menu" with a photo + one sentence — AI writes the post, owner approves)
   - Editor-initiated (you pick a business, fill the form, AI drafts)
10. **Auto-rotation** — one business story published per day, round-robin across active businesses with cooldown to avoid repeats.

### Phase 4 — The Signal Desk (week 3–4)
The "what is Lake Geneva talking about" anchor.

11. **`community_signals` table** — n8n workflow watches a curated list of public Facebook pages, Nextdoor public posts, Reddit r/LakeGeneva, and our own tip inbox. Each signal is a row: `question_text`, `source_url`, `observed_at`, `category`, `signal_strength` (count of similar mentions).
12. **Daily "Signal Desk" digest** — every morning, AI clusters the day's signals into 5–10 bullets ("Three readers asked what's replacing Pita Pit", "Helicopter spotted over Geneva Bay around 4pm — no incident report yet"). Published as a single daily block on the homepage.
13. **Investigative trigger** — high-strength signals (≥5 mentions) auto-create an editorial task for you/the desk to follow up.

### Phase 5 — Polls + History (week 4)
Always-on content engines.

14. **`polls` table + voting** — one new poll/week, results published as a follow-up post the next week. Schema supports the existing "Best Fish Fry" patterns.
15. **`history_entries` table** — seed once with ~400 dated entries (one per day-of-year minimum) sourced from Geneva Lake Museum, library archives, and your own research. Publish "Today in Lake Geneva History" auto-daily at 6am.

### Phase 6 — Community Voices upgrade (week 5)
The pipeline exists; productize it.

16. **Pitch flow on `/community/voices`** — replace the empty-state with a real pitch form (`title`, `1-paragraph pitch`, `proposed angle`, `contact`).
17. **Editor approval workflow in dashboard** — review pitch → invite to draft → AI cleanup pass → editor approve → publish with real byline.

## Daily mix enforcement

A new `daily_mix_planner` job at 5am that looks at the next 12 hours of scheduled stories and ensures the day hits the target ratio. If a pillar is short, it auto-promotes from the relevant evergreen pool (history entry, business-story queue, poll). If a pillar is over, surplus moves to `editorial_later`.

## What this means for the homepage

The feed becomes *anchored* rather than *whatever-came-in*:

```text
─────────────────────────────────────
TODAY'S BRIEF (existing)
─────────────────────────────────────
THE SIGNAL DESK — what LG is talking about
─────────────────────────────────────
LEAD STORY (real news, if any)
─────────────────────────────────────
On the menu / Business spotlight (rotating)
─────────────────────────────────────
Events (today + this weekend)
─────────────────────────────────────
Schools & community
─────────────────────────────────────
Today in Lake Geneva History
─────────────────────────────────────
Catching up (everything else)
─────────────────────────────────────
```

Every section has a guaranteed daily entry from its dedicated pool. The page is never thin again.

## Technical surface (for the dev pass)

- **New tables**: `business_stories`, `community_signals`, `polls`, `poll_votes`, `history_entries`, `daily_mix_targets`
- **New edge functions**: `generate-business-story`, `cluster-daily-signals`, `daily-mix-planner`, `publish-history-of-the-day`
- **New n8n workflows**: civic-spine webhooks (per source), facebook/nextdoor signal watcher, school-feed webhook
- **New dashboard pages**: Business Stories queue, Signal Desk, Polls manager, History library
- **New public surfaces**: Signal Desk block on home, History block on home, `/polls`, business story permalinks
- **Modified**: ingestion classifier (Tier-0 cap + geo filter), Source Health (retire dead sources), homepage layout (anchored sections)

## What I'd ship in week 1 to prove the thesis

Just three things, to validate before building the rest:

1. **Tier-0 cap + Milwaukee filter** (1 SQL rule, 1 classifier tweak) — proves the feed quality jumps immediately.
2. **`history_entries` seeded with 60 days + auto-publish** — proves "anchored daily content" works without n8n.
3. **One business spotlight written this way** end-to-end with Oakfire or Simple Cafe — proves the business-story engine before we build the full intake form.

If those three move the needle in a week, we commit to phases 3–6. If they don't, we re-plan before building more infrastructure.

---

**Open questions before I implement:**

1. Do you want to start with the Phase 1 quick wins (Tier-0 cap, Milwaukee filter, dedupe, retire dead sources) this session, or jump straight into the bigger Phase 3 business-coverage engine?
2. For the Signal Desk, are you comfortable with n8n scraping public Facebook pages, or do you want to start with just tip-form + Reddit + Nextdoor (lower legal/TOS risk)?
3. For history entries, do you have a source you trust (Geneva Lake Museum, a specific book) or should I draft a research plan first?
