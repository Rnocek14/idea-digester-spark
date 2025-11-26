-- Sample Lake Geneva Sources for Content Ingestion
-- Run this in Supabase SQL Editor to populate initial sources
-- Project: mzumvkrpnxhkvhdyzgqa

INSERT INTO public.sources (name, type, url, category, status, fetch_frequency_minutes, metadata)
VALUES
  (
    'City of Lake Geneva – Civic Alerts',
    'rss',
    'https://www.cityoflakegeneva.gov/rss.aspx',
    'news',
    'active',
    60,
    '{"location_tags": ["Lake Geneva"]}'::jsonb
  ),
  (
    'Walworth County Community News – Lake Geneva',
    'rss',
    'https://walworthcountycommunitynews.com/feed/',
    'news',
    'active',
    60,
    '{"location_tags": ["Lake Geneva"]}'::jsonb
  ),
  (
    'Visit Lake Geneva – Events',
    'scrape',
    'https://www.visitlakegeneva.com/events/',
    'events',
    'active',
    120,
    '{"location_tags": ["Lake Geneva"], "scrape_selector": ".event-item"}'::jsonb
  );
