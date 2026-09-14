// One-shot cleanup for stories that are already live with the wrong locality.
//
// The ingestion classifier used to accept the AI summary as evidence of
// locality. Because the summarizer is told to "make the local relevance
// explicit", nearly every summary name-drops Lake Geneva — so Kenosha and
// Racine headlines were filed as Lake Geneva news and sat in the local feed.
// sync-rss no longer does that, but the rows it already wrote need fixing, and
// the public (anon) key cannot update content_queue. Hence this admin-only
// function, which re-applies the corrected rule to published rows.
//
// Idempotent: running it twice changes nothing the second time.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Kept in sync with sync-rss deliberately: this function exists to apply that
// same judgement retroactively.
const NON_LOCAL_TITLE_CITIES = [
  "milwaukee", "madison", "chicago", "racine", "kenosha",
  "waukesha", "green bay", "appleton", "oshkosh", "janesville",
  "beloit", "rockford", "brookfield", "wauwatosa", "fond du lac",
  "union grove", "sturtevant", "mount pleasant", "somers", "pleasant prairie",
];

const LOCAL_TITLE_KEYWORDS = [
  "lake geneva", "geneva lake", "williams bay", "fontana", "walworth",
  "delavan", "elkhorn", "lake como", "genoa city", "bloomfield", "linn",
];

function isNonLocalTitle(title: string): boolean {
  const t = (title || "").toLowerCase();
  if (LOCAL_TITLE_KEYWORDS.some((k) => t.includes(k))) return false;
  return NON_LOCAL_TITLE_CITIES.some((c) => t.includes(c));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: rows, error } = await supabase
      .from("content_queue")
      .select("id, title, geo_tier")
      .in("status", ["published", "auto_published"])
      .gte("geo_tier", 1)
      .limit(2000);

    if (error) throw error;

    const mislabeled = (rows ?? []).filter((r) => isNonLocalTitle(r.title ?? ""));

    if (mislabeled.length > 0) {
      const { error: updateError } = await supabase
        .from("content_queue")
        .update({ geo_tier: 0, geo_label: null })
        .in("id", mislabeled.map((r) => r.id));
      if (updateError) throw updateError;

      await supabase.from("activity_log").insert({
        actor_type: "admin",
        entity_type: "content_queue",
        action: "retag_nonlocal",
        message: `Re-tagged ${mislabeled.length} out-of-area stories to regional (tier 0)`,
        details: { titles: mislabeled.slice(0, 50).map((r) => r.title) },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: rows?.length ?? 0,
        retagged: mislabeled.length,
        titles: mislabeled.slice(0, 50).map((r) => r.title),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[retag-nonlocal]", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
