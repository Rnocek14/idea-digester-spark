-- Assign varied weather images to existing weather articles based on ID hash
WITH weather_images AS (
  SELECT unnest(ARRAY[
    'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=800&q=80',
    'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=800&q=80',
    'https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=800&q=80',
    'https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=800&q=80',
    'https://images.unsplash.com/photo-1610141160708-53221889e5b1?w=800&q=80',
    'https://images.unsplash.com/photo-1547754980-3df97fed72a8?w=800&q=80',
    'https://images.unsplash.com/photo-1428592953211-077101b2021b?w=800&q=80'
  ]) AS url,
  generate_series(0, 6) AS idx
)
UPDATE content_queue cq
SET image_url = wi.url
FROM weather_images wi
WHERE cq.category = 'weather'
  AND wi.idx = (('x' || substr(cq.id::text, 1, 8))::bit(32)::int % 7);