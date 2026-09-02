// Post-build prerender: renders routes in a real browser and writes the
// resulting HTML to dist/<route>/index.html.
//
// Why: the app is a client-rendered SPA. Google can execute JS but does it
// slower and less reliably, and most other crawlers (Facebook, Twitter/X,
// LinkedIn, Slack link previews) don't execute JS at all — so every shared
// link previews as the generic site card and non-Google bots see an empty
// <div id="root">. Prerendering bakes the real content AND the per-page
// meta/OG/JSON-LD (injected by react-helmet-async) into static HTML.
//
// Runs as `postbuild`, in the SAME build, so the hashed asset URLs it captures
// always match the bundle that was just produced. If Playwright isn't
// installed in the build environment this NO-OPS and the build succeeds
// unchanged — prerendering is an enhancement, never a build dependency.
//
// Usage:  npm run build          (prerender runs automatically if available)
//         npm run prerender      (re-run against an existing dist/)

import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DIST = join(ROOT, 'dist')
const PORT = 4179
const NAV_TIMEOUT_MS = 20000
const SETTLE_MS = 400
// Floors for "did we actually capture the page, or a loading state?".
// A rendered guide runs to thousands of characters, so it gets a real floor. Other
// static pages (the legal pages especially) are legitimately short, and there the only
// thing worth catching is a baked-in spinner, which renders near-empty.
const MIN_GUIDE_TEXT = 1200
const MIN_STATIC_TEXT = 500

// Routes whose content is static (no database needed) — these get the full
// benefit and are correct regardless of where the build runs.
const STATIC_ROUTES = [
  '/about', '/privacy', '/terms',
  '/guides',
  '/guides/lake-geneva-shore-path',
  '/guides/lake-geneva-shore-path/passport',
  '/guides/yerkes-observatory',
  '/guides/big-foot-beach-state-park',
  '/guides/where-to-stay-lake-geneva',
  '/guides/things-to-do-lake-geneva',
  '/guides/moving-to-lake-geneva',
  '/guides/lake-geneva-neighborhoods',
  '/guides/things-to-do-lake-geneva-this-weekend',
  '/guides/things-to-do-lake-geneva-in-winter',
  '/guides/lake-geneva-winterfest',
  '/guides/best-things-to-do-lake-geneva-in-summer',
  '/guides/things-to-do-lake-geneva-with-kids',
  '/guides/lake-geneva-schools',
  '/guides/cost-of-living-lake-geneva',
  '/guides/lake-geneva-vs-williams-bay',
  '/guides/fontana-vs-lake-geneva',
  '/guides/why-people-love-lake-geneva',
  '/guides/lake-geneva-public-access-guide',
  '/guides/lake-geneva-faq',
  '/guides/streblow-boats-geneva-lake',
  '/guides/lake-geneva-mailboat',
  '/guides/lake-geneva-boat-rentals',
  '/best-of/restaurants-lake-geneva',
  '/lake-geneva-webcams',
  '/lake-geneva-weather',
  '/market-report',
  '/selling-lake-geneva',
  '/advertise',
]

// Data-backed routes. Prerendering these still bakes correct <title>/OG/JSON-LD
// even when the database isn't reachable from the build environment, which is
// the main win for link previews. Content fills in for real readers via JS.
const DATA_ROUTES = ['/', '/today', '/events', '/incidents', '/eats', '/nightlife', '/jobs', '/deals', '/directory', '/cities', '/guides/lake-geneva-shore-path/register']

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain',
  '.xml': 'application/xml',
}

/**
 * Drop static meta tags that react-helmet-async has already replaced per-page.
 *
 * index.html carries site-wide defaults (description, og:url, og:type, …) because most
 * routes never mount PageMeta and would otherwise ship with no description at all.
 * But helmet APPENDS rather than replaces, so on a page that does set them the document
 * ends up with two — the generic one first, the correct one second, tagged data-rh="true".
 * Crawlers and social scrapers read the FIRST match, so every prerendered guide was
 * advertising the homepage URL and the generic site description.
 *
 * Helmet's own tags are authoritative here: if a data-rh twin exists for a given
 * name/property, the static one is dead weight and gets removed.
 */
function dedupeMeta(html) {
  const metaRe = /<meta\s[^>]*>/gi
  const tags = html.match(metaRe) ?? []
  const keyOf = (tag) => {
    const m = tag.match(/\b(name|property)\s*=\s*"([^"]+)"/i)
    return m ? `${m[1].toLowerCase()}:${m[2].toLowerCase()}` : null
  }
  const managed = new Set(
    tags.filter((t) => /data-rh\s*=\s*"true"/i.test(t)).map(keyOf).filter(Boolean),
  )
  if (!managed.size) return html

  let removed = 0
  const out = html.replace(metaRe, (tag) => {
    if (/data-rh\s*=\s*"true"/i.test(tag)) return tag
    const k = keyOf(tag)
    if (k && managed.has(k)) {
      removed++
      return ''
    }
    return tag
  })
  if (removed) metaDeduped += removed
  return out
}

let metaDeduped = 0

/**
 * Static file server with SPA fallback, so client routing resolves.
 *
 * `shell` is the PRISTINE index.html captured before we write anything. It has to be
 * passed in rather than read per-request: this script writes dist/index.html (the '/'
 * route) and dist/<route>/index.html, so a naive server would start serving its own
 * prerendered output back as the SPA shell. Every route after '/' would then boot from
 * the homepage's baked markup and stale helmet tags instead of the real bundle entry —
 * and re-running against an existing dist/ (which `npm run prerender` explicitly does)
 * would compound it. Serving the snapshot keeps every run identical and idempotent.
 */
function serveDist(shell) {
  return new Promise((res) => {
    const server = createServer(async (req, response) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
        const filePath = join(DIST, urlPath)
        // Only real assets come off disk; anything route-shaped gets the snapshot.
        if (extname(filePath) && existsSync(filePath)) {
          const body = await readFile(filePath)
          response.writeHead(200, {
            'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
          })
          response.end(body)
          return
        }
        response.writeHead(200, { 'Content-Type': MIME['.html'] })
        response.end(shell)
      } catch {
        response.writeHead(500)
        response.end('error')
      }
    })
    server.listen(PORT, () => res(server))
  })
}

/**
 * Fetch database-backed detail routes worth baking to static HTML.
 *
 * Why: Bing Webmaster shows ~a third of this site's known URLs excluded from the
 * index, and the excluded class is exactly the pages that only exist if a crawler
 * executes JavaScript — story and event detail pages. The fixed route lists above
 * never included a single database row, so every /stories/{slug} the sitemap
 * advertised was an empty <div id="root"> to any crawler that renders JS poorly
 * (Bing) or not at all (every AI crawler).
 *
 * This runs in the SAME build environment as the prebuild sitemap script, so the
 * same VITE_SUPABASE_* env vars are available. Plain PostgREST fetch — no SDK,
 * because this file must stay dependency-free. Fails open: no env, no network, or
 * a query error just means these routes are skipped and the build is unaffected.
 *
 * Incidents are deliberately NOT prerendered here. Their editorial/PII gate lives
 * in the edge layer (supabase/functions/_shared/incidentGate.ts, Deno TS) and
 * re-implementing it in this Node script would create a second copy that drifts.
 * Incident pages are served crawlable by the serve-page edge function instead.
 */
async function fetchDynamicRoutes() {
  const base = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!base || !key) {
    console.log('[prerender] Supabase env missing — skipping story/event routes.')
    return []
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  const slugify = (t) =>
    (t || '').toLowerCase().replace(/['"]/g, '').replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '')
  const routes = []

  try {
    // Recent published stories — the bulk of the excluded-from-index class.
    const q = new URLSearchParams({
      select: 'id,title',
      status: 'in.(published,auto_published)',
      safety_level: 'eq.safe',
      geo_tier: 'gte.1',
      order: 'publish_date.desc.nullslast',
      limit: '40',
    })
    const res = await fetch(`${base}/rest/v1/content_queue?${q}`, { headers })
    if (res.ok) {
      for (const s of await res.json()) {
        const slug = slugify(s.title)
        routes.push(slug ? `/stories/${slug}-${s.id}` : `/stories/${s.id}`)
      }
    }
  } catch (e) {
    console.log(`[prerender] story fetch failed (${e.message}) — skipping.`)
  }

  try {
    // Upcoming events only — a prerendered page for a past event is a stale page
    // with a permanent URL, which is worse than no page.
    const q = new URLSearchParams({
      select: 'id',
      category: 'eq.events',
      status: 'in.(published,auto_published)',
      safety_level: 'eq.safe',
      event_date: `gte.${new Date().toISOString().slice(0, 10)}`,
      order: 'event_date.asc',
      limit: '20',
    })
    const res = await fetch(`${base}/rest/v1/content_queue?${q}`, { headers })
    if (res.ok) for (const e of await res.json()) routes.push(`/events/${e.id}`)
  } catch (e) {
    console.log(`[prerender] event fetch failed (${e.message}) — skipping.`)
  }

  if (routes.length) console.log(`[prerender] +${routes.length} story/event routes from the database`)
  return routes
}

async function main() {
  if (!existsSync(DIST)) {
    console.log('[prerender] no dist/ — run vite build first. Skipping.')
    return
  }

  let chromium
  try {
    ({ chromium } = await import('playwright'))
  } catch {
    console.log('[prerender] Playwright not installed in this environment — skipping (build unaffected).')
    return
  }

  let browser, server
  try {
    browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
      ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
    })
  } catch (e) {
    console.log(`[prerender] could not launch a browser (${e.message.split('\n')[0]}) — skipping.`)
    return
  }

  try {
    // Capture the pristine SPA shell before writing anything. `npm run prerender` runs
    // against an existing dist/, where index.html may already BE prerendered output —
    // using that as the shell would boot every route from the homepage's baked markup.
    // The sidecar keeps the real bundle entry available across re-runs.
    const indexPath = join(DIST, 'index.html')
    const shellPath = join(DIST, '.prerender-shell.html')
    let shell = await readFile(indexPath, 'utf8')
    if (shell.includes('<!-- prerendered ')) {
      if (existsSync(shellPath)) {
        shell = await readFile(shellPath, 'utf8')
        console.log('[prerender] dist/index.html is already prerendered — using saved shell')
      } else {
        console.log(
          '[prerender] dist/index.html is already prerendered and no shell snapshot exists — ' +
            'run `npx vite build` first. Skipping.',
        )
        return
      }
    } else {
      await writeFile(shellPath, shell, 'utf8')
    }

    server = await serveDist(shell)
    const dynamicRoutes = await fetchDynamicRoutes()
    const routes = [...STATIC_ROUTES, ...DATA_ROUTES, ...dynamicRoutes]
    const page = await browser.newPage({ userAgent: 'LakeGenevaBriefPrerender/1.0' })
    page.setDefaultTimeout(NAV_TIMEOUT_MS)

    // Canonicals resolve from the live hostname (so each city in the fleet claims its
    // own domain), but this browser is on 127.0.0.1 — without an override every
    // prerendered file would ship rel=canonical pointing at localhost. Set before any
    // app code runs. Per-city builds override with SITE_ORIGIN.
    const siteOrigin = (process.env.SITE_ORIGIN || 'https://lakegenevabrief.com').replace(/\/+$/, '')
    await page.addInitScript((origin) => {
      window.__SITE_ORIGIN__ = origin
    }, siteOrigin)
    console.log(`[prerender] canonical origin: ${siteOrigin}`)

    let ok = 0
    const failed = []

    for (const route of routes) {
      try {
        await page.goto(`http://127.0.0.1:${PORT}${route}`, {
          waitUntil: 'domcontentloaded',
          timeout: NAV_TIMEOUT_MS,
        })
        // Wait for React to paint something into #root.
        await page.waitForFunction(() => {
          const r = document.getElementById('root')
          return r && r.children.length > 0
        }, { timeout: NAV_TIMEOUT_MS })

        // Route components are lazy(), so the FIRST thing painted into #root is the
        // Suspense fallback — a bare spinner. Waiting only for "#root has children"
        // would happily bake that spinner into the HTML and silently ship a site with
        // no content to crawlers. Wait for the route chunk to actually resolve.
        try {
          await page.waitForFunction(() => {
            const r = document.getElementById('root')
            return r && !r.querySelector('.animate-spin')
          }, { timeout: NAV_TIMEOUT_MS })
        } catch {
          // A spinner that never clears is usually a data-backed widget, not the route
          // chunk. Fall through — the text assertion below is the real gate.
        }

        // Let react-helmet-async flush <title>/<meta> and any fast queries settle.
        await page.waitForTimeout(SETTLE_MS)

        // Static routes are pure prose: if they came out near-empty we captured a
        // loading state, and writing that file would be worse than leaving the SPA
        // fallback in place. Give them one more chance, then skip rather than ship
        // an empty page.
        if (STATIC_ROUTES.includes(route) || route.startsWith('/stories/') || route.startsWith('/events/')) {
          const floor = route.startsWith('/guides/') ? MIN_GUIDE_TEXT : MIN_STATIC_TEXT
          const textLen = await page.evaluate(
            () => document.getElementById('root')?.innerText?.trim().length ?? 0,
          )
          if (textLen < floor) {
            await page.waitForTimeout(2000)
            const retry = await page.evaluate(
              () => document.getElementById('root')?.innerText?.trim().length ?? 0,
            )
            if (retry < floor) {
              failed.push(`${route}: only ${retry} chars rendered — refusing to write a stub`)
              continue
            }
          }
        }

        let html = await page.content()
        html = dedupeMeta(html)

        // Mark it, so it's obvious in view-source and verifiable in CI.
        html = html.replace('<head>', `<head>\n    <!-- prerendered ${new Date().toISOString()} -->`)

        const outDir = route === '/' ? DIST : join(DIST, route)
        await mkdir(outDir, { recursive: true })
        await writeFile(join(outDir, 'index.html'), html, 'utf8')
        ok++
      } catch (e) {
        failed.push(`${route}: ${e.message.split('\n')[0]}`)
      }
    }

    console.log(`[prerender] wrote ${ok}/${routes.length} routes`)
    if (metaDeduped) {
      console.log(`[prerender] removed ${metaDeduped} static meta tags superseded per-page`)
    }
    if (failed.length) {
      console.log('[prerender] failed routes (site still works via SPA fallback):')
      for (const f of failed.slice(0, 10)) console.log(`  - ${f}`)
    }
  } finally {
    if (server) server.close()
    if (browser) await browser.close()
  }
}

// Never fail the build over prerendering.
main().catch((e) => {
  console.log(`[prerender] skipped after error: ${e.message}`)
  process.exit(0)
})
