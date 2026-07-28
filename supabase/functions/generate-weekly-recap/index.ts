// generate-weekly-recap: the Sunday "your week in {city}" edition.
//
// Fleet-native from day one — loops every active city, scopes and stamps by
// city_id, and one city's failure never blocks the rest.
//
// Editorial rules baked in:
//   - Byline is the DESK, never a fabricated person (see /about).
//   - Purely derivative: it only ever references stories we already published,
//     so there are no new factual claims. Story ids are recorded so the UI can
//     link back to exactly what was summarized.
//   - Quiet weeks stay quiet. Below QUIET_WEEK_THRESHOLD the prompt is told to
//     write short and say so plainly rather than inflate thin material — the
//     product promise is honesty on slow weeks, not manufactured drama.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getActiveCityConfigs, type CityConfig } from "../_shared/cityConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "gpt-4o-mini";
const QUIET_WEEK_THRESHOLD = 4;
const MAX_STORIES_IN_PROMPT = 18;

/** YYYY-MM-DD for a date shifted by `offsetDays`, in the city's timezone. */
export function localDate(timeZone: string, offsetDays = 0, from = new Date()): string {
  const d = new Date(from.getTime() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * The week being recapped: the 7 days ending today (inclusive). Running on a
 * Sunday yields Mon–Sun; running manually mid-week yields a trailing week,
 * which is the sensible behavior for a forced regeneration.
 */
export function weekBounds(timeZone: string, now = new Date()): { week_start: string; week_end: string } {
  return {
    week_start: localDate(timeZone, -6, now),
    week_end: localDate(timeZone, 0, now),
  };
}

/** Group stories by category, preserving a sensible editorial order. */
export function groupByCategory(stories: Array<{ category?: string | null }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of stories) {
    const key = (s.category || "news").toLowerCase();
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

type Story = {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  geo_label: string | null;
  publish_date: string | null;
};

async function recapCity(
  supabase: ReturnType<typeof createClient>,
  config: CityConfig,
  openaiKey: string,
  force: boolean,
) {
  const { week_start, week_end } = weekBounds(config.timezone);

  const { data: existing } = await supabase
    .from("weekly_recaps")
    .select("id, status")
    .eq("city_id", config.id)
    .eq("week_start", week_start)
    .maybeSingle();

  if (existing && existing.status === "published" && !force) {
    return { city_id: config.id, skipped: "already_generated", week_start };
  }

  // Only stories this city already published — never anything held or unsafe.
  const { data: rawStories } = await supabase
    .from("content_queue")
    .select("id, title, summary, category, geo_label, publish_date")
    .eq("city_id", config.id)
    .in("status", ["published", "auto_published"])
    .in("safety_level", ["safe", "soft_sensitive"])
    .neq("category", "events")
    .gte("geo_tier", 1)
    .lte("geo_tier", 2)
    .gte("publish_date", `${week_start}T00:00:00`)
    .lte("publish_date", `${week_end}T23:59:59`)
    .order("priority_score", { ascending: false, nullsFirst: false })
    .order("publish_date", { ascending: false, nullsFirst: false })
    .limit(40);

  const stories = (rawStories ?? []) as Story[];
  const featured = stories.slice(0, MAX_STORIES_IN_PROMPT);
  const story_count = stories.length;
  const is_quiet_week = story_count < QUIET_WEEK_THRESHOLD;
  const mentioned_story_ids = featured.slice(0, 8).map((s) => s.id);

  // Nothing at all to recap — record the fact, publish nothing.
  if (story_count === 0) {
    await supabase.from("weekly_recaps").upsert(
      {
        city_id: config.id,
        week_start,
        week_end,
        body: "",
        story_count: 0,
        is_quiet_week: true,
        mentioned_story_ids: [],
        model: MODEL,
        status: "skipped",
        generation_error: null,
      },
      { onConflict: "city_id,week_start" },
    );
    return { city_id: config.id, skipped: "no_stories", week_start };
  }

  const weekLabel = `${new Date(week_start + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })} – ${new Date(week_end + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })}`;

  const system = [
    `You write the weekly recap for the ${config.site_name}, a local news brief for ${config.city_name}, ${config.state_code}.`,
    "This is the Sunday 'here's your week' edition — a reader catching up in two minutes should feel current.",
    "STRICT RULES:",
    "- Use ONLY the stories provided. Never invent facts, numbers, names, quotes, or outcomes.",
    "- Never add commentary about national politics. Never pitch a business or real estate.",
    "- Write 5-8 sentences of plain prose in 2-3 short paragraphs. No headings, no bullets, no markdown, no emojis.",
    "- Group naturally by theme (city hall, schools, business, safety, community) rather than listing chronologically.",
    "- Voice: warm, dry, observant, institutional. You are the newsroom desk, not a named person. Never use 'I'.",
    "- Do not sign off; the page adds the byline.",
    is_quiet_week
      ? "- THIS WAS A QUIET WEEK. Say so plainly and keep it to 2-4 sentences. Do NOT stretch thin material into drama — a slow week in a small town is good news and readers trust us for saying it."
      : "- Lead with the single most consequential item of the week, then move outward.",
  ].join("\n");

  const categoryCounts = groupByCategory(stories);
  const sourceBlock = [
    `WEEK: ${weekLabel}`,
    `TOTAL STORIES: ${story_count}`,
    `BY CATEGORY: ${Object.entries(categoryCounts).map(([k, v]) => `${k}=${v}`).join(", ")}`,
    `QUIET_WEEK: ${is_quiet_week}`,
    "",
    "STORIES PUBLISHED THIS WEEK (use only these):",
    featured
      .map(
        (s, i) =>
          `${i + 1}. [${s.category ?? "news"}${s.geo_label ? " · " + s.geo_label : ""}] ${s.title}${
            s.summary ? `\n   ${s.summary}` : ""
          }`,
      )
      .join("\n"),
  ].join("\n");

  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: sourceBlock },
      ],
      temperature: 0.6,
    }),
  });

  if (!aiRes.ok) {
    const errText = (await aiRes.text()).slice(0, 400);
    await supabase.from("weekly_recaps").upsert(
      {
        city_id: config.id,
        week_start,
        week_end,
        body: "",
        story_count,
        is_quiet_week,
        mentioned_story_ids,
        model: MODEL,
        status: "draft",
        generation_error: `openai ${aiRes.status}: ${errText}`,
      },
      { onConflict: "city_id,week_start" },
    );
    throw new Error(`openai ${aiRes.status}`);
  }

  const aiJson = await aiRes.json();
  const body = String(aiJson?.choices?.[0]?.message?.content ?? "").trim();

  if (!body) {
    await supabase.from("weekly_recaps").upsert(
      {
        city_id: config.id,
        week_start,
        week_end,
        body: "",
        story_count,
        is_quiet_week,
        mentioned_story_ids,
        model: MODEL,
        status: "draft",
        generation_error: "empty_body",
      },
      { onConflict: "city_id,week_start" },
    );
    throw new Error("empty_body");
  }

  const { error: upsertErr } = await supabase.from("weekly_recaps").upsert(
    {
      city_id: config.id,
      week_start,
      week_end,
      body,
      headline: is_quiet_week ? "A quiet week" : "Your week in review",
      story_count,
      is_quiet_week,
      mentioned_story_ids,
      model: MODEL,
      prompt_version: "v1",
      status: "published",
      generation_error: null,
    },
    { onConflict: "city_id,week_start" },
  );
  if (upsertErr) throw upsertErr;

  return { city_id: config.id, week_start, week_end, story_count, is_quiet_week, published: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { force = false } = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cities = await getActiveCityConfigs(supabase);
    const results = [];
    for (const config of cities) {
      try {
        results.push(await recapCity(supabase, config, openaiKey, force));
      } catch (cityError) {
        console.error(`[generate-weekly-recap] (${config.id}) failed:`, cityError);
        results.push({
          city_id: config.id,
          error: cityError instanceof Error ? cityError.message : String(cityError),
        });
      }
    }

    console.log("[generate-weekly-recap] Completed:", results);
    return new Response(JSON.stringify({ success: true, cities: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-weekly-recap] error", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
