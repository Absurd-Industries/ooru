#!/usr/bin/env node
/**
 * step-colorize - convert a CAD STEP assembly into a web GLB with per-part
 * PBR colours, so the model looks like the real product instead of grey clay.
 *
 * Why this exists: a STEP file is just B-rep geometry with no UVs, so you can't
 * wrap a product photo onto it. But an assembly STEP is a pile of separate
 * solids, and we CAN colour each solid. FreeCAD's headless assembly importer
 * (Import.open) segfaults on large files, so we read the merged compound
 * (Part.Shape().read) and bucket its solids into materials by GEOMETRY -
 * bounding-box size / height / footprint - using rules from a small config.
 * Colours are sampled from the real photo.
 *
 * Usage:
 *   node tools/step-colorize.mjs <input.step> <output.glb> --config <colors.json>
 *
 * Config shape (see tools/folio-builder/configs/cory-dora.colors.json):
 *   {
 *     "tolerance": 0.25,            // tessellation linear deflection (mm)
 *     "yUp": true,                  // rotate CAD Z-up -> glTF Y-up
 *     "fallback": { "name": "interior", "color": "#1B1B1D" },
 *     "rules": [                    // first matching rule wins, per solid
 *       { "name": "case", "color": "#E7DCC2", "footprint": "full", "dzMin": 3 },
 *       ...
 *     ]
 *   }
 *
 * A rule matches a solid when every numeric bound it declares holds. Available
 * bounds: dxMin/dxMax, dyMin/dyMax, dzMin/dzMax, zminMin/zminMax,
 * zmaxMin/zmaxMax, volMin/volMax. `"footprint": "full"` means the solid spans
 * most of the assembly footprint (>=85% x and >=80% y of the global bbox).
 *
 * Requires FreeCAD.app (macOS); override with FREECADCMD=/path/to/freecadcmd.
 * Uses npx to fetch obj2gltf + @gltf-transform/cli on first run.
 * Colours are stored linear (glTF baseColorFactor space) so they match on screen.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FREECAD =
  process.env.FREECADCMD ||
  "/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd";

function die(m) {
  console.error("step-colorize: " + m);
  process.exit(1);
}

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const stepIn = positional[0];
const glbOut = positional[1];
const cfgIdx = args.indexOf("--config");
const cfgPath = cfgIdx >= 0 ? args[cfgIdx + 1] : null;

if (!stepIn || !glbOut || !cfgPath)
  die("usage: step-colorize.mjs <input.step> <output.glb> --config <colors.json>");
if (!existsSync(stepIn)) die("input not found: " + stepIn);
if (!existsSync(cfgPath)) die("config not found: " + cfgPath);
if (!existsSync(FREECAD)) die(`FreeCAD CLI not found at ${FREECAD}. Set FREECADCMD.`);

const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const tol = cfg.tolerance ?? 0.25;
const yUp = cfg.yUp !== false;
// Keep one mesh per material (no join/weld merging) so a web viewer can
// address each part individually for isolation / recolouring.
const separate = cfg.separate === true;
const tmpObj = join(tmpdir(), `colorize-${process.pid}.obj`);
const tmpMtl = `colorize-${process.pid}.mtl`;
const tmpMtlPath = join(tmpdir(), tmpMtl);

// FreeCAD python: read compound, classify each solid by the config rules,
// tessellate, write OBJ groups + an MTL with linear-space Kd.
const py = `
import sys, json
import FreeCAD as App
import Part
def e(s): sys.stderr.write(s+"\\n"); sys.stderr.flush()
STEP=${JSON.stringify(stepIn)}
OBJ=${JSON.stringify(tmpObj)}
MTLPATH=${JSON.stringify(tmpMtlPath)}
MTLNAME=${JSON.stringify(tmpMtl)}
TOL=${tol}
YUP=${yUp ? "True" : "False"}
CFG=json.loads(${JSON.stringify(JSON.stringify(cfg))})

shape=Part.Shape(); shape.read(STEP)
gb=shape.BoundBox
GX,GY=gb.XLength,gb.YLength

def s2l(c):
    return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def hex2lin(h):
    h=h.lstrip("#")
    r=int(h[0:2],16)/255.0; g=int(h[2:4],16)/255.0; b=int(h[4:6],16)/255.0
    return (s2l(r),s2l(g),s2l(b))

rules=CFG.get("rules",[])
fb=CFG.get("fallback",{"name":"other","color":"#888888"})

def ok(rule,bb,vol):
    dx,dy,dz=bb.XLength,bb.YLength,bb.ZLength
    zmin,zmax=bb.ZMin,bb.ZMax
    if rule.get("footprint")=="full" and not (dx>=0.85*GX and dy>=0.80*GY): return False
    chk=[("dxMin",dx,1),("dxMax",dx,-1),("dyMin",dy,1),("dyMax",dy,-1),
         ("dzMin",dz,1),("dzMax",dz,-1),("zminMin",zmin,1),("zminMax",zmin,-1),
         ("zmaxMin",zmax,1),("zmaxMax",zmax,-1),("volMin",vol,1),("volMax",vol,-1)]
    for key,val,sign in chk:
        if key in rule:
            if sign>0 and val<rule[key]: return False
            if sign<0 and val>rule[key]: return False
    return True

def classify(bb,vol):
    for r in rules:
        if ok(r,bb,vol): return r["name"],r["color"]
    return fb["name"],fb["color"]

# material name -> color
matcolor={}
groups={}
for s in shape.Solids:
    try: vol=s.Volume
    except Exception: vol=0
    name,color=classify(s.BoundBox,vol)
    matcolor[name]=color
    g=groups.setdefault(name,{"v":[],"f":[]})
    vts,fcs=s.tessellate(TOL)
    off=len(g["v"])
    for p in vts: g["v"].append((p.x,p.y,p.z))
    for f in fcs: g["f"].append((f[0]+off,f[1]+off,f[2]+off))

ml=[]
for name,color in matcolor.items():
    r,gc,b=hex2lin(color)
    ml+=["newmtl %s"%name,"Kd %.4f %.4f %.4f"%(r,gc,b),"Ka 0 0 0","Ks 0.04 0.04 0.04","Ns 60","d 1",""]
open(MTLPATH,"w").write("\\n".join(ml))

out=["mtllib %s"%MTLNAME]; base=0
for name,g in groups.items():
    if not g["v"]: continue
    out+=["o %s"%name,"usemtl %s"%name]
    for (x,y,z) in g["v"]:
        out.append("v %.4f %.4f %.4f"%((x,z,-y) if YUP else (x,y,z)))
    for (a,b,c) in g["f"]:
        out.append("f %d %d %d"%(a+1+base,b+1+base,c+1+base))
    base+=len(g["v"])
open(OBJ,"w").write("\\n".join(out))
e("COUNTS "+", ".join("%s=%d"%(k,len(g["f"])) for k,g in groups.items()))
e("OBJ verts=%d"%base)
`;

const scriptPath = join(tmpdir(), `colorize-${process.pid}.py`);
writeFileSync(scriptPath, py);
console.log(`step-colorize: ${stepIn} -> ${glbOut} (tolerance ${tol}, yUp ${yUp})`);
const r1 = spawnSync(FREECAD, [scriptPath], { stdio: ["ignore", "inherit", "inherit"] });
rmSync(scriptPath, { force: true });
if (r1.status !== 0 || !existsSync(tmpObj)) die("FreeCAD tessellation failed.");

// OBJ+MTL -> raw GLB
const rawGlb = glbOut.replace(/\.glb$/i, ".raw.glb");
const r2 = spawnSync("npx", ["-y", "obj2gltf", "-b", "-i", tmpObj, "-o", rawGlb], { stdio: "inherit" });
if (r2.status !== 0 || !existsSync(rawGlb)) die("obj2gltf failed.");

// optimize + Draco, keep separate named materials (palette off). When
// `separate` is set, also disable join so each part stays its own mesh.
const optArgs = ["-y", "@gltf-transform/cli", "optimize", rawGlb, glbOut,
  "--compress", "draco", "--texture-compress", "false", "--palette", "false"];
if (separate) optArgs.push("--join", "false", "--weld", "false");
const r3 = spawnSync("npx", optArgs, { stdio: "inherit" });
rmSync(tmpObj, { force: true });
rmSync(tmpMtlPath, { force: true });
rmSync(rawGlb, { force: true });
if (r3.status !== 0 || !existsSync(glbOut)) die("gltf-transform optimize failed.");

const kb = (statSync(glbOut).size / 1024).toFixed(0);
console.log(`step-colorize: ok -> ${glbOut} (${kb} KB)`);
