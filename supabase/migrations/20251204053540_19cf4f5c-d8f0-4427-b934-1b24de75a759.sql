-- Update Gina's metadata with testimonials array
UPDATE business_profiles 
SET metadata = jsonb_build_object(
  'testimonials', jsonb_build_array(
    jsonb_build_object(
      'quote', 'Gina handled everything for us from Chicago — we closed above asking in 10 days.',
      'attribution', 'Out-of-state sellers',
      'tag', 'Remote sale'
    ),
    jsonb_build_object(
      'quote', 'She found us the perfect lakefront home and negotiated a better price than we expected.',
      'attribution', 'Lakefront buyers',
      'tag', 'Lakefront'
    ),
    jsonb_build_object(
      'quote', 'As first-time buyers in Lake Geneva, Gina made the process simple, clear, and stress-free.',
      'attribution', 'First-time buyers',
      'tag', 'First-time'
    ),
    jsonb_build_object(
      'quote', 'Professional, responsive, and she really knows this market inside and out.',
      'attribution', 'Repeat client',
      'tag', 'Local expert'
    )
  )
)
WHERE id = 'db06b0ce-2fe3-4a01-a870-7f2aef1913a6';