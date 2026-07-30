# The citable incident record

This document is written for a reporter, researcher or editor deciding whether
to trust and cite this data. It is deliberately blunt about what the dataset
does not contain. If you only read one section, read
[What is missing, and why](#what-is-missing-and-why).

---

## What this is

A machine-readable, per-city index of local incidents — weather alerts, road
and traffic events, utility outages, and county sheriff news releases — with the
source of record named for every row.

It exists because the incident record on this site is real and growing but was,
until now, invisible to anything that does not run JavaScript. Every incident
page is client-rendered, so an AI crawler (GPTBot, ClaudeBot, PerplexityBot,
OAI-SearchBot) and any plain HTTP fetch saw an empty `<div id="root">`. These
endpoints serve the record as data instead, and describe it with a
schema.org/Dataset document so it is eligible for indexing in Google Dataset
Search.

**It is a provenance index, not a statistic.** Its job is to help you find and
cite an individual documented event, and to tell you exactly whose record to go
verify it against. It is not built to be counted, and counting it produces a
wrong answer. See below.

---

## Endpoints

Served by the `serve-data` Supabase edge function. It is reachable directly at
the functions host, and at `/data/…` on a city's own domain wherever a host
rewrite is configured:

| Route | Content-Type | What it returns |
| --- | --- | --- |
| `/data/incidents.json` | `application/json` | Paginated records plus the exclusion notice |
| `/data/incidents.csv` | `text/csv` | The same records, RFC 4180 quoted |
| `/data/dataset.json` | `application/ld+json` | schema.org/Dataset description of both |
| `/data/` | `application/json` | Index listing the three routes |

Direct form, if no rewrite is in place:

```
https://<project>.supabase.co/functions/v1/serve-data/incidents.json
https://<project>.supabase.co/functions/v1/serve-data/incidents.csv
https://<project>.supabase.co/functions/v1/serve-data/dataset.json
```

The URLs advertised inside `dataset.json` echo the URL the request actually
arrived on, so whichever form you fetch, the `contentUrl` values you get back
are ones that work.

### Parameters

| Parameter | Default | Notes |
| --- | --- | --- |
| `page` | `1` | 1-based. Capped at 500. |
| `limit` | `100` | Records per page. **Maximum 200**; larger values are clamped, not rejected. |
| `city_id` | resolved from `Host` | Selects a city explicitly. |
| `format` | — | `csv` on the `/incidents` path, as an alternative to the `.csv` suffix. |

This codebase runs many cities from one database and one deployment. The city is
resolved from the request — `?city_id=` first, otherwise the `Host` /
`X-Forwarded-Host` header matched against `city_config.hostname` then
`city_config.site_domain`. No city name, domain or id is hardcoded anywhere in
the endpoint.

`OPTIONS` is answered, and `Access-Control-Allow-Origin: *` is set on every
response, so the endpoints can be fetched from a browser.

### Pagination behaves slightly unusually — read this

Rows are filtered **after** they are retrieved from the database (see the
exclusion rules below). A page therefore returns *at most* `limit` records and
frequently returns fewer — sometimes zero — while more pages remain.

Follow `next_page` until it is `null`. Do not stop when a page comes back short
or empty; that means "everything in this window was excluded", not "the record
has ended". The CSV route signals the same thing with an `X-Next-Page` header.

---

## Fields

Eleven fields per record. Nothing else is published.

| Field | Meaning |
| --- | --- |
| `slug` | Stable identifier and URL path segment. |
| `title` | Short description of the event, personal details redacted. |
| `incident_type` | Coarse category — `weather`, `traffic`, `utility`, `fire`, `other`. |
| `status` | `active`, `developing`, `monitoring` or `resolved`. |
| `started_at` | ISO 8601 timestamp the event was recorded as beginning. |
| `resolved_at` | ISO 8601 timestamp it was recorded as resolved, or `null`. |
| `geo_label` | Coarse geographic label. Not a precise address — see Privacy. |
| `source` | Source-of-record key: `sheriff`, `nws`, `traffic_511`, `utility_outage`. |
| `source_name` | The named publisher of the underlying record. |
| `source_url` | That publisher's official page or feed, or `null` if there isn't one. |
| `url` | The canonical page for this record on the publishing site. |

Two things to be precise about:

- **`source_url` is a feed or index page, not a permalink to the individual
  record.** Most of these publishers do not mint stable per-item URLs. It tells
  you where to go looking; it does not deep-link.
- **`started_at` is when *we* recorded the event as beginning**, derived from the
  source's own timestamp where the source provides one. It is not an official
  dispatch time and should not be cited as one.

There is no incident body, narrative or description field. That is intentional:
narrative text is where names, addresses and unverified detail live.

---

## What is missing, and why

### 1. An editorial gate removes whole categories of incident

Every incident in this system passes a keyword gate before it can be published
(`supabase/functions/_shared/incidentGate.ts`). It is a blunt instrument, applied
without human review, because this site is run by one person across many towns
and an unattended review queue is worse than a filter.

**Tier 4 — rejected outright.** Any text mentioning: arrest, arrested, charged
with, domestic, overdose, suicide, fatality, fatal, deceased, wanted suspect,
manhunt, fugitive, juvenile, minor child, underage.

**Tier 3 — withheld from automatic publication.** Any text mentioning: police
presence, active scene, large response, multiple units, missing person, silver
alert, amber alert, endangered, shots fired, weapons, armed, barricade,
evacuation, fire with injuries, rollover, extrication, medical emergency,
developing, unconfirmed.

The consequence is the single most important fact about this dataset: **it is
systematically censored in precisely the categories a crime reporter would want
to cite.** Violent crime, arrests, drug deaths and incidents involving minors are
structurally absent — not rare, absent.

For this endpoint the gate is applied a second time, and applied more strictly
than on the website: a row is excluded if *any* of its text trips tier 4 **or**
tier 3, including the incident body, which this endpoint never publishes. A row
whose narrative mentions an arrest does not appear here at all, even if its title
is innocuous.

### 2. SpotCrime rows are excluded entirely

The site ingests from SpotCrime for some internal purposes. Its own ingestion
code labels the material `SpotCrime (unverified aggregator)` and writes it with
`is_verified = false`. It is an aggregation of unconfirmed police data, it is not
a source of record, and there is no redistribution right attached to it.

It is excluded twice over: the database query refuses to fetch it, and the
record builder drops it again if it ever arrives by another route.

### 3. Unregistered sources are excluded (fail-closed)

A row is published **only** if its source maps to a registered source of record
whose publisher can be named — currently county sheriff news releases, NOAA/NWS
alerts, state DOT 511 traffic, and electric utility outage feeds. Community tips,
scraped social posts, RSS and email ingestion do not appear.

This is deliberately fail-closed. A new ingestion function has to be admitted to
the citable record on purpose. Nothing gets in by default.

### 4. Only publicly visible statuses appear

Rows in review, rejected rows, and rows marked a false alarm are never included.

---

## Therefore: do not count this data

**Any count, rate, trend or per-capita figure derived from this dataset will be
wrong, and wrong in a specific direction: it will make the town look safer than
the official record.**

The categories that were filtered out are the serious ones. A "total incidents
this month" number computed from these rows is a count of weather alerts, road
closures and power cuts with the violent crime removed. Publishing it as a
measure of local crime or safety would be a factual error and a harmful one.

For that reason the endpoint publishes **no counts of any kind** — no total, no
result count, no dataset size, no aggregate in the JSON, the headers or the
JSON-LD. This is not an oversight to be worked around; it is the point.

For the same reason, a database failure returns **HTTP 503**, never an empty
`records` array. Zero rows would read as zero incidents.

If you need incident counts or a crime rate for this area, request them from the
county sheriff's office or the state's official crime reporting programme. That
is the correct source, and this is not a substitute for it.

---

## Privacy

These are small towns. In a community of a few thousand people a street number
and a date are enough to identify a household, so the endpoint is deliberately
more conservative than the site it draws from.

Every string this endpoint publishes — the title and the geographic label, which
are the only free-text fields — is run through a deterministic redactor
(`supabase/functions/serve-data/redact.ts`) that removes:

- personal names following a rank or honorific, and `First M. Last` name forms
- exact street numbers, reduced to a hundred-block (`1247 W Main St` becomes
  `1200 block of W Main St`)
- rural fire numbers, apartment, unit and suite designators
- ages and `NN-year-old` constructions
- vehicle plate references
- phone numbers and email addresses

Understand what that is and is not. It is a pattern scrubber applied as a last
line of defence to text that has *already* passed the tier-4 and tier-3 gates. It
is not entity recognition and cannot reliably identify an arbitrary name; the
pipeline does not depend on it to, because the titles it publishes are generated
from structured fields by the ingestion functions rather than copied out of a
source narrative. It errs heavily toward over-removing, so you will occasionally
see a redaction that was not necessary.

**A record whose title needed redacting is withheld entirely.** The `slug` field
— and therefore the record's canonical `url` — is generated upstream from the
*unredacted* title, and a slug cannot be scrubbed without ceasing to address the
page it names. Publishing a redacted title beside a slug that still spelled the
name out would defeat the redactor completely, so such records are dropped
instead. This is another reason counts derived from this dataset are invalid.

If you find a record here that identifies a private individual, that is a bug and
a serious one. Report it and it will be removed.

---

## Licence and citation

Records are published under [CC BY 4.0][cc]. You may use, republish and build on
them, including commercially, with attribution.

[cc]: https://creativecommons.org/licenses/by/4.0/

Two caveats that the licence itself does not cover:

- The licence applies to **this compilation** — the selection, structuring,
  redaction and provenance labelling. The underlying facts are public records
  and are not anyone's to license.
- `source_url` points at third-party publishers. Their material is theirs, under
  their own terms.

**Cite the individual record, not the dataset.** Each record's `url` is a real,
canonical page. Verify against the named `source_name` / `source_url` before
publication; treat this index as a finding aid.

Suggested form:

> "Tree down blocking County Highway H", Lake Geneva Brief incident record,
> 14 July 2026, https://lakegenevabrief.com/incidents/tree-down-county-highway-h-abc
> (source of record: NOAA National Weather Service). Retrieved 30 July 2026.

Substitute the `site_name` and `site_domain` of whichever city you fetched.

---

## Known limitations

An honest list, beyond the exclusions above.

1. **Coverage began when ingestion began**, not when the town did.
   `temporalCoverage` in `dataset.json` reports the actual span of records
   present. There is no historical backfill.
2. **`temporalCoverage` describes the span, not its density.** Events inside that
   range are missing wherever the editorial gate removed them. The interval is
   not a promise of continuous coverage.
3. **Ingestion is automated and unattended.** A source that changes its HTML or
   feed format goes quiet. A separate health check watches for sources producing
   zero rows, but a gap in this data may be a gap in ingestion rather than a
   quiet week. Do not infer absence of events from absence of records.
4. **Categories are coarse and machine-assigned.** `incident_type` is inferred by
   the ingestion functions, not assigned by an editor, and is inconsistent across
   sources.
5. **`geo_label` is a label, not a geocode.** It is free text from the source,
   redacted. There are no coordinates in the output. Do not map it.
6. **`status` reflects our last observation, not the world.** Incidents are
   auto-resolved on a timer when a source stops reporting them; `resolved_at` is
   when we stopped tracking it, which may be later than when it actually ended.
7. **Redaction is pattern-based**, with the limits described above.
8. **No stable record identifiers across edits.** `slug` is stable once created,
   but a record can be updated in place, and there is no revision history or
   `dateModified` per record.

---

## Operational notes

For whoever maintains this.

- The function is `supabase/functions/serve-data/`:
  `index.ts` (routing, city resolution, queries, serialisation), `sources.ts`
  (the fail-closed source registry and the SpotCrime exclusion), `redact.ts`
  (the deterministic redactor).
- Tests: `tests/edge/serve-data.test.ts`, run with `npm run test:edge`. They
  cover SpotCrime exclusion, gate exclusion via the unpublished body, redaction,
  CSV escaping and formula-injection neutralisation, bounded pagination, the
  absence of any count, and that the Dataset `description` states the exclusions.
- **Admitting a new source** to the citable record means adding an entry to
  `OFFICIAL_SOURCES` in `sources.ts`. Do it only for a source of record with a
  nameable publisher. Everything else stays out by default.
- **`redactPersonalDetails` currently lives in `serve-data/redact.ts`, not in
  `_shared/incidentGate.ts`.** If a shared redactor lands there, delete
  `redact.ts` and repoint the import in `index.ts` — the exported signature is
  deliberately identical.
- **Still to wire up (not owned by this function):** add the three `/data` URLs
  to the sitemap so Google discovers them, confirm `robots.txt` allows `/data`,
  and add a `/data/*` host rewrite to the edge function so the endpoints are
  reachable on each city's own domain rather than only on the functions host.
  Google Dataset Search wants a crawlable page carrying the Dataset JSON-LD; the
  `/incidents` page linking to `dataset.json` via
  `<link rel="describedby" type="application/ld+json">` is the natural home.
