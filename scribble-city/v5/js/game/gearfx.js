import { clamp } from '../core/util.js';

// (ROADMAP 11.28) What the things of the pen do to the world, shared by their kits (game/gearmove.js,
// game/gearweap.js, game/gearguard.js): the police cars near, a car stopped or spun or wrecked, a blast of
// paint, rings and lines in ink.

// the police cars (their chase cars, on the road) within r of (x, z), nearest first
export function cops(G, x, z, r) {
  const out = [];
  for (const c of G.game.traffic.list) {
    if (!c.police || c.gone || c.wrecked || c.poofT !== undefined || c.taken) continue;
    const d = Math.hypot(c.pos.x - x, c.pos.z - z);
    if (d <= r) out.push({ c, d });
  }
  return out.sort((a, b) => a.d - b.d);
}

// any car of the city's within r (not yours), nearest first
export function cars(G, x, z, r, skip = null) {
  const out = [];
  const g = G.game;
  for (const c of [...g.traffic.list, ...g.traffic.parked]) {
    if (c === skip || c.gone || c.taken || c.poofT !== undefined) continue;
    const d = Math.hypot(c.pos.x - x, c.pos.z - z);
    if (d <= r) out.push({ c, d });
  }
  return out.sort((a, b) => a.d - b.d);
}

// a police car held for a while (stopped by a bolt, under a net, spinning on oil, on a harpoon): what
// holds it, till when (game/gear.js holdCar - its kit moves it)
export function hold(G, c, kind, secs, more = {}) {
  const t = G.game.time;
  c.gear = { kind, t0: t, until: t + secs, ...more };
  c.siren = kind !== 'emp';
  c.path = null;
}

// a car wrecked by them: dented, stopped, its officers out (game/fuse.js crash)
export function wreck(G, c, power = 30) {
  const g = G.game;
  if (g.fuse) g.fuse.crash(c, power);
  else {
    c.crashed = true;
    c.speed = 0;
  }
  if (power >= 30) c.wrecked = true;
}

// a blast of paint at (x, y, z), r across: what is near hurt, thrown, police cars wrecked or spun
export function blast(G, x, y, z, r, dmg, o = {}) {
  const g = G.game;
  g.fx.boom(x, y, z, r * 0.6);
  g.fx.splash(x, y + 0.3, z, 18, 5, o.color || [1, 1, 0.98]);
  g.fx.crumbs(x, y + 0.2, z, 16, 4);
  g.audio.play(o.snd || 'boom', clamp(0.4 + r * 0.08, 0.4, 1));
  const pp = g.player.inVehicle ? g.player.inVehicle.pos : g.player.pos;
  const dp = Math.hypot(pp.x - x, pp.z - z);
  g.camRig.addShake(clamp(0.6 - dp / 60, 0.05, 0.6));
  if (g.knock) g.knock.blast(x, y, z, r);
  g.enemies.explosion(x, y + 0.5, z, r, dmg);
  g.civilians.explosion(x, y + 0.5, z, r * 0.7);
  for (const { c, d } of cars(G, x, z, r + 1.5, o.skip || g.player.inVehicle)) {
    if (c.police) {
      if (d < r * 0.65) wreck(G, c, 34);
      else hold(G, c, 'spin', 1.2, { w: (Math.random() < 0.5 ? -1 : 1) * 5 });
    } else if (g.damage && !g.classic) g.damage.hit(c, x, 0.8, z, dmg * (1 - d / (r + 1.5)));
  }
  g.enemies.noise({ x, z }, 60, 'boom');
  if (!o.quiet) {
    g.civilians.panic({ x, z }, 30);
    g.onCrime('shoot', x, z);
  }
}

// a ring in ink, round (cx, cy, cz), r across, flat (plane 'y') or upright facing z/x
export function ring(fr, cx, cy, cz, r, col, w, seed, a = 1, n = 28, plane = 'y') {
  let px = 0;
  let py = 0;
  let pz = 0;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const c = Math.cos(t) * r;
    const s = Math.sin(t) * r;
    const x = cx + (plane === 'x' ? 0 : c);
    const y = cy + (plane === 'y' ? 0 : s);
    const z = cz + (plane === 'y' ? s : plane === 'x' ? c : 0);
    if (i) fr.lineXYZ(px, py, pz, x, y, z, col, w, seed + i, a, 0.004, 0);
    px = x;
    py = y;
    pz = z;
  }
}

// a car of yours: a point of its frame (x to its left, z to its nose) in the world
export function onCar(v, x, y, z, out = { x: 0, y: 0, z: 0 }) {
  const c = Math.cos(v.yaw);
  const s = Math.sin(v.yaw);
  out.x = v.pos.x + x * c + z * s;
  out.y = (v.pos.y || 0) + y + ((v.fz && v.fz.lift) || 0);
  out.z = v.pos.z - x * s + z * c;
  return out;
}

// a world point in a car's frame
export function inCar(v, x, y, z) {
  const c = Math.cos(v.yaw);
  const s = Math.sin(v.yaw);
  const dx = x - v.pos.x;
  const dz = z - v.pos.z;
  return { x: dx * c - dz * s, y: y - (v.pos.y || 0), z: dx * s + dz * c };
}
