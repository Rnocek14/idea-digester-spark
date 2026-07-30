// Live sitemap served straight from the database — no rebuild required.
// The build-time script (scripts/generate-sitemap.ts) only captures stories
// that existed at deploy time; this function is always current, which matters
// for a news site publishing all day with no operator watching deploys.
//
// Crawlers are pointed here by the Sitemap: line in serve-robots, which passes
// each city's own ?city_id=. No param serves the template city.
//
// The static route list lives in ../_shared/siteRoutes.ts, shared with
// serve-llms so the two documents cannot drift apart the way the old hardcoded
// array and public/llms.txt did. scripts/generate-sitemap.ts still writes a
// build-time sitemap for the template city only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { CityConfig } from "../_shared/cityConfig.ts";
import {
  containsPersonalDetail,
  passesIncidentGate,
  resolveCityConfig,
} from "../_shared/renderPage.ts";
import { isTemplateCity, staticRoutesFor } from "../_shared/siteRoutes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Entry = { path: string; lastmod?: string; changefreq?: string; priority?: string };

/**
 * The static half of the sitemap, per city.
 *
 * This list used to be ~25 hardcoded lake-geneva-* paths, which meant city #2's
 * sitemap would submit Lake Geneva URLs under city #2's own domain — a sitemap
 * full of soft 404s, from a file whose entire purpose is to be trusted.
 *
 * The routes now come from ../_shared/siteRoutes.ts, which splits them into
 * database-backed pages every city has and hand-written Lake Geneva editorial
 * that only the template city has. PER-CITY GUIDES ARE UNBUILT WORK: there is
 * no generator, no table and no component that would produce a guide for
 * another city, so a non-template city emits none of those slugs. That is the
 * honest output, not a limitation to paper over.
 */
function staticEntries(config: CityConfig): Entry[] {
  return staticRoutesFor(config)
    .filter((r) => r.sitemap !== false)
    .map((r) => ({ path: r.path, changefreq: r.changefreq, priority: r.priority }));
}

function slugify(s: string, max = 60): string {
  return (s || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/**
 * XML-escape a value before it is interpolated into an element.
 *
 * This is not defensive dressing: a sitemap is parsed as XML, and ONE stray
 * `&` or `<` anywhere in the document makes the whole file unparseable, so
 * Google discards every URL in it. The values below are database columns —
 * `incidents.slug`, `shore_path_stops.slug`, `city_config.site_domain` — and
 * while the ingest slugifiers currently emit [a-z0-9-] only, shore-path slugs
 * and site_domain are operator-entered and nothing in the schema enforces it.
 * A single bad row must not be able to blank an entire city's sitemap.
 */
function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlBlock(base: string, e: Entry): string {
  return [
    `  <url>`,
    `    <loc>${xmlEscape(`${base}${e.path}`)}</loc>`,
    e.lastmod ? `    <lastmod>${xmlEscape(e.lastmod)}</lastmod>` : null,
    e.changefreq ? `    <changefreq>${xmlEscape(e.changefreq)}</changefreq>` : null,
    e.priority ? `    <priority>${xmlEscape(e.priority)}</priority>` : null,
    `  </url>`,
  ]
    .filter(Boolean)
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    // Per-city sitemaps, resolved by the SAME shared helper every other public
    // surface uses: ?city_id=<slug> first (how each city's robots.txt addresses
    // this function on the shared functions host), then the Host header (so a
    // city that rewrites /sitemap.xml on its own domain without a param still
    // gets its own sitemap rather than the template city's), then the default.
    const config = await resolveCityConfig(supabase, req);
    const cityId = config.id;
    const base = `https://${config.site_domain}`;

    const entries: Entry[] = staticEntries(config);
    const day = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : undefined);

    // Upcoming events
    const { data: events } = await supabase
      .from("content_queue")
      .select("id, event_date, updated_at")
      .eq("city_id", cityId)
      .eq("category", "events")
      .in("status", ["auto_published", "published"])
      .eq("safety_level", "safe")
      .gte("event_date", new Date().toISOString().slice(0, 10))
      .order("event_date", { ascending: true })
      .limit(500);
    for (const e of events ?? []) {
      entries.push({ path: `/events/${e.id}`, lastmod: day(e.updated_at || e.event_date), changefreq: "weekly", priority: "0.6" });
    }

    // Recent incidents (last 60 days).
    //
    // PRIVACY + CORRECTNESS: a sitemap is a public document and every URL in it
    // is submitted to Google. `incidents.slug` is computed upstream as
    // slugify(RAW title), so an ungated row publishes its own title in the
    // sitemap XML — a name, a house number — even though no page ever renders
    // it. And serve-page returns 404 for exactly these rows, so listing them
    // also submits soft-404s. Apply the SAME gate the rendering surfaces apply,
    // and fail closed on a title whose slug would leak what the redactor
    // removes (the slug cannot be scrubbed without breaking the URL it names).
    // This is why the gate columns are selected here at all.
    const incidentCutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data: incidents } = await supabase
      .from("incidents")
      .select("slug, updated_at, status, title, incident_type, sub_type, location, body, ai_rewrite")
      .eq("city_id", cityId)
      .in("status", ["active", "developing", "monitoring", "resolved"])
      .not("slug", "is", null)
      .gte("updated_at", incidentCutoff)
      .order("updated_at", { ascending: false })
      .limit(500);
    for (const i of incidents ?? []) {
      if (!i.slug) continue;
      if (!passesIncidentGate(i.title, i.incident_type, i.sub_type, i.location, i.body, i.ai_rewrite)) {
        continue;
      }
      if (containsPersonalDetail(i.title)) continue;
      entries.push({ path: `/incidents/${i.slug}`, lastmod: day(i.updated_at), changefreq: "weekly", priority: "0.5" });
    }

    // Published stories (last 90 days)
    const storyCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: stories } = await supabase
      .from("content_queue")
      .select("id, title, updated_at, publish_date")
      .eq("city_id", cityId)
      .in("status", ["published", "auto_published"])
      .eq("safety_level", "safe")
      .gte("publish_date", storyCutoff)
      .order("publish_date", { ascending: false, nullsFirst: false })
      .limit(1000);
    for (const s of stories ?? []) {
      const slug = slugify(s.title || "");
      entries.push({
        path: slug ? `/stories/${slug}-${s.id}` : `/stories/${s.id}`,
        lastmod: day(s.updated_at || s.publish_date),
        changefreq: "weekly",
        priority: "0.7",
      });
    }

    // Shore Path stops. Template city only: shore_path_stops has no city_id
    // column and its parent route (/guides/lake-geneva-shore-path) is one of
    // the hand-written guides, so these rows belong to exactly one city.
    if (isTemplateCity(config)) {
      const { data: stops } = await supabase
        .from("shore_path_stops")
        .select("slug, updated_at, order_index")
        .eq("is_published", true)
        .order("order_index", { ascending: true });
      for (const s of stops ?? []) {
        if (!s.slug) continue;
        entries.push({ path: `/guides/lake-geneva-shore-path/${s.slug}`, lastmod: day(s.updated_at), changefreq: "monthly", priority: "0.8" });
      }
    }

    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      ...entries.map((e) => urlBlock(base, e)),
      `</urlset>`,
    ].join("\n");

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        // Crawlers may fetch often; DB reads are cheap but there is no reason
        // to regenerate more than hourly.
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[serve-sitemap] Error:", error);
    return new Response("sitemap generation failed", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
