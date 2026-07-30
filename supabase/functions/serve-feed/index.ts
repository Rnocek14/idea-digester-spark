// serve-feed — the outbound Atom 1.0 feed for the resolved city.
//
// WHY THIS EXISTS
// Aggregators, curators, press-monitoring tools and newsreaders discover an
// outlet by its feed. This site publishes all day and has never had one, so it
// is structurally unmonitorable: there is no machine-readable way for anyone
// downstream to notice that it published anything at all. A sitemap tells a
// crawler what URLs exist; a feed tells a subscriber what is NEW.
//
// ROUTE
//   /feed.xml on a city's own domain (wherever a host rewrite is configured),
//   and directly at https://<project>.supabase.co/functions/v1/serve-feed.
//   The direct form has no city in its Host header, so pass ?city_id=<id>
//   when calling it that way — otherwise the default city is served.
//   index.html and renderPage.renderHead() both advertise the relative
//   /feed.xml form, which resolves per-host and therefore per-city.
//
// FLEET-SAFE: the city is resolved per request (?city_id=, then Host, then the
// default row). Every absolute URL — feed id, self link, alternate link, entry
// id, entry link — is built from THAT city's site_domain. Nothing here names a
// host, a city, or a city id.
//
// PRIVACY: only two fields of a row ever reach a subscriber, the title and the
// summary. Both are checked against the shared editorial gate BEFORE anything
// from the row is emitted — a row that trips Tier 4 or Tier 3 is dropped from
// the feed entirely, exactly as it would be dropped from an index page — and
// what survives is then passed through redactForPublicRender(). Gate first,
// redact second: the gate has to see the original wording.
//
// The gate is applied to the emitted text rather than to the whole row body.
// That is deliberate. The feed publishes title + summary and nothing else, so
// those are the strings that must clear the gate; gating on a full article
// body would suppress ordinary reporting for words like "developing" that are
// only meaningful as signals in raw incident copy.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  absoluteUrl,
  type CityConfig,
  escapeHtml,
  HTML_CORS_HEADERS,
  isoDate,
  passesIncidentGate,
  redactForPublicRender,
  resolveCityConfig,
  siteBase,
  storyPath,
  stripTags,
  truncate,
} from "../_shared/renderPage.ts";

// Mirrors the anon RLS policy on content_queue — a subscriber must never see
// anything a logged-out reader could not see on the site itself.
const PUBLIC_STORY_STATUSES = ["published", "auto_published"];

// Never select("*"): content_queue carries internal editorial columns
// (safety_level reasons, source scoring, draft variants) that have no business
// leaving the database.
const STORY_COLUMNS =
  "id, title, summary, content, category, author, publish_date, created_at, updated_at";

/** Entries per feed. Readers want the recent window, not the archive. */
const FEED_LIMIT = 50;

const FEED_PATH = "/feed.xml";

// ---------------------------------------------------------------------------
// XML emission
// ---------------------------------------------------------------------------

// XML 1.0 forbids most C0 control characters outright — no escape sequence can
// represent them. Upstream feed text occasionally carries them, and one is
// enough to make the whole document unparseable, so they are dropped before
// escaping rather than encoded. Tab, newline and carriage return are the only
// control characters the spec permits, and they survive.
// deno-lint-ignore no-control-regex
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

/** Escape a value for an XML text node or a quoted attribute value. */
function xml(value: unknown): string {
  return escapeHtml(String(value ?? "").replace(INVALID_XML_CHARS, ""));
}

function tag(name: string, value: string, attrs = ""): string {
  return `    <${name}${attrs}>${value}</${name}>`;
}

// ---------------------------------------------------------------------------
// Rows -> entries
// ---------------------------------------------------------------------------

type StoryRow = Record<string, unknown>;

type Entry = {
  id: string;
  url: string;
  title: string;
  summary: string;
  updated: string;
  published: string | null;
  category: string | null;
  author: string | null;
};

/**
 * The permanent identifier for an entry. It is the id-only form of the story
 * URL rather than the slugged canonical: the slug is derived from the title,
 * so editing a headline would otherwise mint a new id and every subscriber
 * would see the item a second time. serve-page resolves both forms.
 *
 * Absolute and rooted at the resolved city's domain, so the same story in two
 * cities can never collide.
 */
function entryId(config: CityConfig, id: string): string {
  return absoluteUrl(config, `/stories/${id}`);
}

function toEntry(config: CityConfig, row: StoryRow): Entry | null {
  const id = String(row.id ?? "");
  if (!id) return null;

  const rawTitle = stripTags(row.title);
  if (!rawTitle) return null;

  // The summary a subscriber will see, before the gate looks at it.
  const rawSummary = truncate(stripTags(row.summary) || stripTags(row.content) || rawTitle, 300);

  // Gate on the original wording of exactly the text this entry would publish.
  if (!passesIncidentGate(rawTitle, rawSummary)) {
    console.log(`[serve-feed] gated row withheld from feed: ${id}`);
    return null;
  }

  const updated = isoDate(row.updated_at) ?? isoDate(row.publish_date) ?? isoDate(row.created_at);
  if (!updated) return null;

  return {
    id: entryId(config, id),
    url: absoluteUrl(config, storyPath(id, stripTags(row.title))),
    title: redactForPublicRender(rawTitle),
    summary: redactForPublicRender(rawSummary),
    updated,
    published: isoDate(row.publish_date) ?? isoDate(row.created_at),
    category: stripTags(row.category) || null,
    author: stripTags(row.author) || null,
  };
}

function renderEntry(entry: Entry): string {
  const lines = [
    `  <entry>`,
    tag("id", xml(entry.id)),
    tag("title", xml(entry.title), ` type="text"`),
    `    <link rel="alternate" type="text/html" href="${xml(entry.url)}"/>`,
    tag("updated", xml(entry.updated)),
  ];
  if (entry.published) lines.push(tag("published", xml(entry.published)));
  if (entry.author) {
    lines.push(`    <author><name>${xml(entry.author)}</name></author>`);
  }
  if (entry.category) {
    lines.push(`    <category term="${xml(entry.category)}"/>`);
  }
  lines.push(tag("summary", xml(entry.summary), ` type="text"`));
  lines.push(`  </entry>`);
  return lines.join("\n");
}

/**
 * "Testville, ZZ" — or just "Testville" when the row carries no state code.
 * Interpolating the columns straight into a template literal renders the
 * string "null" for a city_config row whose state_code is unset, and a feed
 * subtitle reading "Local reporting for Testville, null." is a fabricated
 * fact in the one line every newsreader displays under the title.
 */
function placeName(config: CityConfig): string {
  return [config.city_name, config.state_code]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function renderFeed(config: CityConfig, entries: Entry[]): string {
  const self = absoluteUrl(config, FEED_PATH);
  const home = `${siteBase(config)}/`;
  const place = placeName(config);
  const subtitle = place ? `Local reporting for ${place}.` : "Local reporting.";
  // A feed's <updated> is the last time it meaningfully changed. With no
  // entries there is nothing to date but the request itself.
  const updated = entries.length
    ? entries.map((e) => e.updated).sort().reverse()[0]
    : new Date().toISOString();

  return [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<feed xmlns="http://www.w3.org/2005/Atom">`,
    `  <id>${xml(self)}</id>`,
    `  <title type="text">${xml(config.site_name)}</title>`,
    `  <subtitle type="text">${xml(subtitle)}</subtitle>`,
    `  <updated>${xml(updated)}</updated>`,
    `  <link rel="self" type="application/atom+xml" href="${xml(self)}"/>`,
    `  <link rel="alternate" type="text/html" href="${xml(home)}"/>`,
    `  <author><name>${xml(config.site_name)}</name><uri>${xml(siteBase(config))}</uri></author>`,
    ...entries.map(renderEntry),
    `</feed>`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: HTML_CORS_HEADERS });
  }

  let config: CityConfig | null = null;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    config = await resolveCityConfig(supabase, req);

    const { data, error } = await supabase
      .from("content_queue")
      .select(STORY_COLUMNS)
      .eq("city_id", config.id)
      .in("status", PUBLIC_STORY_STATUSES)
      .eq("safety_level", "safe")
      .order("publish_date", { ascending: false, nullsFirst: false })
      .limit(FEED_LIMIT);

    if (error) throw new Error(error.message);

    const entries: Entry[] = [];
    for (const row of (data ?? []) as StoryRow[]) {
      const entry = toEntry(config, row);
      if (entry) entries.push(entry);
    }

    return new Response(renderFeed(config, entries), {
      headers: {
        ...HTML_CORS_HEADERS,
        "Content-Type": "application/atom+xml; charset=utf-8",
        // Newsreaders poll hard. A quarter hour at the edge is well inside the
        // publishing cadence and keeps the database out of the loop.
        "Cache-Control": "public, max-age=900, s-maxage=1800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    // Never emit a half-written document: a truncated feed poisons a reader's
    // cache. Fail loudly with a status the aggregator will retry.
    console.error("[serve-feed] feed generation failed:", err);
    return new Response("feed generation failed", {
      status: 500,
      headers: {
        ...HTML_CORS_HEADERS,
        "Content-Type": "text/plain; charset=utf-8",
        // A 5xx is a transient failure of our own infrastructure. Letting a
        // CDN cache it turns one bad minute into hours of dead feed for every
        // subscriber behind that edge node.
        "Cache-Control": "no-store",
      },
    });
  }
});
