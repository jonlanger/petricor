#!/usr/bin/env python3
"""
Package one or more model versions into the interactive Three.js viewer.

  python make_viewer.py --title "Halo Hub" \
      --version "v1 · first pass=out_v1/model.glb,out_v1/spec.json" \
      --version "v2 · lower parting line=out_v2/model.glb,out_v2/spec.json" \
      --out viewer.html [--standalone]

Each --version is  LABEL=GLB[,SPEC_JSON]. The last version opens first.
Default output is an Artifact-ready fragment (no <!doctype>/<head>; the Artifact
publisher adds the skeleton). --standalone wraps it as a full HTML document for
sending as a file or opening locally (still needs internet for three.js + fonts).

spec.json keys the viewer uses (all optional, written by idkit.write_report):
  parts[]: part, process, material, cmf, mass_g, wall{}, draft{}, fasteners[], gap_mm, notes
  dims[]:  {label, from:[x,y,z], to:[x,y,z], view:"front"|"top"|"right"}   (Blender mm coords)
  explode: {PartName: [dx,dy,dz]}   explicit explode offsets at slider=1 (Blender mm)
Keep the total under ~14 MB (Artifact limit is 16 MB): GLBs are embedded base64 (+33%).
"""
import argparse
import base64
import datetime
import html
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "..", "assets", "viewer_template.html")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", required=True)
    ap.add_argument("--subtitle", default="")
    ap.add_argument("--version", action="append", required=True, help="LABEL=GLB[,SPEC]")
    ap.add_argument("--out", required=True)
    ap.add_argument("--standalone", action="store_true")
    a = ap.parse_args()

    versions = []
    for v in a.version:
        label, paths = v.split("=", 1)
        glb, *rest = paths.split(",")
        spec = json.load(open(rest[0])) if rest and rest[0] else {}
        versions.append({"label": label.strip(), "glb": base64.b64encode(open(glb, "rb").read()).decode(),
                         "spec": spec})
    data = {"title": a.title, "subtitle": a.subtitle or "units mm",
            "date": datetime.date.today().isoformat(), "versions": versions}
    payload = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    tpl = open(TEMPLATE).read()
    out = tpl.replace("__IDB_TITLE__", html.escape(a.title)).replace("/*__IDB_DATA__*/", payload)
    if a.standalone:
        out = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
               '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
               '</head><body>' + out + '</body></html>')
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    open(a.out, "w").write(out)
    mb = os.path.getsize(a.out) / 1e6
    print(f"wrote {a.out} ({mb:.1f} MB, {len(versions)} version(s))" + ("  WARNING: over 14 MB" if mb > 14 else ""))


if __name__ == "__main__":
    main()
