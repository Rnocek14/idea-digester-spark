CREATE UNIQUE INDEX IF NOT EXISTS incidents_source_external_id_uidx
  ON public.incidents (source, external_id)
  WHERE source IS NOT NULL AND external_id IS NOT NULL;