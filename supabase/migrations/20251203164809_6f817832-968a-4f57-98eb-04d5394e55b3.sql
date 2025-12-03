-- Delete non-working regional sources (WISN/TMJ4 blocked)
DELETE FROM sources 
WHERE name IN ('WISN 12 Milwaukee - Breaking', 'TMJ4 Milwaukee - Local News');

-- Add Spectrum News Wisconsin as working alternative
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, metadata) VALUES
(
  'Spectrum News Wisconsin - Local',
  'rss',
  'http://spectrumlocalnews.com/services/contentfeed.wi%7Cmilwaukee%7Cnews.landing.rss',
  'news',
  'active',
  30,
  '{"regional": true, "coverage_keywords": ["lake geneva", "walworth county", "walworth", "fontana", "williams bay", "elkhorn", "delavan", "highway 50", "us-12", "geneva lake", "town of linn", "como", "east troy", "kenosha", "racine"], "description": "Spectrum News Wisconsin local headlines"}'::jsonb
),
(
  'Spectrum News Wisconsin - Weather',
  'rss',
  'http://spectrumlocalnews.com/services/contentfeed.wi%7Cmilwaukee%7Cweather.hero.rss',
  'weather',
  'active',
  15,
  '{"regional": true, "coverage_keywords": ["lake geneva", "walworth county", "walworth", "southeast wisconsin", "southern wisconsin"], "description": "Spectrum News Wisconsin weather alerts"}'::jsonb
);