## Goal

Capture reader feedback now that traffic is climbing — both open-ended suggestions and lightweight per-story signal — without adding a public comment thread that would need heavy moderation.

## What gets built

### 1. Suggestion box (anonymous, sitewide)

- New table `reader_suggestions` (message, optional email, page_path, user_agent, session_id, created_at, status: new/read/archived).
- Public can INSERT only. Admins can read/update via existing `has_role`.
- Validation: message 5–1000 chars, email optional but format-checked, simple rate-limit (one submission per session per 60s, enforced client-side + DB trigger checking last insert for the session_id).
- Two entry points:
  - **Footer link** — "Tell us what you think" opens a modal with the form.
  - **Homepage block** — warm, neighborly card placed near the bottom of the feed: "What should we cover next?" with the same form inline.
- Success state thanks the reader; no email required.

### 2. Per-story reactions

- New table `story_reactions` (story_id, session_id, reaction enum: `helpful` | `more_like_this` | `not_for_me`, created_at). Unique on (story_id, session_id) — one vote per reader per story, switchable.
- Public can INSERT/UPDATE/DELETE rows scoped to their own session_id (passed in from client; not auth-gated since the site is anonymous).
- UI: small reaction bar at the bottom of every story detail page — three buttons with counts, optimistic update, persists choice in localStorage so the reader sees their selection on return.
- Also surfaced on the homepage StoryCard as a subtle "helpful" count when ≥3.

### 3. Admin: Reader Feedback page

- New `/dashboard/reader-feedback` route in the existing dashboard sidebar.
- Two tabs:
  - **Suggestions** — list with message, page submitted from, timestamp, optional email, mark-as-read / archive actions.
  - **Story reactions** — table of stories ranked by `more_like_this` and `helpful` counts over last 7/30 days, to inform what to publish more of.

## What is NOT in scope

- Public comment threads (rejected — moderation cost too high right now).
- Auth-gated reactions (anonymous session_id is enough at this traffic level).
- Analytics deep-dive page (user chose to defer).

## Technical notes

- Both tables follow the project's standard structure: `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY`, with `service_role` granted for admin reads.
- Reuses the existing `session_id` from `src/lib/trackStoryEvent.ts` (localStorage) so reactions tie back to the same anonymous identity already used by `story_events`.
- New components: `SuggestionBoxModal.tsx`, `SuggestionBoxCard.tsx` (homepage), `StoryReactions.tsx` (detail page), `ReaderFeedback.tsx` (dashboard page).
- Touches: `Footer.tsx`, homepage feed composition file, story detail page, `App.tsx` (route), `DashboardSidebar.tsx`.
- No edge functions needed — direct supabase-js inserts with RLS doing the gating.

## After this ships

You'll have a feedback loop running alongside the pillar metrics already in place: suggestions tell you what's missing, reactions tell you what to double down on.