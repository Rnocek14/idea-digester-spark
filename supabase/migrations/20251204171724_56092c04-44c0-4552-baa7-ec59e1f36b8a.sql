-- Add unique constraint on tweet_id for upsert support
ALTER TABLE public.engagement_opportunities 
ADD CONSTRAINT engagement_opportunities_tweet_id_unique UNIQUE (tweet_id);