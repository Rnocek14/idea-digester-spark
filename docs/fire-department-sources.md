# Fire Department & EMS Incident Sources - Research Findings

## Overview

Research conducted December 2025 to identify scrapeable Fire Department and EMS sources for Lake Geneva area incident ingestion.

## Key Finding

**Most local FD websites are static info pages WITHOUT news/incident feeds.**

The best opportunities for FD/EMS incident data are:
1. **Walworth County Alert Center** (CivicEngage) - Official county alerts
2. **Sheriff News Releases** - ✅ Already implemented and working!
3. **Facebook public pages** - Phase 3, requires careful implementation

---

## Source Research Results

### 1. Lake Geneva Fire Department
- **URL**: https://www.cityoflakegeneva.com/departments/fire/
- **Scrapeable**: ❌ NO - Site blocked scraping
- **Has News/Calls Page**: Unknown (blocked)
- **Tech Stack**: Unknown
- **Recommendation**: Manual check needed, likely static info only
- **Status**: SKIP for now

### 2. Town of Linn Fire Department
- **URL**: https://www.townoflinn.com/fire-department
- **Scrapeable**: ✅ YES (Juniper CMS)
- **Has News/Calls Page**: ❌ NO - Static info page only
- **Content Found**: General FD info, contact details
- **Recommendation**: No incident data available
- **Status**: SKIP - no incident content

### 3. Walworth County Alert Center ⭐ PRIORITY
- **URL**: https://www.co.walworth.wi.us/AlertCenter.aspx
- **Scrapeable**: ⚠️ MAYBE - CivicEngage, JS-heavy, needs waitFor
- **Has News/Calls Page**: ✅ YES - Active alerts system
- **Tech Stack**: CivicEngage
- **Content Type**: County-wide emergency alerts
- **Recommendation**: HIGH PRIORITY - Try Firecrawl with waitFor:8000
- **Status**: TEST REQUIRED

### 4. Walworth County Emergency Management
- **URL**: https://www.co.walworth.wi.us/268/Emergency-Management
- **Scrapeable**: ❌ NO - Site blocked scraping
- **Has News/Calls Page**: Unknown
- **Recommendation**: May link to Alert Center
- **Status**: SKIP - use Alert Center instead

### 5. Elkhorn Area Fire Department
- **URL**: https://www.cityofelkhorn.org/fire (redirects to .gov)
- **Scrapeable**: ✅ YES
- **Has News/Calls Page**: ❌ NO - Static info only
- **Content Found**: Department info, board info, contact
- **Tech Stack**: Drupal/Granicus
- **Recommendation**: No incident data available
- **Status**: SKIP - no incident content

### 6. Fontana Fire & Rescue
- **URL**: https://vi.fontana.wi.gov/departments/fire-ems/
- **Coverage**: Fontana AND Williams Bay
- **Scrapeable**: ✅ YES (WordPress)
- **Has News/Calls Page**: ❌ NO - Basic contact info only
- **Recommendation**: Check for News section elsewhere on site
- **Status**: SKIP for now - no incident content visible

### 7. Williams Bay
- **URL**: https://www.williamsbay.org/
- **Fire Coverage**: Served by Fontana Fire & Rescue
- **Has FD Page**: ❌ NO dedicated FD section
- **Recommendation**: See Fontana above
- **Status**: SKIP - no FD page

### 8. Delavan Fire Department
- **URL**: Not researched yet
- **Status**: FUTURE RESEARCH

---

## Summary: Best Incident Sources for Lake Geneva

### Already Working ✅
| Source | Type | Status | Frequency |
|--------|------|--------|-----------|
| NWS Weather Alerts | Weather | Operational | Every 15 min |
| WI 511 Traffic | Traffic | Operational | Every 15 min |
| WE Energies Outages | Utility | Operational | Every 15 min |
| Sheriff News Releases | Crime/Crashes | Operational | 2x daily |
| Geo-tier 1 Backfill | News | Operational | 2x daily |

### High Priority to Test 🔶
| Source | Type | Challenge | Next Step |
|--------|------|-----------|-----------|
| Walworth County Alert Center | Emergency | JS/CivicEngage | Test with waitFor:8000 |

### Not Viable ❌
| Source | Reason |
|--------|--------|
| Lake Geneva FD | Static info only, blocked scraping |
| Town of Linn FD | No incident feed |
| Elkhorn FD | Static info only |
| Fontana FD | No incident feed |
| Williams Bay | No FD page (uses Fontana) |

---

## Recommended Next Steps

### Step 1: Test Walworth County Alert Center
Create a test scrape with Firecrawl + waitFor:8000 to see if Alert Center content loads.

```bash
# Test via edge function or manual Firecrawl call
url: https://www.co.walworth.wi.us/AlertCenter.aspx
formats: ['markdown', 'html']
waitFor: 8000
```

### Step 2: If Alert Center Works
Create `sync-county-alerts` edge function:
- Scrape Alert Center page
- Extract active alerts (structure TBD based on scrape results)
- Insert as `source = 'county_alerts'`
- Schedule 2x daily or more frequent

### Step 3: Phase 3 - Facebook Public Pages
Consider monitoring public FB pages for:
- Lake Geneva Fire Department (if they have one)
- Fontana Fire & Rescue
- Walworth County Sheriff

This requires careful implementation with "unconfirmed" status labels.

---

## Architecture Notes

### Existing `sync-sheriff-releases` Pattern
The sheriff scraper is the template for any new FD/EMS scrapers:
- Use Firecrawl with waitFor for JS sites
- Extract structured data from markdown
- Dedupe via external_id hash
- Insert with appropriate source tag
- Status = 'resolved' for post-fact reports

### Multi-City Scalability
Each city will need similar research:
- Identify county alert systems
- Find sheriff/PD press release pages
- Check if FD sites have incident feeds (usually don't)
- Facebook public pages as Phase 3 backup
