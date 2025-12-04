-- Replace testimonials with seller-focused only
UPDATE business_profiles 
SET metadata = jsonb_build_object(
  'testimonials', jsonb_build_array(
    jsonb_build_object('quote', 'Gina sold our home 10% over asking in 10 days — we were living in Chicago the whole time.', 'attribution', 'Out-of-state sellers', 'tag', 'Remote sale'),
    jsonb_build_object('quote', 'Listed Friday, multiple offers by Monday, closed in 12 days. Gina made it happen.', 'attribution', 'Recent seller', 'tag', 'Quick sale'),
    jsonb_build_object('quote', 'Gina handled everything — photos, staging, showings — we barely lifted a finger.', 'attribution', 'Lake Geneva sellers', 'tag', 'Full service'),
    jsonb_build_object('quote', 'We were worried about timing the market. Gina got us multiple offers in 48 hours.', 'attribution', 'First-time sellers', 'tag', 'Fast results')
  )
)
WHERE id = 'db06b0ce-2fe3-4a01-a870-7f2aef1913a6';