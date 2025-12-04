-- Make newsletter_id nullable to support web click tracking (not just newsletter clicks)
ALTER TABLE newsletter_clicks ALTER COLUMN newsletter_id DROP NOT NULL;