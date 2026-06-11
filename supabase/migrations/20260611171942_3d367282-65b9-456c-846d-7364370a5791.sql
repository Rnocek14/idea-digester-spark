
ALTER TABLE public.history_entries
  ADD COLUMN IF NOT EXISTS history_type text;

CREATE INDEX IF NOT EXISTS history_entries_history_type_idx
  ON public.history_entries(history_type);

-- Relax sources.status to allow 'dormant' if it's currently constrained.
DO $$
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'public.sources'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sources DROP CONSTRAINT %I', c_name);
  END IF;
END $$;
