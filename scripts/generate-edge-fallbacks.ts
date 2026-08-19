// Snapshot the crawler-facing edge functions into static files at build time.
//
// The fleet-correct design serves /feed.xml and /llms.txt per city through
// edge functions (serve-feed, serve-llms) behind hosting rewrites. Those
// rewrites don't exist yet — Lovable hosting can't express them — so until a
// CDN layer (e.g. Cloudflare) fronts the domain, the canonical URLs would
// 404 (/feed.xml) or serve a hostname-neutral stub (/llms.txt).
//
// This script closes that gap the same way generate-sitemap.ts does for the
// sitemap: at every build it fetches the DEPLOYED functions — the single
// source of truth for content, filtering, and privacy gating — and writes
// their output into public/, which Vite copies into dist/. The trade-offs,
// stated honestly:
//
//   - Freshness is per-build, not per-request. A story published between
//     builds appears in the edge feed immediately but in this static feed
//     only after the next build. Better a slightly stale feed at the real
//     URL than a 404.
//   - SINGLE-CITY PRAGMATISM: the snapshot bakes in one city's content and
//     absolute URLs, and dist/ is shared by every city domain. Exactly like
//     the Sitemap: line in public/robots.txt, this is correct while exactly
//     one city exists and must be replaced by the rewrite mechanism before
//     city #2 launches.
//
// Failure mode: if a function is unreachable or returns junk, KEEP whatever
// file is already there and exit 0 — a build must never fail, and an old
// feed beats an empty one.

import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const FUNCTIONS_BASE = "https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1";
const CITY_ID = "default";

type Target = {
  fn: string;
  query: string;
  outFile: string;
  // A cheap shape check so a 200-with-error-body never overwrites good output.
  looksRight: (body: string) => boolean;
};

const TARGETS: Target[] = [
  {
    fn: "serve-feed",
    query: `?city_id=${CITY_ID}`,
    outFile: "public/feed.xml",
    looksRight: (b) => b.includes("<feed") && b.includes("<entry"),
  },
  {
    fn: "serve-llms",
    query: `?city_id=${CITY_ID}`,
    outFile: "public/llms.txt",
    looksRight: (b) => b.startsWith("#") && b.length > 300,
  },
];

async function main() {
  for (const t of TARGETS) {
    const url = `${FUNCTIONS_BASE}/${t.fn}${t.query}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const body = await res.text();
      if (!res.ok || !t.looksRight(body)) {
        console.warn(
          `[edge-fallbacks] ${t.fn} returned ${res.status} / unexpected shape — keeping existing ${t.outFile}`,
        );
        continue;
      }
      writeFileSync(resolve(process.cwd(), t.outFile), body);
      console.log(`[edge-fallbacks] wrote ${t.outFile} (${body.length} bytes) from ${t.fn}`);
    } catch (err) {
      const kept = existsSync(resolve(process.cwd(), t.outFile)) ? "keeping existing file" : "no file exists";
      console.warn(`[edge-fallbacks] ${t.fn} unreachable (${err}) — ${kept}`);
    }
  }
}

main();
