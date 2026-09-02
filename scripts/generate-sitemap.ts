// Runs before `vite dev` and `vite build`; writes public/sitemap.xml.
// Pulls dynamic event + incident slugs/ids from Supabase so /events/:id
// and /incidents/:slug routes are discoverable by crawlers.

import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// The SAME editorial gate the edge functions apply. Incident slugs are built from the
// raw title, so an ungated row publishes a person's name or house number inside
// public/sitemap.xml itself — the exact leak that was found and fixed in serve-sitemap.
// This build-time script had the identical query with no gate. The gate module is pure
// functions with zero Deno APIs, so Node/tsx imports it directly and the two sitemaps
// cannot drift apart.
import {
  containsPersonalDetail,
  passesIncidentGate,
} from "../supabase/functions/_shared/incidentGate";

const BASE_URL = "https://lakegenevabrief.com";

// tsx does NOT load .env the way Vite does, so relying on process.env alone made
// every local/CI build silently skip dynamic entries ("Supabase env missing").
// Read the dotenv files ourselves; real process env always wins.
function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), file);
    if (!existsSync(p)) continue;
    for (const raw of readFileSync(p, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}
loadEnvFiles();

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
  { path: "/today", changefreq: "hourly", priority: "1.0" },
  { path: "/lake-geneva", changefreq: "hourly", priority: "1.0" },
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
  { path: "/businesses", changefreq: "weekly", priority: "0.8" },
  { path: "/businesses/yogeeze-frozen-yogurt", changefreq: "monthly", priority: "0.8" },
  { path: "/businesses/brunos-liquors", changefreq: "monthly", priority: "0.8" },
  { path: "/businesses/stinebrinks-piggly-wiggly", changefreq: "monthly", priority: "0.8" },
  { path: "/guides/yerkes-observatory", changefreq: "monthly", priority: "0.95" },
  { path: "/guides/big-foot-beach-state-park", changefreq: "monthly", priority: "0.95" },
  { path: "/guides/where-to-stay-lake-geneva", changefreq: "weekly", priority: "0.95" },
  { path: "/guides/things-to-do-lake-geneva", changefreq: "weekly", priority: "0.9" },
  { path: "/guides/moving-to-lake-geneva", changefreq: "weekly", priority: "0.9" },
  { path: "/guides/lake-geneva-neighborhoods", changefreq: "weekly", priority: "0.9" },
  { path: "/guides/things-to-do-lake-geneva-this-weekend", changefreq: "weekly", priority: "0.9" },
  { path: "/guides/lake-geneva-winterfest", changefreq: "weekly", priority: "0.9" },
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
  { path: "/guides/lake-geneva-shore-path/register", changefreq: "weekly", priority: "0.7" },
  { path: "/guides/lake-geneva-shore-path/passport", changefreq: "monthly", priority: "0.7" },
  { path: "/guides/streblow-boats-geneva-lake", changefreq: "monthly", priority: "0.85" },
  { path: "/best-of/restaurants-lake-geneva", changefreq: "weekly", priority: "0.9" },
  { path: "/best-of/lake-geneva", changefreq: "weekly", priority: "0.9" },
  { path: "/guides/lake-geneva-public-access-guide", changefreq: "monthly", priority: "0.85" },
  { path: "/guides/lake-geneva-faq", changefreq: "monthly", priority: "0.9" },
  { path: "/guides/streblow-boats-geneva-lake", changefreq: "monthly", priority: "0.85" },
  { path: "/guides/lake-geneva-mailboat", changefreq: "monthly", priority: "0.9" },
  { path: "/guides/lake-geneva-boat-rentals", changefreq: "monthly", priority: "0.9" },
  { path: "/lake-geneva-webcams", changefreq: "weekly", priority: "0.85" },
  { path: "/lake-geneva-weather", changefreq: "daily", priority: "0.9" },
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
      // Match the anon RLS policy exactly (published/auto_published + safe only) —
      // requesting more just gets silently filtered and under-fills the sitemap.
      .in("status", ["auto_published", "published"])
      .eq("safety_level", "safe")
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
      // Gate columns are selected so the editorial gate can actually see them.
      .select("slug, title, incident_type, location, updated_at")
      // RLS already hides rejected rows from the anon key, but state it
      // explicitly — the filter is the contract, not a side effect of policy.
      .in("status", ["active", "developing", "monitoring", "resolved"])
      .not("slug", "is", null)
      .gte("updated_at", cutoff)
      .order("updated_at", { ascending: false })
      .limit(500);
    let gatedOut = 0;
    for (const i of incidents ?? []) {
      // Fail closed: a Tier-4 incident (arrest, custody, a name in the title) must not
      // appear in the sitemap even as a URL, and a slug cannot be redacted without
      // breaking the URL it names.
      if (!passesIncidentGate(i.title, i.incident_type, i.location)) { gatedOut++; continue; }
      if (containsPersonalDetail(i.title)) { gatedOut++; continue; }
      entries.push({
        path: `/incidents/${i.slug}`,
        lastmod: (i.updated_at || "").toString().slice(0, 10) || undefined,
        changefreq: "weekly",
        priority: "0.5",
      });
    }
    console.log(`[sitemap] +${(incidents?.length ?? 0) - gatedOut} incident entries (${gatedOut} withheld by the editorial gate)`);
  } catch (err) {
    console.warn("[sitemap] incidents fetch failed:", err);
  }

  // Published stories (last 90 days). Each story has a permalink at
  // /stories/{slug}-{id} with NewsArticle JSON-LD — required for Google
  // News / Top Stories eligibility.
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: stories } = await sb
      .from("content_queue")
      .select("id, title, updated_at, publish_date")
      .in("status", ["published", "auto_published"])
      .eq("safety_level", "safe")
      .gte("geo_tier", 1) // tier 0 = regional; not this city's record (mirror serve-sitemap)
      .gte("publish_date", cutoff)
      .order("publish_date", { ascending: false, nullsFirst: false })
      .limit(1000);
    for (const s of stories ?? []) {
      const slug = slugify(s.title || "");
      const path = slug ? `/stories/${slug}-${s.id}` : `/stories/${s.id}`;
      entries.push({
        path,
        lastmod: (s.updated_at || s.publish_date || "").toString().slice(0, 10) || undefined,
        changefreq: "weekly",
        priority: "0.7",
      });
    }
    console.log(`[sitemap] +${stories?.length ?? 0} story entries`);
  } catch (err) {
    console.warn("[sitemap] stories fetch failed:", err);
  }

  // Shore Path stop subpages — high-intent landmark pages
  // (e.g. Yerkes Observatory, Big Foot Beach area, Kishwauketoe).
  try {
    const { data: stops } = await sb
      .from("shore_path_stops")
      .select("slug, updated_at, order_index")
      .eq("is_published", true)
      .order("order_index", { ascending: true });
    for (const s of stops ?? []) {
      if (!s.slug) continue;
      entries.push({
        path: `/guides/lake-geneva-shore-path/${s.slug}`,
        lastmod: (s.updated_at || "").toString().slice(0, 10) || undefined,
        changefreq: "monthly",
        priority: "0.8",
      });
    }
    console.log(`[sitemap] +${stops?.length ?? 0} shore-path stop entries`);
  } catch (err) {
    console.warn("[sitemap] shore-path stops fetch failed:", err);
  }

  return entries;
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

async function main() {
  const dynamic = await fetchDynamic();
  if (dynamic.length === 0) {
    // Static-only sitemaps kill discoverability of every story/event/incident
    // page. Make this state impossible to miss in build logs.
    console.warn(
      "[sitemap] ⚠️  WARNING: ZERO dynamic entries — sitemap will contain only " +
        `${staticEntries.length} static URLs. Check VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY ` +
        "availability at build time and the queries above."
    );
  }
  const all = [...staticEntries, ...dynamic];
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...all.map(urlBlock),
    `</urlset>`,
  ].join("\n");
  writeFileSync(resolve("public/sitemap.xml"), xml);
  console.log(`[sitemap] wrote public/sitemap.xml (${all.length} entries: ${staticEntries.length} static + ${dynamic.length} dynamic)`);
}

main().catch((err) => {
  console.error("[sitemap] generation failed:", err);
  process.exit(0); // don't fail builds on sitemap issues
});