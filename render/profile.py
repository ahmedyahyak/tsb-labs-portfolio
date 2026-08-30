import bpy, time, sys, json
s = bpy.context.scene
cfg = json.loads(sys.argv[-1])
s.cycles.samples = cfg['samples']
s.cycles.adaptive_threshold = cfg['thresh']
s.cycles.max_bounces = cfg['bounces']
s.cycles.diffuse_bounces = min(3, cfg['bounces'])
s.cycles.glossy_bounces = min(4, cfg['bounces'])
for m in bpy.data.materials:
    if not m.use_nodes: continue
    for n in m.node_tree.nodes:
        if n.type == 'BEVEL': n.samples = cfg['bevel']
s.frame_set(60)
s.render.filepath = f"/tmp/prof-{cfg['tag']}.png"
t0 = time.time()
bpy.ops.render.render(write_still=True)
print(f"PROFILE {cfg['tag']} {round(time.time()-t0,1)}s")
