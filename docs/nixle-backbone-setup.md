# Nixle + official alerts → `ingest-incident`

Nixle is what the Walworth County Sheriff and most local agencies use to push
verified public-safety alerts. It's free and **higher confidence** than Facebook
scraping (baseline confidence 95 vs. 70 for Apify). This is the backbone — Apify
is the chatter layer.

## Option A — Quick start (text alerts to your phone)

1. Text **WALWORTH** to **888777** to subscribe via SMS.
2. Confirm alerts arrive for the Lake Geneva / Walworth County region.
3. This is just for testing coverage — not for ingestion.

## Option B — Email-to-webhook (recommended for ingestion)

1. Sign up at https://www.nixle.com using `alerts@lakegenevabrief.com` (or a Gmail alias forwarded to one).
2. Subscribe to: Walworth County Sheriff, City of Lake Geneva PD, Lake Geneva Fire Department, any other agencies serving towns we cover.
3. Set the inbox to forward every Nixle email to a parser webhook:

### Using SendGrid Inbound Parse (free tier covers this)

1. In SendGrid → **Settings → Inbound Parse** → Add Host & URL:
   - Receiving Domain: a subdomain you control, e.g. `nixle.lakegenevabrief.com`
   - Destination URL: `https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/ingest-nixle-parser`
2. Add MX record `nixle.lakegenevabrief.com → mx.sendgrid.net` (priority 10).
3. Set your Nixle account email to `forward@nixle.lakegenevabrief.com` (any inbox at that subdomain works).

Then add a small `ingest-nixle-parser` edge function (future work) that:
- Parses the SendGrid multipart email body.
- Extracts subject/body/issuing agency.
- POSTs to `ingest-incident` with `source: "nixle_walworth_sheriff"`, `source_type: "nixle"`.

## Option C — Manual paste (zero-setup interim)

While waiting on Option B, the admin moderation queue has a "Quick add" form that lets you paste a Nixle alert verbatim, picks `source_type: official`, and publishes immediately.

## Why this matters

The Apify Facebook scrapers will lose access from time to time (Meta cat-and-mouse). Nixle never breaks — it's the official channel. Once Option B is live, even if Apify dies for a week, the site still has live verified content.

## Auto-publish behavior

Nixle alerts get `source_type: "nixle"` → confidence baseline 95 → skips the geo bbox check (Nixle is pre-filtered by agency area) and almost always lands as Tier 1 auto-publish.