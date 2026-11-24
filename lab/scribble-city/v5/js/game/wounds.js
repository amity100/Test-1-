import { groundHeight } from '../world/layout.js';

// (the owner's word: "every weapon I have really does significant damage to other people"; "with the sharpener minigun I
// didn't see much damage") What a weapon does to a person, as GTA has it: every hit wounds, and enough of it puts them down -
// a few hits of a pistol, one burst of the rifle, a shotgun up close, a moment of the minigun. The rubbing-out of the drawing
// (game/doodle.js erase: the holes, the parts that go) is as it was, and still kills on its own; this is the wound under it,
// counted for each person - a passer-by goes down at 100, those who fight you are tougher (Toughness).
//
// The numbers are the people's only: what a shot does to a car, a wall, the car park's gang in their cars
// (game/prologue/paintfight.js) is still its own def.damage (game/weapons.js WEAPON_DEFS).
//   hit: the wound of one hit in the body (a pellet of the shotgun, a cut of the blade, a second of the beam)
//   knock: how hard a hit shoves them (m/s) - a pistol a jolt, the MAG and a blade a step back, the shotgun all of it at once
//   loud: how far round the shooter the shot sets the street running (m) - a stapler 30, the minigun and the MAG 60
// (the rocket, the planes, the ink bottle go off: their blast is game.js explosion's, as deadly as a blast is - Civilians.explosion,
// Enemies.explosion)
export const PEOPLE = {
  pencil: { hit: 45, knock: 2.6 },
  paint: { hit: 34, knock: 1.0, loud: 34 },
  rifle: { hit: 40, knock: 1.8, loud: 55 },
  bazooka: { loud: 60 },
  pen: { hit: 40, knock: 1.3, loud: 42 },
  m4: { hit: 34, knock: 1.1, loud: 42 },
  bigEraser: { hit: 70, knock: 4.2 },
  shotgun: { hit: 22, knock: 0.95, loud: 55 },
  stapler: { hit: 26, knock: 0.6, loud: 30 },
  katana: { hit: 75, knock: 3.0 },
  planes: { loud: 30 },
  glue: { hit: 28, knock: 0.7, loud: 30 },
  laser: { hit: 300, knock: 0.25, loud: 30 },
  boomerang: { hit: 65, knock: 2.4 },
  minigun: { hit: 26, knock: 1.05, loud: 60 },
  shield: { hit: 30, knock: 3.0 },
  tippex: { hit: 30, knock: 0.9, loud: 42 },
  erasermg: { hit: 30, knock: 1.2, loud: 45 },
  paintmg: { hit: 28, knock: 0.9, loud: 45 },
  mp5: { hit: 30, knock: 1.0, loud: 45 },
  mag: { hit: 45, knock: 2.2, loud: 60 },
};

// what a hit of a kind does when the weapon is not in the table (one drawn freehand, a gadget, a turret, a fall): the wound
// for each point of its damage
const PER_POINT = { blast: 0.9, fire: 1.2, beam: 3.0, melee: 1.15, slash: 1.0, scissors: 1.1, run: 1.6, fall: 1.2, punch: 1.0 };
// (where it lands: the head is the end of it, an arm or a leg less than the body)
const PART_K = { head: 2.5, torso: 1, armL: 0.6, armR: 0.6, legL: 0.65, legR: 0.65 };
const MELEE_HEAD = 1.8;

// the wound and the shove of one hit of def (null: by kind and damage alone); amount: the damage the hit carries (pr.damage:
// the drawing's grade in it - a perfect one more, a crooked one less - and less after it went through somebody or a wall)
export function bodyHit(def, kind, amount) {
  const P = def && PEOPLE[def.id];
  if (P && P.hit) {
    const k = def.damage > 0 ? Math.max(0, Math.min(1.6, amount / def.damage)) : 1;
    return { wound: P.hit * k, knock: P.knock * Math.min(1, k) };
  }
  // (a gun drawn freehand, a turret, a gadget: by what its shot is made of and how hard it hits)
  const wound = amount * (PER_POINT[kind] || 2.6);
  return { wound, knock: Math.min(3, 0.4 + amount * 0.04) };
}

// how far round the shooter a shot of def is heard as gunfire (m)
export function loudOf(def) {
  const P = def && PEOPLE[def.id];
  if (P && P.loud) return P.loud;
  // (one drawn freehand: by how hard it hits)
  return Math.max(30, Math.min(60, 30 + (def && def.damage ? def.damage : 10) * 0.9));
}

// the wound that puts somebody down: a passer-by 100, those who fight you half as much again or twice as much (their armour)
export function toughness(who, civ) {
  if (civ) return who.tough || 100;
  const a = (who.cfg && who.cfg.armor) || 1;
  return 100 * Math.max(1.5, Math.min(2, 1.25 + 0.4 * a));
}

// the multiplier for where it landed
export function partK(part, melee = false) {
  if (part === 'head') return melee ? MELEE_HEAD : PART_K.head;
  return PART_K[part] || 1;
}

// the shoves of the last moment, summed (a shotgun's pellets arrive together, a minigun's one after the other): how hard the
// body is thrown if this is the hit that puts it down
export function knockSum(who, knock, now) {
  const k0 = who.knockAcc || 0;
  const dt = now - (who.knockAt || -9);
  who.knockAcc = k0 * Math.exp(-dt * 7) + knock;
  who.knockAt = now;
  return who.knockAcc;
}

// the body thrown down by the hit that killed it (dir: the way the shot went, level; k: how hard): the drawing's own ragdoll
// (game/ragdoll.js) - a pistol's last shot folds them where they stand, the shotgun's throws them back
export function throwDown(game, who, dir, k) {
  const R = game.ragdolls;
  if (!R || !who.fig) return false;
  const dx = dir ? dir.x : 0;
  const dz = dir ? dir.z : 0;
  const l = Math.hypot(dx, dz) || 1;
  const ux = dx / l;
  const uz = dz / l;
  const s = 0.6 + Math.min(9, k) * 0.95;
  const w = 1.2 + Math.min(9, k) * 0.7;
  R.throw(who, ux * s, 0.4 + Math.min(9, k) * 0.32, uz * s, uz * w, (Math.random() - 0.5) * 1.5, -ux * w);
  who.ragKill = true;
  return true;
}

// (ink, not blood: the drawing's own) a pool of it where the body comes down, a drip of it after somebody wounded
const INK = [0.1, 0.11, 0.2];
export function inkPool(game, x, z, size = 1.2, y = null) {
  const fx = game.fx;
  if (!fx || !fx.decal) return;
  // (where they stood - the pier's boards, a floor of the mall - or the street under it)
  const gy = y !== null ? y : groundHeight(x, z);
  fx.decal(Math.random() < 0.5 ? 'splat0' : 'splat1', x, gy + 0.02, z, size, INK, 0.92, [1, 0, 0], [0, 0, -1]);
}

export function inkDrip(game, x, z, y = null) {
  const fx = game.fx;
  if (!fx || !fx.decal) return;
  const gy = y !== null ? y : groundHeight(x, z);
  fx.decal('splat1', x + (Math.random() - 0.5) * 0.3, gy + 0.02, z + (Math.random() - 0.5) * 0.3, 0.18 + Math.random() * 0.14, INK, 0.85, [1, 0, 0], [0, 0, -1]);
}

// a body hit by a shot: the hole the drawing's own ray goes through (game/doodle.js raycast passes holes) still has a body
// round it - a ray that crosses the body only through holes rubbed out before is a hit all the same, where it went in
// (the rifle's second shot through the hole of its first). Returns { t, part, point } or null
export function rayThroughHoles(fig, ro, rd, maxT) {
  const H = fig.holes;
  if (!H || !H.length) return null;
  // (the shapes built first, with the holes in them: building them stamps the holes for the picture - game/doodle.js
  // dressTorso - and the raycast's own ensureShapes is then nothing)
  fig.ensureShapes();
  fig.holes = [];
  let h = null;
  try {
    h = fig.raycast(ro, rd, maxT);
  } finally {
    fig.holes = H;
  }
  return h;
}
