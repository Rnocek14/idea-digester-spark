import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ingest-secret",
};

const LAKE_GENEVA_NEWS_SOURCE_ID = "1cd38cc0-fb4f-4df5-a2cd-93a273abd4d1";

interface IncomingItem {
  source?: string;            // slug, e.g. "lakegenevanews"
  source_id?: string;         // UUID override (optional)
  url?: string;
  original_url?: string;
  title: string;
  content?: string;
  summary?: string;
  author?: string;
  category?: string;
  published_at?: string;
  publish_date?: string;
  image_url?: string;
  geo_tier?: number;
  geo_label?: string;
  metadata?: Record<string, unknown>;
}

function normalizeUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    u.hash = "";
    // Drop common tracking params
    const drop = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src",
    ];
    drop.forEach((k) => u.searchParams.delete(k));
    let s = `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}`;
    const qs = u.searchParams.toString();
    if (qs) s += `?${qs}`;
    return s.toLowerCase();
  } catch {
    return url.toLowerCase().trim().split("#")[0].replace(/\/+$/, "");
  }
}

function resolveSourceId(source: string | undefined): string {
  // Slug → UUID map. Extend as more webhook sources come online.
  const slugMap: Record<string, string> = {
    lakegenevanews: LAKE_GENEVA_NEWS_SOURCE_ID,
    "lake-geneva-news": LAKE_GENEVA_NEWS_SOURCE_ID,
    "lake-geneva-regional-news": LAKE_GENEVA_NEWS_SOURCE_ID,
  };
  if (!source) return LAKE_GENEVA_NEWS_SOURCE_ID;
  return slugMap[source.toLowerCase()] ?? LAKE_GENEVA_NEWS_SOURCE_ID;
}

// Keyword screen standing in for the AI safety pass that sync-rss items get.
// Matches the SENSITIVE definition used there: crime/courts, death/tragedy,
// and charged civic topics. Anything that matches is held for human review;
// a clean article from a trusted hyperlocal source auto-publishes, which is
// the same tier default sync-rss applies when its classifier is unavailable.
const SENSITIVE_SCREEN_KEYWORDS = [
  // crime & courts
  "arrest", "arrested", "police", "sheriff", "crime", "criminal", "charged",
  "charges", "sentenced", "guilty", "lawsuit", "court", "jail", "prison",
  "theft", "burglary", "robbery", "assault", "battery", "shooting", "shot",
  "stabbed", "stabbing", "homicide", "murder", "drugs", "overdose", "dui", "owi",
  // death & tragedy
  "dies", "died", "death", "dead", "fatal", "fatality", "killed", "obituary",
  "suicide", "drowned", "drowning", "crash", "collision", "missing person",
  // charged topics
  "protest", "election", "campaign", "layoff", "layoffs", "outbreak",
  "abuse", "scandal", "fraud",
];

function matchSensitiveKeyword(text: string): string | null {
  for (const kw of SENSITIVE_SCREEN_KEYWORDS) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) return kw;
  }
  return null;
}

type IngestDecision = {
  status: string;
  safetyLevel: string;
  safetyReason: string;
  holdReason: string | null;
  decisionPath: string;
};

function decideIngestStatus(geoTier: number, matchedKeyword: string | null): IngestDecision {
  if (matchedKeyword) {
    return {
      status: "pending",
      safetyLevel: "sensitive",
      safetyReason: `Keyword screen matched "${matchedKeyword}" — held for human review`,
      holdReason: "sensitive_keyword_screen",
      decisionPath: "ingest_keyword_hold",
    };
  }
  if (geoTier >= 1) {
    return {
      status: "auto_published",
      safetyLevel: "safe",
      safetyReason: "Keyword screen clean; trusted hyperlocal source",
      holdReason: null,
      decisionPath: "ingest_trusted_auto",
    };
  }
  return {
    status: "pending",
    safetyLevel: "soft_sensitive",
    safetyReason: "Keyword screen clean but source is not hyperlocal — held for review",
    holdReason: "untrusted_tier",
    decisionPath: "ingest_t0_hold",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const expected = Deno.env.get("NEWS_INGEST_SECRET");
  if (!expected) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Accept secret via Authorization: Bearer <secret> OR X-Ingest-Secret header
  const authHeader = req.headers.get("Authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const headerSecret = req.headers.get("X-Ingest-Secret") || "";
  const provided = bearer || headerSecret;

  if (!provided || provided !== expected) {
    console.warn("ingest-news: unauthorized attempt");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const items: IncomingItem[] = Array.isArray(body) ? body : [body as IncomingItem];
  if (items.length === 0) {
    return new Response(
      JSON.stringify({ status: "noop", inserted: 0, skipped: 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Look up the (single) source row to pull trust score + geo defaults.
  const sourceId = resolveSourceId(items[0]?.source);
  const { data: sourceRow } = await supabase
    .from("sources")
    .select("id, name, source_trust_score, default_geo_tier, metadata")
    .eq("id", sourceId)
    .maybeSingle();

  if (!sourceRow) {
    return new Response(
      JSON.stringify({ error: "Unknown source", source_id: sourceId }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const trustScore = sourceRow.source_trust_score ?? 8;
  const defaultGeoTier = sourceRow.default_geo_tier ?? 1;

  const results: Array<{ status: string; reason?: string; article_id?: string; url?: string | null }> = [];
  let inserted = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item?.title || (!item.url && !item.original_url)) {
      results.push({ status: "skipped", reason: "missing_title_or_url" });
      skipped++;
      continue;
    }

    const originalUrl = item.url || item.original_url || null;
    const normalizedUrl = normalizeUrl(originalUrl);

    // Pre-check for duplicate so we can return a clear reason
    if (normalizedUrl) {
      const { data: existing } = await supabase
        .from("content_queue")
        .select("id")
        .eq("normalized_url", normalizedUrl)
        .maybeSingle();
      if (existing) {
        results.push({
          status: "skipped",
          reason: "duplicate_url",
          article_id: existing.id,
          url: originalUrl,
        });
        skipped++;
        continue;
      }
    }

    const geoTier = item.geo_tier ?? defaultGeoTier;
    const screenText = `${item.title} ${item.summary || ""} ${(item.content || "").substring(0, 2000)}`;
    const matchedKeyword = matchSensitiveKeyword(screenText);
    const decision = decideIngestStatus(geoTier, matchedKeyword);

    const payload = {
      source_id: sourceId,
      title: item.title.trim().slice(0, 500),
      content: item.content || item.summary || "",
      summary: item.summary || (item.content ? item.content.substring(0, 300) : null),
      status: decision.status,
      category: item.category || "news",
      original_url: originalUrl,
      normalized_url: normalizedUrl,
      // Never null: a missing original publish time falls back to ingestion
      // time. The public feed filters on publish_date, so a null here made
      // the article permanently invisible even after approval.
      publish_date: item.published_at || item.publish_date || new Date().toISOString(),
      author: item.author || null,
      image_url: item.image_url || null,
      geo_tier: geoTier,
      geo_label: item.geo_label || "Lake Geneva",
      safety_level: decision.safetyLevel,
      safety_tags: matchedKeyword ? ["keyword_screen", matchedKeyword] : ["keyword_screen"],
      safety_reason: decision.safetyReason,
      hold_reason: decision.holdReason,
      decision_path: decision.decisionPath,
      metadata: {
        ...(item.metadata || {}),
        source_slug: item.source || "lakegenevanews",
        ingested_via: "n8n-news-webhook",
        ingest_method: (item.metadata as Record<string, unknown> | undefined)?.ingest_method ?? "n8n_puppeteer",
        ingested_at: new Date().toISOString(),
        trust_score: trustScore,
      },
    };

    const { data: row, error } = await supabase
      .from("content_queue")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      // Race condition on the unique index — treat as duplicate
      if (`${error.message}`.toLowerCase().includes("duplicate")) {
        results.push({ status: "skipped", reason: "duplicate_url", url: originalUrl });
        skipped++;
        continue;
      }
      console.error("ingest-news insert error:", error);
      results.push({ status: "error", reason: error.message, url: originalUrl });
      continue;
    }

    inserted++;
    results.push({ status: "inserted", article_id: row.id, url: originalUrl });
  }

  // Update Source Health on the LakeGenevaNews row. Keys are omitted (not
  // nulled) when this run carries no signal for them — the previous version
  // wrote last_nonzero_run_at: null on every zero-insert run, erasing the
  // real timestamp the health digest relies on.
  const nowIso = new Date().toISOString();
  const healthUpdate: Record<string, unknown> = {
    last_fetched_at: nowIso,
    last_successful_fetch_at: nowIso,
    last_items_ingested_count: inserted,
    last_error_code: null,
    last_error_detail: null,
    updated_at: nowIso,
  };
  if (inserted > 0) {
    healthUpdate.last_nonzero_run_at = nowIso;
    healthUpdate.consecutive_zero_runs = 0;
    healthUpdate.health_severity = "ok";
  } else {
    healthUpdate.last_zero_items_at = nowIso;
  }
  await supabase.from("sources").update(healthUpdate).eq("id", sourceId);

  // Audit log
  await supabase.from("activity_log").insert({
    actor_type: "system",
    action: "news_ingest",
    entity_type: "content_queue",
    entity_id: null,
    message: `ingest-news: ${inserted} inserted, ${skipped} duplicates`,
    details: {
      source: items[0]?.source || "lakegenevanews",
      source_id: sourceId,
      attempted: items.length,
      inserted,
      skipped,
      trust_score: trustScore,
    },
  });

  // Single-item callers get the simple shape they expect
  if (!Array.isArray(body) && results.length === 1) {
    const r = results[0];
    return new Response(JSON.stringify(r), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ inserted, skipped, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
