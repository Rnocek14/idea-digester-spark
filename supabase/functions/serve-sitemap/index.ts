// Live sitemap served straight from the database — no rebuild required.
// The build-time script (scripts/generate-sitemap.ts) only captures stories
// that existed at deploy time; this function is always current, which matters
// for a news site publishing all day with no operator watching deploys.
//
// robots.txt points crawlers here via an additional Sitemap: line.
// Keep the static route list in sync with scripts/generate-sitemap.ts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCityConfig } from "../_shared/cityConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Entry = { path: string; lastmod?: string; changefreq?: string; priority?: string };

const STATIC_ENTRIES: Entry[] = [
  { path: "/", changefreq: "hourly", priority: "1.0" },
  { path: "/today", changefreq: "hourly", priority: "1.0" },
  { path: "/selling-lake-geneva", changefreq: "weekly", priority: "0.9" },
  { path: "/directory", changefreq: "weekly", priority: "0.8" },
  { path: "/cities", changefreq: "monthly", priority: "0.5" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/advertise", changefreq: "monthly", priority: "0.6" },
  { path: "/nightlife", changefreq: "daily", priority: "0.8" },
  { path: "/eats", changefreq: "weekly", priority: "0.8" },
  { path: "/eats/fish-fry", changefreq: "weekly", priority: "0.8" },
  { path: "/events", changefreq: "daily", priority: "0.9" },
  { path: "/incidents", changefreq: "daily", priority: "0.7" },
  { path: "/jobs", changefreq: "daily", priority: "0.8" },
  { path: "/deals", changefreq: "weekly", priority: "0.7" },
  { path: "/community/local-love", changefreq: "weekly", priority: "0.7" },
  { path: "/community/voices", changefreq: "weekly", priority: "0.7" },
  { path: "/guides", changefreq: "weekly", priority: "0.9" },
  { path: "/guides/yerkes-observatory", changefreq: "monthly", priority: "0.95" },
  { path: "/guides/big-foot-beach-state-park", changefreq: "monthly", priority: "0.95" },
  { path: "/guides/where-to-stay-lake-geneva", changefreq: "weekly", priority: "0.95" },
  { path: "/guides/things-to-do-lake-geneva", changefreq: "weekly", priority: "0.9" },
  { path: "/guides/moving-to-lake-geneva", changefreq: "weekly", priority: "0.9" },
  { path: "/guides/lake-geneva-neighborhoods", changefreq: "weekly", priority: "0.9" },
  { path: "/guides/things-to-do-lake-geneva-this-weekend", changefreq: "weekly", priority: "0.9" },
  { path: "/guides/things-to-do-lake-geneva-in-winter", changefreq: "weekly", priority: "0.9" },
  { path: "/guides/best-things-to-do-lake-geneva-in-summer", changefreq: "weekly", priority: "0.9" },
  { path: "/guides/things-to-do-lake-geneva-with-kids", changefreq: "weekly", priority: "0.9" },
  { path: "/guides/lake-geneva-schools", changefreq: "weekly", priority: "0.9" },
  { path: "/market-report", changefreq: "monthly", priority: "0.9" },
  { path: "/guides/cost-of-living-lake-geneva", changefreq: "monthly", priority: "0.8" },
  { path: "/guides/lake-geneva-vs-williams-bay", changefreq: "monthly", priority: "0.8" },
  { path: "/guides/fontana-vs-lake-geneva", changefreq: "monthly", priority: "0.8" },
  { path: "/guides/why-people-love-lake-geneva", changefreq: "monthly", priority: "0.7" },
  { path: "/guides/lake-geneva-shore-path", changefreq: "weekly", priority: "0.95" },
  { path: "/best-of/restaurants-lake-geneva", changefreq: "weekly", priority: "0.9" },
  { path: "/best-of/lake-geneva", changefreq: "weekly", priority: "0.9" },
  { path: "/guides/lake-geneva-public-access-guide", changefreq: "monthly", priority: "0.85" },
  { path: "/guides/lake-geneva-faq", changefreq: "monthly", priority: "0.9" },
  { path: "/lake-geneva-webcams", changefreq: "weekly", priority: "0.85" },
  { path: "/lake-geneva-weather", changefreq: "daily", priority: "0.9" },
];

function slugify(s: string, max = 60): string {
  return (s || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

function urlBlock(base: string, e: Entry): string {
  return [
    `  <url>`,
    `    <loc>${base}${e.path}</loc>`,
    e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
    e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
    e.priority ? `    <priority>${e.priority}</priority>` : null,
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
    // Per-city sitemaps: each city's robots.txt points here with its own
    // ?city_id=<slug>; no param serves the default city.
    const cityIdParam = new URL(req.url).searchParams.get("city_id");
    let config = await getCityConfig(supabase);
    if (cityIdParam && cityIdParam !== config.id) {
      const { data: row } = await supabase
        .from("city_config")
        .select("*")
        .eq("id", cityIdParam)
        .maybeSingle();
      if (row) config = { ...config, ...row };
    }
    const cityId = config.id;
    const base = `https://${config.site_domain}`;

    const entries: Entry[] = [...STATIC_ENTRIES];
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

    // Recent incidents (last 60 days)
    const incidentCutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data: incidents } = await supabase
      .from("incidents")
      .select("slug, updated_at, status")
      .eq("city_id", cityId)
      .in("status", ["active", "developing", "monitoring", "resolved"])
      .not("slug", "is", null)
      .gte("updated_at", incidentCutoff)
      .order("updated_at", { ascending: false })
      .limit(500);
    for (const i of incidents ?? []) {
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

    // Shore Path stops
    const { data: stops } = await supabase
      .from("shore_path_stops")
      .select("slug, updated_at, order_index")
      .eq("is_published", true)
      .order("order_index", { ascending: true });
    for (const s of stops ?? []) {
      if (!s.slug) continue;
      entries.push({ path: `/guides/lake-geneva-shore-path/${s.slug}`, lastmod: day(s.updated_at), changefreq: "monthly", priority: "0.8" });
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
