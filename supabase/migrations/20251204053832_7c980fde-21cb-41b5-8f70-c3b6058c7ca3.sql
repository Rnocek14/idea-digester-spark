-- Add 2 more testimonials highlighting lakefront expertise and quick sales
UPDATE business_profiles 
SET metadata = jsonb_set(
  metadata,
  '{testimonials}',
  metadata->'testimonials' || jsonb_build_array(
    jsonb_build_object(
      'quote', 'Gina''s lakefront knowledge is unmatched — she knew every dock, every view, every HOA rule before we even asked.',
      'attribution', 'Lakefront buyer',
      'tag', 'Lakefront expert'
    ),
    jsonb_build_object(
      'quote', 'Listed Friday, multiple offers by Monday, closed in 12 days over asking. Gina made it happen.',
      'attribution', 'Recent seller',
      'tag', 'Quick sale'
    )
  )
)
WHERE id = 'db06b0ce-2fe3-4a01-a870-7f2aef1913a6';