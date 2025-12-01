# Full Queue Prep Automation Setup Guide

This guide explains how to set up automated daily runs of Full Queue Prep using pg_cron in Supabase.

## Overview

The Full Queue Prep automation runs three operations sequentially:
1. **Generate Images** - Creates AI images for stories missing visual assets
2. **Generate Voice** - Creates platform-specific voice variants for all content
3. **Prepare Posts** - Queues posts for Instagram, Facebook, and X

## Setup Steps

### 1. Enable pg_cron Extension (One-time)

First, enable the pg_cron extension in your Supabase database. Run this in the Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 2. Configure Schedule in UI

1. Go to **Social Queue** page
2. Click the **Settings** icon (⚙️) in the top-right header
3. Toggle **Enable Automated Runs** to ON
4. Set your desired **Run Time (UTC)** (default: 02:00 AM UTC)
5. Click **Copy SQL Setup Code** button
6. Click **Save Settings**

### 3. Set Up Cron Job in Supabase

1. Go to Supabase Dashboard → SQL Editor
2. Paste the copied SQL code
3. Replace `${process.env.SUPABASE_ANON_KEY}` with your actual anon key from:
   - Supabase Dashboard → Settings → API → Project API keys → anon public
4. Run the SQL

**Example SQL:**

```sql
-- Schedule Full Queue Prep to run daily at 02:00 UTC
SELECT cron.schedule(
  'full-queue-prep-daily',
  '0 2 * * *', -- 02:00 UTC daily (minute hour * * *)
  $$
  SELECT
    net.http_post(
      url:='https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/full-queue-prep',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY_HERE"}'::jsonb
    ) as request_id;
  $$
);
```

### 4. Verify Setup

Check that your cron job was created successfully:

```sql
SELECT * FROM cron.job;
```

You should see a row with `jobname = 'full-queue-prep-daily'`.

## Monitoring

### View Cron Job Status

```sql
-- View all scheduled jobs
SELECT * FROM cron.job;

-- View recent job runs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'full-queue-prep-daily')
ORDER BY start_time DESC 
LIMIT 10;
```

### View Activity Log

Full Queue Prep logs its completion to the `activity_log` table:

```sql
SELECT 
  created_at,
  message,
  details
FROM activity_log
WHERE entity_type = 'system' 
  AND action = 'full_queue_prep_completed'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Edge Function Logs

Go to Supabase Dashboard → Edge Functions → full-queue-prep → Logs

## Management

### Pause Automated Runs

To temporarily disable automated runs without deleting the schedule:

```sql
-- Disable the job
UPDATE cron.job 
SET active = false 
WHERE jobname = 'full-queue-prep-daily';

-- Re-enable later
UPDATE cron.job 
SET active = true 
WHERE jobname = 'full-queue-prep-daily';
```

### Change Schedule Time

To change the run time, unschedule and reschedule:

```sql
-- Remove existing schedule
SELECT cron.unschedule('full-queue-prep-daily');

-- Create new schedule with different time (e.g., 3 AM UTC)
SELECT cron.schedule(
  'full-queue-prep-daily',
  '0 3 * * *', -- 03:00 UTC daily
  $$
  SELECT
    net.http_post(
      url:='https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/full-queue-prep',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY_HERE"}'::jsonb
    ) as request_id;
  $$
);
```

### Remove Automated Runs

To completely remove the scheduled job:

```sql
SELECT cron.unschedule('full-queue-prep-daily');
```

## Cron Schedule Format

The schedule uses standard cron syntax: `minute hour day month weekday`

Common patterns:
- `0 2 * * *` - Every day at 2:00 AM UTC
- `0 */6 * * *` - Every 6 hours
- `0 2 * * 1` - Every Monday at 2:00 AM UTC
- `0 2 1 * *` - First day of every month at 2:00 AM UTC

## Troubleshooting

### Job Not Running

1. Check if job is active:
   ```sql
   SELECT jobname, active FROM cron.job WHERE jobname = 'full-queue-prep-daily';
   ```

2. Check recent run history:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'full-queue-prep-daily')
   ORDER BY start_time DESC 
   LIMIT 5;
   ```

3. Verify edge function is working manually:
   - Go to Social Queue page
   - Click "Full Queue Prep" button
   - Check if it completes successfully

### Authorization Errors

If you see 401 Unauthorized errors in cron job logs:
1. Verify your anon key is correct in the cron SQL
2. Check that `full-queue-prep` function has `verify_jwt = false` in `supabase/config.toml`
3. Redeploy edge functions if needed

### Timeout Errors

If the job times out:
1. The edge function has a 60-second timeout per invocation
2. The function is designed to batch operations to stay under this limit
3. Check edge function logs for specific failures
4. Consider running Full Queue Prep manually during low-traffic periods

## Cost Considerations

Automated runs consume:
- **AI Image Generation**: ~$0.02-0.04 per image (Lovable AI Gateway)
- **Voice Generation**: Included in Lovable AI usage
- **Edge Function Execution**: Supabase edge function invocations

Running once daily typically costs $5-15/month depending on content volume.

## Best Practices

1. **Test manually first**: Run Full Queue Prep manually several times before enabling automation
2. **Monitor the first few runs**: Check logs and activity feed after automated runs begin
3. **Choose low-traffic times**: Schedule during off-peak hours (2-4 AM UTC is typical)
4. **Review pipeline health**: Check the Pipeline Health card regularly to ensure content is flowing
5. **Adjust as needed**: If you're generating too many or too few posts, adjust source feeds first

## Support

If you encounter issues:
1. Check edge function logs in Supabase Dashboard
2. Review the activity_log table for system errors
3. Check cron.job_run_details for execution history
4. Test the Full Queue Prep button manually to isolate issues
