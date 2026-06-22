# Apify Facebook scraper → `ingest-incident` setup

No burner accounts. Apify runs a managed Facebook scraper, posts results to
our `ingest-incident` edge function on a schedule. Total cost: ~$15-25/mo for 3 pages
polled every 30 min.

## 1. One-time Apify account setup

1. Sign up at https://apify.com (free tier exists; you'll need to add ~$25 credit).
2. Open the **Facebook Posts Scraper** actor: https://apify.com/apify/facebook-posts-scraper
3. Click **Try for free** → it lands in your Console.
4. In **Settings → Integrations → API**, copy your personal API token (we don't store it; Apify uses it to call our endpoint via its built-in webhook feature, not the other way around).

## 2. Configure the actor input

Use this JSON in the actor's input editor. Start with 3 pages; add more after confirming volume isn't overwhelming.

```json
{
  "startUrls": [
    { "url": "https://www.facebook.com/WalworthCountyScanner" },
    { "url": "https://www.facebook.com/LakeGenevaFire" },
    { "url": "https://www.facebook.com/TownOfLinnFireDepartment" }
  ],
  "resultsLimit": 10,
  "captionText": true
}
```

`resultsLimit: 10` keeps cost down — we only care about the newest posts each poll.

## 3. Schedule it

In the actor page → **Schedules** → New Schedule:
- Name: `Lake Geneva Brief — every 30 min`
- Cron: `*/30 * * * *`
- Run actor with input above.

## 4. Wire the webhook

In the **Schedule → Webhooks** tab → Add webhook:
- **Event types:** `Run succeeded`
- **URL:** `https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/ingest-incident`
- **Headers:** `x-ingest-secret: <CIVIC_INGEST_SECRET value>`
- **Payload template** (Apify's template language; transforms Apify's output into our schema):

```handlebars
{
  "items": [
    {{#each (last resource.defaultDatasetItems 10)}}
    {
      "source": "apify_{{pageName}}",
      "source_type": "facebook",
      "external_id": "{{postId}}",
      "title": "{{truncate (or text caption) 240}}",
      "body": "{{or text caption ''}}",
      "location": "{{or place.name ''}}",
      "started_at": "{{time}}",
      "raw": { "url": "{{url}}", "pageName": "{{pageName}}" }
    }{{#unless @last}},{{/unless}}
    {{/each}}
  ]
}
```

(Adjust field names if Apify changes its output schema — verify by running the actor once and inspecting the dataset.)

## 5. Verify it works

1. Click **Run** manually on the actor.
2. Watch the run logs, then check our edge function logs: https://supabase.com/dashboard/project/mzumvkrpnxhkvhdyzgqa/functions/ingest-incident/logs
3. You should see `results` with `ok: true` for each post, with `tier` and `status` populated.
4. Tier 1 (auto-publish) items appear immediately on the Right Now sidebar. Tier 3 items appear in the admin moderation queue at `/admin/incidents-queue` (built separately).

## Cost estimate

- Facebook Posts Scraper: ~$5-8 per 1,000 posts.
- 3 pages × 10 posts × 48 runs/day = ~1,440 posts/day = ~$7-12/mo.
- Add the $29/mo Apify Starter plan if you want priority queues — optional.

## When to expand to more pages

Watch volume in the moderation queue for the first 2 weeks. If you're seeing:
- < 5 posts/day in the queue → add the other 3 scanner pages (Walworth County WI, Walworth Fire, Lake Geneva Police FB).
- > 30 posts/day → tighten the keyword lists in `ingest-incident/index.ts` first, don't add more sources yet.