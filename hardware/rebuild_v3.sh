#!/bin/zsh
set -e
cd /Users/jonlanger/Documents/Projects/petricor/hardware
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b --python blender/build_petricor.py 2>&1 | grep "BUILD OK"
$B -b petricor.blend --python blender/export_glb.py 2>&1 | grep EXPORTED
$B -b petricor.blend --python blender/dfm_viewer.py -- export/viewer_v3 2>&1 | grep "VIEWER"
S=skill/industrial-design-blender/scripts
python3 $S/make_viewer.py --title "Petricor PC-6" --subtitle "benchtop incubator + imager" \
  --version "v1 · concept=export/viewer_v1/model.glb,export/viewer_v1/spec.json" \
  --version "v2 · DFM pass=export/viewer_v2/model.glb,export/viewer_v2/spec.json" \
  --version "v3 · rounder form, dimpled EPP=export/viewer_v3/model.glb,export/viewer_v3/spec.json" \
  --out export/viewer.html --standalone
$B -b petricor.blend --python blender/render_petricor.py -- hero hero_blue open open_blue front side rear top exploded exploded_blue exploded_side interior section x_imaging x_carousel x_climate x_console x_insulation d_foam d_carousel d_imaging d_console d_scanner d_climate d_rear_io d_handhold d_reveal d_scoop --samples 160 2>&1 | grep -c Saved
echo ALL_DONE
