-- Seed Pier 290's timely hook for Local Context Feature
INSERT INTO public.restaurant_news (
  restaurant_id,
  news_type,
  hook_type,
  headline,
  summary,
  source_url,
  published_at,
  is_current,
  verified
) VALUES (
  'e159428d-06d7-4486-b9dc-3bf990946343',
  'other',
  'event_series',
  'Don''t Miss Our 2026 Dinner & Concert Series',
  'Pier 290 announced its 2026 Dinner & Concert Series, hosted in the Boat Showroom with dinner, cocktails, and live music; tickets are required in advance.',
  'https://pier290.com/dont-miss-our-2026-dinner-concert-series/',
  '2025-12-08T00:00:00Z',
  true,
  true
);