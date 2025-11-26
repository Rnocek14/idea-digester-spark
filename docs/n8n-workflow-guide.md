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
2. Name it: **"Lake Geneva – RSS → Supabase Content Queue"**
3. You will add 8 nodes in this order:
   1. Cron (trigger)
   2. HTTP Request – Get active sources
   3. Split In Batches – iterate sources
   4. RSS Read – fetch items
   5. Function – normalize item
   6. OpenAI – summary + category
   7. Function – build final payload
   8. HTTP Request – insert into content_queue

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

## Step 3: Get Active RSS Sources

**Node 2: HTTP Request – "Get Active Sources"**

1. Add an **HTTP Request** node
2. Configure:
   - **Credentials:** Select `Supabase Service`
   - **Method:** `GET`
   - **URL:** 
     ```
     {{$env.SUPABASE_URL}}/rest/v1/sources?status=eq.active&type=eq.rss&select=*
     ```
   - **Response Format:** JSON
3. Ensure headers include (if not in credentials):
   - `Authorization: Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}`
   - `Accept: application/json`

**Test:** Click *Execute Node* – you should see an array of source rows

Connect: **Get Active Sources → Split In Batches**

---

## Step 4: Split Sources Into Individual Items

**Node 3: Split In Batches – "For Each Source"**

1. Add a **Split In Batches** node
2. Configure:
   - **Batch Size:** `1`
   - **Input:** Output from "Get Active Sources"
3. This processes one source at a time

Connect: **For Each Source → RSS Read**

---

## Step 5: Fetch RSS Feed Items

**Node 4: RSS Read – "Fetch RSS Items"**

1. Add an **RSS Read** node
2. Configure:
   - **URL:** 
     ```
     {{$json["url"]}}
     ```
   - This pulls the `url` field from each source row
3. Keep default options or adjust max items as needed

This outputs one item per RSS entry with fields like `title`, `link`, `pubDate`, `content`, etc.

Connect: **Fetch RSS Items → Function (Normalize)**

---

## Step 6: Normalize RSS Items

**Node 5: Function – "Normalize RSS Item"**

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

Connect: **Normalize RSS Item → OpenAI**

---

## Step 7: AI Summarization & Categorization

**Node 6: OpenAI – "Summarize & Categorize"**

1. Add an **OpenAI** node (Chat model)
2. Configure:
   - **Credentials:** Select `OpenAI Main`
   - **Resource:** Chat
   - **Model:** `gpt-4o` or similar
3. Set messages:

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

## Step 8: Build Final content_queue Payload

**Node 7: Function – "Build ContentQueue Payload"**

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

Connect: **Build Payload → HTTP Request (Insert)**

---

## Step 9: Insert Into content_queue

**Node 8: HTTP Request – "Insert into Content Queue"**

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

## Step 10: Test The Pipeline

### Pre-flight checks:
1. In Supabase, confirm at least one RSS source exists:
   - `public.sources` table
   - `status = 'active'`
   - `type = 'rss'`
   - Valid `url` field

### Run the workflow:
1. In n8n, click **Execute Workflow** (manual run)
2. Watch each node execute in sequence
3. Check for errors at each step

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
   - Verify new stories appear in the table

---

## Troubleshooting

### No sources returned (Step 3)
- Verify sources exist in `public.sources` with `status = 'active'` and `type = 'rss'`
- Check Supabase credentials are correct
- Verify RLS policies allow service role key access

### RSS Read fails (Step 5)
- Test the RSS feed URL in a browser
- Check if the feed requires authentication
- Verify URL is valid in source record

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

Once the RSS workflow is running successfully:

1. **Add scrape-type sources** – Create a parallel path using HTTP Request + HTML parsing for sources like "Visit Lake Geneva Events"
2. **Add error handling** – Implement error branches and notification nodes
3. **Optimize batching** – Insert multiple items per request to reduce API calls
4. **Add deduplication** – Check if content already exists before inserting
5. **Monitor performance** – Track execution time and token usage

---

## Related Documentation

- [Ingestion Contract](./ingestion-contract.md) – Payload structure and requirements
- [Sample Sources Seed](./sample-sources-seed.sql) – Initial Lake Geneva sources to test with
