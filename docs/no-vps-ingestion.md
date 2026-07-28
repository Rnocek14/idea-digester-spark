# No-VPS Ingestion — Removing the n8n / Apify Dependency

**Goal:** every source in the city template is fetched by code that lives in
this repo and runs on Supabase cron. No machine you have to keep alive, no
per-city scraping bill, nothing that breaks silently on someone else's server.

## What n8n/Apify were doing, and what replaced them

| Job | Old path | New path | Status |
|---|---|---|---|
| lakegenevanews.net (Cloudflare) | n8n Puppeteer VPS → `ingest-news` | `scrape-lakegenevanews` (Firecrawl) on hourly cron | **Replaced** — the function already existed, it was just never scheduled |
| County / Sheriff CivicEngage (Cloudflare) | n8n webhook (never built) | `sync-rss` Firecrawl fallback, sources reactivated as `type='scrape'` | **Replaced** |
| Facebook fire/police/school pages | Apify Facebook scraper | `ingest-email` (Nixle, listservs, press releases) | **Replaced by equivalent coverage** — see below |

Firecrawl stays (it's an API, not a server you run) and is already in the
stack. If you ever want to drop it too, the DIY fetch path in `sync-rss`
handles every non-protected source; Firecrawl only matters for Cloudflare and
JS-rendered pages.

## Why Facebook can't be replaced *directly* — and why that's fine

Facebook actively blocks scraping. Apify only works because it runs browser
automation behind residential proxies; that's why it costs per city and why it
cannot be a template dependency. There is no honest way to do it from an edge
function.

**But the content isn't actually Facebook-exclusive.** In nearly every town,
the same fire/police/school/city alerts that get posted to Facebook also go out
through channels that are free, structured, and email-based:

- **Nixle** — the actual backbone for police/fire alerts in most US
  municipalities. Free to subscribe by ZIP.
- **Government listservs** — city/county/school notification lists.
- **Press-release distribution** — most agencies will add an address on request.
- **School closings** — district notification lists (Blackboard/Finalsite).

So instead of scraping Facebook, `ingest-email` subscribes an inbox to those
lists and ingests them. This is strictly better: higher trust (Nixle is an
official channel, confidence baseline 95 vs Facebook's 70), no bot-blocking,
no per-city cost, and it scales to a thousand cities by adding filters to one
inbox.

## How `ingest-email` works

1. Cron fires every 10 minutes.
2. The function refreshes a Gmail access token over HTTPS (no raw TCP, no
   browser) and lists unread messages.
3. Each sender is matched against a `sources` row whose
   `metadata.email_from` equals that address. **Unknown senders are ignored and
   left unread** — never guessed at, so a marketing email can't become a news
   story.
4. Matched messages are parsed (multipart-aware, HTML de-tagged, listserv
   boilerplate stripped) and POSTed to `ingest-incident`.
5. `ingest-incident` applies the full editorial pipeline — Tier-4 auto-reject,
   Tier-3 skip, geo gates, dedupe, confidence scoring. **Email gets no special
   privileges over any other source.**
6. Only after a successful ingest is the message marked read; a failed ingest
   leaves it unread so the next run retries it.

Until Gmail credentials are set, the function no-ops cleanly — it never errors
into your health digest.

## One-time setup

1. Create a dedicated inbox (e.g. `ingest@yourdomain.com` on Google Workspace,
   or a plain Gmail account).
2. In Google Cloud Console: create an OAuth client (Desktop app), enable the
   Gmail API, and authorize the inbox once to obtain a **refresh token**
   (scope: `https://www.googleapis.com/auth/gmail.modify`).
3. Store as Supabase secrets: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`,
   `GMAIL_REFRESH_TOKEN`.
4. Subscribe that inbox to Nixle (by ZIP), your city's notification lists, and
   any agency press-release lists.
5. For each sender, add/activate a `sources` row with
   `metadata.email_from = '<sender address>'` and
   `metadata.email_source_type` (`nixle` | `official` | `email`).
   Migration `20260718190000` seeds two examples, inactive.

## Per-city rollout

Adding a city means: subscribe the same inbox to that city's Nixle ZIP and
lists, then add `sources` rows with `city_id = '<city>'` and the sender
addresses. One inbox serves the entire fleet. No new infrastructure, ever.

**Roadmap:** an inbound-webhook variant (Cloudflare Email Routing or
SendGrid Inbound Parse → this same function) would remove the Gmail polling
step and the OAuth setup entirely. Worth doing if the inbox ever becomes a
bottleneck; the parsing and routing logic is already shared.
