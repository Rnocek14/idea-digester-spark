# Civic Content Sources Implementation

## Overview

This adds 3 civic/community sources to Lake Geneva Local to diversify content mix away from the current 77% events skew. These sources provide school district news, library programs, and city government announcements—critical verticals for a comprehensive local newsroom.

## Sources Being Added

### 1. Lake Geneva School District News
- **URL**: https://www.lakegenevaschools.com/news
- **Type**: Scrape (Finalsite CMS)
- **Category**: `schools`
- **Scrape Selector**: `article.fsBoard-3`
- **Expected Verticals**: `["local", "civic", "family"]`
- **Fetch Frequency**: Every 2 hours (120 min)
- **Content Types**: Enrollment announcements, school board decisions, student achievements, district programs, calendar updates

**Why This Matters**: School district news is foundational for family-focused local media. Parents are highly engaged with this content and it diversifies away from event listings into civic/institutional coverage.

### 2. Lake Geneva Public Library Events
- **URL**: https://lglibrary.org/eventcal
- **Type**: Scrape (Squarespace events calendar)
- **Category**: `community`
- **Scrape Selector**: `.eventlist-event`
- **Expected Verticals**: `["local", "family"]`
- **Fetch Frequency**: Every 3 hours (180 min)
- **Content Types**: Library programs, kids' activities, educational workshops, author talks, community meetings held at library

**Why This Matters**: Library events are highly family/community-focused and provide regular, predictable content that appeals to engaged local readers. Less tourism-heavy than Visit Lake Geneva events.

### 3. Lake Geneva City Calendar
- **URL**: https://www.cityoflakegeneva.gov/Calendar.aspx
- **Type**: Scrape (CivicEngage platform)
- **Category**: `civic`
- **Scrape Selector**: `.calendarCell`
- **Expected Verticals**: `["local", "civic"]`
- **Fetch Frequency**: Every 4 hours (240 min)
- **Content Types**: City council meetings, planning commission, board of public works, public hearings, municipal announcements

**Why This Matters**: Government/civic content is the backbone of local journalism credibility. This provides oversight-focused content distinct from promotional event listings. Critical for future @LakeGenevaCivics account.

---

## Expected Content Mix After Addition

**Current State** (2 sources: Visit LG Events + Walworth County News):
- 77% Events
- 11% Community  
- 9% News
- 3% Dining

**Target State After Civic Sources**:
- 40-50% Events (Visit LG + Library events)
- 20-25% Civic (City calendar + School district)
- 15-20% Community (Library + Walworth News)
- 10-15% News (Walworth News + School announcements)

This creates a balanced newsroom feed instead of an events aggregator.

---

## Installation Instructions

### Step 1: Add Sources to Database

Run the SQL in `docs/civic-sources-seed.sql` in Supabase SQL Editor:

```bash
# Navigate to Supabase SQL Editor
https://supabase.com/dashboard/project/mzumvkrpnxhkvhdyzgqa/sql/new
```

Copy and paste the INSERT statements, then execute.

### Step 2: Verify Sources Created

Check the Sources page in the dashboard—you should see 5 total active sources:
1. Walworth County Community News (existing RSS)
2. Visit Lake Geneva Events (existing scrape)
3. **Lake Geneva School District News** (new)
4. **Lake Geneva Public Library Events** (new)
5. **Lake Geneva City Calendar** (new)

### Step 3: Run Initial Sync

From the Sources page, click **"Sync RSS Now"** to trigger the `sync-rss` edge function. This will:
1. Fetch content from all 5 active sources
2. Apply safety scanning
3. Insert into `content_queue` with status based on auto-publish rules
4. Log sync activity

### Step 4: Classify New Content

From the Dashboard, use the **Pipeline Health** card:
1. Click **"Classify"** to run `backfill-verticals` on all stories missing vertical tags
2. Watch the "Needs Verticals" count drop to 0
3. Verify that new civic stories have appropriate `metadata.verticals` arrays (e.g., school stories should have `["local", "civic", "family"]`)

### Step 5: Generate Images for Civic Content

Many civic sources won't have OG images (government sites often don't set og:image tags). From Pipeline Health:
1. Click **"Generate"** to run `bulk-generate-images` (processes 20 stories at a time)
2. Repeat 2-3 times until image coverage reaches 50-60%
3. This ensures Instagram posts have visual assets

### Step 6: Monitor Category Mix

Check Content Queue after a few sync cycles:
- Filter by category to see distribution
- Confirm you're seeing school announcements, library events, and city calendar items
- Verify safety_level is properly assigned (most civic content should be "safe")

---

## Troubleshooting

### Issue: School District articles not scraping
**Cause**: CSS selector `article.fsBoard-3` may have changed  
**Fix**: Inspect https://www.lakegenevaschools.com/news HTML structure and update `metadata.scrape_selector` in sources table

### Issue: Library events returning no content
**Cause**: Squarespace uses dynamic loading, selector `.eventlist-event` may not work with basic HTML fetch  
**Fix**: May need to use a different selector or consider switching to their RSS feed if available

### Issue: City calendar parsing fails
**Cause**: CivicEngage calendars often have complex nested structures  
**Fix**: Inspect HTML, try alternative selectors like `.CalendarEvent` or `.dayCell`

### Issue: All civic content marked "sensitive" or "blocked"
**Cause**: AI safety classifier may be overly cautious with government/civic content  
**Fix**: Review `safety_reason` in content_queue, adjust safety prompt in `sync-rss` if needed

---

## What's Next After This?

Once civic sources are flowing:

1. **Enable Real Social Posting** (1 platform at a time with rate limits)
2. **Build Monetization MVP** (business directory + ad slots now that feed looks professional)
3. **Add Multi-City Architecture** (markets table + city_id columns after Lake Geneva is proven)

The civic sources establish Lake Geneva Local as a real newsroom, not just an events calendar. This makes monetization credible and multi-city scaling viable.
