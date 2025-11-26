# n8n Workflow Guide: Lake Geneva Content Ingestion

This guide provides step-by-step instructions to build the RSS → Supabase content ingestion pipeline in n8n.

## Prerequisites

Before starting:
- Supabase project with `sources` and `content_queue` tables configured
- At least one RSS source in `public.sources` with `status = 'active'` and `type = 'rss'`
- n8n instance (cloud or self-hosted)
- Supabase Service Role Key
- OpenAI API key

## Step 0: Set Up n8n Credentials

### 0.1 Supabase HTTP Credentials

1. In n8n, navigate to **Credentials → Create New**
2. Select **HTTP Request** authentication type
3. Configure:
   - **Name:** `Supabase Service`
   - **Authentication:** Header Auth
   - **Header Name:** `apikey`
   - **Value:** `YOUR_SUPABASE_SERVICE_ROLE_KEY`
4. Add additional default headers:
   - `Authorization: Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY`
   - `Content-Type: application/json`

### 0.2 OpenAI Credentials

1. In n8n, navigate to **Credentials → Create New**
2. Select **OpenAI** credential type
3. Configure:
   - **Name:** `OpenAI Main`
   - **API Key:** Your OpenAI API key

---

## Step 1: Create Workflow Skeleton

1. Create a new workflow in n8n
2. Name it: **"Lake Geneva – Multi-Source → Supabase Content Queue"**
3. You will add these nodes:
   1. Cron (trigger)
   2. HTTP Request – Get active sources (RSS + scrape)
   3. Split In Batches – iterate sources
   4. Switch – route by source type
   5. **RSS path:** RSS Read → Normalize RSS
   6. **Scrape path:** HTTP Request → HTML Extract → Normalize Scrape
   7. OpenAI – summary + category (shared)
   8. Function – build final payload (shared)
   9. HTTP Request – insert into content_queue (shared)

---

## Step 2: Add Cron Trigger

**Node 1: Cron**

1. Add a **Cron** node to the canvas
2. Configure:
   - **Mode:** `Every X Minutes`
   - **Every:** `15` (or your preferred interval)
3. This will fire the pipeline on schedule

Connect: **Cron → HTTP Request (Get Active Sources)**

---

## Step 3: Get Active Sources (RSS + Scrape)

**Node 2: HTTP Request – "Get Active Sources"**

1. Add an **HTTP Request** node
2. Configure:
   - **Credentials:** Select `Supabase Service`
   - **Method:** `GET`
   - **URL:** 
     ```
     {{$env.SUPABASE_URL}}/rest/v1/sources?status=eq.active&select=*
     ```
     *(Note: No type filter – this returns both `rss` and `scrape` sources)*
   - **Response Format:** JSON
3. Ensure headers include (if not in credentials):
   - `Authorization: Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}`
   - `Accept: application/json`

**Test:** Click *Execute Node* – you should see an array of source rows including different types

Connect: **Get Active Sources → Split In Batches**

---

## Step 4: Split Sources Into Individual Items

**Node 3: Split In Batches – "For Each Source"**

1. Add a **Split In Batches** node
2. Configure:
   - **Batch Size:** `1`
   - **Input:** Output from "Get Active Sources"
3. This processes one source at a time

Connect: **For Each Source → Switch**

---

## Step 5: Route by Source Type

**Node 4: Switch – "Route by Source Type"**

1. Add a **Switch** node
2. Configure:
   - **Mode:** `Expression`
   - **Property to compare:** 
     ```
     {{$json["type"]}}
     ```
3. Add routing rules:
   - **Rule 1:** When value equals `rss` → output 0
   - **Rule 2:** When value equals `scrape` → output 1

This splits your workflow into two parallel paths based on source type.

Connect: 
- **Switch (output 0 - rss) → RSS Read**
- **Switch (output 1 - scrape) → Fetch HTML Page**

---

## RSS Path (for RSS feeds)

### Step 6a: Fetch RSS Feed Items

**Node 5a: RSS Read – "Fetch RSS Items"**

1. Add an **RSS Read** node
2. Configure:
   - **URL:** 
     ```
     {{$json["url"]}}
     ```
   - This pulls the `url` field from each source row
3. Keep default options or adjust max items as needed

This outputs one item per RSS entry with fields like `title`, `link`, `pubDate`, `content`, etc.

Connect: **Fetch RSS Items → Normalize RSS Item**

---

### Step 7a: Normalize RSS Items

**Node 6a: Function – "Normalize RSS Item"**

1. Add a **Function** node
2. Paste this code:

```javascript
// Get the source row from "For Each Source"
const sourceItem = $items("For Each Source")[0].json;
const item = $json; // current RSS entry

// Try to pick the best content field
const body =
  item["content:encoded"] ||
  item["content"] ||
  item["description"] ||
  "";

return [
  {
    json: {
      // Required for ingestion contract
      source_id: sourceItem.id,
      title: item.title || "(Untitled)",
      content: body,
      original_url: item.link || null,

      // Original publish timestamp (if present)
      original_published_at: item.pubDate || item.isoDate || null,

      // Hint category from source
      source_category: sourceItem.category || null,

      raw: item, // raw RSS data for metadata
    },
  },
];
```

This creates a consistent structure regardless of RSS feed variations.

Connect: **Normalize RSS Item → OpenAI** (Step 8)

---

## Scrape Path (for HTML pages)

### Step 6b: Fetch HTML Page

**Node 5b: HTTP Request – "Fetch HTML Page"**

1. Add an **HTTP Request** node
2. Configure:
   - **Method:** `GET`
   - **URL:**
     ```
     {{$json["url"]}}
     ```
   - **Response Format:** `String` (raw HTML)
3. This fetches the full HTML of the page

Connect: **Fetch HTML Page → HTML Extract**

---

### Step 7b: Extract Event Data

**Node 6b: HTML Extract – "Extract Event Cards"**

1. Add an **HTML Extract** node
2. Configure:
   - **HTML:** `={{$json["data"] || $json}}`
   - **Extract Multiple:** `Yes`
   - **Item Selector:** 
     ```
     .event-card
     ```
     *(Adjust this CSS selector based on the actual HTML structure)*

3. Define fields to extract:
   - **title:** Selector `.event-card__title` (or equivalent)
   - **link:** Selector `.event-card__link@href` (use `@href` to get attribute)
   - **date:** Selector `.event-card__date`
   - **description:** Selector `.event-card__excerpt`

**Note:** These selectors are examples. You'll need to:
- Inspect the actual HTML of your target page (e.g., Visit Lake Geneva Events)
- Identify the correct CSS selectors for event cards and their fields
- You can use browser DevTools to find the right selectors

Each execution item will be one extracted event:
```json
{
  "title": "Lake Geneva Ice Castles",
  "link": "https://www.visitlakegeneva.com/event/...",
  "date": "December 15, 2025",
  "description": "Experience magical ice sculptures..."
}
```

Connect: **HTML Extract → Normalize Scraped Item**

---

### Step 8b: Normalize Scraped Items

**Node 7b: Function – "Normalize Scraped Item"**

1. Add a **Function** node
2. Paste this code:

```javascript
// Get the source row from "For Each Source"
const sourceItem = $items("For Each Source")[0].json;
const item = $json; // current scraped event

// Build content body from available fields
const bodyParts = [
  item.description || "",
  item.details || "",
  item.excerpt || ""
].filter(Boolean);

const body = bodyParts.join("\n\n") || item.title || "(No content)";

return [
  {
    json: {
      // Required for ingestion contract
      source_id: sourceItem.id,
      title: item.title || "(Untitled)",
      content: body,
      original_url: item.link || sourceItem.url,

      // Try to preserve date if available
      original_published_at: item.date || null,

      // Scraped events typically fall under 'events' category
      source_category: sourceItem.category || "events",

      raw: item, // raw scraped data for metadata
    },
  },
];
```

This creates the same normalized structure as RSS items.

Connect: **Normalize Scraped Item → OpenAI** (Step 8)

---

## Shared AI & Insert Path (for both RSS and Scrape)

Both the RSS path and Scrape path now converge into the same downstream nodes.

### Step 8: AI Summarization & Categorization

**Node 7 (shared): OpenAI – "Summarize & Categorize"**

1. Add an **OpenAI** node (Chat model)
2. This node receives input from **both** paths:
   - **Normalize RSS Item** (from RSS path)
   - **Normalize Scraped Item** (from Scrape path)
3. Configure:
   - **Credentials:** Select `OpenAI Main`
   - **Resource:** Chat
   - **Model:** `gpt-4o` or similar
4. Set messages:

**System Message:**
```
You are helping normalize local news content for an autonomous local media network.
```

**User Message:**
```
Given this article body, produce:
- A short 1–3 sentence summary in a neutral, community-friendly tone.
- A single category from this fixed set: news, events, dining, real-estate, community.

Respond as JSON ONLY, in this format:

{
  "summary": "...",
  "category": "news"
}

Article body:
{{$json["content"]}}
```

4. Enable JSON output if your n8n version supports it

Connect: **OpenAI → Function (Build Payload)**

---

### Step 9: Build Final content_queue Payload

**Node 8 (shared): Function – "Build ContentQueue Payload"**

1. Add a **Function** node
2. Paste this code:

```javascript
const item = $items("Normalize RSS Item")[0].json;
const aiRaw = $json;

// Handle JSON string vs object from OpenAI
let ai = aiRaw;
if (typeof aiRaw === "string") {
  try {
    ai = JSON.parse(aiRaw);
  } catch (e) {
    ai = {};
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
      summary: ai.summary || null,
      category: ai.category || item.source_category || null,

      // Source metadata
      original_url: item.original_url,
      publish_date: item.original_published_at || null,

      // Contract-aligned metadata
      metadata: {
        original_published_at: item.original_published_at || null,
        location_tags: ["Lake Geneva"], // can be made per-source later
        ai_model: "openai:gpt-4o",
        scrape_timestamp: now,
        raw_data: item.raw,
      },
    },
  },
];
```

This produces a payload that exactly matches the ingestion contract.

**Note:** This function works identically for items coming from either the RSS path or the Scrape path, since both were normalized to the same structure.

Connect: **Build Payload → HTTP Request (Insert)**

---

### Step 10: Insert Into content_queue

**Node 9 (shared): HTTP Request – "Insert into Content Queue"**

1. Add an **HTTP Request** node
2. Configure:
   - **Credentials:** Select `Supabase Service`
   - **Method:** `POST`
   - **URL:**
     ```
     {{$env.SUPABASE_URL}}/rest/v1/content_queue
     ```
   - **Headers:**
     - `Authorization: Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}`
     - `Content-Type: application/json`
     - `Prefer: return=representation`
   - **Body:**
     - **Send:** JSON
     - **Body Content:** `[ $json ]`

This inserts one record per request (batching can be added later for optimization).

---

## Step 11: Test The Pipeline

### Pre-flight checks:
1. In Supabase, confirm sources exist for both types:
   - At least one RSS source: `status = 'active'`, `type = 'rss'`, valid `url`
   - At least one scrape source: `status = 'active'`, `type = 'scrape'`, valid `url`
   - Use the sample sources from `docs/sample-sources-seed.sql`

### Run the workflow:
1. In n8n, click **Execute Workflow** (manual run)
2. Watch each node execute in sequence
3. The Switch node should route to different paths based on source type
4. Check for errors at each step in both paths

### Verify results:
1. **In Supabase:**
   - Navigate to `content_queue` table
   - Look for new rows with:
     - `status = 'pending'`
     - Populated `source_id`, `title`, `content`, `summary`, `category`
     - Valid JSON in `metadata` field

2. **In Admin Dashboard:**
   - Check Dashboard metrics – "Pending Content" should increase
   - Navigate to Content Queue page
   - Verify new stories appear from both RSS and scraped sources
   - Check that `source_id` correctly links to the originating source

---

## Workflow Architecture Summary

Your completed workflow now has this structure:

```
Cron (15min)
  ↓
Get Active Sources (RSS + Scrape)
  ↓
Split In Batches (1 source at a time)
  ↓
Switch (by source.type)
  ├─ RSS path:
  │   ↓
  │  RSS Read
  │   ↓
  │  Normalize RSS Item
  │   ↓
  └─ Scrape path:
      ↓
     Fetch HTML Page
      ↓
     HTML Extract
      ↓
     Normalize Scraped Item
      ↓
     [Both paths merge here]
      ↓
    OpenAI (Summarize & Categorize)
      ↓
    Build ContentQueue Payload
      ↓
    Insert into content_queue
```

This architecture:
- Handles multiple source types in one workflow
- Normalizes different content formats into a consistent structure
- Applies AI enrichment uniformly across all sources
- Produces contract-compliant payloads for Supabase
- Can be extended easily (add `api` path later)

---

## Troubleshooting

### No sources returned (Step 3)
- Verify sources exist in `public.sources` with `status = 'active'` and `type = 'rss'`
- Check Supabase credentials are correct
- Verify RLS policies allow service role key access

### RSS Read fails (Step 6a)
- Test the RSS feed URL in a browser
- Check if the feed requires authentication
- Verify URL is valid in source record

### HTML Extract fails (Step 7b)
- Inspect the target page HTML in browser DevTools
- Verify CSS selectors match the actual HTML structure
- Check if page requires JavaScript rendering (n8n HTML Extract only works with static HTML)
- Consider if the page blocks automated requests (check for 403/429 errors)
- Test selectors are unique and not too broad

### Scraped content is empty (Step 8b)
- Verify HTML Extract is finding elements (check node output)
- Ensure selectors target the correct fields
- Check if page structure has changed since configuration
- Some sites may use dynamic content that requires JavaScript

### OpenAI errors (Step 7)
- Verify OpenAI API key is valid and has credits
- Check if content is too long (may need truncation)
- Verify model name is correct

### Insert fails (Step 9)
- Check Supabase service role key permissions
- Verify payload structure matches table schema
- Review Supabase logs for constraint violations

---

## Environment Variables

Set these in n8n (Settings → Environment Variables):

```
SUPABASE_URL=https://mzumvkrpnxhkvhdyzgqa.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
OPENAI_API_KEY=your_openai_key_here
```

**Security Note:** Never commit these keys to version control or expose them in client-side code.

---

## Next Steps

Once both RSS and scraping workflows are running successfully:

1. **Add API-type sources** – Create a third path in the Switch node for `type = 'api'` sources that call structured APIs
2. **Add error handling** – Implement error branches and notification nodes for failed fetches or parsing
3. **Optimize batching** – Insert multiple items per request to reduce API calls
4. **Add deduplication** – Check if content already exists (by `original_url` or title hash) before inserting
5. **Monitor performance** – Track execution time, token usage, and success rates
6. **Enhance scraping** – Add support for pagination, multiple page types, or JavaScript-rendered content (using Puppeteer if needed)
7. **Refine selectors** – As pages change, update HTML Extract selectors in the workflow

---

## CSS Selector Tips for HTML Extract

When configuring the HTML Extract node for scraping:

**Finding selectors:**
1. Open the target page in your browser
2. Right-click on the element you want to extract → "Inspect"
3. In DevTools, right-click the highlighted HTML element → "Copy" → "Copy selector"
4. Simplify the selector if possible (remove overly specific classes)

**Best practices:**
- **Use semantic selectors** when possible: `article`, `h2`, `.event-title` rather than deeply nested divs
- **Test selectors** in DevTools console: `document.querySelectorAll('.your-selector')`
- **Extract attributes** using `@attributeName`: `.link@href`, `img@src`
- **Start broad, then narrow**: First extract all event cards (`.event-card`), then fields within each card
- **Avoid brittle selectors**: Don't rely on auto-generated classes like `.css-abc123`

**Common patterns:**
```
Items container:     .events-list, .event-cards, article
Individual items:    .event-item, .event-card, article.event
Title:              h2, .event-title, .title
Link:               a@href, .event-link@href
Date:               .date, time, .event-date
Description:        p, .description, .excerpt
```

---

## Related Documentation

- [Ingestion Contract](./ingestion-contract.md) – Payload structure and requirements for both RSS and scrape sources
- [Sample Sources Seed](./sample-sources-seed.sql) – Initial Lake Geneva sources (RSS and scrape) to test with

---

## Alignment with Lake Geneva Strategy

This multi-source workflow directly supports the autonomous local media network strategy:

**Content Pillars Covered:**
- **News**: City RSS feeds, local news outlets
- **Events**: Scraped from Visit Lake Geneva and event calendars  
- **Community**: Mix of both RSS and scraped civic content

**Key Benefits:**
- **Comprehensive coverage**: Captures content even from sources without RSS feeds
- **Consistent quality**: AI enrichment normalizes tone and categorization across sources
- **Scalable**: Easy to add new sources of any type without changing core pipeline
- **Autonomous**: Runs on schedule, minimal human intervention needed

Once content flows into `content_queue`, editors use the Admin Dashboard to review, approve, and publish stories across multiple channels.
