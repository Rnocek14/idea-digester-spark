-- Restaurant scrape jobs queue table
CREATE TABLE public.restaurant_scrape_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES public.sources(id) ON DELETE CASCADE,
  restaurant_slug TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'discovering', 'scraping', 'extracting', 'complete', 'failed')),
  priority INTEGER DEFAULT 0,
  
  -- Discovery results
  discovered_pages JSONB DEFAULT '[]'::jsonb,
  pages_scraped INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  
  -- Combined content for extraction
  combined_content TEXT,
  content_sources JSONB DEFAULT '[]'::jsonb,
  
  -- Extraction results
  extraction_result JSONB,
  extraction_confidence NUMERIC(3,2),
  
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for queue processing
CREATE INDEX idx_scrape_jobs_status_priority ON public.restaurant_scrape_jobs(status, priority DESC, created_at ASC);
CREATE INDEX idx_scrape_jobs_source ON public.restaurant_scrape_jobs(source_id);

-- Enable RLS
ALTER TABLE public.restaurant_scrape_jobs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON public.restaurant_scrape_jobs
  FOR ALL USING (true) WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_scrape_jobs_updated_at
  BEFORE UPDATE ON public.restaurant_scrape_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Fish fry submissions table (crowdsource)
CREATE TABLE public.fish_fry_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_name TEXT NOT NULL,
  restaurant_slug TEXT,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  
  -- Fish fry details
  day_served TEXT DEFAULT 'Friday',
  fish_type TEXT,
  price TEXT,
  sides TEXT,
  is_all_you_can_eat BOOLEAN DEFAULT false,
  description TEXT,
  
  -- Happy hour (optional)
  happy_hour_days TEXT[],
  happy_hour_start TEXT,
  happy_hour_end TEXT,
  happy_hour_deals TEXT,
  
  -- Weekly specials (optional)
  weekly_specials JSONB DEFAULT '[]'::jsonb,
  
  -- Verification
  proof_url TEXT,
  proof_image_url TEXT,
  submitter_email TEXT,
  submitter_name TEXT,
  
  -- Moderation
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_verification')),
  moderated_by UUID,
  moderated_at TIMESTAMPTZ,
  moderation_notes TEXT,
  is_verified BOOLEAN DEFAULT false,
  
  -- Metadata
  source TEXT DEFAULT 'web_form',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for submissions
CREATE INDEX idx_submissions_status ON public.fish_fry_submissions(status, created_at DESC);
CREATE INDEX idx_submissions_restaurant ON public.fish_fry_submissions(restaurant_slug);

-- Enable RLS
ALTER TABLE public.fish_fry_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert submissions
CREATE POLICY "Anyone can submit fish fry" ON public.fish_fry_submissions
  FOR INSERT WITH CHECK (true);

-- Only admins can view/update
CREATE POLICY "Admins can manage submissions" ON public.fish_fry_submissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON public.fish_fry_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();