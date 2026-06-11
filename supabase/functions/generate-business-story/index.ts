import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generates a short AI draft from a real business input row.
// The AI is only allowed to expand the facts supplied by the editor/owner.
// It must not invent quotes, prices, dates, or outcomes.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { story_id } = await req.json();
    if (!story_id) {
      return new Response(JSON.stringify({ error: "story_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: story, error: loadErr } = await supabase
      .from("business_stories")
      .select("*")
      .eq("id", story_id)
      .single();
    if (loadErr || !story) {
      return new Response(JSON.stringify({ error: "story not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a Lake Geneva, Wisconsin community newsletter writer.
Voice: warm, neighborly, factual. Never overly enthusiastic. No "our/us". No invented facts, quotes, prices, dates, or outcomes.
Expand the supplied facts into a 130-220 word post for locals. Include the business name in the first sentence.
If a real owner quote is supplied, you may use it verbatim. Do NOT fabricate quotes.
Plain prose, 2-3 short paragraphs. No headings, no bullet lists, no emojis.`;

    const userInput = [
      `Business: ${story.business_name}`,
      `Story type: ${story.story_type}`,
      `Headline (working title): ${story.headline}`,
      `Facts the editor/owner supplied:\n${story.raw_input}`,
      story.owner_quote ? `Verbatim owner quote (use as-is, in quotes):\n"${story.owner_quote}"` : "",
      story.source_citation ? `Source: ${story.source_citation}` : "",
    ].filter(Boolean).join("\n\n");

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput },
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: "OpenAI error", detail: txt }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiJson = await aiRes.json();
    const draft: string = aiJson?.choices?.[0]?.message?.content?.trim() ?? "";

    if (!draft) {
      return new Response(JSON.stringify({ error: "AI returned empty draft" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updErr } = await supabase
      .from("business_stories")
      .update({
        ai_draft: draft,
        ai_draft_generated_at: new Date().toISOString(),
        status: story.status === "pending" ? "ai_drafted" : story.status,
      })
      .eq("id", story_id);
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, draft }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});