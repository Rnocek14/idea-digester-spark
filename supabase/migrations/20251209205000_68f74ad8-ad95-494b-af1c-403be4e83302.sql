-- Add high-value local news sources for Lake Geneva content mix

-- 1. Walworth County Community News - Main feed (hyperlocal county coverage)
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Walworth County Community News',
  'rss',
  'https://walworthcountycommunitynews.com/feed/',
  'news',
  'active',
  120,
  1,
  '{"location_tags": ["Lake Geneva", "Walworth County", "Elkhorn", "Delavan"], "coverage_keywords": ["lake geneva", "walworth", "elkhorn", "delavan", "fontana", "williams bay"], "trusted_locality": true}'::jsonb
);

-- 2. Walworth County Government - CivicAlerts RSS (civic/government news)
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Walworth County Government News',
  'rss',
  'https://www.co.walworth.wi.us/rss.aspx',
  'civic',
  'active',
  180,
  2,
  '{"location_tags": ["Walworth County"], "coverage_keywords": ["walworth county", "lake geneva", "elkhorn"], "trusted_locality": true, "vertical_hints": ["civic", "local"]}'::jsonb
);

-- 3. Patch Lake Geneva (hyperlocal news + community)
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, default_geo_tier, metadata)
VALUES (
  'Patch Lake Geneva',
  'scrape',
  'https://patch.com/wisconsin/lake-geneva-wi',
  'news',
  'active',
  180,
  1,
  '{"location_tags": ["Lake Geneva"], "scrape_selector": "article.styles_Card__HkIZq", "trusted_locality": true, "vertical_hints": ["local", "community"]}'::jsonb
);