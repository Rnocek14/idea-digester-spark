// Server-rendered HTML helpers for crawlable, database-backed pages.
//
// WHY THIS EXISTS
// The reader-facing site is a Vite SPA: every database-backed URL ships an
// empty <div id="root">. Googlebot renders JS eventually; GPTBot, ClaudeBot,
// PerplexityBot and OAI-SearchBot never do. serve-page (and the feed/archive
// functions built on these helpers) emit real HTML for the same URLs so the
// structured record of a town is legible to a crawler that executes nothing.
//
// FLEET-SAFE: nothing here hardcodes a hostname, a city name, or a city id.
// Every absolute URL is built from the RESOLVED city's site_domain.
//
// Deliberately NOT here: FAQPage JSON-LD. A story-level FAQPage was removed
// from this codebase as schema padding. Do not reintroduce it.

// deno-lint-ignore-file no-explicit-any

import {
  type CityConfig,
  getCityConfig,
  LAKE_GENEVA_DEFAULTS,
} from "./cityConfig.ts";
import {
  containsPersonalDetail,
  passesIncidentGate,
  publicIncidentText,
  redactForPublicRender,
  tier3Match,
  tier4Match,
} from "./incidentGate.ts";

export type { CityConfig };

// ---------------------------------------------------------------------------
// Escaping — ONE helper, used for text nodes AND attribute values.
// ---------------------------------------------------------------------------

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escape a value for interpolation into HTML. Safe in text nodes and in
 * quoted attribute values (both quote characters are escaped), which is why
 * there is only one of these. null/undefined render as an empty string.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (c) => HTML_ENTITIES[c]);
}

/** Alias for readability at attribute call sites. Identical behaviour. */
export const escapeAttr = escapeHtml;

/**
 * Serialize JSON-LD into a <script> block. JSON.stringify alone is not
 * enough: a "</script>" inside any string value would close the element.
 */
export function jsonLdScript(payload: unknown | unknown[]): string {
  const blocks = Array.isArray(payload) ? payload : [payload];
  return blocks
    .filter((b) => b !== null && b !== undefined)
    .map((b) => {
      const json = JSON.stringify(b)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
      return `<script type="application/ld+json">${json}</script>`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Text shaping
// ---------------------------------------------------------------------------

/** Remove any markup that snuck in from an upstream source before escaping. */
export function stripTags(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(value: unknown, max = 160): string {
  const s = stripTags(value);
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

/**
 * Turn a plain-text body into escaped <p> blocks. Blank lines separate
 * paragraphs; single newlines are joined (upstream feeds wrap hard).
 */
export function toParagraphs(text: unknown, className?: string): string {
  const source = String(text ?? "").replace(/\r\n/g, "\n");
  if (!stripTags(source)) return "";
  const blocks = source
    .split(/\n\s*\n/)
    .map((b) => stripTags(b))
    .filter(Boolean);
  const cls = className ? ` class="${escapeAttr(className)}"` : "";
  return blocks.map((b) => `<p${cls}>${escapeHtml(b)}</p>`).join("\n");
}

/** ISO-8601 string for a <time datetime> attribute, or null if unparseable. */
export function isoDate(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Date-only (YYYY-MM-DD) in the given IANA timezone. */
export function localDateKey(value: Date | string | number, timezone: string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Human-readable date/time in the city's timezone. Never invents a value.
 *
 * A date-only value (a Postgres `date` column such as publish_date or
 * brief_date) is a CALENDAR DATE, not an instant. `new Date("2026-07-25")`
 * parses as midnight UTC, and formatting that in a western timezone renders
 * the previous day — a brief filed for the 30th captioned "July 29". Date-only
 * inputs are therefore formatted in UTC so the calendar date survives.
 */
export function displayDate(
  value: unknown,
  timezone: string,
  opts: { withTime?: boolean } = {}
): string {
  if (!value) return "";
  const raw = String(value);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const dateOnly = DATE_ONLY_RE.test(raw.trim());
  const base: Intl.DateTimeFormatOptions = {
    timeZone: dateOnly ? "UTC" : timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  // A date-only value carries no time of day; never render one.
  if (opts.withTime && !dateOnly) {
    base.hour = "numeric";
    base.minute = "2-digit";
    base.timeZoneName = "short";
  }
  try {
    return new Intl.DateTimeFormat("en-US", base).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Bare hostname of an outbound URL, for source attribution. */
export function hostOf(url: unknown): string | null {
  if (!url) return null;
  try {
    return new URL(String(url)).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Only http(s) links are ever emitted — no javascript:/data: URLs. */
export function safeExternalUrl(url: unknown): string | null {
  if (!url) return null;
  try {
    const u = new URL(String(url));
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** URL slug helper. Mirrors src/lib/slug.ts so paths match the SPA exactly. */
export function slugify(input: string, max = 60): string {
  return (input || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Pull the trailing uuid out of "{slug}-{id}" (or a bare id). */
export function extractStoryId(param: string): string | null {
  const m = String(param || "").match(new RegExp(UUID_RE.source + "$", "i"));
  return m ? m[0] : UUID_RE.test(String(param || "")) ? String(param).match(UUID_RE)![0] : null;
}

export function storyPath(id: string, title?: string | null): string {
  const s = slugify(title || "");
  return s ? `/stories/${s}-${id}` : `/stories/${id}`;
}

// ---------------------------------------------------------------------------
// PRIVACY — this is a town of 8,000. Two independent layers.
//
// Layer 1 (primary): the editorial gate. Any incident text matching a Tier-4
//   or Tier-3 keyword never reaches a public surface at all.
// Layer 2 (defence in depth): deterministic redaction of the identifiers that
//   survive a clean gate pass — street numbers, ages, plates, phone numbers,
//   emails, and names in the few positions where they are machine-detectable.
//
// The implementation of all four lives in _shared/incidentGate.ts, beside the
// tier keyword lists they are always used with. They are re-exported here so
// the render helpers remain a single import for page-building call sites.
// ---------------------------------------------------------------------------

export {
  containsPersonalDetail,
  passesIncidentGate,
  publicIncidentText,
  redactForPublicRender,
  tier3Match,
  tier4Match,
};

// ---------------------------------------------------------------------------
// City resolution — ?city_id= wins, then the Host header, then the default.
// ---------------------------------------------------------------------------

// The whole row. city_config is a small, operator-managed table, and callers
// need fields a hand-picked list kept losing: serve-data's Dataset JSON-LD
// publishes `bbox` as the spatialCoverage GeoShape. With a partial select the
// row spread below leaves bbox at the TEMPLATE city's value, so every city in
// the fleet would advertise the template town's bounding box as its own.
// (The no-select-* rule exists for `incidents`, which has internal columns.
// city_config has none.)
const CITY_COLUMNS = "*";

function normalizeHost(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0].trim().toLowerCase();
  if (!first) return null;
  return first.replace(/^www\./, "").replace(/:\d+$/, "");
}

/** The public host the reader actually asked for, if a proxy passed it along. */
export function requestHost(req: Request): string | null {
  const h = req.headers;
  return (
    normalizeHost(h.get("x-forwarded-host")) ??
    normalizeHost(h.get("x-original-host")) ??
    normalizeHost(h.get("host"))
  );
}

/**
 * Resolve the city for this request. Never throws: a database failure falls
 * back to the default config rather than 500-ing a crawler.
 */
export async function resolveCityConfig(supabase: any, req: Request): Promise<CityConfig> {
  const fallback = await safeDefaultConfig(supabase);
  let url: URL | null = null;
  try {
    url = new URL(req.url);
  } catch {
    url = null;
  }

  const cityIdParam = url?.searchParams.get("city_id")?.trim() || null;
  if (cityIdParam) {
    const row = await fetchCityRow(supabase, "id", cityIdParam);
    if (row) return { ...fallback, ...row } as CityConfig;
  }

  const host = requestHost(req);
  if (host) {
    const row =
      (await fetchCityRow(supabase, "hostname", host)) ??
      (await fetchCityRow(supabase, "site_domain", host));
    if (row) return { ...fallback, ...row } as CityConfig;
  }

  return fallback;
}

async function fetchCityRow(
  supabase: any,
  column: string,
  value: string
): Promise<Record<string, any> | null> {
  try {
    const { data, error } = await supabase
      .from("city_config")
      .select(CITY_COLUMNS)
      .eq(column, value)
      .maybeSingle();
    if (error || !data) return null;
    return data as Record<string, any>;
  } catch {
    return null;
  }
}

async function safeDefaultConfig(supabase: any): Promise<CityConfig> {
  try {
    return await getCityConfig(supabase);
  } catch {
    return LAKE_GENEVA_DEFAULTS;
  }
}

export function siteBase(config: CityConfig): string {
  const domain = String(config.site_domain || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${domain}`;
}

export function absoluteUrl(config: CityConfig, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${siteBase(config)}${p}`;
}

/**
 * The site path this invocation is standing in for. Callers hit the function
 * as ?path=/incidents/foo (the shape a CDN rewrite produces); a direct call
 * to /functions/v1/serve-page/incidents/foo works too.
 */
export function requestedPath(req: Request): string {
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return "/";
  }
  const explicit = url.searchParams.get("path");
  if (explicit) {
    const p = explicit.split("?")[0];
    return normalizePath(p);
  }
  let p = url.pathname;
  p = p.replace(/^\/functions\/v1/, "");
  p = p.replace(/^\/serve-page/, "");
  return normalizePath(p);
}

function normalizePath(p: string): string {
  let out = (p || "/").trim();
  if (!out.startsWith("/")) out = `/${out}`;
  if (out.length > 1) out = out.replace(/\/+$/, "");
  return out || "/";
}

// ---------------------------------------------------------------------------
// <head> construction — exactly one of each social tag, always.
// ---------------------------------------------------------------------------

export type PageMeta = {
  title: string;
  description: string;
  /** Site-relative path; the canonical is built from the resolved domain. */
  path: string;
  ogType?: "website" | "article";
  imageUrl?: string | null;
  publishedTime?: string | null;
  modifiedTime?: string | null;
  /** Defaults to the site-wide feed. */
  feedPath?: string;
  feedTitle?: string;
  noindex?: boolean;
  jsonLd?: unknown[];
  prevPath?: string | null;
  nextPath?: string | null;
};

export function renderHead(config: CityConfig, meta: PageMeta): string {
  const canonical = absoluteUrl(config, meta.path);
  const title = stripTags(meta.title) || config.site_name;
  const description = truncate(meta.description, 300);
  const ogType = meta.ogType ?? "website";
  const image = safeExternalUrl(meta.imageUrl);
  const feedPath = meta.feedPath ?? "/feed.xml";
  const feedTitle = meta.feedTitle ?? `${config.site_name} feed`;

  const lines: string[] = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}">`,
    `<link rel="canonical" href="${escapeAttr(canonical)}">`,
    meta.noindex
      ? `<meta name="robots" content="noindex, follow">`
      : `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`,
    `<link rel="alternate" type="application/atom+xml" title="${escapeAttr(feedTitle)}" href="${escapeAttr(absoluteUrl(config, feedPath))}">`,
    // Open Graph — exactly one of each.
    `<meta property="og:site_name" content="${escapeAttr(config.site_name)}">`,
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:url" content="${escapeAttr(canonical)}">`,
    `<meta property="og:type" content="${escapeAttr(ogType)}">`,
    `<meta property="og:locale" content="en_US">`,
    // Twitter — exactly one card.
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(description)}">`,
  ];

  if (image) {
    lines.push(`<meta property="og:image" content="${escapeAttr(image)}">`);
    lines.push(`<meta name="twitter:image" content="${escapeAttr(image)}">`);
  }
  if (meta.publishedTime) {
    lines.push(`<meta property="article:published_time" content="${escapeAttr(meta.publishedTime)}">`);
  }
  if (meta.modifiedTime) {
    lines.push(`<meta property="article:modified_time" content="${escapeAttr(meta.modifiedTime)}">`);
  }
  if (meta.prevPath) {
    lines.push(`<link rel="prev" href="${escapeAttr(absoluteUrl(config, meta.prevPath))}">`);
  }
  if (meta.nextPath) {
    lines.push(`<link rel="next" href="${escapeAttr(absoluteUrl(config, meta.nextPath))}">`);
  }
  if (meta.jsonLd?.length) {
    lines.push(jsonLdScript(meta.jsonLd));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// JSON-LD builders
// ---------------------------------------------------------------------------

export function publisherRef(config: CityConfig) {
  return {
    "@type": "NewsMediaOrganization",
    name: config.site_name,
    url: siteBase(config),
  };
}

export type ArticleJsonLdInput = {
  headline: string;
  description?: string | null;
  path: string;
  datePublished?: string | null;
  dateModified?: string | null;
  imageUrl?: string | null;
  authorName?: string | null;
  /** Outbound source URL this item is derived from. */
  basedOnUrl?: string | null;
  sectionName?: string | null;
};

function buildArticle(
  config: CityConfig,
  type: "NewsArticle" | "Article",
  a: ArticleJsonLdInput
): Record<string, unknown> {
  const url = absoluteUrl(config, a.path);
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    headline: truncate(a.headline, 110),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    publisher: publisherRef(config),
    inLanguage: "en-US",
  };
  if (a.description) node.description = truncate(a.description, 300);
  if (a.datePublished) node.datePublished = a.datePublished;
  if (a.dateModified) node.dateModified = a.dateModified;
  if (a.imageUrl && safeExternalUrl(a.imageUrl)) node.image = [safeExternalUrl(a.imageUrl)];
  node.author = a.authorName
    ? { "@type": "Person", name: stripTags(a.authorName) }
    : publisherRef(config);
  if (a.basedOnUrl && safeExternalUrl(a.basedOnUrl)) node.isBasedOn = safeExternalUrl(a.basedOnUrl);
  if (a.sectionName) node.articleSection = stripTags(a.sectionName);
  node.contentLocation = {
    "@type": "Place",
    name: `${config.city_name}, ${config.state_code}`,
  };
  return node;
}

/** For editorial stories out of content_queue. */
export function newsArticleJsonLd(config: CityConfig, a: ArticleJsonLdInput) {
  return buildArticle(config, "NewsArticle", a);
}

/**
 * For incident records. Deliberately plain `Article` — schema.org has no
 * incident type and inventing one is worse than being generic.
 */
export function articleJsonLd(config: CityConfig, a: ArticleJsonLdInput) {
  return buildArticle(config, "Article", a);
}

export function breadcrumbJsonLd(
  config: CityConfig,
  items: Array<{ name: string; path: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: stripTags(item.name),
      item: absoluteUrl(config, item.path),
    })),
  };
}

export function collectionPageJsonLd(
  config: CityConfig,
  input: {
    name: string;
    description: string;
    path: string;
    items: Array<{ name: string; path: string; datePublished?: string | null }>;
  }
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: stripTags(input.name),
    description: truncate(input.description, 300),
    url: absoluteUrl(config, input.path),
    // isPartOf's range is CreativeWork — an Organization node here is invalid.
    isPartOf: { "@type": "WebSite", name: config.site_name, url: siteBase(config) },
    publisher: publisherRef(config),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: input.items.length,
      itemListElement: input.items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: stripTags(item.name),
        url: absoluteUrl(config, item.path),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Page chrome — self-contained, no external CSS, no JS.
// System font stack; 2px radii; neutral palette only (see the UI chrome rules:
// no purple/pink/indigo/violet/cyan/teal/emerald, no emoji as chrome).
// ---------------------------------------------------------------------------

const BASE_CSS = `
:root{color-scheme:light}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#fafaf9;color:#1c1917;
 font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
a{color:#0f3d63;text-underline-offset:2px}
a:hover{color:#0a2b47}
.wrap{max-width:44rem;margin:0 auto;padding:0 1.25rem}
.masthead{border-bottom:2px solid #1c1917;background:#fff}
.masthead .wrap{display:flex;flex-wrap:wrap;align-items:baseline;gap:.75rem;padding-top:1rem;padding-bottom:.85rem}
.brand{font-size:1.05rem;font-weight:700;letter-spacing:-.01em;text-decoration:none;color:#1c1917}
.place{font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:#57534e}
nav.top{margin-left:auto;font-size:.8125rem}
nav.top a{margin-left:.9rem;color:#44403c;text-decoration:none}
nav.top a:hover{text-decoration:underline}
main{padding:2rem 0 1rem}
h1{font-size:1.85rem;line-height:1.2;letter-spacing:-.015em;margin:0 0 .6rem}
h2{font-size:1.15rem;line-height:1.3;margin:2rem 0 .5rem}
h3{font-size:1rem;margin:1.5rem 0 .4rem}
p{margin:0 0 1rem}
.crumbs{font-size:.8125rem;color:#57534e;margin:0 0 1.1rem}
.crumbs a{color:#57534e}
.meta{font-size:.8125rem;color:#57534e;margin:0 0 1.4rem;padding-bottom:1rem;border-bottom:1px solid #e7e5e4}
.meta .dot{margin:0 .45rem;color:#a8a29e}
.lede{font-size:1.05rem;color:#292524}
ul.items{list-style:none;margin:0;padding:0;border-top:1px solid #e7e5e4}
ul.items li{padding:.9rem 0;border-bottom:1px solid #e7e5e4}
ul.items a{font-weight:600;text-decoration:none;color:#1c1917}
ul.items a:hover{text-decoration:underline}
.sub{display:block;font-size:.8125rem;color:#57534e;margin-top:.2rem;font-weight:400}
.tag{display:inline-block;border:1px solid #d6d3d1;border-radius:2px;padding:.05rem .4rem;
 font-size:.6875rem;letter-spacing:.06em;text-transform:uppercase;color:#57534e;background:#fff}
.note{border:1px solid #e7e5e4;border-radius:2px;background:#fff;padding:.85rem 1rem;
 font-size:.875rem;color:#44403c;margin:1.5rem 0}
.source{font-size:.875rem;color:#44403c;margin:1.5rem 0 0;padding-top:.9rem;border-top:1px solid #e7e5e4}
.updates{list-style:none;margin:0;padding:0}
.updates li{border-left:2px solid #d6d3d1;padding:0 0 1rem 1rem;margin:0}
.updates time{display:block;font-size:.75rem;color:#57534e;letter-spacing:.04em}
.pager{display:flex;justify-content:space-between;gap:1rem;margin:2rem 0 0;font-size:.875rem}
.spa-link{display:inline-block;margin:1.75rem 0 0;border:1px solid #1c1917;border-radius:2px;
 padding:.5rem .85rem;font-size:.875rem;text-decoration:none;color:#1c1917;background:#fff}
.spa-link:hover{background:#1c1917;color:#fff}
footer.site{margin-top:2.5rem;border-top:1px solid #e7e5e4;background:#fff}
footer.site .wrap{padding-top:1.25rem;padding-bottom:2rem;font-size:.8125rem;color:#57534e}
footer.site a{color:#57534e}
@media (max-width:480px){h1{font-size:1.5rem}nav.top{margin-left:0;width:100%}nav.top a{margin:0 .9rem 0 0}}
`.trim();

export type DocumentInput = {
  meta: PageMeta;
  /** Rendered, already-escaped HTML for <main>. */
  body: string;
  /** Rendered above the h1. Pass the same items you gave breadcrumbJsonLd. */
  breadcrumbs?: Array<{ name: string; path: string }>;
  /** Where the "view on the full site" button points. Defaults to meta.path. */
  spaPath?: string;
  spaLabel?: string;
};

export function renderBreadcrumbs(
  config: CityConfig,
  items: Array<{ name: string; path: string }>
): string {
  if (!items.length) return "";
  const parts = items.map((item, i) =>
    i === items.length - 1
      ? `<span aria-current="page">${escapeHtml(item.name)}</span>`
      : `<a href="${escapeAttr(absoluteUrl(config, item.path))}">${escapeHtml(item.name)}</a>`
  );
  return `<nav class="crumbs" aria-label="Breadcrumb">${parts.join(
    ' <span aria-hidden="true">/</span> '
  )}</nav>`;
}

export function renderDocument(config: CityConfig, input: DocumentInput): string {
  const base = siteBase(config);
  const spaHref = absoluteUrl(config, input.spaPath ?? input.meta.path);
  const place = `${config.city_name}, ${config.state_code}`;
  return `<!doctype html>
<html lang="en">
<head>
${renderHead(config, input.meta)}
<style>${BASE_CSS}</style>
</head>
<body>
<header class="masthead">
  <div class="wrap">
    <a class="brand" href="${escapeAttr(base)}">${escapeHtml(config.site_name)}</a>
    <span class="place">${escapeHtml(place)}</span>
    <nav class="top" aria-label="Sections">
      <a href="${escapeAttr(absoluteUrl(config, "/today"))}">Today</a>
      <a href="${escapeAttr(absoluteUrl(config, "/incidents"))}">Incidents</a>
      <a href="${escapeAttr(absoluteUrl(config, "/incidents/archive"))}">Archive</a>
    </nav>
  </div>
</header>
<main>
  <div class="wrap">
${input.breadcrumbs?.length ? renderBreadcrumbs(config, input.breadcrumbs) : ""}
${input.body}
    <p><a class="spa-link" href="${escapeAttr(spaHref)}">${escapeHtml(
    input.spaLabel ?? `Open this page on ${config.site_name}`
  )}</a></p>
  </div>
</main>
<footer class="site">
  <div class="wrap">
    <p>${escapeHtml(config.site_name)} &middot; a daily brief for ${escapeHtml(
    place
  )}, compiled from official and public sources.</p>
    <p><a href="${escapeAttr(base)}">${escapeHtml(config.site_name)}</a>
     &middot; <a href="${escapeAttr(absoluteUrl(config, "/about"))}">About &amp; sources</a>
     &middot; <a href="${escapeAttr(absoluteUrl(config, "/feed.xml"))}">Feed</a></p>
  </div>
</footer>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export const HTML_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function htmlResponse(
  html: string,
  opts: { status?: number; maxAge?: number; sMaxAge?: number } = {}
): Response {
  const status = opts.status ?? 200;
  const maxAge = opts.maxAge ?? 300;
  const sMaxAge = opts.sMaxAge ?? 600;
  return new Response(html, {
    status,
    headers: {
      ...HTML_CORS_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
      // A 5xx is a transient failure of OUR infrastructure. Caching it — at the
      // CDN especially — turns a blip into two minutes of hard-failed pages for
      // every reader and crawler behind that edge node.
      "Cache-Control":
        status >= 500
          ? "no-store"
          : status === 200
          ? `public, max-age=${maxAge}, s-maxage=${sMaxAge}`
          : `public, max-age=60, s-maxage=120`,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

/**
 * A real 404 page — not a blank body. Never echoes a database error; the
 * caller logs the detail and passes a reader-safe message (or none).
 */
export function renderNotFound(
  config: CityConfig,
  input: { path: string; heading?: string; message?: string }
): Response {
  const heading = input.heading ?? "That page isn't here";
  const message =
    input.message ??
    "The address may have changed, or the item may have been taken down. The links below still work.";
  const body = `
    <h1>${escapeHtml(heading)}</h1>
    <p class="lede">${escapeHtml(message)}</p>
    <ul class="items">
      <li><a href="${escapeAttr(absoluteUrl(config, "/today"))}">Today in ${escapeHtml(
    config.city_name
  )}</a><span class="sub">The daily brief</span></li>
      <li><a href="${escapeAttr(absoluteUrl(config, "/incidents"))}">Current incidents</a><span class="sub">Active and recent public-safety records</span></li>
      <li><a href="${escapeAttr(absoluteUrl(config, "/incidents/archive"))}">Incident archive</a><span class="sub">The full historical record</span></li>
    </ul>`;
  const html = renderDocument(config, {
    meta: {
      title: `${heading} — ${config.site_name}`,
      description: message,
      path: input.path,
      ogType: "website",
      noindex: true,
      jsonLd: [breadcrumbJsonLd(config, [{ name: config.site_name, path: "/" }])],
    },
    body,
    spaPath: "/",
    spaLabel: `Go to ${config.site_name}`,
  });
  return htmlResponse(html, { status: 404 });
}

/** Generic failure page. Never contains the underlying error. */
export function renderError(config: CityConfig, path: string): Response {
  const body = `
    <h1>This page couldn't be loaded</h1>
    <p class="lede">Something went wrong on our side. Please try again shortly.</p>
    <ul class="items">
      <li><a href="${escapeAttr(absoluteUrl(config, "/"))}">${escapeHtml(
    config.site_name
  )} home</a></li>
    </ul>`;
  const html = renderDocument(config, {
    meta: {
      title: `Temporarily unavailable — ${config.site_name}`,
      description: "This page could not be loaded.",
      path,
      noindex: true,
    },
    body,
    spaPath: "/",
    spaLabel: `Go to ${config.site_name}`,
  });
  return htmlResponse(html, { status: 500 });
}
