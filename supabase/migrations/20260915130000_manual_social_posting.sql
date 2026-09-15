-- Manual posting for platforms we have no API access to.
--
-- Facebook and Instagram posts were being marked `simulated` — written, then
-- dropped on the floor with the note "Would have posted to real platform API".
-- In a town this size those two platforms are where the readers actually are,
-- so the queue was doing all the work of drafting and none of the reaching.
--
-- Until Meta API access exists, the honest state for such a post is "written,
-- waiting for a human to publish it". That is what `awaiting_manual` means, and
-- it is a WORKING state: the post stays in the queue, visible and actionable,
-- instead of being filed away as if it had been handled.

ALTER TABLE public.post_queue DROP CONSTRAINT IF EXISTS post_queue_status_check;

ALTER TABLE public.post_queue ADD CONSTRAINT post_queue_status_check
CHECK (status = ANY (ARRAY[
  'pending'::text,
  'queued'::text,
  'sent'::text,
  'failed'::text,
  'simulated'::text,   -- retained: historical rows still carry it
  'expired'::text,
  'blocked'::text,
  'awaiting_manual'::text,
  'skipped'::text
]));

-- Distinguishes "a person published this by hand" from "an API sent it", so
-- reach per platform stays answerable once some posting is automated again.
ALTER TABLE public.post_queue
  ADD COLUMN IF NOT EXISTS posted_manually boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.post_queue.posted_manually IS
  'True when an operator published this post by hand from the Post Today screen, rather than it going out through a platform API.';

-- The Post Today screen reads exactly one slice: what is waiting on a human,
-- oldest scheduled first.
CREATE INDEX IF NOT EXISTS idx_post_queue_awaiting_manual
  ON public.post_queue(scheduled_for)
  WHERE status = 'awaiting_manual';

-- Deliberately NOT backfilled. Converting the historical `simulated` rows would
-- dump a backlog of stale posts — events long past, last winter's holiday
-- copy — into a screen whose whole value is that everything on it is worth
-- posting right now. History stays history.
