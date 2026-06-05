// Runs before `vite dev` and `vite build`; writes public/sitemap.xml.
// Pulls dynamic event + incident slugs/ids from Supabase so /events/:id
// and /incidents/:slug routes are discoverable by crawlers.

import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://lakegeneva.citybrief.info";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

// Static, indexable routes. Excludes /auth, /v1, /v2, /lake-geneva
// (redirects/legacy), /submit, /jobs/post, /dashboard/*, /employer-*,
// /sponsor-portal — internal or non-indexable.
const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "hourly", priority: "1.0" },
  { path: "/selling-lake-geneva", changefreq: "weekly", priority: "0.9" },
  { path: "/directory", changefreq: "weekly", priority: "0.8" },
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
  { path: "/best-of/restaurants-lake-geneva", changefreq: "weekly", priority: "0.9" },
];

function urlBlock(e: SitemapEntry) {
  return [
    `  <url>`,
    `    <loc>${BASE_URL}${e.path}</loc>`,
    e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
    e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
    e.priority ? `    <priority>${e.priority}</priority>` : null,
    `  </url>`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function fetchDynamic(): Promise<SitemapEntry[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[sitemap] Supabase env missing — skipping dynamic entries");
    return [];
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const entries: SitemapEntry[] = [];

  // Upcoming events (next 90 days)
  try {
    const { data: events } = await sb
      .from("content_queue")
      .select("id, event_date, updated_at")
      .eq("category", "events")
      .in("status", ["approved", "auto_published", "published"])
      .in("safety_level", ["safe", "soft_sensitive"])
      .gte("event_date", new Date().toISOString().slice(0, 10))
      .order("event_date", { ascending: true })
      .limit(500);
    for (const e of events ?? []) {
      entries.push({
        path: `/events/${e.id}`,
        lastmod: (e.updated_at || e.event_date || "").toString().slice(0, 10) || undefined,
        changefreq: "weekly",
        priority: "0.6",
      });
    }
    console.log(`[sitemap] +${events?.length ?? 0} event entries`);
  } catch (err) {
    console.warn("[sitemap] events fetch failed:", err);
  }

  // Recent incident detail pages (last 60 days)
  try {
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data: incidents } = await sb
      .from("incidents")
      .select("slug, updated_at, created_at")
      .not("slug", "is", null)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(500);
    for (const i of incidents ?? []) {
      entries.push({
        path: `/incidents/${i.slug}`,
        lastmod: (i.updated_at || i.created_at || "").toString().slice(0, 10) || undefined,
        changefreq: "weekly",
        priority: "0.5",
      });
    }
    console.log(`[sitemap] +${incidents?.length ?? 0} incident entries`);
  } catch (err) {
    console.warn("[sitemap] incidents fetch failed:", err);
  }

  return entries;
}

async function main() {
  const dynamic = await fetchDynamic();
  const all = [...staticEntries, ...dynamic];
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...all.map(urlBlock),
    `</urlset>`,
  ].join("\n");
  writeFileSync(resolve("public/sitemap.xml"), xml);
  console.log(`[sitemap] wrote public/sitemap.xml (${all.length} entries)`);
}

main().catch((err) => {
  console.error("[sitemap] generation failed:", err);
  process.exit(0); // don't fail builds on sitemap issues
});