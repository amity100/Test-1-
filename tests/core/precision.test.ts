import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { DynBody, EnemyView, EntranceContext, TrapTarget } from '../../src/core/contracts';
import { PortalKey, PORTAL, type PortalHost } from '../../src/game/portalkey';
import { Strikes, STRIKE, type StrikeHost } from '../../src/game/strikes';
import { BLADE, HiddenBlade } from '../../src/game/blade';
import { aimedEnemy, behind, dodgeAt, dodgeSpot, exposedTo, Parry, PRECISION, precisionOn } from '../../src/game/precision';
import { activeVariant, setLabActive, setVariant } from '../../src/game/variant';
import { makePhysics, makeRifts, makeWorld, V } from './helpers';

/** A stand-in enemy: enough of EnemyView for the aim, the PORTAL key, the strikes and the blade. */
function fakeEnemy(id: number, pos: THREE.Vector3, o: Partial<{ state: EnemyView['state']; kind: EnemyView['kind']; yaw: number }> = {}) {
  const yaw = o.yaw ?? 0;
  return {
    id,
    kind: o.kind ?? 'rifleman',
    state: o.state ?? 'combat',
    pos: pos.clone(),
    yaw,
    hp: 40,
    maxHp: 40,
    alive: true,
    aware: true,
    offBalance: (o.state ?? 'combat') !== 'combat',
    armored: false,
    radius: 0.42,
    height: 1.8,
    body: null as DynBody | null,
    sightScale: 1,
    def: { id: `t.${id}`, zone: 'pier', kind: 'rifleman', pos: pos.clone(), yaw },
    held: false,
    sink: 0,
    launched: null as THREE.Vector3 | null,
    staggered: 0,
    chest(out = new THREE.Vector3()) {
      return out.set(this.pos.x, this.pos.y + 1.3, this.pos.z);
    },
    forward(out = new THREE.Vector3()) {
      return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    },
  };
}
type Fake = ReturnType<typeof fakeEnemy>;
const views = (l: Fake[]) => l as unknown as EnemyView[];

/** PRECISION in force (the lab loaded, the variant picked); CURRENT again after each test. */
function precision(on = true) {
  setLabActive(on);
  setVariant(on ? 'precision' : 'current');
}
afterEach(() => {
  setVariant('current');
  setLabActive(false);
});

const deg = THREE.MathUtils.degToRad;
/** Aim from the camera at `at`, turned `off` degrees to the side. */
function aimAt(cam: THREE.Vector3, at: THREE.Vector3, off = 0) {
  return at.clone().sub(cam).normalize().applyAxisAngle(V(0, 1, 0), deg(off));
}

describe('PRECISION: variant gating', () => {
  it('applies in PRECISION and ONSLAUGHT inside the lab, never outside it', () => {
    expect(precisionOn()).toBe(false);
    setVariant('precision');
    expect(activeVariant()).toBe('current');
    expect(precisionOn()).toBe(false); // (not in the lab: CURRENT everywhere else)
    setLabActive(true);
    expect(precisionOn()).toBe(true);
    setVariant('onslaught');
    expect(precisionOn()).toBe(true);
    setVariant('current');
    expect(precisionOn()).toBe(false);
  });
});

describe('PRECISION: manual aim (no lock-on)', () => {
  const world = makeWorld();
  const cam = V(0, 2.2, -3);
  const eye = V(0, 1.68, 0);

  it('takes the man the crosshair is on, within a tight cone; a few degrees off is no one', () => {
    const e = fakeEnemy(1, V(0, 0, 17)); // 20 m from the camera
    const L = views([e]);
    const at = (off: number, loose = false) => aimedEnemy(world, L, () => true, cam, aimAt(cam, e.chest(), off), eye, { range: 40, loose });
    expect(at(0)).toBe(L[0]);
    expect(at(2)).toBe(L[0]); // inside 2.5°
    expect(at(3.2)).toBeNull(); // past it: no lock-on to save you
    // a thumb or a pad: a little looser, not a lock-on
    expect(at(3.2, true)).toBe(L[0]);
    expect(at(6, true)).toBeNull();
  });

  it('up close, his body itself is the target (the cone never shrinks below it)', () => {
    const e = fakeEnemy(1, V(0, 0, 3)); // 6 m from the camera
    const L = views([e]);
    const side = (x: number) => aimedEnemy(world, L, () => true, cam, V(x, 1.3, 3).sub(cam).normalize(), eye, { range: 40 });
    expect(side(0.35)).toBe(L[0]);
    expect(side(0.9)).toBeNull();
  });

  it('the nearest along the ray wins; out of sight or out of range is no one', () => {
    const near = fakeEnemy(1, V(0, 0, 8));
    const far = fakeEnemy(2, V(0.1, 0, 16));
    const L = views([far, near]);
    const dir = aimAt(cam, near.chest());
    expect(aimedEnemy(world, L, () => true, cam, dir, eye, { range: 40 })).toBe(L[1]);
    expect(aimedEnemy(world, L, () => true, cam, dir, eye, { range: 40, skip: L[1] })).toBe(L[0]);
    expect(aimedEnemy(world, L, () => true, cam, dir, eye, { range: 5 })).toBeNull();
    const walled = makeWorld();
    walled.add(V(-3, 0, 5), V(3, 4, 5.5));
    expect(aimedEnemy(walled, L, () => true, cam, dir, eye, { range: 40 })).toBeNull();
  });
});

function strikeRig(enemies: Fake[]) {
  const world = makeWorld(false);
  world.add(V(-40, -2, -40), V(12, 0, 40), { tag: 'ground' });
  const rifts = makeRifts(world);
  const phys = makePhysics(world, rifts);
  const body = phys.createBody('player', { pos: V(0, 0, 0), radius: 0.35, height: 1.8 });
  const camPos = V(0, 2.2, -3);
  const camDir = V(0, 0, 1);
  const host: StrikeHost = {
    rifts,
    world,
    level: { seaY: -20, isSea: (p) => p.x > 12 },
    killYAt: () => -100,
    enemies: {
      list: views(enemies),
      launch: (v, vel) => ((v as unknown as Fake).launched = vel ? vel.clone() : V(0, 0, 0)),
      provoke: () => true,
      muzzleInfo: (v, from, dir) => {
        from.set(v.pos.x, v.pos.y + 1.4, v.pos.z);
        dir.set(0, 0, -1);
        return true;
      },
    },
    props: { items: [] },
    active: new Set(['pier']),
    playerFeet: () => body.pos,
    playerEye: () => V(body.pos.x, body.pos.y + 1.68, body.pos.z),
    playerBody: () => body,
    playerGrounded: () => true,
    aimRay: () => ({ origin: camPos.clone(), dir: camDir.clone() }),
    touch: () => false,
  };
  return { s: new Strikes(host), camDir, camPos };
}

describe('PRECISION: strikes need the crosshair on him', () => {
  it('CURRENT locks on from well off the crosshair; PRECISION only on him (a LOOP 6° off misses)', () => {
    const e = fakeEnemy(1, V(0, 0, 10));
    const { s, camDir, camPos } = strikeRig([e]);
    camDir.copy(aimAt(camPos, e.chest(), 6));
    expect(s.target()).toBe(e as unknown as EnemyView);
    precision();
    expect(s.target()).toBeNull();
    const r = s.fire('loop');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('strike.noTarget');
    expect(s.charges).toBe(STRIKE.maxCharges);
    // on him: it takes
    camDir.copy(aimAt(camPos, e.chest(), 0.5));
    expect(s.fire('loop').ok).toBe(true);
  });

  it('no auto-switching: with two men, the one under the crosshair, not the nearest to it', () => {
    const a = fakeEnemy(1, V(-3, 0, 12));
    const b = fakeEnemy(2, V(3, 0, 12));
    const { s, camDir, camPos } = strikeRig([a, b]);
    precision();
    camDir.copy(aimAt(camPos, b.chest()));
    expect(s.target()).toBe(b as unknown as EnemyView);
    // between them: nobody
    camDir.copy(aimAt(camPos, V(0, 1.3, 12)));
    expect(s.target()).toBeNull();
  });
});

function portalRig(enemies: Fake[]) {
  const world = makeWorld(false);
  world.add(V(-40, -2, -40), V(12, 0, 40), { tag: 'ground' });
  const rifts = makeRifts(world);
  const camPos = V(0, 2.2, -3);
  const camDir = V(0, 0, 1);
  const feet = V(0, 0, 0);
  const ctx = (): EntranceContext => ({
    playerFeet: feet,
    playerVel: V(0, 0, 0),
    playerYaw: 0,
    airborne: false,
    camPos,
    camDir,
    targets: enemies.filter((e) => e.alive).map((e): TrapTarget => ({ key: `enemy:${e.id}`, pos: e.pos, radius: e.radius, height: e.height, canFall: e.offBalance, steady: !e.offBalance })),
  });
  const host: PortalHost = {
    rifts,
    world,
    level: { seaY: -20, isSea: (p) => p.x > 12 },
    killYAt: () => -100,
    enemies: {
      list: views(enemies),
      byKey: (k) => (enemies.find((e) => `enemy:${e.id}` === k) as unknown as EnemyView) ?? null,
      hold: (v, on) => ((v as unknown as Fake).held = on),
      isHeld: (v) => (v as unknown as Fake).held,
      setSink: (v, m) => ((v as unknown as Fake).sink = m),
      launch: (v, vel) => ((v as unknown as Fake).launched = vel ? vel.clone() : V(0, 0, 0)),
      stagger: (v, sec) => ((v as unknown as Fake).staggered = sec),
    },
    props: { byKey: () => null, release: () => {} },
    entranceCtx: ctx,
    aimRay: () => ({ origin: camPos.clone(), dir: camDir.clone() }),
    playerEye: () => V(feet.x, feet.y + 1.68, feet.z),
    playerFeet: () => feet,
    touch: () => false,
    live: () => true,
    hangingUnderCrosshair: () => null,
  };
  return { rifts, pk: new PortalKey(host), camDir, camPos };
}

const step = (pk: PortalKey, held: boolean, n = 1) => {
  let r = null;
  for (let i = 0; i < n; i++) r = pk.update(1 / 60, held) ?? r;
  return r;
};

describe('PRECISION: GRAB is aimed by hand', () => {
  it('a man just off the crosshair is grabbed in CURRENT, not in PRECISION', () => {
    const e = fakeEnemy(1, V(0, 0, 10));
    const { pk, camDir, camPos } = portalRig([e]);
    camDir.copy(aimAt(camPos, e.chest(), 5));
    expect(pk.preview().mode).toBe('grab');
    precision();
    expect(pk.preview().mode).not.toBe('grab');
    camDir.copy(aimAt(camPos, e.chest()));
    expect(pk.preview().mode).toBe('grab');
  });

  it('a tap puts the exit where the crosshair is when you let go (not straight on past him)', () => {
    precision();
    const e = fakeEnemy(1, V(4, 0, 10));
    const { rifts, pk, camDir, camPos } = portalRig([e]);
    camDir.copy(aimAt(camPos, e.chest()));
    expect(pk.press().ok).toBe(true);
    // flick to the right and let go inside the tap window
    const flick = V(1, 0.05, 0.4).normalize();
    camDir.copy(flick);
    const out = step(pk, false);
    expect(out?.ok).toBe(true);
    const ex = rifts.playerEnds().exit!;
    expect(ex.boost).toBe(PORTAL.throwSpeed.grab);
    // on the aim ray, facing along it
    const rel = ex.position.clone().sub(camPos);
    expect(rel.clone().addScaledVector(flick, -rel.dot(flick)).length()).toBeLessThan(0.05);
    expect(ex.normal.dot(flick)).toBeGreaterThan(0.99);
  });

  it('a tap on him with the crosshair still on him throws him on along the aim, past him', () => {
    precision();
    const e = fakeEnemy(1, V(0, 0, 10));
    const { rifts, pk, camDir, camPos } = portalRig([e]);
    camDir.copy(aimAt(camPos, e.chest()));
    pk.press();
    step(pk, false);
    const ex = rifts.playerEnds().exit!;
    expect(ex.position.z).toBeGreaterThan(e.pos.z + PRECISION.grab.pastMan - 0.5);
  });

  it('the hold is lighter slow motion and shorter; the arc preview stays', () => {
    const e = fakeEnemy(1, V(0, 0, 10));
    const { pk, camDir, camPos } = portalRig([e]);
    camDir.copy(aimAt(camPos, e.chest()));
    pk.press();
    expect(pk.timeScale()).toBe(PORTAL.slow.grab);
    pk.cancel();
    precision();
    // (the preview lays out what letting go now would do)
    expect(pk.preview(true).mode).toBe('grab');
    expect(pk.arcN).toBeGreaterThan(2);
    pk.press();
    expect(pk.timeScale()).toBe(PRECISION.grab.slow);
    camDir.set(0.3, 0.1, 1).normalize();
    expect(step(pk, true, Math.round(PRECISION.grab.maxHold * 60) - 3)).toBeNull();
    expect(pk.arcN).toBeGreaterThan(2);
    // held past the limit it lets go by itself
    const out = step(pk, true, 6);
    expect(out?.ok).toBe(true);
    expect(e.launched).not.toBeNull();
  });
});

describe('PRECISION: the PARRY window', () => {
  it('opens on the press for 0.25 s (PERFECT for 0.1 s), then a 0.6 s lockout', () => {
    const p = new Parry();
    expect(p.open).toBe(false);
    expect(p.press()).toBe(true);
    expect(p.open && p.perfect).toBe(true);
    p.update(0.09, 0.09);
    expect(p.perfect).toBe(true);
    p.update(0.03, 0.03);
    expect(p.open).toBe(true);
    expect(p.perfect).toBe(false);
    p.update(0.14, 0.14); // 0.26 s
    expect(p.open).toBe(false);
    expect(p.press()).toBe(false); // (still locked out)
    p.update(PRECISION.parry.cooldown, PRECISION.parry.cooldown);
    expect(p.press()).toBe(true);
    expect(p.cooling()).toBeCloseTo(1);
  });

  it('a catch holds the rift open for the rest of a burst', () => {
    const p = new Parry();
    p.press();
    p.update(0.2, 0.2);
    p.catch();
    p.update(0.1, 0.1); // 0.3 s: past the plain window
    expect(p.open).toBe(true);
    p.update(0.06, 0.06);
    expect(p.open).toBe(false);
    expect(p.caught).toBe(1);
  });

  it('meets fire coming at your front only', () => {
    const look = V(0, 0, 1);
    expect(Parry.facing(V(0, 0, -26), look)).toBe(true); // straight at you
    expect(Parry.facing(V(10, 0, -24), look)).toBe(true); // from ahead-left
    expect(Parry.facing(V(0, 0, 26), look)).toBe(false); // from behind
    expect(Parry.facing(V(26, 0, 0), look)).toBe(false); // across you
  });
});

describe('PRECISION: the DODGE', () => {
  const level = { seaY: -1.2, isSea: (p: THREE.Vector3) => p.x > 20 };

  it('comes up 4.5 m the way you go on open floor', () => {
    const w = makeWorld();
    const to = dodgeSpot(w, level, V(0, 0, 0), V(0, 0, 1))!;
    expect(to.distanceTo(V(0, 0, PRECISION.dodge.dist))).toBeLessThan(1e-6);
  });

  it('stops short of a wall (never through it), and of the lip of a drop', () => {
    const w = makeWorld(false);
    w.add(V(-20, -2, -20), V(20, 0, 3), { tag: 'ground' }); // the floor ends at z 3: the void past it
    const to = dodgeSpot(w, level, V(0, 0, 0), V(0, 0, 1))!;
    expect(to).not.toBeNull();
    expect(to.z).toBeLessThanOrEqual(3 - 0.35 + 1e-6);
    expect(to.z).toBeGreaterThanOrEqual(PRECISION.dodge.minDist - 1e-6);
    const walled = makeWorld();
    walled.add(V(-5, 0, 3), V(5, 4, 3.5));
    const t2 = dodgeSpot(walled, level, V(0, 0, 0), V(0, 0, 1))!;
    expect(t2.z).toBeLessThan(3);
    // a wall right in front: nowhere to go
    const tight = makeWorld();
    tight.add(V(-5, 0, 1.2), V(5, 4, 1.6));
    expect(dodgeSpot(tight, level, V(0, 0, 0), V(0, 0, 1))).toBeNull();
  });

  it('never over the void or into water; not up a ledge', () => {
    const edge = makeWorld(false);
    edge.add(V(-20, -2, -20), V(20, 0, 1), { tag: 'ground' });
    expect(dodgeSpot(edge, level, V(0, 0, 0), V(0, 0, 1))).toBeNull();
    const w = makeWorld();
    expect(dodgeSpot(w, level, V(18, 0, 0), V(1, 0, 0))).not.toBeNull(); // (2 m short of the pool)
    const pool = makeWorld(false);
    pool.add(V(-20, -2, -20), V(20, 0, 20), { tag: 'ground' });
    const seaLevel = { seaY: 0, isSea: (p: THREE.Vector3) => p.z > 1.5 };
    expect(dodgeSpot(pool, seaLevel, V(0, 0, 0), V(0, 0, 1))).toBeNull();
    const ledge = makeWorld();
    ledge.add(V(-5, 0, 1.5), V(5, 3, 8));
    expect(dodgeSpot(ledge, level, V(0, 0, 0), V(0, 0, 1))).toBeNull();
  });

  it('down, across, up in a quarter second', () => {
    const r = { from: V(0, 0, 0), to: V(0, 0, 4.5), t: 0, up: false };
    const out = V(0, 0, 0);
    expect(dodgeAt(r, out)!.z).toBe(0);
    r.t = PRECISION.dodge.sink + PRECISION.dodge.travel / 2;
    expect(dodgeAt(r, out)!.z).toBeCloseTo(2.25, 3);
    r.t = PRECISION.dodge.sink + PRECISION.dodge.travel + 1e-3;
    expect(dodgeAt(r, out)).toBeNull();
    expect(PRECISION.dodge.sink + PRECISION.dodge.travel).toBeLessThanOrEqual(0.25);
    expect(PRECISION.dodge.invuln).toBeGreaterThan(PRECISION.dodge.sink + PRECISION.dodge.travel);
  });

  it('behind a man is behind him; a man on his guard facing you is not exposed', () => {
    const e = fakeEnemy(1, V(0, 0, 0), { yaw: 0 }); // facing +Z
    const view = e as unknown as EnemyView;
    expect(behind(view, V(0, 0, -2))).toBe(true);
    expect(behind(view, V(0, 0, 2))).toBe(false);
    expect(exposedTo(view, V(0, 0, 2))).toBe(false);
    expect(exposedTo(view, V(0, 0, -2))).toBe(true);
    // reeling, down or unaware: exposed from anywhere
    for (const s of ['stagger', 'downed', 'stunned', 'idle'] as const) expect(exposedTo(fakeEnemy(2, V(0, 0, 0), { state: s }) as unknown as EnemyView, V(0, 0, 2))).toBe(true);
    // a brute's charge is his guard up too
    expect(exposedTo(fakeEnemy(3, V(0, 0, 0), { state: 'charge' }) as unknown as EnemyView, V(0, 0, 2))).toBe(false);
  });
});

describe('PRECISION: the blade has reach, no lunge', () => {
  it('a man 3 m ahead is lunged at in CURRENT, out of reach in PRECISION', () => {
    const e = fakeEnemy(1, V(0, 0, BLADE.lunge + 0.42 - 0.2));
    const blade = new HiddenBlade({ world: makeWorld(), enemies: views([e]), live: () => true, reachOnly: () => precisionOn() });
    expect(blade.pick(V(0, 0, 0), V(0, 0, 1), V(0, 0, 1))?.lunge).toBe(true);
    precision();
    expect(blade.pick(V(0, 0, 0), V(0, 0, 1), V(0, 0, 1))).toBeNull();
    // in reach it still takes him
    e.pos.set(0, 0, BLADE.reach + 0.42 - 0.1);
    expect(blade.pick(V(0, 0, 0), V(0, 0, 1), V(0, 0, 1))).toEqual({ enemy: e, lunge: false });
  });
});
