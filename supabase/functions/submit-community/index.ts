import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Naive in-memory IP rate limit (per warm instance). Good enough for v1 abuse control.
const RATE_BUCKET = new Map<string, number[]>();
const RATE_LIMIT = 5; // 5 submissions per IP per hour
const RATE_WINDOW_MS = 60 * 60 * 1000;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = (RATE_BUCKET.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_LIMIT) {
    RATE_BUCKET.set(ip, arr);
    return false;
  }
  arr.push(now);
  RATE_BUCKET.set(ip, arr);
  return true;
}

const BaseSchema = z.object({
  honeypot: z.string().max(0).optional().default(""),
  submitter_name: z.string().max(120).optional(),
  submitter_email: z.string().email().max(200).optional(),
  submitter_town: z.string().max(120).optional(),
});

const LocalLoveSchema = BaseSchema.extend({
  kind: z.literal("local_love"),
  category: z.enum(["people", "places", "moments"]),
  body: z.string().min(4).max(280),
  subject_name: z.string().min(1).max(160).optional(),
  subject_type: z.enum(["person", "place", "moment"]).optional(),
});

const TipSchema = BaseSchema.extend({
  kind: z.literal("tip"),
  body: z.string().min(4).max(2000),
});

const MemorySchema = BaseSchema.extend({
  kind: z.literal("memory"),
  category: z.literal("historical").default("historical"),
  body: z.string().min(4).max(2000),
  historical_year: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
});

const EventSchema = BaseSchema.extend({
  kind: z.literal("event"),
  title: z.string().min(4).max(200),
  summary: z.string().min(10).max(1000),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  event_time: z.string().optional(),
  venue: z.string().max(200).optional(),
  original_url: z.string().url().optional(),
  category: z.string().max(40).default("community"),
});

const PayloadSchema = z.discriminatedUnion("kind", [
  LocalLoveSchema,
  TipSchema,
  MemorySchema,
  EventSchema,
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (!rateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: "Too many submissions. Try again later." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = PayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validation failed", details: parsed.error.flatten() }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const payload = parsed.data;

  // Honeypot tripped → pretend success, drop silently.
  if (payload.honeypot && payload.honeypot.length > 0) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (payload.kind === "event") {
      const { error } = await supabase.from("content_queue").insert({
        title: payload.title,
        summary: payload.summary,
        content: payload.summary,
        category: payload.category || "community",
        event_date: payload.event_date,
        event_time: payload.event_time || null,
        original_url: payload.original_url || null,
        status: "pending",
        safety_level: "pending",
        geo_tier: 1,
        geo_label: "Lake Geneva",
        submitter_name: payload.submitter_name || null,
        submitted_by_email: payload.submitter_email || null,
        metadata: {
          source: "community_submission",
          venue: payload.venue || null,
          submitter_ip: ip,
        },
      });
      if (error) throw error;
    } else {
      const row = {
        kind: payload.kind,
        status: "pending",
        category: "category" in payload ? payload.category : null,
        body: payload.body,
        subject_name: "subject_name" in payload ? payload.subject_name || null : null,
        subject_type: "subject_type" in payload ? payload.subject_type || null : null,
        historical_year:
          "historical_year" in payload ? payload.historical_year || null : null,
        submitter_name: payload.submitter_name || null,
        submitter_email: payload.submitter_email || null,
        submitter_town: payload.submitter_town || null,
        submitter_ip: ip === "unknown" ? null : ip,
      };
      const { error } = await supabase.from("community_submissions").insert(row);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("submit-community insert failed", err);
    return new Response(
      JSON.stringify({ error: "Could not save submission" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});