# Daily Restaurant Scrape - Cron Setup

This document explains how to schedule the daily restaurant scraper to run automatically.

## What It Does

The `daily-restaurant-scrape` edge function:
1. Runs `scrape-restaurant-diy` on all active restaurant sources (up to 50)
2. Waits 2 seconds
3. Runs `sync-dining-content-v2` to push new deals to the content queue

## Schedule: 6 AM CT Daily (11:00 UTC)

This timing ensures:
- Fresh data for Friday fish fry searches
- Thursday night scrape prepares Friday's guide
- Low traffic time for API calls

## Setup Instructions

### 1. Enable pg_cron Extension

Run this SQL in [Supabase SQL Editor](https://supabase.com/dashboard/project/mzumvkrpnxhkvhdyzgqa/sql/new):

```sql
-- Enable the pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
```

### 2. Schedule the Daily Job

```sql
-- Schedule daily restaurant scrape at 6 AM CT (11:00 UTC)
SELECT cron.schedule(
  'daily-restaurant-scrape',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/daily-restaurant-scrape',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ25vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### 3. Verify the Job Was Created

```sql
SELECT * FROM cron.job WHERE jobname = 'daily-restaurant-scrape';
```

## Managing the Schedule

### Pause the Job

```sql
UPDATE cron.job SET active = false WHERE jobname = 'daily-restaurant-scrape';
```

### Resume the Job

```sql
UPDATE cron.job SET active = true WHERE jobname = 'daily-restaurant-scrape';
```

### Delete the Job

```sql
SELECT cron.unschedule('daily-restaurant-scrape');
```

### Change the Schedule

```sql
-- First unschedule
SELECT cron.unschedule('daily-restaurant-scrape');

-- Then reschedule with new time (e.g., 5 AM CT = 10:00 UTC)
SELECT cron.schedule(
  'daily-restaurant-scrape',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/daily-restaurant-scrape',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ25vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## Fish Fry Friday - Extra Thursday Run

For optimal Friday coverage, add a Thursday evening run:

```sql
-- Thursday 8 PM CT (Friday 01:00 UTC) - extra fish fry prep
SELECT cron.schedule(
  'thursday-fish-fry-prep',
  '0 1 * * 5',
  $$
  SELECT net.http_post(
    url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/daily-restaurant-scrape',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ25vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## Monitoring

### Check Recent Runs

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-restaurant-scrape')
ORDER BY start_time DESC 
LIMIT 10;
```

### Check Activity Log

```sql
SELECT * FROM activity_log 
WHERE action = 'daily_restaurant_scrape' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Manual Trigger

Test the function manually:

```bash
curl -X POST 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/daily-restaurant-scrape' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ25vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA' \
  -d '{}'
```

## Expected Output

```json
{
  "success": true,
  "duration_ms": 45000,
  "results": {
    "scraper": {
      "success": true,
      "restaurants_processed": 31
    },
    "sync": {
      "success": true,
      "synced": 12
    }
  }
}
```
