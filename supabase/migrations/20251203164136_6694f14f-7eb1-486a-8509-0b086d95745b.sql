-- Add regional breaking news RSS sources with coverage keywords
INSERT INTO sources (name, type, url, category, status, fetch_frequency_minutes, metadata) VALUES
(
  'WISN 12 Milwaukee - Breaking',
  'rss',
  'https://www.wisn.com/topstories-rss',
  'news',
  'active',
  30,
  '{"regional": true, "coverage_keywords": ["lake geneva", "walworth county", "walworth", "fontana", "williams bay", "elkhorn", "delavan", "highway 50", "us-12", "geneva lake", "town of linn", "como", "east troy"], "description": "Regional Milwaukee ABC breaking news"}'::jsonb
),
(
  'TMJ4 Milwaukee - Local News',
  'rss', 
  'https://www.tmj4.com/feeds/rssFeed?obfType=RSS_FEED&siteId=10043',
  'news',
  'active',
  30,
  '{"regional": true, "coverage_keywords": ["lake geneva", "walworth county", "walworth", "fontana", "williams bay", "elkhorn", "delavan", "highway 50", "us-12", "geneva lake", "town of linn", "como", "east troy"], "description": "Regional Milwaukee NBC local news"}'::jsonb
);

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule sync-nws-alerts to run every 15 minutes
SELECT cron.schedule(
  'sync-nws-alerts-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/sync-nws-alerts',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dW12a3Jwbnhoa3ZoZHl6Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDkzNjEsImV4cCI6MjA3OTY4NTM2MX0.HgDLweJ15vv-OtiQ-dQkuiDL9AzXdUQ6mSKxOkO0GdA'
    ),
    body:='{}'::jsonb
  ) as request_id;
  $$
);