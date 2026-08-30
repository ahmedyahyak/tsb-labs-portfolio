import bpy, time
s = bpy.context.scene
s.cycles.samples = 48; s.cycles.adaptive_threshold = 0.03
s.cycles.max_bounces = 3; s.cycles.diffuse_bounces = 3; s.cycles.glossy_bounces = 3
s.cycles.use_denoising = True

def run(tag, frames=(60,61,62,63)):
    ts=[]
    for f in frames:
        s.frame_set(f); s.render.filepath=f"/tmp/p3-{tag}-{f}.png"
        t0=time.time(); bpy.ops.render.render(write_still=True); ts.append(round(time.time()-t0,1))
    print(f"PROFILE {tag} first={ts[0]}s steady={ts[1:]}")

run('lean')
# persistent data keeps the synced scene resident between frames: built for
# exactly this case, an animation where geometry barely changes
s.render.use_persistent_data = True
run('lean+persistent')
