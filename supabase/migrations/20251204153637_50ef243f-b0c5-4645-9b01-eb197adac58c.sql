-- Create engagement opportunities table for X monitoring
CREATE TABLE public.engagement_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'x',
  opportunity_type TEXT NOT NULL, -- mention, reply, hashtag, follower
  tweet_id TEXT,
  author_username TEXT,
  author_display_name TEXT,
  author_profile_url TEXT,
  tweet_text TEXT,
  tweet_url TEXT,
  hashtags TEXT[],
  tweet_created_at TIMESTAMP WITH TIME ZONE,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'new', -- new, reviewed, engaged, dismissed
  priority_score INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT engagement_opportunities_type_check CHECK (opportunity_type IN ('mention', 'reply', 'hashtag', 'follower')),
  CONSTRAINT engagement_opportunities_status_check CHECK (status IN ('new', 'reviewed', 'engaged', 'dismissed'))
);

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX idx_engagement_opportunities_tweet ON public.engagement_opportunities(platform, tweet_id) WHERE tweet_id IS NOT NULL;

-- Index for efficient querying
CREATE INDEX idx_engagement_opportunities_status ON public.engagement_opportunities(status, priority_score DESC);
CREATE INDEX idx_engagement_opportunities_type ON public.engagement_opportunities(opportunity_type);

-- Enable RLS
ALTER TABLE public.engagement_opportunities ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can manage engagement opportunities"
ON public.engagement_opportunities
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_engagement_opportunities_updated_at
BEFORE UPDATE ON public.engagement_opportunities
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();