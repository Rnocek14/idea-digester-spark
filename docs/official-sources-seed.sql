-- Official Public Safety & Government Sources for Lake Geneva
-- Run in Supabase SQL Editor to add high-signal hyperlocal sources
-- These sources are non-bot-protected and reliably produce Tier 1/2 content

-- ============================================================
-- 1. WALWORTH COUNTY SHERIFF (Tier 2 - county-wide coverage)
-- ============================================================
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Walworth County Sheriff',
  'rss',
  'https://www.co.walworth.wi.us/rss.aspx?feed=news&dept=69',
  'safety',
  'active',
  30,
  2,
  '{"location_tags": ["Walworth County"], "priority": "high", "trust_anchor": true}'::jsonb
)
ON CONFLICT DO NOTHING;

-- Facebook backup for Sheriff (requires n8n webhook - staged as inactive)
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Walworth County Sheriff - Facebook',
  'scrape',
  'https://www.facebook.com/WalworthCountySheriff',
  'safety',
  'inactive',
  60,
  2,
  '{"location_tags": ["Walworth County"], "requires_browser": true, "note": "Activate when n8n webhook ready"}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. LAKE GENEVA POLICE DEPARTMENT (Tier 1 - hyperlocal)
-- ============================================================
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Lake Geneva Police - Facebook',
  'scrape',
  'https://www.facebook.com/LakeGenevaPD',
  'safety',
  'inactive',
  60,
  1,
  '{"location_tags": ["Lake Geneva"], "requires_browser": true, "priority": "high"}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. LAKE GENEVA FIRE DEPARTMENT (Tier 1 - hyperlocal)
-- ============================================================
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Lake Geneva Fire - Facebook',
  'scrape',
  'https://www.facebook.com/LakeGenevaFire',
  'safety',
  'inactive',
  60,
  1,
  '{"location_tags": ["Lake Geneva"], "requires_browser": true}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. CITY OF LAKE GENEVA OFFICIAL (Tier 1 - hyperlocal)
-- ============================================================
-- City RSS feed for civic alerts
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'City of Lake Geneva Alerts',
  'rss',
  'https://www.cityoflakegeneva.com/rss.aspx',
  'civic',
  'active',
  60,
  1,
  '{"location_tags": ["Lake Geneva"], "trust_anchor": true}'::jsonb
)
ON CONFLICT DO NOTHING;

-- City meeting agendas/minutes (CivicEngage platform)
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Lake Geneva City Meetings',
  'scrape',
  'https://www.cityoflakegeneva.com/AgendaCenter',
  'civic',
  'active',
  240,
  1,
  '{"location_tags": ["Lake Geneva"], "scrape_type": "civicengage", "content_type": "meetings"}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. WALWORTH COUNTY GOVERNMENT (Tier 2)
-- ============================================================
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Walworth County News',
  'rss',
  'https://www.co.walworth.wi.us/rss.aspx?feed=news',
  'civic',
  'active',
  120,
  2,
  '{"location_tags": ["Walworth County"], "trust_anchor": true}'::jsonb
)
ON CONFLICT DO NOTHING;

-- County Emergency Management
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Walworth County Emergency Mgmt',
  'rss',
  'https://www.co.walworth.wi.us/rss.aspx?feed=news&dept=49',
  'safety',
  'active',
  30,
  2,
  '{"location_tags": ["Walworth County"], "priority": "high", "alert_source": true}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. LAKE GENEVA SCHOOL DISTRICT (Tier 1)
-- ============================================================
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Lake Geneva Schools News',
  'scrape',
  'https://www.lakegenevaschools.com/news',
  'schools',
  'active',
  120,
  1,
  '{"location_tags": ["Lake Geneva"], "scrape_selector": "article.fsBoard-3"}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. WILLIAMS BAY (Tier 1 - lakefront community)
-- ============================================================
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Williams Bay Village',
  'rss',
  'https://www.williamsbay.org/rss.aspx',
  'civic',
  'active',
  180,
  1,
  '{"location_tags": ["Williams Bay", "Lake Geneva area"]}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. FONTANA (Tier 1 - lakefront community)
-- ============================================================
INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Fontana Village',
  'rss',
  'https://www.fontana-wi.gov/rss.aspx',
  'civic',
  'active',
  180,
  1,
  '{"location_tags": ["Fontana", "Lake Geneva area"]}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================
-- Run this after inserting to verify sources were added:
SELECT 
  name,
  type,
  category,
  status,
  default_geo_tier,
  CASE default_geo_tier 
    WHEN 1 THEN 'Lake Geneva (T1)'
    WHEN 2 THEN 'Walworth (T2)'
    ELSE 'Regional (T0)'
  END as tier_label,
  metadata->>'priority' as priority
FROM sources
WHERE category IN ('safety', 'civic', 'schools')
  AND created_at > now() - interval '1 hour'
ORDER BY default_geo_tier ASC, name;
