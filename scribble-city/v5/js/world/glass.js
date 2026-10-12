// (ROADMAP 8.3, not with ?classic) The shop windows' glass, a pane at a time. world/deco.js says
// where each pane goes (and keeps the numbers of its strokes, so every other part keeps its own);
// here, at the end of the city, each pane is drawn as a prop of its own - so a shot, a blast or a
// car can break it (game/knock.js) - and the props built before keep their numbers (the saves
// remember the rubbed-out ones by number).

export function buildPanes(ctx) {
  const M = ctx.M;
  const out = [];
  for (const p of ctx.panes || []) {
    const { f, a, b } = p;
    const c = f.p((a + b) / 2, 2.05, 0.07);
    const id = ctx.objects.begin(ctx, 'glass', c[0], c[2]);
    let k = 0;
    for (let u = a; u < b - 0.5; u += 2.2) ctx.B.add(M.glintObj, f.quad(u, 0.9, Math.min(b, u + 1.6), 2.9, 0.07), null, p.ids[k++]);
    ctx.objects.end(ctx, id);
    if (id) out.push({ id, f, u0: a, u1: b, y0: 0.7, y1: 3.4, x: c[0], z: c[2] });
  }
  ctx.glass = out;
}
