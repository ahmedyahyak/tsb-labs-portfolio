# TSB Labs · "one build, in section" · first light
#
# Builds the machined five-plate assembly from the 3d-designer's measured
# spec, ready for a single calibration render. Run inside Blender (the MCP
# executes this via bpy). Everything is parameterised at the top so a brand
# change is an edit, not a rebuild.
#
# The spec this implements, in one line each:
#   materials: anodised plates, roughness varied by noise (0.22-0.31), coat
#   lighting:  2K HDRI fill at 0.2, big key area light, narrow warm rim strip
#   camera:    50mm, f/4, focus empty on the gate plate, 7 bokeh blades
#   colour:    AgX Medium High Contrast, dither 1.0
#   sampling:  adaptive, max 128, OpenImageDenoise with albedo+normal
#   output:    720x960 portrait (fits .stage-zone exactly), 16-bit PNG
#
# Determinism rule: nothing animates on wall clock. The camera rides a path
# driven by (frame-1)/(N-1), so frame 57 of a chunked render equals frame 57
# of a full one. This file only sets the still; the path comes next session.

import bpy
import math

# ── palette (TSB system.css, shipped values) ─────────────────────────────
VOID  = (0.0196, 0.0275, 0.0510, 1.0)   # #05070d
RAISE = (0.0588, 0.0784, 0.1294, 1.0)   # #0f1421
BLUE  = (0.2392, 0.4314, 0.9686, 1.0)   # #3d6ef7
ICE   = (0.5608, 0.7059, 1.0000, 1.0)   # #8fb4ff
WARM  = (0.8784, 0.5412, 0.3216, 1.0)   # #e08a52

PLATE_W, PLATE_D, PLATE_T = 1.26, 0.88, 0.055
GAP = 0.16                                # separated state for the still
GATE = 3                                  # access-and-audit plate index

# ── clean slate ──────────────────────────────────────────────────────────
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
    for d in list(block):
        if d.users == 0:
            block.remove(d)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU'
scene.cycles.samples = 128
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.01
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
scene.cycles.max_bounces = 8
scene.cycles.diffuse_bounces = 3
scene.cycles.glossy_bounces = 4
scene.render.resolution_x = 720
scene.render.resolution_y = 960
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_depth = '16'
scene.render.dither_intensity = 1.0
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'

# ── materials ────────────────────────────────────────────────────────────
def anodised(name, base, coat=0.3):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = base
    bsdf.inputs['Metallic'].default_value = 1.0
    bsdf.inputs['Coat Weight'].default_value = coat
    bsdf.inputs['Coat Roughness'].default_value = 0.08
    # roughness VARIED, not constant: noise 600 mapped into 0.22..0.31
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 600.0
    ramp = nt.nodes.new('ShaderNodeMapRange')
    ramp.inputs['To Min'].default_value = 0.22
    ramp.inputs['To Max'].default_value = 0.31
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Value'])
    nt.links.new(ramp.outputs['Result'], bsdf.inputs['Roughness'])
    # machined edge: bevel into normal, 1mm, 4 samples
    bev = nt.nodes.new('ShaderNodeBevel')
    bev.inputs['Radius'].default_value = 0.001
    bev.samples = 4
    nt.links.new(bev.outputs['Normal'], bsdf.inputs['Normal'])
    return m

m_plate = anodised('tsb-plate', RAISE)
m_gate  = anodised('tsb-gate',  (RAISE[0]*1.15, RAISE[1]*1.1, RAISE[2], 1.0))
m_ground = bpy.data.materials.new('tsb-ground')
m_ground.use_nodes = True
g = m_ground.node_tree.nodes['Principled BSDF']
g.inputs['Base Color'].default_value = VOID
g.inputs['Roughness'].default_value = 0.15   # holds a soft reflection
g.inputs['Metallic'].default_value = 0.0

# ── the stack ────────────────────────────────────────────────────────────
for i in range(5):
    y = (2 - i) * (PLATE_T + GAP)
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, y + 1.0))
    p = bpy.context.active_object
    p.name = f'plate-{i}' + ('-gate' if i == GATE else '')
    p.scale = (PLATE_W / 2, PLATE_D / 2, PLATE_T / 2)
    b = p.modifiers.new('bevel', 'BEVEL')
    b.width = 0.004
    b.segments = 3
    p.data.materials.append(m_gate if i == GATE else m_plate)

bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
ground = bpy.context.active_object
ground.name = 'ground'
ground.data.materials.append(m_ground)

# ── the ring, on the gate plate ──────────────────────────────────────────
gate_z = (2 - GATE) * (PLATE_T + GAP) + 1.0 + PLATE_T / 2 + 0.002
bpy.ops.mesh.primitive_torus_add(location=(0, 0, gate_z),
                                 major_radius=0.16, minor_radius=0.004)
ring = bpy.context.active_object
ring.name = 'approval-ring'
m_ring = bpy.data.materials.new('tsb-ring')
m_ring.use_nodes = True
rb = m_ring.node_tree.nodes['Principled BSDF']
rb.inputs['Emission Color'].default_value = WARM
rb.inputs['Emission Strength'].default_value = 4.0
ring.data.materials.append(m_ring)

# ── lights: key, warm rim strip, cool bounce card ────────────────────────
def area(name, loc, rot, size, energy, color=(1, 1, 1)):
    bpy.ops.object.light_add(type='AREA', location=loc, rotation=rot)
    L = bpy.context.active_object
    L.name = name
    L.data.size = size
    L.data.energy = energy
    L.data.color = color[:3]
    return L

area('key',  (-2.2, -1.6, 3.4), (math.radians(-35), math.radians(-28), 0), 4.0, 320)
rim = area('rim', (1.8, 2.4, 2.6), (math.radians(118), 0, math.radians(-24)), 0.06, 140,
           (WARM[0], WARM[1], WARM[2]))
rim.data.size_y = 2.0
area('bounce', (2.4, -2.0, 0.5), (math.radians(70), math.radians(40), 0), 1.5, 40,
     (ICE[0], ICE[1], ICE[2]))

# world: near-black gradient, never a grey void
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (VOID[0]*0.6, VOID[1]*0.6, VOID[2]*0.6, 1)
bg.inputs['Strength'].default_value = 0.2

# ── camera: 50mm, f/4, focused on the gate ───────────────────────────────
bpy.ops.object.empty_add(location=(0, 0, gate_z))
focus = bpy.context.active_object
focus.name = 'focus-gate'
bpy.ops.object.camera_add(location=(-2.6, -3.1, 2.3),
                          rotation=(math.radians(72), 0, math.radians(-40)))
cam = bpy.context.active_object
cam.name = 'hero-cam'
cam.data.lens = 50
cam.data.dof.use_dof = True
cam.data.dof.focus_object = focus
cam.data.dof.aperture_fstop = 4.0
cam.data.dof.aperture_blades = 7
scene.camera = cam

result = {
    'objects': len(bpy.data.objects),
    'engine': scene.render.engine,
    'res': f'{scene.render.resolution_x}x{scene.render.resolution_y}',
    'view_transform': scene.view_settings.view_transform,
}
