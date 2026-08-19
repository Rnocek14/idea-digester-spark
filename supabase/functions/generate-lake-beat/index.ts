import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCityConfig } from "../_shared/cityConfig.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-editorial-secret",
};

const EDITORIAL_SECRET = Deno.env.get("EDITORIAL_GENERATION_SECRET");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const FALLBACK_OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
const MODEL = "google/gemini-2.5-flash";

function todayCT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function describeCode(code: number): string {
  if (code === 0) return "clear";
  if (code <= 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code >= 45 && code <= 48) return "foggy";
  if (code >= 51 && code <= 65) return "rainy";
  if (code >= 71 && code <= 77) return "snowy";
  if (code >= 80 && code <= 82) return "showers";
  if (code >= 95) return "thunderstorms";
  return "fair";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const secretHeader = req.headers.get("X-Editorial-Secret");
    const okBySecret = !!EDITORIAL_SECRET && secretHeader === EDITORIAL_SECRET;
    if (!authHeader.startsWith("Bearer ") && !okBySecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!LOVABLE_API_KEY && !FALLBACK_OPENAI_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY or OPENAI_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { force = false } = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const config = await getCityConfig(supabase);
    const beat_date = todayCT();
    // Same-day guard, but a row that recorded a generation_error is a
    // degraded fallback ("62° and overcast on the lake."), not a finished
    // beat — retry it so the line upgrades to real prose once the AI provider
    // recovers, instead of the template surviving all day.
    const { data: existing } = await supabase
      .from("lake_beats")
      .select("beat_date, generation_error")
      .eq("beat_date", beat_date)
      .eq("city_id", config.id)
      .maybeSingle();
    if (existing && !existing.generation_error && !force) {
      return new Response(JSON.stringify({ skipped: true, beat_date }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull current conditions for Lake Geneva
    const wxResp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${config.latitude}&longitude=${config.longitude}&current_weather=true&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${encodeURIComponent(config.timezone)}`,
    );
    const wxJson = await wxResp.json();
    const cw = wxJson?.current_weather ?? {};
    const rawTemp = Number(cw.temperature);
    const rawWind = Number(cw.windspeed);
    // Never publish a beat off missing weather data — a "0°" line is worse than no line.
    if (!Number.isFinite(rawTemp) || rawTemp < -40 || rawTemp > 130) {
      console.error("[generate-lake-beat] no usable temperature", cw);
      return new Response(
        JSON.stringify({ error: "weather_unavailable", skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const temp_f = Math.round(rawTemp);
    const wind = Number.isFinite(rawWind) ? Math.round(rawWind) : 0;
    const code = Number(cw.weathercode ?? 0);
    const conditions = describeCode(code);

    const system = [
      "You write a single one-sentence 'on the lake today' line for the Lake Geneva Brief homepage.",
      "Voice: warm, dry, observant local. Like a friend texting you about the weather.",
      "RULES:",
      "- Exactly ONE sentence. Under 18 words.",
      "- The temperature given is the AIR temperature, not the water temperature.",
      "- Never describe it as the lake's or water's temperature (no 'lake's at 68').",
      "- Include the air temperature naturally (e.g., '68 and breezy over the water').",
      "- Light personality is good; avoid emojis, no 'today is going to be' filler.",
      "- Do not invent facts beyond what's given (temp, wind, conditions).",
      "- No sign-off, no quotes around it.",
    ].join("\n");
    const user = `Air temp: ${temp_f}F, wind: ${wind} mph, conditions: ${conditions}.`;

    // Lovable AI Gateway first (project credits), OpenAI only as a fallback.
    let aiResp: Response;
    let usedProvider = "lovable";
    try {
      if (!LOVABLE_API_KEY) throw new Error("missing_lovable_key");
      aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.8,
        }),
      });
      if (!aiResp.ok && aiResp.status === 401) throw new Error("lovable_auth_failed");
    } catch (gatewayErr) {
      if (!FALLBACK_OPENAI_KEY) throw gatewayErr;
      console.log("[generate-lake-beat] falling back to OpenAI", gatewayErr);
      usedProvider = "openai";
      aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${FALLBACK_OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.8,
        }),
      });
    }

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error(`[generate-lake-beat] ${usedProvider}`, aiResp.status, errText);
      await supabase.from("lake_beats").upsert({
        beat_date,
        city_id: config.id,
        body: `${temp_f}° and ${conditions} over the water.`,
        temp_f,
        conditions,
        model: MODEL,
        generation_error: `${usedProvider} ${aiResp.status}`,
      });
      return new Response(
        JSON.stringify({ error: `${usedProvider}_failed`, fallback_written: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiResp.json();
    let body = String(aiJson?.choices?.[0]?.message?.content ?? "").trim();
    body = body.replace(/^["']|["']$/g, "");
    if (!body) body = `${temp_f}° and ${conditions} over the water.`;

    const { error } = await supabase.from("lake_beats").upsert({
      beat_date,
      city_id: config.id,
      body,
      temp_f,
      conditions,
      model: MODEL,
      generation_error: null,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, beat_date, body }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-lake-beat] error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});