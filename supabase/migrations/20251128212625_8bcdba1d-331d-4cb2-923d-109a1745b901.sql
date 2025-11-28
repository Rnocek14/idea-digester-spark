-- Add voice transformation columns to content_queue
ALTER TABLE content_queue
  ADD COLUMN content_lg_base text,              -- unified Lake Geneva voice
  ADD COLUMN content_website text,              -- long-form / SEO-ish
  ADD COLUMN content_newsletter text,           -- warm, personal
  ADD COLUMN content_facebook text,             -- conversational, engagement
  ADD COLUMN content_instagram text,            -- short, emoji-friendly
  ADD COLUMN content_x text,                    -- short, punchy
  ADD COLUMN voice_generated_at timestamptz,    -- when variants were created
  ADD COLUMN voice_version text;                -- which prompt/version was used

-- Add index for querying stories without voice
CREATE INDEX idx_content_queue_voice_generated ON content_queue(voice_generated_at) WHERE voice_generated_at IS NULL;

-- Add index for voice version tracking
CREATE INDEX idx_content_queue_voice_version ON content_queue(voice_version) WHERE voice_version IS NOT NULL;