# Content Queue Ingestion Contract

## Overview

This document defines the standardized contract for external automation tools (n8n/Make) to insert normalized content into the `content_queue` table for editorial review and publishing.

## Ingestion Payload Schema

```typescript
{
  // REQUIRED
  source_id: string,      // UUID from public.sources.id
  title: string,          // Human-friendly headline
  content: string,        // Full article body or normalized text
  status: "pending",      // Always "pending" for automated items

  // RECOMMENDED
  summary?: string,       // AI-generated short summary
  category?: string,      // e.g. "news" | "events" | "dining" | "real-estate" | "community"
  original_url?: string,  // URL of the source page/post
  author?: string,
  image_url?: string,

  // TIMING
  // created_at is set automatically by Supabase (ingestion time)
  publish_date?: string,  // ISO timestamp of original publish time, if available

  // STRUCTURED METADATA (optional but powerful)
  metadata?: {
    original_published_at?: string;    // Same as publish_date or more precise
    location_tags?: string[];          // e.g. ["Lake Geneva"]
    ai_model?: string;                 // e.g. "gpt-4o"
    tokens_used?: number;
    scrape_timestamp?: string;
    raw_data?: any;                    // Raw RSS / HTML / API payload
    [key: string]: any;
  };
}
```

### Timestamp Conventions

- **`created_at`** (automatic) = Ingestion time into the dashboard system
- **`publish_date`** (optional) = Original publish time from the source, if known
- **`metadata.original_published_at`** = More precise version of original publish time
- **`metadata.scrape_timestamp`** = When the automation fetched the content

### Status Rules

- Callers always send `status = "pending"`; the server decides the real status.
- `ingest-news` applies the same publish gate sync-rss items get, using a
  keyword screen in place of the AI safety pass:
  - Sensitive-topic keyword match (crime/courts, death/tragedy, charged
    topics) → `pending` with `hold_reason = "sensitive_keyword_screen"`,
    `safety_level = "sensitive"` — human review required.
  - Clean + hyperlocal source (`geo_tier >= 1`) → `auto_published`,
    `safety_level = "safe"` (`decision_path = "ingest_trusted_auto"`).
  - Clean + non-hyperlocal → `pending` with `hold_reason = "untrusted_tier"`.
- `safety_level` and `publish_date` are always written. A missing original
  publish time falls back to ingestion time (a DB trigger enforces this for
  every insert path) — the public feed filters on both columns, so NULLs made
  articles permanently invisible.
- Status transitions: `pending` → `auto_published`/`published` (or `rejected`)

### Location Tags

- Use `metadata.location_tags` for multi-city readiness
- Example: `["Lake Geneva"]`
- Future expansion can add `["Madison"]`, `["Milwaukee"]`, etc. without schema changes

## Supabase REST API Integration

### Base URL

```
https://mzumvkrpnxhkvhdyzgqa.supabase.co/rest/v1
```

### Authentication

All requests from n8n/Make must use the **service role key** (server-side only, never in browser):

```
apikey: {SUPABASE_SERVICE_ROLE_KEY}
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
Content-Type: application/json
```

### Get Active Sources

```http
GET /rest/v1/sources?status=eq.active&select=*
```

Returns an array of active source configurations that your workflows should poll.

### Insert Content into Queue

```http
POST /rest/v1/content_queue
Prefer: return=representation
Body: {ingestion payload as defined above}
```

Supabase will auto-populate `id`, `created_at`, and `updated_at`.

---

## n8n Workflow Blueprint

### Overview

**Workflow Name:** "Poll Active Sources → Fetch Items → Enrich with AI → Insert into Content Queue"

**High-Level Flow:**
1. Cron trigger (every 15 minutes)
2. Fetch active sources from Supabase
3. Iterate over sources
4. Route by source type (RSS/API/Scrape)
5. Fetch content from source
6. Normalize into standard shape
7. AI enrichment (summary + category)
8. Build final payload
9. Insert into `content_queue`

---

### Node 1: Cron Trigger

**Node Type:** Cron

**Config:**
- Mode: `Every X Minutes`
- Interval: `15` minutes

**Purpose:** Kicks off the ingestion pipeline on a schedule.

---

### Node 2: Get Active Sources

**Node Type:** HTTP Request

**Config:**
- Method: `GET`
- URL: `{{ $env.SUPABASE_URL }}/rest/v1/sources?status=eq.active&select=*`
- Headers:
  ```
  apikey: {{ $env.SUPABASE_SERVICE_ROLE_KEY }}
  Authorization: Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}
  ```

**Output:** JSON array of source records with `id`, `name`, `type`, `url`, `category`, etc.

---

### Node 3: Split Into Batches

**Node Type:** Split In Batches

**Config:**
- Batch Size: `1`

**Purpose:** Process each source individually.

---

### Node 4: Route by Source Type

**Node Type:** Switch (or IF)

**Config:**
- Property: `={{ $json["type"] }}`
- Cases:
  - `rss`
  - `api`
  - `scrape`

**Purpose:** Route to appropriate fetch logic based on source type.

---

### Node 5: Fetch RSS Items (RSS Path)

**Node Type:** RSS Read

**Config:**
- URL: `={{ $json["url"] }}`

**Output:** Array of RSS items with `title`, `link`, `pubDate`, `content`, etc.

---

### Node 6: Normalize RSS Item

**Node Type:** Function

**Code:**
```javascript
// One item per execution
const source = $items("Split In Batches")[0].json; // upstream source row
const item = $json; // current RSS item

// Try to pick the best content field
const body =
  item["content:encoded"] ||
  item["content"] ||
  item["description"] ||
  "";

return [
  {
    json: {
      source_id: source.id,
      title: item.title || "(Untitled)",
      content: body,
      original_url: item.link || null,
      // original publish timestamp (if present)
      original_published_at: item.pubDate || item.isoDate || null,
      // Use the source.category as default category hint
      source_category: source.category || null,
      raw: item, // keep raw for metadata
    },
  },
];
```

**Purpose:** Convert raw RSS structure into consistent intermediate format.

---

### Node 7: AI Enrichment

**Node Type:** OpenAI (Chat Model)

**Prompt:**
```
You are helping normalize local news/events content for an autonomous local media network.

Given this article body, produce:

* A short 1–3 sentence **summary** in a neutral, community-friendly tone.
* A single **category** from this set: `news, events, dining, real-estate, community`.

Respond as JSON with:

{
  "summary": "...",
  "category": "news"
}

Article body:
{{ $json["content"] }}
```

**Config:**
- Model: `gpt-4o` or `gpt-4o-mini`
- Response Format: JSON (if available) or parse string output

**Output:** JSON with `summary` and `category`

---

### Node 8: Build Final Payload

**Node Type:** Function

**Code:**
```javascript
const item = $json; // includes source_id, title, content, etc.
const ai = $items("OpenAI")[0].json; // from OpenAI node

// Parse AI result if it's a string
let aiResult = ai;
if (typeof ai === "string") {
  try {
    aiResult = JSON.parse(ai);
  } catch (e) {
    aiResult = {};
  }
}

const now = new Date().toISOString();

return [
  {
    json: {
      source_id: item.source_id,
      title: item.title,
      content: item.content,
      status: "pending", // ALWAYS pending for automation

      // AI-enriched fields
      summary: aiResult.summary || null,
      category: aiResult.category || item.source_category || null,

      // Source metadata
      original_url: item.original_url,
      publish_date: item.original_published_at || null,

      // Metadata according to contract
      metadata: {
        original_published_at: item.original_published_at || null,
        location_tags: ["Lake Geneva"], // parametrize per source later
        ai_model: "openai:gpt-4o",      // or whatever you actually use
        scrape_timestamp: now,
        raw_data: item.raw,
      },
    },
  },
];
```

**Purpose:** Assemble contract-compliant payload for database insertion.

---

### Node 9: Insert into Content Queue

**Node Type:** HTTP Request

**Config:**
- Method: `POST`
- URL: `={{ $env.SUPABASE_URL }}/rest/v1/content_queue`
- Headers:
  ```
  apikey: {{ $env.SUPABASE_SERVICE_ROLE_KEY }}
  Authorization: Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}
  Content-Type: application/json
  Prefer: return=representation
  ```
- Body Mode: JSON
- Body: `={{ [$json] }}`

**Result:** Content appears in dashboard Content Queue with `status = pending`

---

## Environment Variables Required in n8n

```bash
SUPABASE_URL=https://mzumvkrpnxhkvhdyzgqa.supabase.co
SUPABASE_SERVICE_ROLE_KEY={your-service-role-key}
OPENAI_API_KEY={your-openai-key}
```

**Security Notes:**
- Service role key bypasses RLS - use only in trusted server environments
- Never expose service role key in client-side code
- Store keys in n8n environment variables or credentials store

---

## Example Source Configuration

To test this workflow, add sources to `public.sources`:

```sql
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes)
VALUES
  ('Visit Lake Geneva Events', 'rss', 'https://www.visitlakegeneva.com/events/feed/', 'events', 'active', 60),
  ('Local News RSS', 'rss', 'https://example-local-news.com/feed', 'news', 'active', 30),
  ('City Government Updates', 'api', 'https://city.gov/api/announcements', 'community', 'active', 120);
```

---

## Future Enhancements

- [ ] Respect `fetch_frequency_minutes` per source
- [ ] Add deduplication logic (check if content already exists by `original_url`)
- [ ] Parametrize `location_tags` per source in `sources.metadata`
- [ ] Add error handling and retry logic
- [ ] Implement API and scraper paths (nodes 5-6 variants)
- [ ] Track `last_fetched_at` in `sources` table after successful runs

---

## Alignment with Pilot Design

This contract and workflow implement the **decoupled ingestion layer** from the Lake Geneva Pilot Design:

✅ Normalized record structure (title, body, source metadata, timestamps, location, category, media)  
✅ External automation handles fetching + AI processing  
✅ Supabase stores normalized records in `content_queue`  
✅ Human editorial control via `status = pending`  
✅ Multi-city ready via `location_tags` in metadata  

---

## Support

For questions or issues with this contract:
1. Check Supabase table schema matches expectations
2. Verify n8n environment variables are set correctly
3. Review edge function logs if using custom backend logic
4. Test with small batches first (single source, single item)
