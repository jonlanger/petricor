// Capture UI screenshots (device screen texture for Blender, marketing imagery).
// usage: [PC_USER=u_alex] node scripts/capture.mjs <url> <out.png> [width] [height] [waitMs]
import { chromium } from 'playwright'
const [url, out, w = '1280', h = '800', wait = '5000'] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })
// PC_USER=u_alex signs in as a demo persona for /app pages
if (process.env.PC_USER) await ctx.addCookies([{ name: 'pc_user', value: process.env.PC_USER, url: new URL(url).origin }])
const page = await ctx.newPage()
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(+wait)
await page.screenshot({ path: out })
await browser.close()
console.log('captured', out)
