"""Export the device to glTF binary for the web viewer (Draco-compressed, extras carry part metadata)."""
import bpy, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else os.path.join(ROOT, 'export', 'petricor.glb')
dev = bpy.data.collections['Device']
# curves/text -> meshes so they survive export
for o in list(dev.all_objects):
    if o.type in ('CURVE', 'FONT'):
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        n = bpy.data.objects.new(o.name, me)
        for k in o.keys():
            n[k] = o[k]
        n.matrix_world = o.matrix_world
        for c in o.users_collection:
            c.objects.link(n)
        n.parent = o.parent
        n.matrix_world = o.matrix_world.copy()
        bpy.data.objects.remove(o, do_unlink=True)
        n.name = n.name.replace('.001', '')
# only the device
for o in bpy.data.objects:
    o.select_set(False)
for o in dev.all_objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True, export_extras=True,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                          export_image_format='WEBP', export_yup=True, export_lights=False, export_cameras=False)
print('EXPORTED', out, os.path.getsize(out) // 1024, 'KB')
