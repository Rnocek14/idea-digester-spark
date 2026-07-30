# Edge serving — the hosting routes an operator must wire

**Read this first: none of the work described here is live.**

Six edge functions now generate crawler-facing output (`serve-page`,
`serve-data`, `serve-feed`, `serve-sitemap`, `serve-robots`, `serve-llms`).
They are deployed code with **no traffic pointed at them**. A crawler visiting
a city's domain today still gets the Vite SPA shell — an empty
`<div id="root">` — exactly as before.

Making them take effect is an **OPERATOR ACTION**: someone has to add rewrite
rules at the hosting layer (Netlify `_redirects` / `netlify.toml`, Vercel
`rewrites`, or a Cloudflare Worker) for **each city domain in the fleet**.
Until those rules exist, every function below is unreachable at the public path
it was written for, and the only ways to use them are the direct
`/functions/v1/<name>` URLs.

This document lists what needs wiring. It does not wire anything.

---

## Prerequisites

1. **Deploy the functions.** `supabase functions deploy serve-page` (and the
   other five).
2. **JWT verification must be off for all six.** They answer anonymous GETs
   from crawlers that send no `Authorization` header; `verify_jwt` defaults to
   **true**, which would make every one of them return 401. This is already set
   in `supabase/config.toml` — verify it survived deployment, because a 401 here
   fails silently and looks exactly like "the crawler didn't come".
3. Note the project's functions origin: `https://<project-ref>.supabase.co`.

## How the functions resolve a city

Every one of them uses the same helper, `resolveCityConfig()` in
`supabase/functions/_shared/renderPage.ts`, in this order:

1. `?city_id=<id>` if present,
2. otherwise the `Host` / `X-Forwarded-Host` / `X-Original-Host` header, matched
   against `city_config.hostname` then `city_config.site_domain`,
3. otherwise the template city.

**This is what makes the rewrites fleet-safe.** A host-based rewrite needs no
per-city parameter: the proxy must simply forward the original `Host` header
(or set `X-Forwarded-Host`). If your proxy rewrites `Host` to the Supabase
origin — some do by default — city resolution silently falls back to the
template city and **every city serves the template town's content**. Either
preserve the header or pin the city explicitly with `?city_id=`.

---

## Routes to wire

### 1. `/robots.txt` → `serve-robots`

```
/robots.txt  →  https://<project-ref>.supabase.co/functions/v1/serve-robots
```

Until this exists, `public/robots.txt` from the shared `dist/` is served on
every domain. That file has deliberately been made hostname-neutral and carries
**no `Sitemap:` line**, because a `Sitemap:` directive requires an absolute URL
and one absolute URL cannot be correct for more than one city. So until this
route is wired, **submit each city's sitemap manually** in Google Search Console
and Bing Webmaster Tools.

### 2. `/llms.txt` → `serve-llms`

```
/llms.txt  →  https://<project-ref>.supabase.co/functions/v1/serve-llms
```

Same situation: the static `public/llms.txt` fallback is hostname-neutral and
names no city, so until this is wired every city serves a generic document.

### 3. `/sitemap.xml` → `serve-sitemap`

```
/sitemap.xml  →  https://<project-ref>.supabase.co/functions/v1/serve-sitemap
```

Host-resolved, so no `?city_id=` is needed when the `Host` header is preserved.
Note that `dist/sitemap.xml` (written at build time by
`scripts/generate-sitemap.ts`) will otherwise win — check that the rewrite takes
precedence over the static file, since most hosts serve a matching static asset
before applying a rewrite. On Netlify this requires `force = true`.

### 4. `/feed.xml` → `serve-feed`

```
/feed.xml  →  https://<project-ref>.supabase.co/functions/v1/serve-feed
```

`index.html` already advertises `<link rel="alternate" type="application/atom+xml"
href="/feed.xml">`, and `renderHead()` emits the same relative link on
server-rendered pages. **Both of those links are currently dead** — they point
at a path nothing serves until this rewrite exists, which is worse than having
no feed link at all. Wire this or remove the discovery links.

### 5. `/data/*` → `serve-data`

```
/data/*  →  https://<project-ref>.supabase.co/functions/v1/serve-data/:splat
```

The function routes on the tail of the path and answers:

| Public path | Serves |
|---|---|
| `/data/` | Index listing the endpoints below |
| `/data/incidents.json` | Paginated JSON (`?page=`, `?limit=`, max 200) |
| `/data/incidents.csv` | The same records as RFC 4180 CSV |
| `/data/dataset.json` | schema.org `Dataset` descriptor (`application/ld+json`) |

The `Dataset` descriptor is what makes this eligible for **Google Dataset
Search**, and Dataset Search discards a dataset whose `distribution.contentUrl`
values do not resolve. `serve-data` therefore builds those URLs by echoing the
request it just answered — so the advertised URLs are correct for whichever form
was used, but only if the rewrite preserves the path prefix. If you mount it
somewhere other than `/data`, the advertised URLs follow automatically.

### 6. Crawler-facing HTML routes → `serve-page`

These are the routes whose HTML is currently an empty `<div id="root">`:

```
/incidents          →  .../functions/v1/serve-page?path=/incidents
/incidents/archive  →  .../functions/v1/serve-page?path=/incidents/archive
/incidents/*        →  .../functions/v1/serve-page?path=/incidents/:splat
/stories/*          →  .../functions/v1/serve-page?path=/stories/:splat
/today              →  .../functions/v1/serve-page?path=/today
```

`serve-page` accepts the path either as `?path=` or as the tail of its own
request path, so `/functions/v1/serve-page/incidents/foo` works equally well.
Use whichever form your host makes easier.

`/incidents/archive` deserves specific attention: **it does not exist in the SPA
at all.** The React app has no archive route, so with no rewrite that URL renders
the not-found route — a soft 404 — while `serve-sitemap` lists it. Wiring this
route is what creates the archive.

#### Serve to crawlers only, or to everyone?

Two defensible choices; pick deliberately.

- **Everyone (simplest, recommended).** All visitors get the server-rendered
  HTML. It is real HTML with working links, and `serve-page` includes a link to
  the SPA equivalent. No cloaking risk, no user-agent list to maintain.
- **Crawlers only,** by branching the rewrite on `User-Agent` (`Googlebot`,
  `GPTBot`, `ClaudeBot`, `PerplexityBot`, `OAI-SearchBot`, `Bingbot`). This
  keeps the SPA experience for humans, but serving different content by
  user-agent is cloaking-adjacent. It is acceptable only if the two versions
  carry the *same* content. If you take this path, keep them in sync.

Do **not** serve `serve-page` output to humans on some routes and the SPA on
others without checking that canonical URLs agree — both emit a canonical built
from `city_config.site_domain`, so they should, but verify after wiring.

---

## Verifying a wire-up

For each city domain, after adding the rules:

```bash
curl -sS https://<city-domain>/robots.txt              | head -5
curl -sS https://<city-domain>/llms.txt                | head -5
curl -sS https://<city-domain>/feed.xml                | head -5
curl -sS https://<city-domain>/data/dataset.json       | head -20
curl -sS https://<city-domain>/incidents               | head -40
curl -sS https://<city-domain>/incidents/archive       | head -40
```

Check specifically that:

- Nothing returns **401** (that is `verify_jwt`, see prerequisites).
- The `<link rel="canonical">` and every absolute URL name **that city's own
  domain** — not another city's, and not the Supabase functions host. This is
  the single failure mode most likely to go unnoticed, and it means the `Host`
  header is not reaching the function.
- `/data/dataset.json` reports the correct `spatialCoverage` for that city.
- `/incidents` returns HTML containing actual incident titles with **no
  `<script>` tag required** to see them — that is the entire point.

## Known fleet hazards in the shared `dist/`

`public/robots.txt` and `public/llms.txt` were rewritten to be hostname-neutral,
because everything in `dist/` is served on **every** city domain. Two files in
that same shared output still name one city and were **not** changed, because
fixing them safely means removing the template city's only working version
before the rewrites above exist. Both are live issues for city #2, and both are
resolved by wiring the routes above.

1. **`dist/sitemap.xml`** is generated at build time by
   `scripts/generate-sitemap.ts`, which hardcodes
   `const BASE_URL = "https://lakegenevabrief.com"` and a fixed list of
   `lake-geneva-*` guide paths. Served on another city's domain it advertises
   ~38 absolute URLs pointing at a different town. Wiring `/sitemap.xml` →
   `serve-sitemap` **with `force = true`** replaces it; until then, do not add a
   second city.
2. **`index.html`** carries two static JSON-LD blocks (`NewsMediaOrganization`,
   `WebSite`) naming one city and domain. The prerenderer strips the static
   `<title>`/OG tags it supersedes per page, but it does **not** strip these two
   blocks — they are present in all 39 prerendered files and would be present on
   city #2's pages too. Helmet-driven canonicals and OG tags are correct per
   city; the organisation schema is not. `serve-page` output does not have this
   problem (its head is built entirely from `city_config`), which is another
   reason to prefer serving it to everyone.

## What is still not wired by any of this

- **`/guides/*` and the other hand-written editorial routes** are React
  components and remain client-rendered. `serve-page` covers database-backed
  routes only.
- **Per-city guides do not exist.** `_shared/siteRoutes.ts` emits the guide
  routes for the template city only, deliberately — there is no generator that
  produces a guide for city #2, so advertising those URLs on another city's
  domain would submit URLs that render the wrong town's prose or a 404.
- **Prerendering covers a different set of routes.** `scripts/prerender.mjs`
  runs as `postbuild`, drives a real browser over a **fixed array** of 39 routes
  and writes `dist/<route>/index.html`. That handles the static and guide pages
  well, and it is why those pages have working social previews. But the array is
  hardcoded: it never enumerates a database row, so `/incidents/{slug}`,
  `/stories/{...}` and `/incidents/archive` get no prerendered HTML — which is
  precisely the gap `serve-page` fills. The two are complementary, not
  alternatives:

  | Surface | Covered by |
  |---|---|
  | Home, guides, `/incidents`, `/today`, other fixed routes | prerender (build time) |
  | `/incidents/{slug}`, `/stories/{...}`, `/incidents/archive` | `serve-page` (request time), once wired |

  Because prerendering runs a browser against `127.0.0.1`, it sets
  `window.__SITE_ORIGIN__` before the app boots so canonicals carry the
  production host. `tests/seo/meta.test.ts` asserts no prerendered file contains
  a localhost canonical — keep that test passing if you touch either file.
