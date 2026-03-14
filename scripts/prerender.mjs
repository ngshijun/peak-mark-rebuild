/**
 * Post-build prerender script.
 *
 * Serves the Vite build output with a static server, visits each public route
 * in headless Chromium via Puppeteer, and writes the fully-rendered HTML back
 * to dist/<route>/index.html so that crawlers see real content.
 *
 * Usage:  node scripts/prerender.mjs
 */

import { createServer } from 'node:http'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const __dirname = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(__dirname, 'dist')
const PORT = 4173

/** Routes to prerender — only public/guest pages. */
const ROUTES = ['/', '/login', '/signup', '/forgot-password']

// Simple MIME lookup for serving static files
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

/** Minimal static file server for the dist directory. */
function createStaticServer() {
  return createServer((req, res) => {
    let filePath = join(DIST, req.url === '/' ? '/index.html' : req.url)

    let content
    try {
      content = readFileSync(filePath)
    } catch {
      // SPA fallback — serve index.html for non-file routes
      content = readFileSync(join(DIST, 'index.html'))
      filePath = join(DIST, 'index.html')
    }

    const ext = extname(filePath)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(content)
  })
}

async function prerender() {
  // 1. Start static server
  const server = createStaticServer()
  await new Promise((resolve) => server.listen(PORT, resolve))
  console.log(`Static server running on http://localhost:${PORT}`)

  // 2. Launch browser
  const browser = await puppeteer.launch({ headless: true })

  try {
    for (const route of ROUTES) {
      const url = `http://localhost:${PORT}${route}`
      const page = await browser.newPage()

      // Navigate and wait for the app to dispatch 'app-rendered'
      await page.goto(url, { waitUntil: 'networkidle0' })
      await page.evaluate(() => {
        return new Promise((resolve) => {
          // If already rendered, resolve immediately
          if (document.querySelector('#app')?.children.length > 0) {
            return resolve()
          }
          document.addEventListener('app-rendered', resolve, { once: true })
        })
      })

      // Small buffer for any async rendering to settle
      await new Promise((r) => setTimeout(r, 500))

      // Get rendered HTML
      const html = await page.content()
      await page.close()

      // Write to dist/<route>/index.html
      const outDir = join(DIST, route)
      mkdirSync(outDir, { recursive: true })
      writeFileSync(join(outDir, 'index.html'), html)
      console.log(`  Prerendered: ${route}`)
    }
  } finally {
    await browser.close()
    server.close()
  }

  console.log('Prerendering complete.')
}

prerender().catch((err) => {
  console.error('Prerender failed:', err)
  process.exit(1)
})
