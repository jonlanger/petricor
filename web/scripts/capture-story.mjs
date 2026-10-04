// Capture the homepage story screenshots (touchscreen + cloud) at 2× into public/shots.
// usage: node scripts/capture-story.mjs <origin>   (reset the demo and fast-forward Bench A to ~day 3 first)
import { chromium } from 'playwright'
import fs from 'node:fs'

const U = process.argv[2] ?? 'http://localhost:3000'
const OUT = 'public/shots'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome' })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = async (page, name) => { await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 90 }); console.log('shot', name) }
const cmd = (id, body) => fetch(`${U}/api/devices/${id}/commands`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())

// ---- touchscreen (1280×800 panel)
const dev = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })
const p = await dev.newPage()
await p.goto(`${U}/device?kiosk=1&operator=u_emily`); await wait(6000)
await shot(p, 'device-incubation')
// open dish 5 (air sample) from the carousel
await p.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.querySelector('canvas') && [...x.querySelectorAll('span')].some((s) => s.textContent?.trim() === '5' && s.className.includes('-bottom-1')))
  b?.click()
})
await wait(2500); await shot(p, 'device-dish')
await p.getByRole('button', { name: /UV/ }).first().click().catch(() => {}); await wait(2000); await shot(p, 'device-dish-uv')

// Bench B: setup wizard from idle
await p.goto(`${U}/device?kiosk=1&operator=u_sam&id=dev_b`); await wait(5000)
await shot(p, 'device-home')
await p.getByRole('button', { name: /New run/ }).click(); await wait(1200)
await shot(p, 'device-protocol')
await p.locator('button:has-text("Yeast")').first().click().catch(async () => { await p.locator('.grid button').first().click() }); await wait(1200)
for (const t of ['Lot 4480 — yogurt', 'Lot 4480 — yogurt (dup)', 'Cleanroom B — settle', 'Cleanroom B — active']) await p.locator(`button:has-text("${t}")`).first().click().catch(() => {})
await wait(600); await shot(p, 'device-samples')
await p.getByRole('button', { name: /Create run/ }).click(); await wait(2000)
await shot(p, 'device-print')
await p.getByRole('button', { name: /Print \d+ labels/ }).click(); await wait(1500)
await shot(p, 'device-printing')
for (let i = 0; i < 40; i++) { if (await p.getByText('Scan each dish').count()) break; await wait(1000) }
const st = await fetch(`${U}/api/state`).then((r) => r.json())
const run = st.runs.find((r) => r.deviceId === 'dev_b' && r.state === 'setup')
await cmd('dev_b', { type: 'scan', barcode: run.dishes[0].barcode, operatorId: 'u_sam' })
await cmd('dev_b', { type: 'scan', barcode: run.dishes[1].barcode, operatorId: 'u_sam' })
await wait(1500); await shot(p, 'device-scan')
for (const d of run.dishes.slice(2)) await cmd('dev_b', { type: 'scan', barcode: d.barcode, operatorId: 'u_sam' })
await cmd('dev_b', { type: 'door', open: true })
await wait(4000); await shot(p, 'device-load')
await dev.close()

// ---- cloud (1440×900 browser)
const cloud = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await cloud.addCookies([{ name: 'pc_user', value: 'u_alex', url: U }])
const c = await cloud.newPage()
for (const [path, name, ms] of [['/app', 'cloud-overview', 6000], ['/app/runs/run_qc_0928', 'cloud-run', 7000], ['/app/runs/run_ym_0922', 'cloud-review', 7000],
  ['/app/runs/run_air_0917/report', 'cloud-report', 6000], ['/app/species', 'cloud-species', 5000], ['/app/samples', 'cloud-samples', 4000], ['/app/audit', 'cloud-audit', 4000], ['/app/devices', 'cloud-devices', 4000]]) {
  await c.goto(U + path); await wait(ms); await shot(c, name)
}
await browser.close()
