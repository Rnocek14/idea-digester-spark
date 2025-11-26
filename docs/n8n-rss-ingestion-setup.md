# n8n RSS Ingestion Setup Guide

## Overview

This guide walks through setting up the n8n workflow that powers Phase 2 of the Autonomous Local Media Network: automated RSS ingestion with GPT normalization into the Supabase `content_queue`.

**Flow:** Cron → Fetch RSS sources → Parse feeds → Dedup check → GPT normalize → Insert to `content_queue`

---

## Prerequisites

Before starting, gather these credentials:

1. **Supabase Project URL**: `https://mzumvkrpnxhkvhdyzgqa.supabase.co`
2. **Supabase Service Role Key**: (from Supabase dashboard → Settings → API)
   - ⚠️ **NEVER** use the anon key for n8n workflows
   - Service role key bypasses RLS and is server-side only
3. **OpenAI API Key**: (from platform.openai.com)
4. **RSS Sources**: Use the "Seed Lake Geneva Sources" button in the dashboard Sources page

---

## GPT Article Normalizer Prompt

### System Prompt

Use this as the **System** or **Instruction** prompt in the OpenAI node:

```text
You are an editorial assistant for an autonomous local media network covering Lake Geneva, Wisconsin.

You receive raw article data from RSS feeds or scrapers. Your job is to:

1. Clean and normalize the content into a clear, human-readable story.
2. Write a concise but compelling title suitable for a local news feed.
3. Generate a short summary (1–3 sentences) in neutral, community-friendly tone.
4. Classify the story into one of these categories:
   - "news"
   - "events"
   - "dining"
   - "real-estate"
   - "community"

Always assume the location is Lake Geneva, WI or nearby Walworth County unless clearly indicated otherwise.

Return ONLY a single JSON object with this exact shape:

{
  "title": "string",
  "content": "string",
  "summary": "string",
  "category": "news | events | dining | real-estate | community",
  "metadata": {
    "source_title": "string | null",
    "source_published_at": "ISO 8601 string | null",
    "location_tags": ["Lake Geneva", "..."],
    "original_rss_title": "string | null",
    "original_rss_link": "string | null",
    "original_rss_description": "string | null"
  }
}

Rules:
- Do NOT include markdown in the content.
- Do NOT add extra keys.
- Do NOT wrap the JSON in backticks.
- Keep tone neutral, helpful, and local-focused.
```

### User Prompt Template

For each RSS item, use this template:

```text
Here is raw article data from an RSS item:

Title: {{ $json.title }}
Link: {{ $json.link }}
Published at: {{ $json.pubDate }}
Description/Content:
{{ $json.description || $json.content || '' }}

Normalize this into the JSON format described in the system instructions.
```

---

## n8n Workflow: Lake Geneva RSS Ingestion

### Node 1: Cron (Schedule Trigger)

- **Type**: Cron
- **Mode**: Every X minutes
- **Interval**: `30` minutes (adjust as needed)
- **Purpose**: Triggers the workflow automatically

---

### Node 2: HTTP Request – Get Active RSS Sources

- **Type**: HTTP Request
- **Name**: `Get RSS Sources`
- **Method**: `GET`
- **URL**: `https://mzumvkrpnxhkvhdyzgqa.supabase.co/rest/v1/sources?type=eq.rss&status=eq.active&select=*`
- **Headers**:
  - `apikey`: `<YOUR_SERVICE_ROLE_KEY>`
  - `Authorization`: `Bearer <YOUR_SERVICE_ROLE_KEY>`
  - `Content-Type`: `application/json`
- **Response Format**: JSON

**Returns**: Array of active RSS sources from your `sources` table.

---

### Node 3: Split In Batches

- **Type**: Split In Batches
- **Purpose**: Loop over each source
- **Batch Size**: `1`
- **Input**: Output from `Get RSS Sources`

---

### Node 4: HTTP Request – Fetch RSS Feed

- **Type**: HTTP Request
- **Name**: `Fetch RSS`
- **Method**: `GET`
- **URL**: `{{ $json["url"] }}`
  (Pulls from the `url` field of each source)
- **Response Format**: String (XML)

---

### Node 5: RSS Parser

**Option A: RSS Read Node** (if available)
- **Type**: RSS Read
- **URL**: Use output from Fetch RSS node
- **Output**: Items with `[title, link, pubDate, content, contentSnippet]`

**Option B: Function Node** (if RSS Read unavailable)
```javascript
// Parse XML to JSON first, then:
const items = $json.rss.channel[0].item || [];
return items.map(item => ({
  json: {
    title: item.title[0] || '',
    link: item.link[0] || '',
    pubDate: item.pubDate ? item.pubDate[0] : null,
    description: item.description ? item.description[0] : '',
    sourceName: $item(0).$node["Split In Batches"].json.name,
    sourceId: $item(0).$node["Split In Batches"].json.id,
  }
}));
```

**Result**: Each n8n item is now one RSS article.

---

### Node 6: HTTP Request – Dedup Check

- **Type**: HTTP Request
- **Name**: `Check Existing Content`
- **Method**: `GET`
- **URL**: `https://mzumvkrpnxhkvhdyzgqa.supabase.co/rest/v1/content_queue?original_url=eq.{{ $json["link"] }}&select=id`
- **Headers**: Same as Node 2
- **Response Format**: JSON

**Purpose**: Check if this article already exists by `original_url`.

---

### Node 7: IF Node – Skip Duplicates

- **Type**: IF
- **Condition**: `{{ $json.length }}` equals `0`
- **True Path**: Continue to GPT normalization
- **False Path**: End (skip duplicate)

---

### Node 8: OpenAI – Normalize Article

- **Type**: OpenAI (Chat/Completion)
- **Credentials**: Your OpenAI API key
- **Model**: `gpt-4.1-mini` or `gpt-5-mini` (recommended for cost/speed)
- **System Prompt**: Paste the full "Article Normalizer" prompt from above
- **User Prompt**: Use the template with `{{ $json.title }}`, `{{ $json.link }}`, etc.
- **Output**: JSON object with normalized content

**After this node**: Add a **JSON Parse** node if needed to convert text response to JSON object.

---

### Node 9: Function – Build Supabase Payload

```javascript
// GPT result (already parsed JSON)
const gpt = $json;

// Retrieve source info and original data from earlier nodes
const sourceId = $item(0).$node["Split In Batches"].json.id;
const sourceName = $item(0).$node["Split In Batches"].json.name;
const rssLink = $item(0).$node["RSS Parser or Function"].json.link;
const pubDate = $item(0).$node["RSS Parser or Function"].json.pubDate;

return [{
  json: {
    source_id: sourceId,
    title: gpt.title,
    content: gpt.content,
    summary: gpt.summary,
    category: gpt.category,
    author: null,
    original_url: rssLink,
    image_url: null,
    status: "pending",
    publish_date: pubDate || null,
    metadata: {
      ...gpt.metadata,
      source_name: sourceName,
      ingestion_origin: "n8n-rss",
      ingested_at: new Date().toISOString(),
    }
  }
}];
```

**Purpose**: Format GPT output into the exact schema required by `content_queue`.

---

### Node 10: HTTP Request – Insert to content_queue

- **Type**: HTTP Request
- **Name**: `Insert Content`
- **Method**: `POST`
- **URL**: `https://mzumvkrpnxhkvhdyzgqa.supabase.co/rest/v1/content_queue`
- **Headers**:
  - `apikey`: `<YOUR_SERVICE_ROLE_KEY>`
  - `Authorization`: `Bearer <YOUR_SERVICE_ROLE_KEY>`
  - `Content-Type`: `application/json`
  - `Prefer`: `return=representation`
- **Body Mode**: JSON
- **Body**: `{{ $json }}`

**Result**: New story inserted into `content_queue` with `status = 'pending'`.

---

## Testing the Workflow

### Step 1: Seed Sources
1. Open your Admin Dashboard → Sources
2. Click **"Seed Lake Geneva Sources"**
3. Verify 3 sources appear (City Civic Alerts, Walworth County News, Visit Lake Geneva Events)

### Step 2: Execute Workflow Manually
1. In n8n, open the "Lake Geneva RSS Ingestion" workflow
2. Click **"Execute Workflow"** (test button)
3. Watch each node execute:
   - ✅ Get RSS Sources returns 2+ items
   - ✅ RSS feeds are fetched
   - ✅ Articles are parsed
   - ✅ Dedup check runs
   - ✅ OpenAI normalizes content
   - ✅ Insert succeeds

### Step 3: Verify in Dashboard
1. Go to **Content Queue** in your dashboard
2. Filter by `Status: Pending`
3. You should see new stories from Lake Geneva sources
4. Click a story → Detail drawer opens
5. Review:
   - Title, summary, category (set by GPT)
   - Source name
   - Original URL
   - Full content

### Step 4: Approve & Publish
1. Click **"Approve"** on a story
2. Select **Publishing Targets** (Website, Newsletter, etc.)
3. Click **"Mark as Published"**
4. Story status changes to `published`
5. Activity feed logs the action

---

## Common Issues & Troubleshooting

### Issue: "No sources found"
- **Fix**: Make sure you seeded sources and they have `status = 'active'` and `type = 'rss'`

### Issue: "RSS feed returns 403/404"
- **Fix**: Check the feed URL in a browser first. Some feeds block bots or require user-agent headers.

### Issue: "GPT returns markdown or invalid JSON"
- **Fix**: Emphasize in the system prompt: "Do NOT wrap JSON in backticks. Return ONLY raw JSON."
- Consider adding a **Code node** to strip backticks if needed.

### Issue: "Duplicate articles keep getting inserted"
- **Fix**: Verify the IF condition checks `$json.length === 0` correctly. Log the dedup response to debug.

### Issue: "Service role key 401 error"
- **Fix**: Double-check you're using the **service role key**, not the anon key. Service role bypasses RLS.

### Issue: "OpenAI rate limit errors"
- **Fix**: Add a **Wait** node (e.g., 2-3 seconds) between OpenAI calls, or reduce cron frequency.

---

## Next Steps After RSS Ingestion Works

Once you have stories flowing into `content_queue` reliably:

### Phase 2.2: Add Scraping
- Extend this workflow with a second branch for `type = 'scrape'` sources
- Use **HTTP Request** + **HTML Extract** nodes
- Feed extracted data through the same GPT normalizer
- See `docs/n8n-workflow-guide.md` for scraping blueprint

### Phase 3: Multi-Channel Distribution
- Build n8n workflows that:
  - Poll `content_targets` for `status = 'pending'`
  - Format content for each channel (Website, Newsletter, Social)
  - Post via APIs (Facebook Graph, Twitter API, Mailchimp, etc.)
  - Update `content_targets.status = 'posted'` or `'failed'`

### Phase 4: Public Website
- Build a React frontend that reads `content_queue` where `status = 'published'`
- Display stories by category, date, source
- Add SEO, social share cards, RSS feed output

---

## Security Checklist

- ✅ Service role key stored ONLY in n8n environment variables
- ✅ Never expose service role key in client code or Git
- ✅ OpenAI API key stored in n8n credentials manager
- ✅ RLS policies on all Supabase tables (already configured)
- ✅ Admin dashboard requires authentication + `admin` role

---

## Workflow Visual Summary

```
┌──────────────┐
│     CRON     │ (every 30 min)
└──────┬───────┘
       │
       v
┌─────────────────────────┐
│ GET Active RSS Sources  │ (Supabase REST API)
└──────┬──────────────────┘
       │
       v
┌──────────────────┐
│ Split In Batches │ (loop over sources)
└──────┬───────────┘
       │
       v
┌──────────────────┐
│  Fetch RSS Feed  │ (HTTP GET)
└──────┬───────────┘
       │
       v
┌──────────────┐
│  Parse RSS   │ (RSS Read or Function)
└──────┬───────┘
       │
       v
┌────────────────────┐
│  Dedup Check       │ (GET from content_queue by original_url)
└──────┬─────────────┘
       │
       v
┌───────────────┐
│   IF not dup  │
└──────┬────────┘
       │ (new articles only)
       v
┌────────────────────┐
│ OpenAI Normalize   │ (GPT-4.1-mini + custom prompt)
└──────┬─────────────┘
       │
       v
┌──────────────────────┐
│ Build Supabase JSON  │ (Function node)
└──────┬───────────────┘
       │
       v
┌─────────────────────┐
│ POST to content_queue│ (Supabase REST API)
└─────────────────────┘
       │
       v
    ✅ Story appears in dashboard as "pending"
```

---

## Environment Variables Reference

Store these in n8n:

```bash
SUPABASE_URL=https://mzumvkrpnxhkvhdyzgqa.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
OPENAI_API_KEY=<your-openai-key>
```

**Do NOT hardcode these in workflow nodes.** Use n8n's credential/environment variable system.

---

## Success Metrics

After running this workflow for 24 hours, you should see:

- ✅ 10–50+ stories in `content_queue` (depending on feed frequency)
- ✅ All stories have `status = 'pending'`
- ✅ GPT-generated summaries are coherent and category-appropriate
- ✅ No duplicate `original_url` entries
- ✅ Activity log shows "content created" events (if you add system logging later)
- ✅ Editors can approve/reject/publish stories via the dashboard

Once this works reliably, **your Autonomous Local Media Network is operationally live.**

---

## Resources

- n8n Documentation: https://docs.n8n.io/
- Supabase REST API: https://supabase.com/docs/guides/api
- OpenAI API: https://platform.openai.com/docs/api-reference
- Ingestion Contract: `docs/ingestion-contract.md`
- Full Workflow Blueprint: `docs/n8n-workflow-guide.md`

---

**Questions or stuck?** Check the troubleshooting section above or review the workflow execution logs in n8n to identify which node is failing.
