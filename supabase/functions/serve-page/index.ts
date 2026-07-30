// serve-page — real, crawlable HTML for database-backed pages.
//
// THE PRECONDITION. The reader site is a Vite SPA, so every URL the sitemap
// submits (up to 500 incidents and 1,000 stories) currently resolves to an
// empty <div id="root">. Googlebot renders JS on its own schedule; GPTBot,
// ClaudeBot, PerplexityBot and OAI-SearchBot never do. This function serves
// the same URLs as static HTML: no script tags, no external stylesheet,
// readable by a crawler that executes nothing.
//
// ROUTES (from ?path= or the request path)
//   /incidents                index of current incidents
//   /incidents/archive        paginated historical archive (?page=N)
//   /incidents/{slug}         one incident with its updates
//   /stories/{slug}-{uuid}    one story from content_queue
//   /today                    the daily brief
//
// FLEET-SAFE: the city is resolved per request (?city_id=, then Host, then the
// default row) and every absolute URL comes from that city's site_domain.
//
// PRIVACY: incident text is gated with tier4Match/tier3Match and passed
// through redactForPublicRender before it can appear. A row that trips the
// gate 404s on a detail route and is omitted from every index. This is a town
// of 8,000; a name, an exact street number, an age or a plate is not
// publishable here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  absoluteUrl,
  articleJsonLd,
  breadcrumbJsonLd,
  type CityConfig,
  collectionPageJsonLd,
  displayDate,
  escapeAttr,
  escapeHtml,
  extractStoryId,
  HTML_CORS_HEADERS,
  hostOf,
  htmlResponse,
  isoDate,
  localDateKey,
  newsArticleJsonLd,
  passesIncidentGate,
  redactForPublicRender,
  renderDocument,
  renderError,
  renderNotFound,
  requestedPath,
  resolveCityConfig,
  safeExternalUrl,
  storyPath,
  stripTags,
  toParagraphs,
  truncate,
} from "../_shared/renderPage.ts";

// Statuses an anonymous reader is allowed to see, mirroring the incidents RLS
// policy in 20260718120000_harden_incidents_rls.sql.
const PUBLIC_INCIDENT_STATUSES = ["active", "developing", "monitoring", "resolved"];
const PUBLIC_STORY_STATUSES = ["published", "auto_published"];

// NEVER select("*") on incidents — the table is anon-readable row-wise and a
// wildcard is how internal columns (hold_reason, original_body, confidence)
// leak onto a public surface.
const INCIDENT_COLUMNS =
  "id, slug, title, incident_type, sub_type, status, location, started_at, updated_at, resolved_at, ai_rewrite, body, source, source_type";
// ai_rewrite and body are NOT rendered in a list, but they ARE part of the
// gate input on the detail route. Selecting them here keeps the gate decision
// identical everywhere: without them an index would link to a row whose body
// trips Tier 4, i.e. publish an internal link (and a JSON-LD ItemList entry,
// and a sitemap URL) pointing straight at a 404.
const INCIDENT_LIST_COLUMNS =
  "slug, title, incident_type, sub_type, status, location, started_at, updated_at, resolved_at, ai_rewrite, body";
const STORY_COLUMNS =
  "id, title, summary, content, category, image_url, original_url, publish_date, created_at, updated_at, author, geo_label";

const INDEX_LIMIT = 60;
const ARCHIVE_PAGE_SIZE = 50;
// The archive reads one window and paginates in memory. Rows removed by the
// editorial gate would otherwise punch holes in offset pagination, and the
// mock-free alternative (range()) can't express "page N of the gated set".
const ARCHIVE_WINDOW = 1500;
const ARCHIVE_MAX_PAGE = Math.ceil(ARCHIVE_WINDOW / ARCHIVE_PAGE_SIZE);

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  developing: "Developing",
  monitoring: "Monitoring",
  resolved: "Resolved",
  false_alarm: "False alarm",
};

// Keys are the literal `incidents.source` values the ingestion functions write
// (see sync-sheriff-releases, sync-spotcrime-incidents, sync-nws-alerts,
// sync-511-traffic). Anything not listed falls through to the source's own
// name, which is the honest answer — inventing a description for a source we
// cannot characterise would be a claim we cannot stand behind.
const SOURCE_LABELS: Record<string, string> = {
  sheriff: "County sheriff news release",
  spotcrime: "SpotCrime aggregated police data",
  nws: "National Weather Service",
  wi511: "State 511 traffic system",
  community: "Reader report",
};

type IncidentRow = Record<string, any>;

function humanize(value: unknown): string {
  return stripTags(value).replace(/[_-]+/g, " ").trim();
}

function statusLabel(status: unknown): string {
  const s = String(status ?? "");
  return STATUS_LABELS[s] ?? humanize(s) ?? "";
}

function sourceLabel(row: IncidentRow): string | null {
  const raw = String(row.source ?? row.source_type ?? "").trim();
  if (!raw) return null;
  // Lower-case for the LOOKUP only. `incidents.source` is free text (the
  // sources row's own name, e.g. "Walworth County Sheriff"), so lower-casing
  // the fallback printed "Source of record: walworth county sheriff."
  return SOURCE_LABELS[raw.toLowerCase()] ?? humanize(raw);
}

/**
 * Everything from an incident row that could become visible text. If any of it
 * trips the gate, nothing from the row is published.
 */
function incidentGateInput(row: IncidentRow): unknown[] {
  return [
    row.title,
    row.ai_rewrite,
    row.body,
    row.location,
    row.sub_type,
    row.incident_type,
    // The rendered page humanizes these, so "medical_emergency" becomes
    // "medical emergency" — gate the displayed form as well as the raw one.
    humanize(row.sub_type),
    humanize(row.incident_type),
  ];
}

function incidentIsPublic(row: IncidentRow): boolean {
  if (!row?.slug) return false;
  return passesIncidentGate(...incidentGateInput(row));
}

function incidentPath(row: IncidentRow): string {
  return `/incidents/${row.slug}`;
}

function renderIncidentList(config: CityConfig, rows: IncidentRow[]): string {
  if (!rows.length) {
    return `<p class="lede">No incidents are on the public record for this period.</p>`;
  }
  const items = rows
    .map((row) => {
      const title = redactForPublicRender(stripTags(row.title));
      const started = isoDate(row.started_at);
      return `      <li>
        <a href="${escapeAttr(absoluteUrl(config, incidentPath(row)))}">${escapeHtml(title)}</a>
        <span class="sub">${
          started
            ? `<time datetime="${escapeAttr(started)}">${escapeHtml(
                displayDate(row.started_at, config.timezone)
              )}</time> <span class="dot">·</span> `
            : ""
        }${escapeHtml(
        [statusLabel(row.status), redactForPublicRender(stripTags(row.location))]
          .filter(Boolean)
          .join(" · ")
      )}</span>
      </li>`;
    })
    .join("\n");
  return `    <ul class="items">\n${items}\n    </ul>`;
}

// ---------------------------------------------------------------------------
// /incidents — current record
// ---------------------------------------------------------------------------

async function renderIncidentsIndex(
  supabase: any,
  config: CityConfig,
  path: string
): Promise<Response> {
  const { data, error } = await supabase
    .from("incidents")
    .select(INCIDENT_LIST_COLUMNS)
    .eq("city_id", config.id)
    .in("status", PUBLIC_INCIDENT_STATUSES)
    .not("slug", "is", null)
    .order("updated_at", { ascending: false })
    .limit(INDEX_LIMIT);

  if (error) {
    console.error("[serve-page] incidents index query failed:", error.message);
    return renderError(config, path);
  }

  const rows = (data ?? []).filter(incidentIsPublic);
  const place = `${config.city_name}, ${config.state_code}`;
  const title = `Current incidents in ${place}`;
  const description = `Road closures, fires, weather events and police activity currently on the public record in ${place}, compiled by ${config.site_name} from official sources.`;

  const crumbs = [
    { name: config.site_name, path: "/" },
    { name: "Incidents", path: "/incidents" },
  ];

  const body = `
    <h1>${escapeHtml(title)}</h1>
    <p class="lede">${escapeHtml(
      `Incidents ${config.site_name} is currently tracking in ${place}. Each entry links to its own page with the updates recorded against it.`
    )}</p>
    <p class="meta">${escapeHtml(
      `${rows.length} incident${rows.length === 1 ? "" : "s"} on the current record`
    )}<span class="dot">·</span>Updated ${escapeHtml(
    displayDate(new Date().toISOString(), config.timezone, { withTime: true })
  )}</p>
${renderIncidentList(config, rows)}
    <p class="note">Entries are compiled from official and public sources and are summarised, not transcribed. Names, exact addresses and other identifying detail are withheld. Records that fall outside what we publish are not listed here. For the historical record, see the <a href="${escapeAttr(
      absoluteUrl(config, "/incidents/archive")
    )}">incident archive</a>.</p>`;

  const html = renderDocument(config, {
    meta: {
      title: `${title} — ${config.site_name}`,
      description,
      path: "/incidents",
      ogType: "website",
      jsonLd: [
        collectionPageJsonLd(config, {
          name: title,
          description,
          path: "/incidents",
          items: rows.map((r) => ({
            name: redactForPublicRender(stripTags(r.title)),
            path: incidentPath(r),
          })),
        }),
        breadcrumbJsonLd(config, crumbs),
      ],
    },
    body,
    breadcrumbs: crumbs,
    spaPath: "/incidents",
  });
  return htmlResponse(html);
}

// ---------------------------------------------------------------------------
// /incidents/archive?page=N — the historical record the SPA never exposed
// ---------------------------------------------------------------------------

async function renderIncidentArchive(
  supabase: any,
  config: CityConfig,
  path: string,
  pageParam: string | null
): Promise<Response> {
  const requested = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isFinite(requested) && requested > 0 ? Math.min(requested, ARCHIVE_MAX_PAGE) : 1;

  const { data, error } = await supabase
    .from("incidents")
    .select(INCIDENT_LIST_COLUMNS)
    .eq("city_id", config.id)
    .in("status", PUBLIC_INCIDENT_STATUSES)
    .not("slug", "is", null)
    .order("started_at", { ascending: false })
    .limit(ARCHIVE_WINDOW);

  if (error) {
    console.error("[serve-page] incident archive query failed:", error.message);
    return renderError(config, path);
  }

  const all = (data ?? []).filter(incidentIsPublic);
  const totalPages = Math.max(1, Math.ceil(all.length / ARCHIVE_PAGE_SIZE));
  // Page 1 always renders (an empty archive is a real, indexable page). Any
  // page past the end 404s — including when the archive is empty, which
  // otherwise served "Page 30 of 1" at a self-canonical ?page=30.
  if (page > 1 && page > totalPages) {
    return renderNotFound(config, {
      path,
      heading: "That archive page doesn't exist",
      message: `The incident archive currently runs to ${totalPages} page${
        totalPages === 1 ? "" : "s"
      }.`,
    });
  }
  const start = (page - 1) * ARCHIVE_PAGE_SIZE;
  const rows = all.slice(start, start + ARCHIVE_PAGE_SIZE);

  const place = `${config.city_name}, ${config.state_code}`;
  const suffix = page > 1 ? ` — page ${page}` : "";
  const title = `Incident archive for ${place}${suffix}`;
  const description = `The historical record of incidents in ${place}: road closures, fires, weather events and police activity, oldest to newest, compiled by ${config.site_name}.`;
  const selfPath = page > 1 ? `/incidents/archive?page=${page}` : "/incidents/archive";
  const prevPath =
    page > 2 ? `/incidents/archive?page=${page - 1}` : page === 2 ? "/incidents/archive" : null;
  const nextPath = page < totalPages ? `/incidents/archive?page=${page + 1}` : null;

  const crumbs = [
    { name: config.site_name, path: "/" },
    { name: "Incidents", path: "/incidents" },
    { name: "Archive", path: "/incidents/archive" },
  ];

  const oldest = rows.length ? rows[rows.length - 1].started_at : null;
  const newest = rows.length ? rows[0].started_at : null;
  const rangeLine =
    newest && oldest
      ? `${displayDate(oldest, config.timezone)} – ${displayDate(newest, config.timezone)}`
      : "";

  const body = `
    <h1>${escapeHtml(title)}</h1>
    <p class="lede">${escapeHtml(
      `Every incident ${config.site_name} has recorded in ${place} that we are able to publish, newest first.`
    )}</p>
    <p class="meta">${escapeHtml(
      `Page ${page} of ${totalPages}`
    )}${rangeLine ? `<span class="dot">·</span>${escapeHtml(rangeLine)}` : ""}</p>
${renderIncidentList(config, rows)}
    <nav class="pager" aria-label="Archive pages">
      ${
        prevPath
          ? `<a href="${escapeAttr(absoluteUrl(config, prevPath))}">&larr; Newer incidents</a>`
          : "<span></span>"
      }
      ${
        nextPath
          ? `<a href="${escapeAttr(absoluteUrl(config, nextPath))}">Older incidents &rarr;</a>`
          : "<span></span>"
      }
    </nav>
    <p class="note">The archive is a summary record compiled from official and public sources, not a legal or complete account. Identifying detail is withheld and records that fall outside what we publish are not listed. Corrections are welcome.</p>`;

  const html = renderDocument(config, {
    meta: {
      title: `${title} — ${config.site_name}`,
      description,
      path: selfPath,
      ogType: "website",
      prevPath,
      nextPath,
      jsonLd: [
        collectionPageJsonLd(config, {
          name: title,
          description,
          path: selfPath,
          items: rows.map((r) => ({
            name: redactForPublicRender(stripTags(r.title)),
            path: incidentPath(r),
          })),
        }),
        breadcrumbJsonLd(config, crumbs),
      ],
    },
    body,
    breadcrumbs: crumbs,
    spaPath: "/incidents",
    spaLabel: `Open current incidents on ${config.site_name}`,
  });
  return htmlResponse(html);
}

// ---------------------------------------------------------------------------
// /incidents/{slug}
// ---------------------------------------------------------------------------

async function renderIncidentDetail(
  supabase: any,
  config: CityConfig,
  path: string,
  slug: string
): Promise<Response> {
  const { data, error } = await supabase
    .from("incidents")
    .select(INCIDENT_COLUMNS)
    .eq("city_id", config.id)
    .eq("slug", slug)
    .in("status", PUBLIC_INCIDENT_STATUSES)
    .maybeSingle();

  if (error) {
    console.error("[serve-page] incident detail query failed:", error.message);
    return renderError(config, path);
  }
  if (!data) return renderNotFound(config, { path });

  // The gate is checked BEFORE anything from the row is rendered. A row that
  // trips it is indistinguishable from a row that does not exist.
  if (!incidentIsPublic(data)) {
    console.log(`[serve-page] gated incident withheld: ${slug}`);
    return renderNotFound(config, { path });
  }

  const title = redactForPublicRender(stripTags(data.title));
  const rawBody = data.ai_rewrite || data.body || "";
  const bodyText = redactForPublicRender(rawBody);
  const location = redactForPublicRender(stripTags(data.location));
  const started = isoDate(data.started_at);
  const updated = isoDate(data.updated_at);
  const resolved = isoDate(data.resolved_at);

  const { data: updateRows } = await supabase
    .from("incident_updates")
    .select("id, created_at, source, source_label, text, is_verified")
    .eq("incident_id", data.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Each update is gated independently: one unpublishable update does not
  // suppress the incident, it just isn't shown.
  // u.source is gated too: when source_label is null it becomes the rendered
  // attribution line, so it is visible text and must clear the same gate.
  const updates = (updateRows ?? []).filter((u: Record<string, any>) =>
    passesIncidentGate(u.text, u.source_label, u.source)
  );

  const place = `${config.city_name}, ${config.state_code}`;
  const description =
    truncate(bodyText, 200) ||
    `${statusLabel(data.status)} ${humanize(data.incident_type)} incident recorded in ${place}${
      location ? ` near ${location}` : ""
    } by ${config.site_name}.`;

  const attribution = sourceLabel(data);
  const crumbs = [
    { name: config.site_name, path: "/" },
    { name: "Incidents", path: "/incidents" },
    { name: title, path: incidentPath(data) },
  ];

  const metaBits: string[] = [];
  if (started) {
    metaBits.push(
      `<time datetime="${escapeAttr(started)}">${escapeHtml(
        displayDate(data.started_at, config.timezone, { withTime: true })
      )}</time>`
    );
  }
  metaBits.push(`<span class="tag">${escapeHtml(statusLabel(data.status))}</span>`);
  if (data.incident_type) metaBits.push(escapeHtml(humanize(data.incident_type)));
  if (location) metaBits.push(escapeHtml(location));

  const updatesHtml = updates.length
    ? `    <h2>Updates</h2>
    <ol class="updates">
${updates
  .map((u: Record<string, any>) => {
    const at = isoDate(u.created_at);
    const label = redactForPublicRender(stripTags(u.source_label || u.source || ""));
    return `      <li>
        ${
          at
            ? `<time datetime="${escapeAttr(at)}">${escapeHtml(
                displayDate(u.created_at, config.timezone, { withTime: true })
              )}</time>`
            : ""
        }
${toParagraphs(redactForPublicRender(u.text))}
        ${
          label
            ? `<p class="sub">${escapeHtml(
                `${label}${u.is_verified ? " · verified against the source" : " · unverified"}`
              )}</p>`
            : ""
        }
      </li>`;
  })
  .join("\n")}
    </ol>`
    : "";

  const body = `
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">${metaBits.join('<span class="dot">·</span>')}${
    resolved
      ? `<span class="dot">·</span>Resolved <time datetime="${escapeAttr(resolved)}">${escapeHtml(
          displayDate(data.resolved_at, config.timezone)
        )}</time>`
      : ""
  }</p>
${bodyText ? toParagraphs(bodyText) : `<p class="lede">${escapeHtml(
      `No narrative summary was recorded for this incident. The status, time and location above are the full extent of the record.`
    )}</p>`}
${updatesHtml}
    <p class="source">${escapeHtml(
      attribution
        ? `Source of record: ${attribution}.`
        : "Source of record: compiled from official and public sources."
    )} ${escapeHtml(
    `Summarised by ${config.site_name}; names, exact addresses and other identifying detail are withheld.`
  )}${
    updated
      ? ` Last updated <time datetime="${escapeAttr(updated)}">${escapeHtml(
          displayDate(data.updated_at, config.timezone, { withTime: true })
        )}</time>.`
      : ""
  }</p>`;

  const html = renderDocument(config, {
    meta: {
      title: `${title} — ${config.site_name}`,
      description,
      path: incidentPath(data),
      ogType: "article",
      publishedTime: started,
      modifiedTime: updated,
      jsonLd: [
        // Plain Article: schema.org has no incident type and inventing one is
        // worse than being generic.
        articleJsonLd(config, {
          headline: title,
          description,
          path: incidentPath(data),
          datePublished: started,
          dateModified: updated,
          sectionName: "Incidents",
        }),
        breadcrumbJsonLd(config, crumbs),
      ],
    },
    body,
    breadcrumbs: crumbs,
    spaPath: incidentPath(data),
  });
  return htmlResponse(html);
}

// ---------------------------------------------------------------------------
// /stories/{slug}-{uuid}
// ---------------------------------------------------------------------------

async function renderStoryDetail(
  supabase: any,
  config: CityConfig,
  path: string,
  id: string
): Promise<Response> {
  const { data, error } = await supabase
    .from("content_queue")
    .select(STORY_COLUMNS)
    .eq("city_id", config.id)
    .eq("id", id)
    .in("status", PUBLIC_STORY_STATUSES)
    .eq("safety_level", "safe")
    .maybeSingle();

  if (error) {
    console.error("[serve-page] story query failed:", error.message);
    return renderError(config, path);
  }
  if (!data) return renderNotFound(config, { path });

  const title = stripTags(data.title);
  const canonicalPath = storyPath(data.id, data.title);
  const summary = stripTags(data.summary);
  const bodyText = String(data.content ?? "");
  const description = truncate(summary || bodyText || title, 200);
  const published = isoDate(data.publish_date || data.created_at);
  const modified = isoDate(data.updated_at);
  const outbound = safeExternalUrl(data.original_url);
  const outboundHost = hostOf(data.original_url);
  const place = stripTags(data.geo_label) || `${config.city_name}, ${config.state_code}`;

  const crumbs = [
    { name: config.site_name, path: "/" },
    { name: "Stories", path: "/today" },
    { name: title, path: canonicalPath },
  ];

  const metaBits: string[] = [];
  if (published) {
    metaBits.push(
      `<time datetime="${escapeAttr(published)}">${escapeHtml(
        displayDate(data.publish_date || data.created_at, config.timezone)
      )}</time>`
    );
  }
  if (data.category) metaBits.push(escapeHtml(humanize(data.category)));
  if (place) metaBits.push(escapeHtml(place));
  if (data.author) metaBits.push(escapeHtml(`By ${stripTags(data.author)}`));

  const body = `
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">${metaBits.join('<span class="dot">·</span>')}</p>
${summary ? `<p class="lede">${escapeHtml(summary)}</p>` : ""}
${toParagraphs(bodyText)}
    <p class="source">${
      outbound
        ? `Source of record: <a href="${escapeAttr(outbound)}" rel="nofollow noopener">${escapeHtml(
            outboundHost ?? outbound
          )}</a>. ${escapeHtml(
            `${config.site_name} summarises; the full account stays with the original publisher.`
          )}`
        : escapeHtml(`Reported by ${config.site_name} from local sources.`)
    }${
    modified
      ? ` Last updated <time datetime="${escapeAttr(modified)}">${escapeHtml(
          displayDate(data.updated_at, config.timezone)
        )}</time>.`
      : ""
  }</p>`;

  const html = renderDocument(config, {
    meta: {
      title: `${title} — ${config.site_name}`,
      description,
      path: canonicalPath,
      ogType: "article",
      imageUrl: data.image_url,
      publishedTime: published,
      modifiedTime: modified,
      jsonLd: [
        newsArticleJsonLd(config, {
          headline: title,
          description,
          path: canonicalPath,
          datePublished: published,
          dateModified: modified,
          imageUrl: data.image_url,
          authorName: data.author,
          basedOnUrl: data.original_url,
          sectionName: data.category ? humanize(data.category) : null,
        }),
        breadcrumbJsonLd(config, crumbs),
      ],
    },
    body,
    breadcrumbs: crumbs,
    spaPath: canonicalPath,
  });
  return htmlResponse(html);
}

// ---------------------------------------------------------------------------
// /today — the daily brief
// ---------------------------------------------------------------------------

async function renderToday(
  supabase: any,
  config: CityConfig,
  path: string
): Promise<Response> {
  const todayKey = localDateKey(new Date(), config.timezone);

  const { data: brief, error: briefError } = await supabase
    .from("daily_briefs")
    .select("brief_date, body, is_quiet_day, updated_at")
    .eq("city_id", config.id)
    .eq("status", "published")
    .eq("brief_date", todayKey)
    .maybeSingle();

  if (briefError) {
    console.error("[serve-page] daily brief query failed:", briefError.message);
  }

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: storyRows } = await supabase
    .from("content_queue")
    .select("id, title, summary, category, publish_date, created_at")
    .eq("city_id", config.id)
    .in("status", PUBLIC_STORY_STATUSES)
    .eq("safety_level", "safe")
    .neq("category", "events")
    .gte("created_at", since)
    .order("priority_score", { ascending: false, nullsFirst: false })
    .order("publish_date", { ascending: false, nullsFirst: false })
    .limit(10);
  const stories = storyRows ?? [];

  const { data: incidentRows } = await supabase
    .from("incidents")
    .select(INCIDENT_LIST_COLUMNS)
    .eq("city_id", config.id)
    .in("status", ["active", "developing", "monitoring"])
    .not("slug", "is", null)
    .order("updated_at", { ascending: false })
    .limit(10);
  const incidents = (incidentRows ?? []).filter(incidentIsPublic);

  const place = `${config.city_name}, ${config.state_code}`;
  const dateLabel = displayDate(new Date().toISOString(), config.timezone);
  const title = `${place} today — ${dateLabel}`;
  const description = `Today in ${place}: the daily brief from ${config.site_name}, the stories filed in the last 48 hours, and any incidents currently being tracked.`;

  const crumbs = [
    { name: config.site_name, path: "/" },
    { name: "Today", path: "/today" },
  ];

  const briefBody = String(brief?.body ?? "").trim();
  const briefSection = briefBody
    ? `    <h2>The brief</h2>
${toParagraphs(briefBody)}
    <p class="sub">${escapeHtml(
      `Written for ${displayDate(brief.brief_date, config.timezone)} by ${config.site_name}.`
    )}</p>`
    : `    <p class="note">${escapeHtml(
        `Today's brief hasn't been filed yet. The stories and incidents below are current as of the timestamp above.`
      )}</p>`;

  const storySection = stories.length
    ? `    <h2>Filed in the last 48 hours</h2>
    <ul class="items">
${stories
  .map((s: Record<string, any>) => {
    const when = isoDate(s.publish_date || s.created_at);
    return `      <li>
        <a href="${escapeAttr(
          absoluteUrl(config, storyPath(s.id, s.title))
        )}">${escapeHtml(stripTags(s.title))}</a>
        <span class="sub">${
          when
            ? `<time datetime="${escapeAttr(when)}">${escapeHtml(
                displayDate(s.publish_date || s.created_at, config.timezone)
              )}</time>`
            : ""
        }${s.category ? ` <span class="dot">·</span> ${escapeHtml(humanize(s.category))}` : ""}${
      s.summary ? `<br>${escapeHtml(truncate(s.summary, 160))}` : ""
    }</span>
      </li>`;
  })
  .join("\n")}
    </ul>`
    : `    <h2>Filed in the last 48 hours</h2>
    <p>No stories have been filed in the last 48 hours.</p>`;

  const incidentSection = incidents.length
    ? `    <h2>Incidents being tracked</h2>
${renderIncidentList(config, incidents)}`
    : `    <h2>Incidents being tracked</h2>
    <p>Nothing is currently being tracked. The <a href="${escapeAttr(
      absoluteUrl(config, "/incidents/archive")
    )}">archive</a> has the historical record.</p>`;

  const nowIso = new Date().toISOString();
  const body = `
    <h1>${escapeHtml(`Today in ${config.city_name}`)}</h1>
    <p class="meta"><time datetime="${escapeAttr(nowIso)}">${escapeHtml(
    displayDate(nowIso, config.timezone, { withTime: true })
  )}</time><span class="dot">·</span>${escapeHtml(place)}</p>
${briefSection}
${storySection}
${incidentSection}`;

  const html = renderDocument(config, {
    meta: {
      title: `${title} — ${config.site_name}`,
      description,
      path: "/today",
      ogType: "website",
      modifiedTime: isoDate(brief?.updated_at) ?? nowIso,
      jsonLd: [
        collectionPageJsonLd(config, {
          name: title,
          description,
          path: "/today",
          items: stories.map((s: Record<string, any>) => ({
            name: stripTags(s.title),
            path: storyPath(s.id, s.title),
          })),
        }),
        breadcrumbJsonLd(config, crumbs),
      ],
    },
    body,
    breadcrumbs: crumbs,
    spaPath: "/today",
  });
  return htmlResponse(html);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * decodeURIComponent throws URIError on a malformed escape ("/incidents/a%zz").
 * A garbage URL is a 404, not a 500 — and a 500 is what the unhandled throw
 * produced before this existed.
 */
function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

async function route(
  supabase: any,
  config: CityConfig,
  req: Request,
  path: string
): Promise<Response> {
  let params: URLSearchParams;
  try {
    params = new URL(req.url).searchParams;
  } catch {
    params = new URLSearchParams();
  }

  if (path === "/today") return await renderToday(supabase, config, path);
  if (path === "/incidents") return await renderIncidentsIndex(supabase, config, path);
  if (path === "/incidents/archive") {
    return await renderIncidentArchive(supabase, config, path, params.get("page"));
  }

  const incidentMatch = path.match(/^\/incidents\/([^/]+)$/);
  if (incidentMatch) {
    const slug = safeDecode(incidentMatch[1]);
    if (slug === null) return renderNotFound(config, { path });
    return await renderIncidentDetail(supabase, config, path, slug);
  }

  const storyMatch = path.match(/^\/stories\/([^/]+)$/);
  if (storyMatch) {
    const raw = safeDecode(storyMatch[1]);
    if (raw === null) return renderNotFound(config, { path });
    const id = extractStoryId(raw);
    if (!id) return renderNotFound(config, { path });
    return await renderStoryDetail(supabase, config, path, id);
  }

  return renderNotFound(config, { path });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: HTML_CORS_HEADERS });
  }

  const path = requestedPath(req);
  let config: CityConfig | null = null;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    config = await resolveCityConfig(supabase, req);
    return await route(supabase, config, req, path);
  } catch (error) {
    // Never leak a Postgres or runtime error into the response body.
    console.error("[serve-page] unhandled error:", error);
    if (config) return renderError(config, path);
    return new Response(
      "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Temporarily unavailable</title></head><body><h1>Temporarily unavailable</h1><p>This page could not be loaded. Please try again shortly.</p></body></html>",
      {
        status: 500,
        headers: {
          ...HTML_CORS_HEADERS,
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60",
        },
      }
    );
  }
});
