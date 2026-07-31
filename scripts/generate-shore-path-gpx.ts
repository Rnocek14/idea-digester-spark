// Writes public/shore-path-geneva-lake.gpx from the shore_path_stops table.
//
// Why a GPX file, of all things: the Shore Path guide is one of this site's proven
// search winners, and the walking/hiking world links to downloadable GPX tracks by
// reflex — forum posts, trail indexes, and blog writeups all want a file to point at.
// A 21-mile continuous public easement around a private-shoreline lake is a genuine
// American oddity, and nobody else publishes its waypoints. This is the cheapest
// genuinely link-worthy asset the site can own: the data already sits in the stops
// table (lat/lon, mile markers, stop names), curated for the map component.
//
// Runs in prebuild alongside generate-sitemap.ts, so the same env vars are present.
// It must NEVER fail the build: no env, no network, or an empty table just means the
// previously committed file (or none) keeps shipping.

import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const OUT = resolve(process.cwd(), "public/shore-path-geneva-lake.gpx");

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[gpx] Supabase env missing — keeping existing file, if any");
    return;
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await sb
    .from("shore_path_stops")
    .select("order_index, name, community, latitude, longitude, approx_mile, description")
    .eq("is_published", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("order_index", { ascending: true });

  if (error || !data?.length) {
    console.warn(`[gpx] no stops with coordinates (${error?.message ?? "empty"}) — skipping`);
    return;
  }

  const wpts = data
    .map((s) => {
      const parts = [
        s.community ? esc(String(s.community)) : null,
        s.approx_mile != null ? `mile ${s.approx_mile}` : null,
      ].filter(Boolean);
      const desc = [parts.join(" · "), s.description ? esc(String(s.description)) : null]
        .filter(Boolean)
        .join(" — ");
      return [
        `  <wpt lat="${Number(s.latitude)}" lon="${Number(s.longitude)}">`,
        `    <name>${s.order_index}. ${esc(String(s.name))}</name>`,
        desc ? `    <desc>${desc}</desc>` : null,
        `  </wpt>`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Lake Geneva Brief — lakegenevabrief.com"
     xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Geneva Lake Shore Path — public stops</name>
    <desc>Waypoints for the public landmarks along the 21-mile Geneva Lake Shore Path,
in walking order. Every waypoint is a public landmark — a park, public beach, public
pier, or historic site open to visitors. Leg distances and access points come from the
official Geneva Lake Shore Path map published by the Williams Bay Recreation Department;
the stop curation is Lake Geneva Brief's own. The path crosses private property under a
long-standing public-access easement: stay on the path, and treat it as the front yards
it runs through. Free to use with attribution to lakegenevabrief.com.</desc>
  </metadata>
${wpts}
</gpx>
`;

  writeFileSync(OUT, gpx, "utf8");
  console.log(`[gpx] wrote public/shore-path-geneva-lake.gpx (${data.length} waypoints)`);
}

main().catch((e) => {
  console.warn(`[gpx] skipped after error: ${e instanceof Error ? e.message : e}`);
});
