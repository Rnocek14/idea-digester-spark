
-- Add Walworth County Sheriff Facebook as incident source
INSERT INTO sources (name, url, type, category, status, metadata, default_geo_tier, fetch_frequency_minutes)
VALUES (
  'Walworth County Sheriff Facebook',
  'https://www.facebook.com/WalworthCountySheriff',
  'scrape',
  'civic',
  'active',
  '{
    "trust_locality": true,
    "selector": "div[data-ad-preview=\"message\"], div[role=\"article\"], article",
    "title_selector": "div[data-ad-preview=\"message\"], span[dir=\"auto\"], p",
    "link_selector": "a[href*=\"/posts/\"], a[href*=\"pfbid\"]",
    "is_incident_source": true,
    "description": "Official Walworth County Sheriff Office - real-time incident reports"
  }'::jsonb,
  1,
  30
)
ON CONFLICT DO NOTHING;
