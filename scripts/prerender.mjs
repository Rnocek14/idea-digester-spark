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

// Routes whose content is static (no database needed) — these get the full
// benefit and are correct regardless of where the build runs.
const STATIC_ROUTES = [
  '/about', '/privacy', '/terms', '/cities',
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
const DATA_ROUTES = ['/', '/today', '/events', '/incidents', '/eats', '/nightlife', '/jobs', '/deals', '/directory', '/guides/lake-geneva-shore-path/register']

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain',
  '.xml': 'application/xml',
}

/** Static file server with SPA fallback, so client routing resolves. */
function serveDist() {
  return new Promise((res) => {
    const server = createServer(async (req, response) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
        let filePath = join(DIST, urlPath)
        if (!extname(filePath)) filePath = join(DIST, 'index.html')
        if (!existsSync(filePath)) filePath = join(DIST, 'index.html')
        const body = await readFile(filePath)
        response.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' })
        response.end(body)
      } catch {
        response.writeHead(500)
        response.end('error')
      }
    })
    server.listen(PORT, () => res(server))
  })
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
    server = await serveDist()
    const routes = [...STATIC_ROUTES, ...DATA_ROUTES]
    const page = await browser.newPage({ userAgent: 'LakeGenevaBriefPrerender/1.0' })
    page.setDefaultTimeout(NAV_TIMEOUT_MS)

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
        // Let react-helmet-async flush <title>/<meta> and any fast queries settle.
        await page.waitForTimeout(SETTLE_MS)

        let html = await page.content()

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
