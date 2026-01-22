# CivicEngage RSS Ingestion via n8n Webhook

## Problem

City of Lake Geneva uses CivicEngage/CivicPlus platform which is protected by Cloudflare. All attempts to fetch RSS feeds from edge functions result in HTTP 403 with a "Just a moment..." challenge page.

**Confirmed blocked feeds:**
- `https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=26&CID=police` (Police Alerts)
- `https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=26&CID=fire` (Fire Alerts)
- `https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=26&CID=public-works` (Public Works)
- `https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=63&CID=All-0` (Civic)
- `https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=65&CID=All-0` (Agenda Center)
- `https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=10&CID=All-news-flash` (News)

## Solution: n8n Webhook Pattern

n8n running on a VPS or self-hosted instance has a different IP range than Supabase edge functions, allowing it to fetch these protected feeds.

### Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ CivicEngage │────▶│ n8n (VPS/Cloud)  │────▶│ Supabase Edge Func  │
│ RSS Feed    │     │ Fetch + Parse    │     │ /ingest-civic       │
└─────────────┘     └──────────────────┘     └─────────────────────┘
```

### n8n Workflow Setup

1. **Trigger**: Cron schedule (every 30 minutes)

2. **HTTP Request Node**: Fetch the RSS feed
   - Method: GET
   - URL: `https://www.cityoflakegeneva.gov/RSSFeed.aspx?ModID=26&CID=police`
   - Headers:
     ```
     Accept: application/rss+xml, application/xml
     User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)...
     ```

3. **XML Parser Node**: Parse the RSS response

4. **Code Node**: Transform to content_queue payload
   ```javascript
   const items = $input.all()[0].json.rss.channel.item;
   
   return items.map(item => ({
     json: {
       source_id: 'POLICE_SOURCE_UUID', // From sources table
       title: item.title,
       content: item.description || item.title,
       summary: item.description?.substring(0, 300),
       status: 'pending',
       category: 'civic',
       original_url: item.link,
       publish_date: item.pubDate,
       geo_tier: 1,
       geo_label: 'Lake Geneva',
       metadata: {
         ingested_via: 'n8n',
         original_published_at: item.pubDate,
       }
     }
   }));
   ```

5. **HTTP Request Node**: POST to Supabase
   - Method: POST
   - URL: `https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/ingest-civic`
   - Headers:
     ```
     X-Ingest-Secret: {{$env.CIVIC_INGEST_SECRET}}
     Content-Type: application/json
     ```
   - Body: `{{ JSON.stringify($input.all().map(i => i.json)) }}`

**SECURITY NOTE**: We use a dedicated `CIVIC_INGEST_SECRET` header instead of the Supabase Service Role Key. This minimizes blast radius if n8n is ever compromised - the secret only grants access to this one ingestion endpoint, not your entire database.

### Supabase Edge Function: ingest-civic

The edge function is already deployed at `/functions/v1/ingest-civic`. It:
- Validates the `X-Ingest-Secret` header
- Batch inserts items with `ON CONFLICT DO NOTHING` (dedupe via unique index)
- Returns `{ inserted, skipped }` counts

Key features:
- **Secure auth**: Uses dedicated secret, service role key never leaves Supabase
- **Batch insert**: All items inserted in one query
- **Automatic dedup**: Unique constraint on `normalized_url` prevents duplicates
- **Activity logging**: Records ingestion stats to `activity_log`

Example request:
```bash
curl -X POST https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/ingest-civic \
  -H "X-Ingest-Secret: your-secret-here" \
  -H "Content-Type: application/json" \
  -d '[{"source_id": "uuid", "title": "Test", "content": "Content here"}]'
```

Response:
```json
{"success": true, "inserted": 1, "skipped": 0}
```

<details>
<summary>Edge Function Source (for reference)</summary>

```typescript
// See supabase/functions/ingest-civic/index.ts for full implementation
```

</details>
```

### Source UUIDs

After setting up the workflow, update these source IDs in n8n:

| Feed | Source ID |
|------|-----------|
| Police Alerts | `5e622832-a4b2-4ac5-8660-dabcea087695` |
| Fire Alerts | `d91c4c22-6da0-4ed4-a516-0f9ecb90975c` |
| Public Works | `888765d0-f358-4181-8027-27a6b35cc77d` |
| Civic | `549991d5-09a5-4fdd-baf3-13b657a09ada` |
| Agenda Center | `ee4c6add-36f1-4a36-a75d-51e0961e20fa` |
| News | `dc1780ac-470b-46ac-a0a1-feea75073d4c` |

### Re-activating Sources

Once n8n is set up:

```sql
UPDATE sources 
SET status = 'active',
    metadata = metadata || '{"ingestion_method": "n8n_webhook"}'::jsonb
WHERE url LIKE '%cityoflakegeneva.gov/RSSFeed%';
```

### Testing

1. Run the n8n workflow manually
2. Check `content_queue` for new items with `source_id` matching the civic sources
3. Verify stories appear in the dashboard pending queue

### Monitoring

Add a check in the dashboard to show when sources haven't received content in 24h even though they're "active" - this indicates the n8n workflow may have failed.
