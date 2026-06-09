# Lake Geneva Regional News — n8n Puppeteer Ingestion

`lakegenevanews.net` is Cloudflare-protected and cannot be fetched from a
Supabase Edge Function. We extract it with a Puppeteer-based n8n workflow
running on the self-hosted n8n VPS, then POST the normalized payload to the
`ingest-news` edge function.

## Endpoint

```
POST https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/ingest-news

Headers:
  Authorization: Bearer ${NEWS_INGEST_SECRET}
  Content-Type: application/json
```

The function accepts either a single item or an array of items.

### Payload

```json
{
  "source": "lakegenevanews",
  "url": "https://lakegenevanews.net/news/example-story",
  "title": "Example Story",
  "published_at": "2026-06-09T12:00:00Z",
  "author": "Staff",
  "summary": "Short summary used as fallback if content is empty.",
  "content": "Full extracted article body…",
  "image_url": "https://lakegenevanews.net/images/example.jpg",
  "category": "news",
  "metadata": {
    "scraped_at": "2026-06-09T12:05:00Z",
    "source_type": "puppeteer",
    "ingest_method": "n8n_puppeteer"
  }
}
```

### Response (single item)

```json
{ "status": "inserted", "article_id": "uuid…", "url": "https://…" }
```

or

```json
{ "status": "skipped", "reason": "duplicate_url", "url": "https://…" }
```

Batch callers get `{ inserted, skipped, results: [...] }`.

## What the edge function handles for you

- Auth via `NEWS_INGEST_SECRET` (Bearer or `X-Ingest-Secret` header)
- URL normalization (strips tracking params, lowercases, trims trailing `/`)
- Dedup against `content_queue.normalized_url`
- Inserts as `status='pending'` (so editorial review still applies)
- Inherits `source_trust_score` and `default_geo_tier` from the
  `Lake Geneva Regional News` source row
- Updates `sources.last_fetched_at` / `last_successful_fetch_at` for
  Source Health
- Writes an `activity_log` audit row (`action='news_ingest'`)

Routing into Breaking / Right Now / Latest / Later is left to the existing
downstream pipeline based on category, geo tier, and trust score.

## n8n Workflow Blueprint

**Name:** `LakeGenevaNews — Puppeteer Ingest`
**Schedule:** every 30 minutes.

### Node 1 — Schedule Trigger
- Mode: Every 30 minutes.

### Node 2 — HTTP Request (Index Page via Puppeteer endpoint)
If you use the `n8n-nodes-puppeteer` community node, point it at:
`https://lakegenevanews.net/news/`

- Wait for selector: `article a[href*="/news/"]`
- Return: rendered HTML
- User agent: a real desktop Chrome UA
- Stealth mode: on

### Node 3 — HTML Extract
Extract a list of article links + titles from the index:
- `links`: `article a[href*="/news/"]` → attribute `href`
- `titles`: same selector → text

### Node 4 — Split In Batches
Iterate over the link list, batch size 1, with a short wait
(`2–4 s` random delay) between iterations to be polite.

### Node 5 — Puppeteer Fetch (Article)
For each link:
- Navigate to absolute URL
- Wait for selector: `article` or `main`
- Return rendered HTML

### Node 6 — HTML Extract (Article fields)
Pull:
- `title` ← `h1`
- `author` ← `.byline, [rel="author"]`
- `published_at` ← `time[datetime]` attribute `datetime`
- `image_url` ← `article img` attribute `src`
- `content` ← `article` text (inner text)

### Node 7 — Function (Normalize payload)
```javascript
const $input = items[0].json;
const absUrl = new URL($input.href, "https://lakegenevanews.net").toString();
return [{
  json: {
    source: "lakegenevanews",
    url: absUrl,
    title: ($input.title || "").trim(),
    author: $input.author || null,
    published_at: $input.published_at || null,
    image_url: $input.image_url || null,
    summary: ($input.content || "").slice(0, 300),
    content: $input.content || "",
    category: "news",
    metadata: {
      scraped_at: new Date().toISOString(),
      source_type: "puppeteer",
    },
  },
}];
```

### Node 8 — HTTP Request (POST to ingest-news)
- Method: `POST`
- URL: `https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/ingest-news`
- Headers:
  - `Authorization: Bearer {{ $env.NEWS_INGEST_SECRET }}`
  - `Content-Type: application/json`
- Body: JSON, `={{ $json }}`
- Continue on fail: ON (so one bad article doesn't kill the run)

### Node 9 — IF (status === "inserted")
Optional: branch on the response so you can log inserts vs. duplicates
separately, or send Slack notifications on errors.

## n8n Environment Variables (VPS)

```
NEWS_INGEST_SECRET=<same value stored in Supabase secrets>
```

Never put this secret in the dashboard repo or frontend code — it stays in
n8n credentials only.

## Operational Notes

- **Cadence:** 30 minutes matches `sources.fetch_frequency_minutes` on the
  Lake Geneva Regional News row. Stay at or above that — Cloudflare is
  patient if we are.
- **Backoff:** on repeated `Cloudflare 403`, pause the n8n workflow for
  6 hours rather than hammering.
- **Dedup is server-side.** Safe to re-run the workflow; duplicates are
  rejected by `normalized_url`.
- **No auto-publish.** All items land as `pending`; the editorial pipeline
  decides if/when they go live.
- **Health visibility.** `sources.last_fetched_at` updates on every POST,
  so Source Health alerts will fire if n8n stops sending for > 48h.

## Curl test

```bash
curl -X POST \
  -H "Authorization: Bearer $NEWS_INGEST_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "lakegenevanews",
    "url": "https://lakegenevanews.net/news/test-article",
    "title": "Test article",
    "content": "Hello from n8n",
    "published_at": "2026-06-09T12:00:00Z"
  }' \
  https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/ingest-news
```

Expected first run: `{"status":"inserted","article_id":"…","url":"…"}`
Re-run: `{"status":"skipped","reason":"duplicate_url","url":"…"}`
