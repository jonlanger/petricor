#!/usr/bin/env python3
"""
Headless smoke test for a packaged viewer: screenshots model, dimensions, explode,
section, a scene preset, the Drawing tab and phone width; prints page errors.

  python check_viewer.py viewer.html OUT_DIR [--three /path/to/node_modules/three]

Needs Playwright + Chromium. If the sandbox can't reach cdn.jsdelivr.net, install
three locally (`npm i three@0.160.0`) and pass --three so requests are served from disk.
Fragment files (Artifact mode) are wrapped in a minimal document automatically.
"""
import argparse, asyncio, os, tempfile
from playwright.async_api import async_playwright


async def run(path, out, three):
    os.makedirs(out, exist_ok=True)
    src = open(path).read()
    if not src.lstrip().lower().startswith("<!doctype"):
        tmp = tempfile.NamedTemporaryFile("w", suffix=".html", delete=False)
        tmp.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + src + "</body></html>")
        tmp.close(); path = tmp.name
    async with async_playwright() as p:
        gl_args = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
        try:
            b = await p.chromium.launch(args=gl_args)
        except Exception as e:  # bundled Chromium not downloaded → fall back to an installed Chrome/Edge
            b = None
            for ch in ("chrome", "msedge", "chromium"):
                try:
                    b = await p.chromium.launch(channel=ch, args=gl_args); print(f"(using system browser channel '{ch}')"); break
                except Exception:
                    pass
            if b is None:
                raise SystemExit(f"No browser available: run `python -m playwright install chromium` or install Chrome.\n{e}")
        pg = await b.new_page(viewport={"width": 1400, "height": 860})
        errs = []
        pg.on("pageerror", lambda e: errs.append(f"PAGEERROR {e}"))
        pg.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errs.append(m.text))  # ERR_FAILED = fonts we aborted

        async def route(r):
            u = r.request.url
            if three and "three@0.160.0/" in u:
                rel = u.split("three@0.160.0/")[1]
                ctype = "application/wasm" if rel.endswith(".wasm") else "application/javascript"
                await r.fulfill(path=os.path.join(three, rel), content_type=ctype)
            elif "fonts.g" in u:
                await r.abort()
            else:
                await r.continue_()
        await pg.route("**/*", route)
        await pg.goto("file://" + os.path.abspath(path)); await pg.wait_for_timeout(6000)
        parts = await pg.evaluate("window.__idb ? window.__idb.parts() : []")
        print("parts:", parts)
        shots = [("1_model", None)]
        await pg.screenshot(path=f"{out}/1_model.png")
        await pg.click("#dimsBtn"); await pg.wait_for_timeout(500); await pg.screenshot(path=f"{out}/2_dims.png"); await pg.click("#dimsBtn")
        await pg.fill("#explode", "1"); await pg.dispatch_event("#explode", "input"); await pg.wait_for_timeout(600); await pg.screenshot(path=f"{out}/3_explode.png")
        await pg.fill("#explode", "0"); await pg.dispatch_event("#explode", "input")
        async def pick(sel_id, label, shot=None):  # drive the custom Select like a user would
            await pg.click(f"#{sel_id}-trigger"); await pg.wait_for_timeout(500)
            if shot: await pg.screenshot(path=f"{out}/{shot}.png")
            await pg.click(f"#{sel_id}-listbox .sel-item >> text='{label}'"); await pg.wait_for_timeout(600)
        await pick("secAxis", "Y"); await pg.screenshot(path=f"{out}/4_section.png"); await pick("secAxis", "Off")
        await pick("scene", "Oak desk", shot="5a_dropdown_open"); await pg.screenshot(path=f"{out}/5_scene_desk.png")
        await pg.click("#secAxis-trigger"); await pg.wait_for_timeout(500); await pg.screenshot(path=f"{out}/5b_dropdown_up.png"); await pg.keyboard.press("Escape")
        await pg.click("#tab-drawing"); await pg.wait_for_timeout(1200); await pg.screenshot(path=f"{out}/6_drawing.png"); await pg.click("#tab-model")
        await pg.set_viewport_size({"width": 420, "height": 900}); await pg.wait_for_timeout(800); await pg.screenshot(path=f"{out}/7_phone.png", full_page=True)
        await b.close()
    print("errors:" if errs else "no page errors", *errs[:20], sep="\n  ")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("html"); ap.add_argument("out"); ap.add_argument("--three")
    a = ap.parse_args(); asyncio.run(run(a.html, a.out, a.three))
