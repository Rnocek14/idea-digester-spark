UPDATE public.post_queue
SET status = 'blocked',
    error_message = 'Geo-gate: non-local content (Milwaukee/Hartford/Watertown/etc.) without Lake Geneva anchor',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('blocked_at', now(), 'block_reason', 'geo_gate_manual_sweep')
WHERE id IN (
  '01c0e865-e8fa-408b-bd75-cd7f1a780974',
  '294eafbc-61c0-45be-b700-b68344653a52',
  'f804b056-d22a-44d2-ba50-826d94a5c2c9',
  '3bd2a615-75e4-4bd9-b502-8097b1f64260',
  '473385d3-84fa-4862-8eb3-54e74fe94372',
  '51b7725a-045f-4180-b98c-67864ff125d9',
  '09bb2eaa-d47a-4edb-8aa8-307a15baa622',
  'b9bb5010-d726-4592-909b-76d673b901e9'
);

UPDATE public.post_queue
SET status = 'blocked',
    error_message = 'Past-date gate: explicit past date in post text',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('blocked_at', now(), 'block_reason', 'explicit_past_date')
WHERE id = '304d14f4-6886-4e3d-8ea7-c91c5db3bc78';