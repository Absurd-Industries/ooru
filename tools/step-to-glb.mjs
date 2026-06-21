#!/usr/bin/env node
/**
 * step-to-glb - convert a CAD STEP/STP file into a web-ready GLB for <model-viewer>.
 *
 * Why a local tool (not the /dev dashboard): this needs FreeCAD, which can't run
 * inside a Cloudflare Worker. So model conversion lives here, beside the other
 * asset-pipeline tools, and the browser tools just emit the command to run.
 *
 * Usage:
 *   node tools/step-to-glb.mjs <input.step> <output.glb> [--deflection 0.2]
 *
 * Requirements (macOS): FreeCAD.app installed. Override the binary with
 *   FREECADCMD=/path/to/freecadcmd node tools/step-to-glb.mjs ...
 * Falls back to writing an .obj + an obj2gltf command if FreeCAD's glTF
 * exporter is unavailable.
 */
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FREECAD =
  process.env.FREECADCMD ||
  "/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd";

function die(msg) {
  console.error("step-to-glb: " + msg);
  process.exit(1);
}

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const stepIn = positional[0];
const glbOut = positional[1];
const defIdx = args.indexOf("--deflection");
const deflection = defIdx >= 0 ? args[defIdx + 1] : "0.2";
// Draco mesh compression - on by default since CAD meshes are huge; model-viewer
// decodes Draco GLBs natively. Pass --no-draco to disable.
const useDraco = !args.includes("--no-draco");
// Decimate to at most this many facets before export - CAD assemblies tessellate
// into millions of triangles; the web only needs a fraction. Pass --max-facets N.
const mfIdx = args.indexOf("--max-facets");
const maxFacets = mfIdx >= 0 ? parseInt(args[mfIdx + 1], 10) : 180000;

if (!stepIn || !glbOut) die("usage: step-to-glb.mjs <input.step> <output.glb> [--deflection N]");
if (!existsSync(stepIn)) die(`input not found: ${stepIn}`);
if (!existsSync(FREECAD)) {
  die(
    `FreeCAD CLI not found at ${FREECAD}.\n` +
      `Install FreeCAD.app or set FREECADCMD=/path/to/freecadcmd.`
  );
}

// FreeCAD python: read STEP -> tessellate to mesh -> export GLB (importGLTF),
// falling back to OBJ if the glTF exporter is missing in this build.
const py = `
import sys, os
step_in = ${JSON.stringify(stepIn)}
glb_out = ${JSON.stringify(glbOut)}
deflection = float(${JSON.stringify(deflection)})
import FreeCAD as App
import Part, Mesh, MeshPart
doc = App.newDocument("conv")
shape = Part.Shape()
shape.read(step_in)
mesh = MeshPart.meshFromShape(Shape=shape, LinearDeflection=deflection,
                              AngularDeflection=0.4, Relative=False)
max_facets = ${maxFacets}
before = mesh.CountFacets
if max_facets and before > max_facets:
    reduction = 1.0 - (float(max_facets) / before)
    try:
        mesh.decimate(0.01, reduction)
    except Exception as e:
        sys.stderr.write("decimate failed: %s\\n" % e)
sys.stderr.write("facets: %d -> %d\\n" % (before, mesh.CountFacets))
mobj = doc.addObject("Mesh::Feature", "mesh")
mobj.Mesh = mesh
doc.recompute()
ok = False
try:
    import importGLTF
    importGLTF.export([mobj], glb_out)
    ok = os.path.exists(glb_out) and os.path.getsize(glb_out) > 0
except Exception as e:
    sys.stderr.write("importGLTF unavailable/failed: %s\\n" % e)
if not ok:
    obj_out = os.path.splitext(glb_out)[0] + ".obj"
    Mesh.export([mobj], obj_out)
    sys.stderr.write("OBJ_FALLBACK:" + obj_out + "\\n")
    sys.exit(2)
sys.stderr.write("verts=%d facets=%d\\n" % (mesh.CountPoints, mesh.CountFacets))
`;

const scriptPath = join(tmpdir(), `step2glb-${process.pid}.py`);
writeFileSync(scriptPath, py);

console.log(`step-to-glb: converting ${stepIn} -> ${glbOut} (deflection ${deflection})`);
const res = spawnSync(FREECAD, [scriptPath], { stdio: ["ignore", "inherit", "inherit"] });
rmSync(scriptPath, { force: true });

if (res.status === 0 && existsSync(glbOut)) {
  const kb = (statSync(glbOut).size / 1024).toFixed(0);
  console.log(`step-to-glb: ok -> ${glbOut} (${kb} KB)`);
  process.exit(0);
}

// OBJ fallback path: try obj2gltf via npx if present.
const objOut = glbOut.replace(/\.glb$/i, ".obj");
if (existsSync(objOut)) {
  console.log("step-to-glb: FreeCAD glTF export unavailable, using obj2gltf -> gltf-transform...");
  // Step A: OBJ -> raw GLB (binary).
  const rawGlb = glbOut.replace(/\.glb$/i, ".raw.glb");
  const conv = spawnSync("npx", ["-y", "obj2gltf", "-b", "-i", objOut, "-o", rawGlb], {
    stdio: "inherit",
  });
  if (conv.status !== 0 || !existsSync(rawGlb)) {
    die(
      `wrote ${objOut} but obj->glb failed. Convert manually:\n` +
        `  npx -y obj2gltf -b -i ${objOut} -o ${glbOut}`
    );
  }
  // Step B: optimize (weld + dedup + Draco compress). gltf-transform crushes
  // CAD meshes far better than obj2gltf's own Draco flag.
  if (useDraco) {
    const opt = spawnSync(
      "npx",
      ["-y", "@gltf-transform/cli", "optimize", rawGlb, glbOut, "--compress", "draco", "--texture-compress", "false"],
      { stdio: "inherit" }
    );
    if (opt.status === 0 && existsSync(glbOut)) {
      rmSync(objOut, { force: true });
      rmSync(rawGlb, { force: true });
      const kb = (statSync(glbOut).size / 1024).toFixed(0);
      console.log(`step-to-glb: ok via gltf-transform -> ${glbOut} (${kb} KB)`);
      process.exit(0);
    }
    console.error("step-to-glb: gltf-transform optimize failed, keeping raw GLB.");
  }
  // No draco (or optimize failed): keep the raw GLB as the output.
  spawnSync("mv", [rawGlb, glbOut]);
  rmSync(objOut, { force: true });
  const kb = (statSync(glbOut).size / 1024).toFixed(0);
  console.log(`step-to-glb: ok (uncompressed) -> ${glbOut} (${kb} KB)`);
  process.exit(0);
}

die("conversion failed (no GLB and no OBJ produced).");
