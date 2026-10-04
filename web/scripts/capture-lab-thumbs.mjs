// Capture Mycelium lab specimen thumbnails (public/lab/<species>.jpg) from each species' live 3D view.
// usage: node scripts/capture-lab-thumbs.mjs <origin>
import { chromium } from 'playwright'
import fs from 'node:fs'

const U = process.argv[2] ?? 'http://localhost:3000'
const KEYS = ['aspergillus_niger', 'penicillium_expansum', 'aspergillus_flavus', 'aspergillus_fumigatus', 'penicillium_chrysogenum',
  'cladosporium_cladosporioides', 'alternaria_alternata', 'fusarium_oxysporum', 'rhizopus_stolonifer', 'candida_albicans']
fs.mkdirSync('public/lab', { recursive: true })
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 })
await ctx.addCookies([{ name: 'pc_user', value: 'u_alex', url: U }])
for (const k of KEYS.filter((x) => !process.argv[3] || x === process.argv[3])) {
  const p = await ctx.newPage()
  await p.goto(`${U}/app/lab/${k}`); await p.waitForTimeout(2500)
  await p.addStyleTag({ content: 'div.aspect-square > *:not(:has(canvas)) { display: none !important }' })
  await p.getByRole('button', { name: '3×' }).click()
  const radius = () => p.evaluate(() => { const e = [...document.querySelectorAll('.eyebrow')].find((x) => x.textContent === 'Radius'); return parseFloat(e?.nextElementSibling?.textContent ?? '0') })
  for (let i = 0; i < 40 && (await radius()) < 1050; i++) await p.waitForTimeout(500)
  await p.waitForTimeout(2500) // let the aerial layer fill in
  await p.locator('div.aspect-square').first().screenshot({ path: `public/lab/${k}.jpg`, type: 'jpeg', quality: 86 })
  console.log(k, 'radius', await radius())
  await p.close()
}
await b.close()
