# Fire Department & EMS Incident Sources

## Overview

This document tracks potential Fire Department and EMS sources for Lake Geneva area incident ingestion.

## Target Sources (Walworth County Area)

### 1. Lake Geneva Fire Department
- **Website**: https://www.cityoflakegeneva.com/departments/fire/
- **Status**: Research needed
- **Type**: City department
- **Coverage**: Lake Geneva city proper
- **Scrapeable**: TBD (check for news/alerts page)

### 2. Town of Linn Fire Department
- **Website**: https://www.townoflinn.com/fire-department
- **Status**: Research needed
- **Type**: Town department
- **Coverage**: Town of Linn (Lake Geneva adjacent)
- **Note**: Already mentioned in content - "Lake Geneva fire department expands support for Town of Linn"

### 3. Williams Bay Fire Department
- **Website**: TBD
- **Status**: Research needed
- **Type**: Village department
- **Coverage**: Williams Bay

### 4. Elkhorn Fire Department
- **Website**: https://www.cityofelkhorn.org/fire
- **Status**: Research needed
- **Type**: City department
- **Coverage**: Elkhorn (county seat)

### 5. Delavan Fire Department
- **Website**: TBD
- **Status**: Research needed
- **Type**: City department
- **Coverage**: Delavan

### 6. Walworth County Emergency Management
- **Website**: https://www.co.walworth.wi.us/692/Emergency-Management
- **Status**: Research needed
- **Type**: County-level coordination
- **Coverage**: All Walworth County
- **Note**: May have county-wide alerts, severe weather, major incidents

### 7. Fontana Fire Department
- **Website**: TBD
- **Status**: Research needed
- **Type**: Village department
- **Coverage**: Fontana-on-Geneva-Lake

## Source Research Checklist

For each source, determine:
- [ ] Has news/alerts section?
- [ ] Has RSS feed?
- [ ] Uses WordPress/CivicEngage/Revize?
- [ ] Facebook public page (backup)?
- [ ] Update frequency?
- [ ] Content type (calls, incidents, announcements)?

## Implementation Priority

1. **Walworth County Emergency Management** - County-wide, official, likely structured
2. **Lake Geneva Fire Department** - Primary city
3. **Elkhorn Fire Department** - County seat, may have more formal reporting
4. **Town of Linn** - Already mentioned in coverage

## Edge Function Pattern

Similar to `sync-sheriff-releases`:
- Use Firecrawl to scrape news/alerts pages
- Extract incident-like content via AI classification
- Dedupe via external_id (hash of date + type + location)
- Insert with `source = 'fire_dept'`
- Status = 'resolved' (post-fact reports)

## Cron Schedule

Recommended: 2x daily (same as sheriff releases)
- 7am CT (13:00 UTC)
- 5pm CT (23:00 UTC)
