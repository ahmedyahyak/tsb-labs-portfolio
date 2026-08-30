import bpy, time
s = bpy.context.scene
def run(tag, frames=(60,61,62)):
    ts=[]
    for f in frames:
        s.frame_set(f); s.render.filepath=f"/tmp/p2-{tag}-{f}.png"
        t0=time.time(); bpy.ops.render.render(write_still=True); ts.append(round(time.time()-t0,1))
    print(f"PROFILE {tag} first={ts[0]}s steady={ts[1:]}")

run('base-warm')                                   # 128 samples, denoise ON
s.cycles.use_denoising = False
run('no-denoise')
s.cycles.use_denoising = True
s.cycles.samples = 48; s.cycles.adaptive_threshold = 0.03
s.cycles.max_bounces = 3; s.cycles.diffuse_bounces = 3; s.cycles.glossy_bounces = 3
run('lean-denoise')
s.cycles.use_denoising = False
run('lean-no-denoise')
