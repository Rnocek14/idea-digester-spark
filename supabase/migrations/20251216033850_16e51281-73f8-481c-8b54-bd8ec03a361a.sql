-- Create evergreen_content table for curated always-relevant content
CREATE TABLE public.evergreen_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'lifestyle',
  season text DEFAULT 'all', -- 'all', 'winter', 'summer', 'spring', 'fall'
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamp with time zone,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evergreen_content ENABLE ROW LEVEL SECURITY;

-- Admins can manage evergreen content
CREATE POLICY "Admins can manage evergreen content"
  ON public.evergreen_content
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System can read evergreen content (for newsletter generation)
CREATE POLICY "System can read evergreen content"
  ON public.evergreen_content
  FOR SELECT
  USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_evergreen_content_updated_at
  BEFORE UPDATE ON public.evergreen_content
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Seed with initial Lake Geneva evergreen content
INSERT INTO public.evergreen_content (title, content, category, season, priority) VALUES
('Winter in Lake Geneva: 7 Cozy Things To Do', 'From lakeside hot cocoa to fireside dining, discover the best ways to embrace the season in Lake Geneva. Ice fishing, winter walks along the shore path, and cozy restaurants await.', 'lifestyle', 'winter', 10),
('Best Brunch Spots Near the Lake', 'Start your weekend right with these local favorites. From classic diners to upscale lakefront dining, Lake Geneva has brunch covered.', 'dining', 'all', 8),
('Local Parking Tips & Winter Driving', 'Navigating downtown Lake Geneva in winter? Here are the locals'' secrets for hassle-free parking and safe driving around the lake area.', 'civic', 'winter', 6),
('The Geneva Lake Shore Path: A Year-Round Guide', 'All 21 miles of the famous shore path offer stunning views in every season. Tips for access points, best sections, and what to bring.', 'lifestyle', 'all', 9),
('Save the Date: Lake Geneva''s Biggest Annual Events', 'Mark your calendar for Winterfest, Wine Walk, Oktoberfest, and more. These beloved traditions bring the community together year after year.', 'events', 'all', 7),
('Hidden Gems: Local Shops Downtown', 'Skip the chains and discover the unique boutiques, antique stores, and specialty shops that make downtown Lake Geneva special.', 'community', 'all', 5);