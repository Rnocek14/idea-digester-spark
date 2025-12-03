# Lake Geneva Brief — Operations Playbook

> **Goal:** Keep the autonomous news system running safely, and know exactly what to do when something looks off.

This playbook covers:

- How the automation pipeline works
- Daily health checks
- How to pause / resume automation (kill switch)
- How to test newsletters & socials
- What to do "if X then Y" for common issues

---

## 1. System Overview

### 1.1. Core Pipelines

The system is fully automated end-to-end:

1. **Ingestion**
   - Sources: RSS / scrapers / NWS
   - Writes rows into `content_queue`

2. **AI Processing**
   - Normalizes title/summary
   - Assigns `category` (civic, community, events, news, etc.)
   - Assigns `safety_level` (`safe` or `sensitive`)

3. **Publishing**
   - If `safety_level = 'safe'` → eligible for **auto-publish**
   - If `safety_level != 'safe'` → stays in `pending` for manual review
   - Auto-published items show on the public site

4. **Newsletter**
   - Daily cron: `autopilot-newsletter-daily`
   - Edge function: `autopilot-newsletter`
   - Builds newsletter from recent published content and **sends automatically** at 8am Central (14:00 UTC, winter)

5. **Social**
   - `prepare-posts` cron: fills `post_queue` with social posts
   - `process-post-queue` cron: posts from the queue to connected platforms

---

## 2. Kill Switch & Automation Settings

### 2.1. Where the kill switch lives

Settings table:

- Table: `system_settings`
- Row: `key = 'automation'`
- `value` JSON shape (example):

```json
{
  "enabled": true,
  "publish_enabled": true,
  "newsletter_enabled": true,
  "social_enabled": true
}
```

### 2.2. What each flag controls

- `enabled`
  - Master switch. If `false`, **all automation stops**:
    - No publishing
    - No newsletters
    - No social posting

- `publish_enabled`
  - If `false`, **no new auto-publishing** to the site (ingest still happens).

- `newsletter_enabled`
  - If `false`, `autopilot-newsletter` will **return early** and not send emails.

- `social_enabled`
  - If `false`, `process-post-queue` will **not post** to social platforms.

All 3 key edge functions **check these flags** on every run:

- `autopilot-newsletter`
- `prepare-posts`
- `process-post-queue`

### 2.3. How to toggle automation

You can toggle from the **System Health card** in the Dashboard UI:

- **Master Automation**: ON/OFF
- When ON, you see three toggles:
  - Publishing
  - Newsletter
  - Social

Under the hood, this updates `system_settings.value` and is picked up by edge functions on their next run.

---

## 3. Daily Health Check (2–3 minutes)

### 3.1. Use the System Health card

Open the **Dashboard → System Health** and verify:

- **Master Automation:** ON (unless intentionally paused)
- **Publishing / Newsletter / Social:** ON (or as desired)

Then glance at metrics:

- **Last Ingest** — should be "a few minutes ago" to "within last hour" during active periods.
- **Last Auto-Publish** — should not be "Never" or "X hours ago" during the day.
- **Last Newsletter** — should show "about X hours ago" after the daily send time.
- **Social Queue**
  - Some pending posts = normal
  - Very large and never dropping = check social automation
- **Needs Review (sensitive)**
  - This is the safety gate.
  - If this number is growing a lot, consider reviewing or tightening sources.

### 3.2. Optional SQL sanity checks

In Supabase SQL Editor:

```sql
-- Recent content activity
SELECT title, created_at, status, safety_level, category
FROM content_queue
ORDER BY created_at DESC
LIMIT 20;

-- Counts by status / safety / category
SELECT status, safety_level, category, COUNT(*)
FROM content_queue
GROUP BY status, safety_level, category
ORDER BY status, safety_level, category;
```

You want:

- New rows today
- Most `safe` items in `auto_published`
- `sensitive` items in `pending`

---

## 4. Emergency Procedures

### 4.1. "Something bad is live on the site"

**Symptoms:**

- Bad headline/story visible on the public site and/or socials.

**Actions (in order):**

1. **Turn off Master Automation**
   - Go to Dashboard → System Health
   - Flip **Master Automation** to **OFF**
   - This stops *all* new publishing, newsletters, and social posts.

2. **Fix or remove the bad content**
   - In Supabase:
     ```sql
     UPDATE content_queue
     SET status = 'removed'
     WHERE id = <ID_OF_BAD_STORY>;
     ```
   - Or use whatever admin tooling exists to unpublish/remove.

3. **Check safety filter**
   - Look at the offending story's `safety_level` and `category`.
   - If it was marked `safe` incorrectly:
     - Review your safety model / prompts / filters.
     - Consider temporarily tightening sources or categories.

4. **Turn automation back on**
   - When you feel confident:
     - Turn **Master Automation** back to **ON**
     - Optionally keep **Newsletter** or **Social** OFF for a while if you want a slower restart.

---

### 4.2. "Automation seems stuck / nothing is updating"

**Symptoms:**

- Last Ingest or Last Auto-Publish shows "many hours ago".
- Home page doesn't change all day.

**Actions:**

1. **Check System Health metrics**
   - If `Last Ingest` is old:
     - In Supabase logs, verify ingestion functions / cron jobs are running.
   - If `Last Auto-Publish` is old but ingest is recent:
     - Check `content_queue` for many `pending safe` items:
       ```sql
       SELECT COUNT(*) 
       FROM content_queue
       WHERE status = 'pending'
         AND safety_level = 'safe';
       ```

2. **Temporarily disable automation**
   - Flip **Master Automation** to OFF to prevent partial or inconsistent publishes while debugging.

3. **Check cron jobs**
   ```sql
   SELECT jobname, schedule, command
   FROM cron.job
   ORDER BY jobid;
   ```
   - Verify both:
     - `autopilot-newsletter-daily`
     - `process-post-queue`
     - and any cron for ingestion are present and enabled.

4. **Re-enable automation**
   - Once the underlying issue (cron or edge function failure) is fixed, flip **Master Automation** back ON.

---

### 4.3. "Newsletter didn't send"

**Symptoms:**

- You expected an email at 8am, but none arrived.

**Checks:**

1. **System Health card**
   - **Last Newsletter** should show "about X hours ago".
   - If it says "Never" or "days ago", proceed.

2. **Check newsletters table**
   ```sql
   SELECT edition_date, status, created_at, sent_at
   FROM newsletters
   ORDER BY created_at DESC
   LIMIT 10;
   ```
   - If you see `status = 'ready'` but no `sent`:
     - Cron or `autopilot-newsletter` failed.

3. **Test newsletter manually**
   ```sql
   SELECT net.http_post(
     url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/autopilot-newsletter',
     headers := jsonb_build_object(
       'Content-Type', 'application/json',
       'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ15vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA'
     ),
     body := '{"sendNow": true, "force": true}'::jsonb
   ) AS request_id;
   ```
   - If this works (newsletter row becomes `sent` and email arrives):
     - The issue is likely cron scheduling.
   - If it fails:
     - Check edge function logs for errors.

---

### 4.4. "Social queue is huge and not draining"

**Symptoms:**

- System Health shows a large `Social Queue` count that never drops.

**Actions:**

1. **Check if social automation is enabled**
   - In the System Health card:
     - Ensure **Master Automation** and **Social** are ON.

2. **Inspect `post_queue`**
   ```sql
   SELECT status, COUNT(*)
   FROM post_queue
   GROUP BY status;
   ```

3. **Manually trigger `process-post-queue` once**
   ```sql
   SELECT net.http_post(
     url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/process-post-queue',
     headers := jsonb_build_object(
       'Content-Type', 'application/json',
       'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ15vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA'
     ),
     body := '{}'::jsonb
   ) AS request_id;
   ```
   - If pending count decreases, cron is likely misconfigured.
   - If not, check the function logs and/or platform credentials.

---

## 5. Safety & Editorial Policy

Even with full automation, the system is **safety-first** by design:

- Only **`safety_level = 'safe'`** items auto-publish.
- **Sensitive topics** (tragedies, minors, crime, courts, protests, etc.) are generally classified as `sensitive` and held in `pending` for review.

**Best practice:**

- Periodically review the **"Needs Review / sensitive"** count.
- Manually handle items that are:
  - Highly emotional (deaths, tragedies)
  - Legal/juvenile cases
  - Sexual crimes
  - Aggressive politics / protests

---

## 6. Quick Reference Cheatsheet

### Check automation state

```sql
SELECT * FROM system_settings WHERE key = 'automation';
```

### Check newsletter cron

```sql
SELECT * FROM cron.job WHERE jobname LIKE '%newsletter%';
```

### Add test subscribers

```sql
INSERT INTO subscribers (email, status, source) VALUES
  ('your+test1@gmail.com', 'active', 'manual'),
  ('your+test2@gmail.com', 'active', 'manual');
```

### Kill switch: emergency full stop

- Dashboard → System Health → **Master Automation OFF**

This immediately stops:

- Publishing
- Newsletter sending
- Social posting

---

## 7. Test Kill Switch Now

To verify the kill switch works:

1. Go to **Dashboard → System Health**
2. Set **Master Automation = OFF**
3. In Supabase SQL Editor, manually call one automation function:

```sql
SELECT net.http_post(
  url := 'https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/autopilot-newsletter',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ15vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA'
  ),
  body := '{"sendNow": true, "force": true}'::jsonb
) AS request_id;
```

4. Check the function logs — you should see:
   > ⛔ Newsletter automation is disabled via kill switch

5. Turn **Master Automation = ON** again when done testing.

---

*Last updated: December 3, 2025*
