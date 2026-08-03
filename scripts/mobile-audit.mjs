// Mobile audit: render every prerendered route at iPhone viewport and measure
// what actually breaks on a phone — not what looks suspicious in the source.
//
// Checks per route, at 390x844 (iPhone 12/13/14) and 360x800 (small Android):
//   1. PAGE-LEVEL HORIZONTAL SCROLL — the cardinal mobile sin. scrollWidth of the
//      document exceeding the viewport means the whole page wobbles sideways.
//   2. OVERFLOWING ELEMENTS — which specific elements poke past the right edge,
//      excluding descendants of an overflow-x container (those scroll by design).
//   3. TINY TAP TARGETS — interactive elements under 40px in either dimension.
//      Reported as counts; a handful in dense nav is normal, dozens is a problem.
//   4. TINY TEXT — visible text nodes rendering under 12px.
//
// Usage: node scripts/mobile-audit.mjs   (requires dist/ from a prior build)

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join, extname, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DIST = join(ROOT, 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml', '.gpx': 'application/gpx+xml',
}

const ROUTES = process.argv[2]
  ? [process.argv[2]]
  : [
      '/', '/today', '/events', '/incidents', '/eats', '/nightlife', '/jobs', '/deals',
      '/directory', '/cities', '/about', '/guides',
      '/guides/lake-geneva-public-access-guide',
      '/guides/things-to-do-lake-geneva',
      '/guides/yerkes-observatory',
      '/guides/lake-geneva-shore-path',
      '/guides/lake-geneva-faq',
      '/guides/cost-of-living-lake-geneva',
      '/guides/where-to-stay-lake-geneva',
      '/guides/moving-to-lake-geneva',
      '/guides/lake-geneva-schools',
      '/guides/lake-geneva-vs-williams-bay',
      '/guides/things-to-do-lake-geneva-in-winter',
      '/guides/best-things-to-do-lake-geneva-in-summer',
      '/guides/things-to-do-lake-geneva-with-kids',
      '/guides/streblow-boats-geneva-lake',
      '/guides/big-foot-beach-state-park',
      '/guides/lake-geneva-neighborhoods',
      '/lake-geneva-weather', '/lake-geneva-webcams', '/market-report',
      '/best-of/restaurants-lake-geneva',
    ]

const VIEWPORTS = [
  { name: 'iphone', width: 390, height: 844 },
  { name: 'small-android', width: 360, height: 800 },
]

function serveDist(shell) {
  return new Promise((res) => {
    const server = createServer(async (req, response) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
        const filePath = join(DIST, urlPath)
        if (extname(filePath) && existsSync(filePath)) {
          response.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' })
          response.end(await readFile(filePath))
          return
        }
        response.writeHead(200, { 'Content-Type': MIME['.html'] })
        response.end(shell)
      } catch {
        response.writeHead(500); response.end('error')
      }
    })
    server.listen(0, () => res(server))
  })
}

const AUDIT_FN = `() => {
  const vw = window.innerWidth
  const doc = document.documentElement

  // Elements that poke past the right edge, excluding those inside a scroll container.
  const inScroller = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowX
      if (o === 'auto' || o === 'scroll' || o === 'hidden') return true
    }
    return false
  }
  const offenders = []
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.right > vw + 1 && !inScroller(el)) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 90) : '',
        right: Math.round(r.right), width: Math.round(r.width),
        text: (el.textContent || '').trim().slice(0, 40),
      })
      if (offenders.length >= 8) break
    }
  }

  // Tap targets under 40px in both dimensions.
  let tinyTargets = 0
  const tinyExamples = []
  for (const el of document.querySelectorAll('a, button, [role="button"], input, select')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.height < 40 && r.width < 40) {
      tinyTargets++
      if (tinyExamples.length < 4)
        tinyExamples.push(\`\${el.tagName.toLowerCase()} "\${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" \${Math.round(r.width)}x\${Math.round(r.height)}\`)
    }
  }

  // Visible text under 12px.
  let tinyText = 0
  const tinyTextExamples = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  while (walker.nextNode()) {
    const t = walker.currentNode
    if (!t.textContent.trim()) continue
    const el = t.parentElement
    if (!el || seen.has(el)) continue
    seen.add(el)
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const fs = parseFloat(getComputedStyle(el).fontSize)
    if (fs < 12) {
      tinyText++
      if (tinyTextExamples.length < 4)
        tinyTextExamples.push(\`\${fs}px "\${t.textContent.trim().slice(0, 28)}"\`)
    }
  }

  return {
    pageScrollsSideways: doc.scrollWidth > vw + 1,
    docScrollWidth: doc.scrollWidth, viewport: vw,
    offenders, tinyTargets, tinyExamples, tinyText, tinyTextExamples,
  }
}`

async function main() {
  const shell = readFileSync(join(DIST, 'index.html'))
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
  })
  const server = await serveDist(shell)

  const failures = []
  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
      page.setDefaultTimeout(20000)
      for (const route of ROUTES) {
        try {
          await page.goto(`http://127.0.0.1:${server.address().port}${route}`, { waitUntil: 'domcontentloaded' })
          await page.waitForFunction(() => {
            const r = document.getElementById('root')
            return r && r.children.length > 0 && !r.querySelector('.animate-spin')
          }, { timeout: 3500 }).catch(() => {})
          await page.waitForTimeout(300)
          const result = await page.evaluate(`(${AUDIT_FN})()`)
          const bad = result.pageScrollsSideways || result.offenders.length > 0
          const flag = bad ? 'FAIL' : 'ok  '
          console.log(`[${vp.name} ${vp.width}] ${flag} ${route}` +
            (result.pageScrollsSideways ? `  <-- PAGE SCROLLS SIDEWAYS (${result.docScrollWidth}px doc)` : '') +
            (result.tinyTargets > 15 ? `  tinyTargets=${result.tinyTargets}` : '') +
            (result.tinyText > 10 ? `  tinyText=${result.tinyText}` : ''))
          for (const o of result.offenders)
            console.log(`         overflow: <${o.tag}> right=${o.right} w=${o.width} cls="${o.cls}" "${o.text}"`)
          if (bad) failures.push({ vp: vp.name, route, result })
        } catch (e) {
          console.log(`[${vp.name}] ERROR ${route}: ${e.message.split('\n')[0]}`)
        }
      }
      await page.close()
    }
  } finally {
    server.close()
    await browser.close()
  }
  console.log(`\n${failures.length} route/viewport combinations with layout failures`)
  // Nonzero exit so CI can gate on this: a page that scrolls sideways on a phone
  // is a shipped defect for the majority of this site's readers, not a nit.
  process.exit(failures.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
