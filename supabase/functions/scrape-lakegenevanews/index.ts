import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INDEX_URL = "https://lakegenevanews.net/news/";
const SOURCE_ID = "1cd38cc0-fb4f-4df5-a2cd-93a273abd4d1";
const MAX_ARTICLES_PER_RUN = 8;

async function firecrawlScrape(url: string, key: string, formats: string[] = ["markdown", "html"]) {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ url, formats, onlyMainContent: true, waitFor: 1500 }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`firecrawl ${res.status}: ${text.slice(0, 200)}`);
  }
  return await res.json();
}

function extractArticleLinks(html: string): string[] {
  if (!html) return [];
  const urls = new Set<string>();
  const re = /href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let href = m[1];
    if (href.startsWith("/")) href = `https://lakegenevanews.net${href}`;
    if (!href.startsWith("https://lakegenevanews.net/news/")) continue;
    if (href === INDEX_URL || href === "https://lakegenevanews.net/news") continue;
    // skip section/tag pages — article URLs have a slug segment after /news/
    const path = href.replace("https://lakegenevanews.net/news/", "");
    if (!path || path.startsWith("?") || path.startsWith("page/")) continue;
    if (path.length < 8) continue;
    urls.add(href.split("#")[0].split("?")[0]);
  }
  return Array.from(urls).slice(0, 30);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = new Date().toISOString();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const ingestSecret = Deno.env.get("NEWS_INGEST_SECRET");

  if (!firecrawlKey || !ingestSecret) {
    return new Response(
      JSON.stringify({ error: "missing FIRECRAWL_API_KEY or NEWS_INGEST_SECRET" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const result = {
    started_at: startedAt,
    discovered: 0,
    skipped_existing: 0,
    scraped: 0,
    inserted: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Current zero-run counter so this run can do the same health accounting
  // sync-rss does — without it, this scraper could return empty forever and
  // never trip the zero-run alarms in the health digest.
  const { data: sourceRow } = await supabase
    .from("sources")
    .select("consecutive_zero_runs")
    .eq("id", SOURCE_ID)
    .maybeSingle();

  try {
    // 1. Fetch index page via Firecrawl
    const indexResp = await firecrawlScrape(INDEX_URL, firecrawlKey, ["html"]);
    const html = indexResp?.data?.html || "";
    const links = extractArticleLinks(html);
    result.discovered = links.length;

    if (links.length === 0) {
      result.errors.push("no article links extracted from index page");
    }

    // 2. Filter against existing content_queue
    const { data: existing } = await supabase
      .from("content_queue")
      .select("normalized_url")
      .in("normalized_url", links.map((l) => l.toLowerCase().replace(/\/+$/, "")));
    const seen = new Set((existing ?? []).map((r: any) => r.normalized_url));
    const fresh = links.filter((l) => !seen.has(l.toLowerCase().replace(/\/+$/, "")));
    result.skipped_existing = links.length - fresh.length;

    // 3. Scrape each fresh link (capped) and POST to ingest-news
    const targets = fresh.slice(0, MAX_ARTICLES_PER_RUN);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    for (const articleUrl of targets) {
      try {
        const scraped = await firecrawlScrape(articleUrl, firecrawlKey, ["markdown", "html"]);
        const data = scraped?.data ?? {};
        const meta = data.metadata ?? {};
        result.scraped++;

        const payload = {
          source: "lakegenevanews",
          url: articleUrl,
          title: meta.title || meta.ogTitle || data.markdown?.split("\n")[0]?.replace(/^#+\s*/, "") || "Untitled",
          summary: meta.description || meta.ogDescription || "",
          content: data.markdown || "",
          author: meta.author || "Lake Geneva Regional News",
          published_at: meta.publishedTime || meta["article:published_time"] || null,
          image_url: meta.ogImage || null,
          category: "news",
          metadata: {
            scraped_at: new Date().toISOString(),
            source_type: "firecrawl",
            ingest_method: "edge_function_cron",
          },
        };

        const ingestRes = await fetch(`${supabaseUrl}/functions/v1/ingest-news`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ingestSecret}`,
          },
          body: JSON.stringify(payload),
        });
        const ingestJson = await ingestRes.json().catch(() => ({}));
        if (ingestRes.ok && ingestJson.status === "inserted") result.inserted++;
      } catch (e: any) {
        result.failed++;
        result.errors.push(`${articleUrl}: ${e?.message ?? String(e)}`);
      }
    }

    // 4. Update source health. The index fetch succeeded, so this counts as a
    // successful fetch; the zero-run counters cover the "HTTP 200 but nothing
    // new" case (dedupe hits don't count as zero — skipped_existing means the
    // source is alive, just already ingested).
    const nowIso = new Date().toISOString();
    const sawContent = result.inserted > 0 || result.skipped_existing > 0;
    const healthUpdate: Record<string, unknown> = {
      last_fetched_at: nowIso,
      last_successful_fetch_at: nowIso,
      last_items_ingested_count: result.inserted,
      last_error_code: null,
      last_error_detail: null,
    };
    if (sawContent) {
      healthUpdate.consecutive_zero_runs = 0;
      healthUpdate.health_severity = "ok";
      if (result.inserted > 0) healthUpdate.last_nonzero_run_at = nowIso;
    } else {
      const nextRuns = (sourceRow?.consecutive_zero_runs ?? 0) + 1;
      healthUpdate.last_zero_items_at = nowIso;
      healthUpdate.consecutive_zero_runs = nextRuns;
      healthUpdate.health_severity = nextRuns >= 10 ? "critical" : nextRuns >= 4 ? "warn" : "ok";
    }
    await supabase.from("sources").update(healthUpdate).eq("id", SOURCE_ID);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    result.errors.push(e?.message ?? String(e));
    // Record the failure on the source row so the health digest can see it —
    // the cron that invokes this function ignores the HTTP response entirely.
    await supabase
      .from("sources")
      .update({
        last_fetched_at: new Date().toISOString(),
        last_error_code: "scrape_failed",
        last_error_detail: (e?.message ?? String(e)).slice(0, 500),
        health_severity: "warn",
      })
      .eq("id", SOURCE_ID);
    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});