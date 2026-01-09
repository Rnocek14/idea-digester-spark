# Editorial Content Generation Scheduling

## Overview

The `generate-editorial-content` function creates automated editorial content (starting with the Friday Fish Fry Guide). This document covers scheduling with Supabase `pg_cron`.

## Schedule: Friday 6:00 AM America/Chicago

- **Winter (CST, UTC-6)**: 6:00 AM local = **12:00 UTC**
- **Summer (CDT, UTC-5)**: 6:00 AM local = **11:00 UTC**

**Note**: `pg_cron` only supports UTC. You'll need to adjust the schedule twice yearly for DST, or pick a compromise time.

## Setup

### 1. Enable pg_cron Extension

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 2. Schedule the Job (Winter - CST)

```sql
SELECT cron.schedule(
  'weekly-fish-fry-guide',
  '0 12 * * 5',  -- 12:00 UTC = 6:00 AM CST (Friday)
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/generate-editorial-content',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Editorial-Secret', '<YOUR_EDITORIAL_GENERATION_SECRET>'
    ),
    body := '{"content_type": "fish_fry_guide"}'::jsonb
  );
  $$
);
```

**Important**: Replace `<YOUR_EDITORIAL_GENERATION_SECRET>` with your actual secret from Supabase Edge Function secrets.

### 3. Verify Job Created

```sql
SELECT * FROM cron.job WHERE jobname = 'weekly-fish-fry-guide';
```

## DST Adjustment

### Switch to Summer (CDT) - Second Sunday of March

```sql
SELECT cron.unschedule('weekly-fish-fry-guide');

SELECT cron.schedule(
  'weekly-fish-fry-guide',
  '0 11 * * 5',  -- 11:00 UTC = 6:00 AM CDT (Friday)
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/generate-editorial-content',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Editorial-Secret', '<YOUR_EDITORIAL_GENERATION_SECRET>'
    ),
    body := '{"content_type": "fish_fry_guide"}'::jsonb
  );
  $$
);
```

### Switch Back to Winter (CST) - First Sunday of November

Use the original `0 12 * * 5` schedule.

## Management Commands

### Check Job Status

```sql
SELECT * FROM cron.job WHERE jobname = 'weekly-fish-fry-guide';
```

### View Recent Runs

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'weekly-fish-fry-guide')
ORDER BY start_time DESC 
LIMIT 10;
```

### Pause Job

```sql
UPDATE cron.job SET active = false WHERE jobname = 'weekly-fish-fry-guide';
```

### Resume Job

```sql
UPDATE cron.job SET active = true WHERE jobname = 'weekly-fish-fry-guide';
```

### Delete Job

```sql
SELECT cron.unschedule('weekly-fish-fry-guide');
```

## Manual Trigger (Testing)

```bash
curl -X POST 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/generate-editorial-content' \
  -H 'Content-Type: application/json' \
  -H 'X-Editorial-Secret: YOUR_SECRET_HERE' \
  -d '{"content_type": "fish_fry_guide"}'
```

### Force Regeneration

```bash
curl -X POST 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/generate-editorial-content' \
  -H 'Content-Type: application/json' \
  -H 'X-Editorial-Secret: YOUR_SECRET_HERE' \
  -d '{"content_type": "fish_fry_guide", "force": true}'
```

## Expected Responses

### First Run (New Week)

```json
{
  "success": true,
  "content_type": "fish_fry_guide",
  "week_key": "2026-W02",
  "queue_id": "uuid-here",
  "snapshot_id": "uuid-here",
  "deals_count": 15,
  "friday_specials_count": 12,
  "ayce_count": 5
}
```

### Subsequent Runs (Same Week, No Force)

```json
{
  "success": true,
  "skipped": true,
  "reason": "already_generated",
  "week_key": "2026-W02",
  "existing_queue_id": "uuid-here",
  "existing_created_at": "2026-01-10T12:00:00.000Z"
}
```

### Force Regeneration

```json
{
  "success": true,
  "content_type": "fish_fry_guide",
  "week_key": "2026-W02",
  "queue_id": "new-uuid-here",
  "is_regeneration": true
}
```

## Monitoring & Alerts

### Healthy Results (No Alert Needed)

- `success: true` with `skipped: true` — already generated this week
- `success: true` with `queue_id` — new content created

### Alert-Worthy Results

- `success: false` — generation failed
- Missing `queue_id` when `skipped: false` — unexpected state
- HTTP 401/403 — secret mismatch
- HTTP 500 — function error

### Activity Log Query

```sql
SELECT * FROM activity_log 
WHERE entity_type = 'editorial_content' 
ORDER BY created_at DESC 
LIMIT 20;
```

## Cron Expression Reference

| Expression | Meaning |
|------------|---------|
| `0 12 * * 5` | 12:00 UTC every Friday (6 AM CST) |
| `0 11 * * 5` | 11:00 UTC every Friday (6 AM CDT) |
| `0 12 * * 4` | 12:00 UTC every Thursday |
| `0 6 * * *` | 6:00 UTC daily |

Format: `minute hour day month weekday`
