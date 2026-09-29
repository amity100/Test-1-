// LOD index buffers with meshoptimizer's simplifier (seam-aware: vertices split at UV seams keep the UV
// layout valid, so every LOD shares one vertex buffer and one texture set).
//
//   node meshopt_lod.mjs in.bin out.bin <targetTris,...> [targetError]
//   in.bin : u32 nv, u32 ni, f32 positions[nv*3], u32 indices[ni]
//   out.bin: for each target: u32 count, u32 indices[count]
// meshoptimizer (MIT) is resolved from NODE_PATH or a node_modules next to the working directory, e.g.
//   (cd /tmp/x && npm i meshoptimizer@0.22) ; NODE_PATH=/tmp/x/node_modules node meshopt_lod.mjs ...
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.join(process.cwd(), 'noop.js'));
let mod;
try {
  mod = require('meshoptimizer');
} catch {
  const np = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
  for (const p of np) {
    try { mod = createRequire(path.join(p, 'noop.js'))('meshoptimizer'); break; } catch { /* next */ }
  }
}
if (!mod) throw new Error('meshoptimizer not found (set NODE_PATH)');
const { MeshoptSimplifier } = mod;

const [, , inPath, outPath, targetsArg, errArg] = process.argv;
const buf = readFileSync(inPath);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const nv = dv.getUint32(0, true), ni = dv.getUint32(4, true);
const pos = new Float32Array(buf.buffer.slice(buf.byteOffset + 8, buf.byteOffset + 8 + nv * 12));
const idx = new Uint32Array(buf.buffer.slice(buf.byteOffset + 8 + nv * 12, buf.byteOffset + 8 + nv * 12 + ni * 4));
await MeshoptSimplifier.ready;
const targets = targetsArg.split(',').map(Number);
const maxErr = errArg ? Number(errArg) : 0.05;
const parts = [];
for (const t of targets) {
  const [out, err] = MeshoptSimplifier.simplify(idx, pos, 3, t * 3, maxErr, []);
  console.log(`target ${t} tris -> ${out.length / 3} tris (error ${err.toFixed(5)})`);
  const head = new Uint32Array([out.length]);
  parts.push(Buffer.from(head.buffer), Buffer.from(out.buffer, out.byteOffset, out.byteLength));
}
writeFileSync(outPath, Buffer.concat(parts));
