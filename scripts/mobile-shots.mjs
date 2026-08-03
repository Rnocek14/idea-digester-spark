// Full-page mobile screenshots of the highest-traffic routes, for eyeballing.
// Usage: node scripts/mobile-shots.mjs <outdir> [route ...]

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { join, extname, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DIST = join(ROOT, 'dist')
const OUT = process.argv[2] || '/tmp/mobile-shots'
const ROUTES = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ['/', '/guides/lake-geneva-public-access-guide', '/guides/things-to-do-lake-geneva',
     '/guides/yerkes-observatory', '/guides/lake-geneva-shore-path', '/guides/lake-geneva-faq']

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain', '.gpx': 'application/gpx+xml',
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const shell = readFileSync(join(DIST, 'index.html'))
  const server = await new Promise((res) => {
    const s = createServer(async (req, response) => {
      try {
        const p = decodeURIComponent((req.url || '/').split('?')[0])
        const f = join(DIST, p)
        if (extname(f) && existsSync(f)) {
          response.writeHead(200, { 'Content-Type': MIME[extname(f)] ?? 'application/octet-stream' })
          response.end(await readFile(f)); return
        }
        response.writeHead(200, { 'Content-Type': MIME['.html'] }); response.end(shell)
      } catch { response.writeHead(500); response.end('x') }
    })
    s.listen(0, () => res(s))
  })

  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
  })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  try {
    for (const route of ROUTES) {
      await page.goto(`http://127.0.0.1:${server.address().port}${route}`, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => {
        const r = document.getElementById('root')
        return r && r.children.length > 0 && !r.querySelector('.animate-spin')
      }, { timeout: 3500 }).catch(() => {})
      await page.waitForTimeout(400)
      const name = route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_/, '')
      await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true })
      console.log(`shot ${route}`)
    }
  } finally {
    server.close(); await browser.close()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
