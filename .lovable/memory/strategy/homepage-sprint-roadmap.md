---
name: Homepage Sprint Roadmap (post-audit)
description: Four-sprint sequence to evolve the homepage from RSS-feel into publication-feel
type: feature
---
Agreed sprint order after full-page audit (Jun 2026):

**Sprint 1 (shipping):** Lead story hierarchy (1 lead + 2 secondaries + "More from today" headline list) · Strip StoryCard chrome (remove NEWS badge on image, "Read full story" link, ShareButtons, separate source row, default Lake Geneva geo chip) · Playfair headlines on all story titles (body/deck/meta stay Inter).

**Sprint 2:** Compress weather widget (single line: temp · condition · H/L; full forecast moves lower) · ~~Collapse Community Status into the [RIGHT NOW] header when "All Clear" — only expand when an active incident exists~~ **Superseded (Jul 2026 audit):** when All Clear, LiveIncidentsSidebar now renders a compact 7-day recap ("Last 7 days: N incidents, all resolved" + most recent resolved item) instead of vanishing — quiet days must read as competence, not absence. Do not restore the self-hiding behavior. · Reorder right rail to strict temporal flow: Tonight → This Weekend → Next Week → Worth a Look.

**Sprint 3 (shipped):** Section dividers in the LATEST feed (Local News / Civic / Business / Real Estate / Food & Drink / Events / Community / Schools) — applied to the "More from today" headline list grouped by category in display order · "Catching Up" headline list at the bottom for stories >72h old (title + source only, no card chrome) · Smarter sticky subscribe banner (triggers once at ~50% page scroll; dismissal persists 7 days via localStorage; successful subscribe hides for 90 days).

**Sprint 4 (shipped):** "Today's Brief" editorial voice block above the lead — date heading, italic teaser, three numbered headlines tagged by section (At City Hall / Around town / On the calendar...), signed "— Lake Geneva Brief desk". Derived from the day's top 3 lead stories so it always tracks the actual lineup · "Lake at a Glance" left-rail panel: today's H/L, sunrise, sunset, community status from incidents (live via Open-Meteo + Supabase). Lake temp, beach status, and traffic intentionally deferred — we don't show fake data; "coming soon" footnote noted · Image policy cleanup via src/lib/imagePolicy.ts — blocks TV-station hosts (cbs58, fox6now, tmj4, wisn, channel3000, wkow, nbc15, weather.com, etc.) and URL fragments (radar, doppler, forecast, weather-radar) before falling back to the curated civic/category set in getCategoryFallbackImage.