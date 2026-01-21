# Newsletter: LIVE · LATEST · LATER Architecture

**Version**: 2.0
**Status**: ✅ IMPLEMENTED (2026-01-21)
**Last Updated**: January 2026

## Overview

This spec aligns the daily newsletter with the homepage's time-based architecture: **LIVE · LATEST · LATER**. The goal is to create consistent mental models across web + email, reinforcing habit formation.

---

## Current vs. New Structure

### Current Structure
```
📋 At-a-Glance (bulleted list by category)
📅 Events
📰 News
🍽️ Dining
✨ Local Favorites (evergreen fallback)
💼 Now Hiring
🌟 Community Advocates
```

### New Structure: LIVE · LATEST · LATER
```
🔴 LIVE (conditional - only when active)
   - Active incidents / severe weather / road closures
   - Omitted entirely when "All clear"

📰 LATEST (the briefing - 3-5 items)
   - Top news/civic stories from last 24h
   - Curated, not dumped
   - Voice-transformed for scanability

📅 LATER (decision support)
   - Pick of the Day (featured event with performer + time)
   - Tonight's Schedule (3-4 events max)
   - Weekend Preview (if Thursday/Friday send)

💼 NOW HIRING (existing, unchanged)
🌟 COMMUNITY (advocates, evergreen, referral CTA)
```

---

## Section Specifications

### 🔴 LIVE Section (Conditional)

**When to include**: Only if `activeIncidents.length > 0` OR `hasActiveWeatherAlert`

**Query** (no new tables):
```sql
-- Active incidents (last 6h, status = active)
SELECT id, title, severity, incident_type, updated_at
FROM incidents
WHERE status = 'active'
  AND updated_at >= NOW() - INTERVAL '6 hours'
ORDER BY severity DESC, updated_at DESC
LIMIT 3;

-- Active NWS alerts (optional enhancement)
SELECT id, title, event_type, severity
FROM content_queue
WHERE source_id IN (SELECT id FROM sources WHERE slug = 'nws-weather-alerts')
  AND status IN ('approved', 'published')
  AND created_at >= NOW() - INTERVAL '24 hours'
  AND (event_date IS NULL OR event_date >= CURRENT_DATE)
LIMIT 2;
```

**Rendering rules**:
- Red left border (like homepage)
- Brief, factual (1-2 sentences max)
- Link to incident detail page
- If section is empty → **omit entirely** (not "All clear" in email)

**HTML template snippet**:
```html
<div style="margin-bottom: 24px; padding: 16px; background-color: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px;">
  <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #dc2626;">
    🔴 LIVE Updates
  </h2>
  <!-- incident items here -->
</div>
```

---

### 📰 LATEST Section (The Briefing)

**What it is**: The daily editorial heart — 3-5 curated stories, voice-transformed.

**Query** (existing logic, refined):
```sql
-- Fresh stories from last 24-72h, geo-filtered, category-balanced
SELECT id, title, content_newsletter, summary, category, original_url, publish_date
FROM content_queue
WHERE status IN ('approved', 'auto_published', 'published')
  AND safety_level = 'safe'
  AND geo_tier IN (1, 2)
  AND last_newsletter_id IS NULL
  AND (
    publish_date >= NOW() - INTERVAL '72 hours'
    OR (publish_date IS NULL AND created_at >= NOW() - INTERVAL '72 hours')
  )
  AND (event_date IS NULL OR event_date >= CURRENT_DATE)
  AND category NOT IN ('events') -- Events go to LATER
ORDER BY 
  CASE WHEN category = 'news' THEN 1
       WHEN category = 'civic' THEN 2
       WHEN category = 'community' THEN 3
       ELSE 4 END,
  publish_date DESC NULLS LAST
LIMIT 5;
```

**Rendering rules**:
- Section header: "📰 LATEST"
- Each story: headline + 1-2 sentence voice summary + "Read more →" link
- No category sub-grouping (flat list, editorially curated)
- Cap at 5 items (brevity over completeness)

---

### 📅 LATER Section (Decision Support)

**What it is**: Tonight's plans — a featured pick + short schedule.

**Queries**:

```sql
-- PICK OF THE DAY: Best event in next 72h (same scoring as homepage)
-- Requires: performer OR event_time, known venue, not generic
SELECT id, title, event_date, event_time, performer, original_url
FROM content_queue
WHERE status IN ('approved', 'auto_published', 'published')
  AND safety_level = 'safe'
  AND category = 'events'
  AND metadata->'verticals' ? 'nightlife'
  AND event_date >= CURRENT_DATE
  AND event_date <= CURRENT_DATE + INTERVAL '3 days'
ORDER BY 
  CASE 
    WHEN performer IS NOT NULL THEN 3 
    WHEN event_time IS NOT NULL THEN 2 
    ELSE 0 
  END DESC,
  event_date ASC
LIMIT 1;

-- TONIGHT'S SCHEDULE: Events for today (max 4)
SELECT id, title, event_time, original_url
FROM content_queue
WHERE status IN ('approved', 'auto_published', 'published')
  AND safety_level = 'safe'
  AND category = 'events'
  AND event_date = CURRENT_DATE
ORDER BY event_time ASC NULLS LAST
LIMIT 4;

-- WEEKEND PREVIEW (only on Thu/Fri sends)
-- Same query but for Saturday/Sunday dates
```

**Rendering rules**:
- Pick of the Day: highlighted card (amber background, like homepage)
- Tonight: simple list with times
- Weekend Preview: only include if sending Thursday or Friday

**HTML template snippet** (Pick):
```html
<div style="margin-bottom: 16px; padding: 16px; background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%); border-radius: 8px;">
  <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 0.1em;">
    ⭐ PICK OF THE DAY
  </p>
  <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #78350f;">
    {venue_name}
  </h3>
  <p style="margin: 0; font-size: 14px; color: #92400e;">
    {performer} · {day_label} at {event_time}
  </p>
</div>
```

---

## Minimum Content Thresholds

| Section | Minimum Required | Skip Rule |
|---------|------------------|-----------|
| LIVE | 0 (conditional) | Omit if empty |
| LATEST | 2 stories | Skip newsletter if < 2 |
| LATER | 1 event | OK to omit if no events |

**Newsletter skip conditions** (existing, unchanged):
- `LATEST` < 2 stories AND no active incidents → skip with logged reason

---

## Implementation Checklist

### Phase 1: Restructure buildNewsletter() ✅
- [x] Add `fetchActiveIncidents()` query
- [x] Add `fetchLaterPick()` query (reuse homepage scoring logic)
- [x] Add `fetchTonightSchedule()` query
- [x] Modify `buildNewsletter()` to accept new section data
- [x] Create `buildLiveSection()` HTML helper
- [x] Create `buildLatestSection()` HTML helper (replaces category grouping)
- [x] Create `buildLaterSection()` HTML helper

### Phase 2: Template Update ✅
- [x] Replace At-a-Glance with LIVE section (conditional)
- [x] Replace category-grouped content with LATEST section
- [x] Add LATER section before Jobs
- [x] Keep NOW HIRING and COMMUNITY sections unchanged

### Phase 3: Testing
- [ ] Test with active incident → LIVE appears
- [ ] Test without incidents → LIVE omitted cleanly
- [ ] Test on Thursday → Weekend Preview included
- [ ] Test thin content day → evergreen fallback still works
- [ ] Verify tracking pixels/links still work

---

## Example Newsletter Layout (Visual)

```
┌──────────────────────────────────────────┐
│  LAKE GENEVA LOCAL                       │
│  Tuesday, January 21, 2026               │
├──────────────────────────────────────────┤
│  Good morning, Lake Geneva! 👋           │
├──────────────────────────────────────────┤
│  🔴 LIVE                    ← CONDITIONAL│
│  ├─ Winter Storm Warning in effect...    │
│  └─ Power outage reported on Main St...  │
├──────────────────────────────────────────┤
│  📰 LATEST                               │
│  ├─ City Council approves new...         │
│  ├─ Local business expands to...         │
│  ├─ School district announces...         │
│  └─ Fire dept. hosts open house...       │
├──────────────────────────────────────────┤
│  📅 LATER                                │
│  ┌─────────────────────────────────────┐ │
│  │ ⭐ PICK OF THE DAY                  │ │
│  │ Pier 290 · Randy McCallister        │ │
│  │ Saturday at 8:00 PM                 │ │
│  └─────────────────────────────────────┘ │
│  TONIGHT                                 │
│  • 6pm - Trivia at Topsy Turvy          │
│  • 7pm - Open Mic at Simple Café        │
│  • 8pm - Live Music at Pier 290         │
├──────────────────────────────────────────┤
│  💼 NOW HIRING                           │
│  (existing section, unchanged)           │
├──────────────────────────────────────────┤
│  🌟 COMMUNITY                            │
│  (advocates + referral CTA)              │
└──────────────────────────────────────────┘
```

---

## Migration Path

1. **Keep existing newsletter running** — no downtime
2. **Create new `buildNewsletterV2()` function** alongside existing
3. **A/B test** via feature flag in `system_settings`
4. **Measure** open rates + click rates between versions
5. **Promote V2** once metrics validated

---

## Open Questions

1. **Should LIVE section link to homepage or incident detail page?**
   - Recommendation: Link to `/incidents/{id}` for specifics

2. **Should Pick of the Day use venue persistence like homepage?**
   - Recommendation: No (newsletter is daily, one pick per day is fine)

3. **Should we show "All clear" in email when no incidents?**
   - Recommendation: No — omit LIVE section entirely (email is different from dashboard)

---

## Related Files

- `supabase/functions/autopilot-newsletter/index.ts` — main newsletter generator
- `supabase/functions/send-newsletter/index.ts` — email sending
- `src/components/NightlifeWidget.tsx` — homepage pick scoring (reference)
- `src/pages/LakeGenevaV2.tsx` — homepage layout (reference)
