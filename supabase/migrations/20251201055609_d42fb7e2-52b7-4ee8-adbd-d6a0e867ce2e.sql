-- Add AI image generation fields to post_queue
ALTER TABLE post_queue 
ADD COLUMN is_sponsored BOOLEAN DEFAULT false,
ADD COLUMN sponsor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL,
ADD COLUMN generated_image_url TEXT;

-- Create storage bucket for AI-generated images
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-images', 'generated-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for generated-images bucket
CREATE POLICY "Generated images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-images');

CREATE POLICY "Admins can upload generated images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'generated-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can upload generated images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'generated-images');

-- Add index for sponsor_id lookups
CREATE INDEX idx_post_queue_sponsor_id ON post_queue(sponsor_id);
CREATE INDEX idx_post_queue_is_sponsored ON post_queue(is_sponsored) WHERE is_sponsored = true;