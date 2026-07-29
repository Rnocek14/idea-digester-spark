// Shore Path Register — the only write path for walkers, stop visits, and
// numbered register entries.
//
// The browser never writes these tables directly. path_walkers and
// path_stop_visits hold location history and the register issues permanent
// numbers, so anon has no grants on any of it (see the register migration) and
// everything lands here on the service role, rate-limited, the same way
// community incident reports were moved behind `report-incident`.
//
// The client is also not trusted to assert its own arrivals. `visit` takes raw
// coordinates and this function decides — against the stop's stored coords and
// geofence radius — whether they prove anything.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getCityConfig } from "../_shared/cityConfig.ts";
import {
  checkStopProximity,
  computeProgress,
  earnedRegisterTiers,
  localDateParts,
  seasonForMonth,
  type RegisterStop,
  type StopVisit,
} from "../_shared/pathTiers.ts";

const MAX_DISPLAY_NAME = 40;
const MAX_HOME_TOWN = 60;

// A walker claim is cheap but not free — it creates a row. Sixteen stops means a
// legitimate walker never needs more than one claim, so these are generous.
const CLAIMS_PER_IP_PER_HOUR = 5;
const CLAIMS_GLOBAL_PER_HOUR = 60;
// 16 stops in a day is the whole loop; 40 leaves room for retries and re-fires
// while still bounding a stuck client.
const VISITS_PER_WALKER_PER_DAY = 40;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`path-register:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function newClaimToken(): string {
  // 32 hex chars from the platform CSPRNG. This is the only credential a walker
  // has, so it must not be guessable and must not encode anything about them.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `spw_${hex}`;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

function cleanEmail(value: unknown): string | null {
  const raw = cleanText(value, 200);
  if (!raw) return null;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw) ? raw.toLowerCase() : null;
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && isFinite(n) ? n : null;
}

/** Public shape of a register entry. Never leaks walker_id or certificate_code. */
type PublicEntry = {
  tier: string;
  entry_number: number;
  display_name: string | null;
  home_town: string | null;
  completed_at: string;
  days_elapsed: number | null;
  verification: string;
  /** Only returned to the walker who owns it. */
  certificate_code?: string;
};

// deno-lint-ignore no-explicit-any
function toOwnEntry(row: any): PublicEntry {
  return {
    tier: row.tier,
    entry_number: row.entry_number,
    display_name: row.display_name ?? null,
    home_town: row.home_town ?? null,
    completed_at: row.completed_at,
    days_elapsed: row.days_elapsed ?? null,
    verification: row.verification,
    certificate_code: row.certificate_code,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cityConfig = await getCityConfig(supabase);
    const cityId = cityConfig.id;
    const timeZone = cityConfig.timezone || "America/Chicago";

    // -----------------------------------------------------------------------
    // claim — start a passport. No email, no password, no account.
    // -----------------------------------------------------------------------
    if (action === "claim") {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const ipHash = await hashIp(ip);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { count: globalCount } = await supabase
        .from("activity_log")
        .select("id", { count: "exact", head: true })
        .eq("action", "path_walker_claim")
        .gte("created_at", oneHourAgo);
      if ((globalCount ?? 0) >= CLAIMS_GLOBAL_PER_HOUR) {
        return jsonResponse({ error: "Too many new passports right now. Please try again shortly." }, 429);
      }

      const { count: ipCount } = await supabase
        .from("activity_log")
        .select("id", { count: "exact", head: true })
        .eq("action", "path_walker_claim")
        .eq("details->>ip_hash", ipHash)
        .gte("created_at", oneHourAgo);
      if ((ipCount ?? 0) >= CLAIMS_PER_IP_PER_HOUR) {
        return jsonResponse({ error: "You've started several passports recently. Please try again later." }, 429);
      }

      const claimToken = newClaimToken();
      const { data: walker, error } = await supabase
        .from("path_walkers")
        .insert({
          city_id: cityId,
          claim_token: claimToken,
          display_name: cleanText(body.display_name, MAX_DISPLAY_NAME),
          home_town: cleanText(body.home_town, MAX_HOME_TOWN),
          email: cleanEmail(body.email),
          is_public: body.is_public === true,
        })
        .select("id, display_name, home_town, is_public")
        .single();

      if (error || !walker) {
        console.error("[path-register] claim failed", error);
        return jsonResponse({ error: "Could not start a passport." }, 500);
      }

      await supabase.from("activity_log").insert({
        actor_type: "public",
        entity_type: "path_walker",
        entity_id: walker.id,
        action: "path_walker_claim",
        message: "Shore Path passport started",
        details: { ip_hash: ipHash },
      });

      return jsonResponse({
        success: true,
        claim_token: claimToken,
        walker: {
          display_name: walker.display_name,
          home_town: walker.home_town,
          is_public: walker.is_public,
        },
      });
    }

    // Every remaining action needs a passport.
    const claimToken = typeof body.claim_token === "string" ? body.claim_token.trim() : "";
    if (!claimToken) {
      return jsonResponse({ error: "Missing passport token." }, 400);
    }

    const { data: walker, error: walkerError } = await supabase
      .from("path_walkers")
      .select("id, city_id, display_name, home_town, is_public")
      .eq("claim_token", claimToken)
      .maybeSingle();

    if (walkerError) {
      console.error("[path-register] walker lookup failed", walkerError);
      return jsonResponse({ error: "Could not load your passport." }, 500);
    }
    if (!walker) {
      // Deliberately not "no such token" — that would confirm token validity to
      // anyone probing.
      return jsonResponse({ error: "Passport not found. It may have been reset." }, 404);
    }

    // -----------------------------------------------------------------------
    // profile — name, town, and whether to appear on the public register.
    // -----------------------------------------------------------------------
    if (action === "profile") {
      // deno-lint-ignore no-explicit-any
      const patch: Record<string, any> = {};
      if ("display_name" in body) patch.display_name = cleanText(body.display_name, MAX_DISPLAY_NAME);
      if ("home_town" in body) patch.home_town = cleanText(body.home_town, MAX_HOME_TOWN);
      if ("email" in body) patch.email = cleanEmail(body.email);
      if ("is_public" in body) patch.is_public = body.is_public === true;

      if (Object.keys(patch).length === 0) {
        return jsonResponse({ error: "Nothing to update." }, 400);
      }

      const { data: updated, error: updateError } = await supabase
        .from("path_walkers")
        .update(patch)
        .eq("id", walker.id)
        .select("display_name, home_town, is_public")
        .single();

      if (updateError || !updated) {
        console.error("[path-register] profile update failed", updateError);
        return jsonResponse({ error: "Could not save your details." }, 500);
      }

      // A walker who publishes (or unpublishes) themselves must have any register
      // entry follow, or the register would show a name they retracted.
      if ("is_public" in patch || "display_name" in patch || "home_town" in patch) {
        const { error: syncError } = await supabase
          .from("path_register_entries")
          .update({
            is_public: updated.is_public,
            display_name: updated.display_name,
            home_town: updated.home_town,
          })
          .eq("walker_id", walker.id);
        if (syncError) console.error("[path-register] register sync failed", syncError);
      }

      return jsonResponse({ success: true, walker: updated });
    }

    // Stops and legs, needed by both `visit` and `progress`.
    const { data: stopRows, error: stopsError } = await supabase
      .from("shore_path_stops")
      .select("id, slug, name, latitude, longitude, geofence_radius_m, leg_order_index")
      .eq("is_published", true)
      .order("order_index", { ascending: true });

    if (stopsError) {
      console.error("[path-register] stops load failed", stopsError);
      return jsonResponse({ error: "Could not load the path." }, 500);
    }
    const stops = (stopRows ?? []) as RegisterStop[];

    const { data: legRows } = await supabase
      .from("path_legs")
      .select("order_index")
      .eq("city_id", cityId)
      .eq("is_published", true)
      .order("order_index", { ascending: true });
    const legs = (legRows ?? []) as Array<{ order_index: number }>;

    // -----------------------------------------------------------------------
    // visit — record an arrival, verified server-side.
    // -----------------------------------------------------------------------
    if (action === "visit") {
      const slug = typeof body.stop_slug === "string" ? body.stop_slug.trim() : "";
      const stop = stops.find((s) => s.slug === slug);
      if (!stop) {
        return jsonResponse({ error: "Unknown stop." }, 400);
      }

      const now = new Date();
      const local = localDateParts(now, timeZone);

      const { count: todayCount } = await supabase
        .from("path_stop_visits")
        .select("id", { count: "exact", head: true })
        .eq("walker_id", walker.id)
        .eq("visit_date", local.isoDate);
      if ((todayCount ?? 0) >= VISITS_PER_WALKER_PER_DAY) {
        return jsonResponse({ error: "That's more stops than the path has. Try again tomorrow." }, 429);
      }

      const lat = toNumber(body.latitude);
      const lng = toNumber(body.longitude);
      const accuracy = toNumber(body.accuracy_m);
      const proximity = checkStopProximity(stop, lat, lng, accuracy);

      if (!proximity.within) {
        // Not there. Recording it anyway would make the register meaningless, and
        // silently accepting it would be worse than refusing.
        return jsonResponse(
          {
            error: "You don't appear to be at this stop yet.",
            reason: proximity.reason,
            distance_m: isFinite(proximity.distanceM) ? Math.round(proximity.distanceM) : null,
          },
          422,
        );
      }

      const { error: visitError } = await supabase
        .from("path_stop_visits")
        .upsert(
          {
            city_id: cityId,
            walker_id: walker.id,
            stop_id: stop.id,
            visited_at: now.toISOString(),
            visit_date: local.isoDate,
            season: seasonForMonth(local.month),
            verification: proximity.verification,
            distance_m: Math.round(proximity.distanceM),
            accuracy_m: accuracy == null ? null : Math.round(accuracy),
          },
          { onConflict: "walker_id,stop_id,visit_date", ignoreDuplicates: true },
        );

      if (visitError) {
        console.error("[path-register] visit insert failed", visitError);
        return jsonResponse({ error: "Could not record that stop." }, 500);
      }
    }

    // -----------------------------------------------------------------------
    // progress (also the tail of `visit`) — recompute, then issue any number
    // the walker has just earned.
    // -----------------------------------------------------------------------
    if (action !== "visit" && action !== "progress") {
      return jsonResponse({ error: "Unknown action." }, 400);
    }

    const { data: visitRows, error: visitsError } = await supabase
      .from("path_stop_visits")
      .select("stop_id, visited_at, season, verification")
      .eq("walker_id", walker.id);

    if (visitsError) {
      console.error("[path-register] visits load failed", visitsError);
      return jsonResponse({ error: "Could not load your progress." }, 500);
    }
    const visits = (visitRows ?? []) as StopVisit[];
    const progress = computeProgress(stops, visits, legs);

    const { data: existingRows } = await supabase
      .from("path_register_entries")
      .select("tier, entry_number, display_name, home_town, completed_at, days_elapsed, verification, certificate_code")
      .eq("walker_id", walker.id);
    const existing = (existingRows ?? []) as Array<Record<string, unknown>>;
    const existingTiers = new Set(existing.map((e) => String(e.tier)));

    const newlyEarned: PublicEntry[] = [];
    const entries: PublicEntry[] = existing.map(toOwnEntry);

    for (const tier of earnedRegisterTiers(progress)) {
      const isNew = !existingTiers.has(tier);
      const { data: entry, error: claimError } = await supabase.rpc("claim_path_register_entry", {
        p_city_id: cityId,
        p_walker_id: walker.id,
        p_tier: tier,
        p_display_name: walker.display_name,
        p_home_town: walker.home_town,
        p_first_visit_at: progress.firstVisitAt,
        p_completed_at: progress.lastVisitAt ?? new Date().toISOString(),
        p_days_elapsed: progress.daysElapsed,
        p_stops_total: progress.stopsVisited,
        p_verification: progress.verification,
        p_is_public: walker.is_public === true,
      });

      if (claimError || !entry) {
        console.error("[path-register] register claim failed", tier, claimError);
        continue;
      }
      const row = Array.isArray(entry) ? entry[0] : entry;
      if (!row) continue;

      const publicEntry = toOwnEntry(row);
      if (isNew) newlyEarned.push(publicEntry);

      const at = entries.findIndex((e) => e.tier === tier);
      if (at >= 0) entries[at] = publicEntry;
      else entries.push(publicEntry);
    }

    return jsonResponse({
      success: true,
      walker: {
        display_name: walker.display_name,
        home_town: walker.home_town,
        is_public: walker.is_public,
      },
      progress: {
        stops_visited: progress.stopsVisited,
        stops_total: progress.stopsTotal,
        visited_stop_ids: progress.visitedStopIds,
        loop_complete: progress.loopComplete,
        verification: progress.verification,
        first_visit_at: progress.firstVisitAt,
        last_visit_at: progress.lastVisitAt,
        days_elapsed: progress.daysElapsed,
        seasons_completed: progress.seasonsCompleted,
        season_stop_counts: progress.seasonStopCounts,
        four_seasons_complete: progress.fourSeasonsComplete,
        legs: progress.legs,
        legs_completed: progress.legsCompleted,
      },
      entries,
      newly_earned: newlyEarned,
    });
  } catch (error) {
    console.error("[path-register] error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
