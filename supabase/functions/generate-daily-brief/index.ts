import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-editorial-secret",
};

const EDITORIAL_SECRET = Deno.env.get("EDITORIAL_GENERATION_SECRET");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const MODEL = "google/gemini-3-flash-preview";

// Compute "today" in America/Chicago regardless of where Deno runs.
function todayCT(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

function yesterdayCT(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: any Bearer token is accepted (Supabase upstream gates with project JWT for
    // verify_jwt=true functions). The function is idempotent, takes no user input, only
    // writes one row keyed by today's date, and reads from already-public content_queue.
    const authHeader = req.headers.get("Authorization") || "";
    const secretHeader = req.headers.get("X-Editorial-Secret");
    const okBySecret = !!EDITORIAL_SECRET && secretHeader === EDITORIAL_SECRET;
    if (!authHeader.startsWith("Bearer ") && !okBySecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { force = false } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const brief_date = todayCT();
    const y_date = yesterdayCT();

    // Idempotent unless forced
    const { data: existing } = await supabase
      .from("daily_briefs")
      .select("brief_date, created_at")
      .eq("brief_date", brief_date)
      .maybeSingle();
    if (existing && !force) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "already_generated", brief_date }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Today's top T1/T2 stories
    const { data: todayStories = [] } = await supabase
      .from("content_queue")
      .select("id, title, summary, content, category, geo_label, geo_tier, publish_date")
      .in("status", ["published", "auto_published"])
      .in("safety_level", ["safe", "soft_sensitive"])
      .neq("category", "events")
      .gte("geo_tier", 1)
      .lte("geo_tier", 2)
      .gte("publish_date", `${brief_date}T00:00:00`)
      .order("priority_score", { ascending: false, nullsFirst: false })
      .order("publish_date", { ascending: false, nullsFirst: false })
      .limit(5);

    // Yesterday's top T1/T2 for "what happened"
    const { data: yStories = [] } = await supabase
      .from("content_queue")
      .select("id, title, summary, category")
      .in("status", ["published", "auto_published"])
      .in("safety_level", ["safe", "soft_sensitive"])
      .neq("category", "events")
      .gte("geo_tier", 1)
      .lte("geo_tier", 2)
      .gte("publish_date", `${y_date}T00:00:00`)
      .lt("publish_date", `${brief_date}T00:00:00`)
      .order("priority_score", { ascending: false, nullsFirst: false })
      .limit(3);

    // Today's events
    const { data: events = [] } = await supabase
      .from("content_queue")
      .select("id, title, event_date, geo_label")
      .in("status", ["published", "auto_published"])
      .eq("category", "events")
      .eq("event_date", brief_date)
      .order("priority_score", { ascending: false, nullsFirst: false })
      .limit(4);

    const todayList = (todayStories ?? []) as any[];
    const yList = (yStories ?? []) as any[];
    const evList = (events ?? []) as any[];

    const is_quiet_day = todayList.length < 2;
    const briefTargets = todayList.slice(0, 3);
    const mentioned_story_ids = briefTargets.map((s) => s.id);

    const dateLabel = new Date(brief_date + "T12:00:00Z").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "America/Chicago",
    });

    const system = [
      "You are Maggie, the editor of the Lake Geneva Brief — a local news digest for Lake Geneva, Wisconsin.",
      "You write a 4-6 sentence morning brief in warm, neighborly, conversational prose. Think 'a friend who reads everything for you.'",
      "STRICT RULES:",
      "- Only state facts that appear in the provided source material. Never invent details, quotes, decisions, names, or numbers.",
      "- Do not editorialize about politics. Do not pitch real estate or any business.",
      "- No bullet points, no headers, no markdown. Plain prose only.",
      "- 4-6 sentences. Tight. No throat-clearing ('Today we...') and no sign-off (the UI adds it).",
      "- Reference at most 3 stories. Mention the calendar item that matters most if any.",
      "- If it's a quiet day, say so honestly in a warm way (e.g. 'Slow morning on the lake, and that's usually a good thing.'). Do not stretch thin material into drama.",
      "- Voice: warm, dry, observant. Local. Like Garrison Keillor by way of a small-town newsroom.",
    ].join("\n");

    const sourceBlock = [
      `DATE: ${dateLabel}`,
      `QUIET_DAY: ${is_quiet_day}`,
      "",
      "TODAY'S TOP LOCAL STORIES (use these only):",
      briefTargets.length === 0
        ? "(none yet today)"
        : briefTargets
            .map(
              (s, i) =>
                `${i + 1}. [${s.category}${s.geo_label ? " · " + s.geo_label : ""}] ${s.title}\n${
                  s.summary || (s.content ? String(s.content).slice(0, 400) : "")
                }`,
            )
            .join("\n\n"),
      "",
      "YESTERDAY (background context only, do not lead with these):",
      yList.length === 0
        ? "(none)"
        : yList.map((s) => `- ${s.title}${s.summary ? " — " + s.summary : ""}`).join("\n"),
      "",
      "ON THE CALENDAR TODAY:",
      evList.length === 0
        ? "(nothing on the public calendar)"
        : evList.map((e) => `- ${e.title}${e.geo_label ? " (" + e.geo_label + ")" : ""}`).join("\n"),
    ].join("\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: sourceBlock },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[generate-daily-brief] AI gateway failed", aiResp.status, errText);
      // Persist the failure so it's visible
      await supabase.from("daily_briefs").upsert({
        brief_date,
        body: "",
        is_quiet_day,
        mentioned_story_ids,
        model: MODEL,
        status: "draft",
        generation_error: `gateway ${aiResp.status}: ${errText.slice(0, 500)}`,
      });
      return new Response(
        JSON.stringify({ error: "ai_gateway_failed", status: aiResp.status, detail: errText.slice(0, 300) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiResp.json();
    const body = String(aiJson?.choices?.[0]?.message?.content ?? "").trim();

    if (!body) {
      console.error("[generate-daily-brief] empty body from model", aiJson);
      await supabase.from("daily_briefs").upsert({
        brief_date,
        body: "",
        is_quiet_day,
        mentioned_story_ids,
        model: MODEL,
        status: "draft",
        generation_error: "empty_body",
      });
      return new Response(JSON.stringify({ error: "empty_body" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upsertErr } = await supabase.from("daily_briefs").upsert({
      brief_date,
      body,
      is_quiet_day,
      mentioned_story_ids,
      model: MODEL,
      prompt_version: "v1",
      status: "published",
      generation_error: null,
    });
    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({
        success: true,
        brief_date,
        is_quiet_day,
        mentioned_story_count: mentioned_story_ids.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[generate-daily-brief] error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});