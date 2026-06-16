## Goal

Finish the Shore Path walking companion: every one of the 16 stops gets a long-form story and narrated audio in the same voice (Sarah, ElevenLabs) used on Black Point Estate (#6). The other 15 stops currently have only a one-line `description` and a `look_for` blurb.

After this ships, the Guided Walk plays a real story at every stop, the on-page write-ups feel complete, and each stop has a tailored "share a memory" prompt that funnels into the Local Love submission flow.

## Sourcing rules (non-negotiable)

- Public, verifiable facts only: Williams Bay Rec Dept materials, municipal park pages (Lake Geneva, Fontana, Linn), Kishwauketoe Nature Conservancy public site, Yerkes Observatory public history, established lake history (1870s railroad and easement).
- Never name private homes, owners, or current residents. We describe what a walker sees from the public path, not what's behind a hedge.
- Match the Black Point tone: warm, neighborly, plain-spoken. No "our" / "us". No marketing language.
- ~120–180 words per story (a comfortable 50–70 second narration at the existing voice settings).

## What changes

### 1. Schema — add per-stop Local Love prompt

New column on `shore_path_stops`:

- `local_love_prompt text NULL` — one short sentence prompting a memory specific to this stop (e.g. for Riviera: "Remember a Fourth of July fireworks night from the pier? Tell us about it.").

Nullable so stops without a prompt fall back to the existing generic Heart link. No new RLS — column inherits the table's existing policies.

### 2. Content — fill the 15 remaining stops

Single `UPDATE` per stop via the insert tool, writing:

- `story_long` — 2–3 short paragraphs of public-facts narrative, voice-matched to Black Point.
- `local_love_prompt` — one-sentence memory prompt tied to that exact stop.
- `look_for` — refresh only when the current line is thinner than the new story warrants; otherwise leave as-is.

Stops to write (order_index · slug · community):

```text
 1  library-park              Lake Geneva
 2  flat-iron-park            Lake Geneva
 3  riviera-beach             Lake Geneva
 4  lake-geneva-public-beach  Lake Geneva
 5  maple-lawn-area           Lake Geneva
 7  south-shore-club-area     Linn
 8  linn-pier                 Linn
 9  fontana-beach             Fontana
10  reid-park                 Fontana
11  abbey-harbor-view         Fontana
12  kishwauketoe-edge         Williams Bay
13  edgewater-park            Williams Bay
14  williams-bay-lakefront    Williams Bay
15  yerkes-area               Williams Bay
16  cedar-point-park          Williams Bay
```

Black Point (#6) already has its story and audio — left alone.

### 3. Audio generation — 15 invocations of the existing edge function

The `generate-shore-path-audio` function already:
- Reads `story_long` as the narration source
- Calls ElevenLabs with the Sarah voice + the tuned settings (stability 0.55, similarity 0.8, style 0.35, speed 0.98)
- Uploads MP3 to the `shore-path-audio` bucket
- Writes back `audio_url`, `audio_duration_sec`, `audio_transcript`, `audio_voice_id`

I invoke it once per stop (by `order_index`) after the content is in. If a stop already has audio, the function skips unless `force: true` — fine for us, only stop 6 currently has audio.

ElevenLabs is already connected, no secret work needed.

### 4. Frontend — surface the Local Love prompt

Tiny edit to `src/pages/guides/LakeGenevaShorePath.tsx`:

- Render `stop.local_love_prompt` (italic, slate-600) immediately above the existing "Share a memory from this spot" link, when present.
- Pass the stop's slug+name into the link query as it already does.

Update `src/hooks/useShorePathStops.ts` `ShorePathStopRow` type to include `local_love_prompt: string | null`.

No other UI changes. The map, guided walk, story player, stop cards, and FAQ are unchanged — the audio just starts showing up everywhere because the existing `{stop.audio_url && ...}` block already handles it.

### 5. Verify

- Spot-check 2–3 stops in the preview: long-form text renders, audio player appears, narration plays in the Black Point voice.
- Run the Guided Walk dialog through a couple of stops to confirm audio fires on arrival as before.

## Out of scope

- No regeneration of Black Point audio.
- No changes to the Guided Walk geofencing, the map, or the `look_for` cards (refreshed only when story_long demands it).
- No new public-facing routes.
- Newsroom-story linking, photo upload, and audio re-narration UI — not part of this pass.

## Risk + cost notes

- 15 ElevenLabs TTS calls at ~140 words each. Well under any rate concern, but I'll invoke serially with brief gaps to be polite.
- Storage is already configured (`shore-path-audio` public bucket).
- If a single call fails, the others are unaffected and the failing stop can be retried with `force: true`.
