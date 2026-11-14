// node tools/jaw-outline.mjs <a module that exports headSdf>   (render/heroshapes.js imports three: cut headSdf and its helpers into a file of their own first)
// the head's outline seen from the front: its half width at each height
const { headSdf } = await import(process.argv[2]);
const out = [];
for (let y = 0.04; y >= -0.112; y -= 0.008) {
  let w = 0;
  for (let x = 0; x < 0.1; x += 0.0005) {
    let inside = false;
    for (let z = -0.1; z <= 0.12; z += 0.004) if (headSdf(x, y, z) < 0) { inside = true; break; }
    if (inside) w = x;
  }
  out.push(`${y.toFixed(3)}  ${(w * 1000).toFixed(1).padStart(5)}  ${'#'.repeat(Math.round(w * 600))}`);
}
console.log(out.join('\n'));
