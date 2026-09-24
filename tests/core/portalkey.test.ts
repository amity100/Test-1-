import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { DynBody, EnemyView, EntranceContext, TrapTarget } from '../../src/core/contracts';
import { LAW } from '../../src/core/contracts';
import { PortalKey, PORTAL, type PortalHost } from '../../src/game/portalkey';
import { Strikes, STRIKE, type StrikeHost } from '../../src/game/strikes';
import { makePhysics, makeRifts, makeWorld, recorder, V } from './helpers';

/** A stand-in enemy: enough of EnemyView for the PORTAL key. */
function fakeEnemy(id: number, pos: THREE.Vector3, o: Partial<{ offBalance: boolean; kind: EnemyView['kind'] }> = {}) {
  const e = {
    id,
    kind: o.kind ?? 'rifleman',
    state: o.offBalance === false ? 'combat' : 'idle',
    pos: pos.clone(),
    yaw: 0,
    hp: 40,
    maxHp: 40,
    alive: true,
    aware: o.offBalance === false,
    offBalance: o.offBalance ?? true,
    armored: false,
    radius: 0.42,
    height: 1.8,
    body: null as DynBody | null,
    sightScale: 1,
    def: { id: `t.${id}`, zone: 'pier', kind: 'rifleman', pos: pos.clone(), yaw: 0 },
    held: false,
    sink: 0,
    launched: null as THREE.Vector3 | null,
    staggered: 0,
    chest(out = new THREE.Vector3()) {
      return out.set(this.pos.x, this.pos.y + 1.3, this.pos.z);
    },
    forward(out = new THREE.Vector3()) {
      return out.set(0, 0, 1);
    },
  };
  return e;
}
type Fake = ReturnType<typeof fakeEnemy>;

/** Ground, a sea to the east past x = 12 (a 20 m drop), the player at the origin looking +Z. */
function rig(enemies: Fake[], o: { falling?: boolean } = {}) {
  const world = makeWorld(false);
  world.add(V(-40, -2, -40), V(12, 0, 40), { tag: 'ground' });
  const rifts = makeRifts(world);
  const camPos = V(0, 2.2, -3);
  const camDir = V(0, 0, 1);
  const feet = V(0, o.falling ? 6 : 0, 0);
  const ctx = (): EntranceContext => ({
    playerFeet: feet,
    playerVel: o.falling ? V(0, -10, 0) : V(0, 0, 0),
    playerYaw: 0,
    airborne: !!o.falling,
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
      list: enemies as unknown as EnemyView[],
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
  const pk = new PortalKey(host);
  return { world, rifts, pk, camDir, feet };
}

const step = (pk: PortalKey, held: boolean, n = 1) => {
  let r = null;
  for (let i = 0; i < n; i++) r = pk.update(1 / 60, held) ?? r;
  return r;
};

describe('PORTAL key', () => {
  it('resolves what a press does: grab (crosshair on a man, fighting you or not), air (falling), door', () => {
    const e = fakeEnemy(1, V(0, 0, 10));
    expect(rig([e]).pk.preview().mode).toBe('grab');
    expect(rig([]).pk.preview().mode).toBe('door');
    expect(rig([], { falling: true }).pk.preview().mode).toBe('air');
    // a man standing firm is grabbed all the same: no price, no refusal
    expect(rig([fakeEnemy(2, V(0, 0, 10), { offBalance: false })]).pk.preview()).toEqual({ mode: 'grab', reason: null, key: 'enemy:2' });
    // ...a turret won't budge
    expect(rig([fakeEnemy(3, V(0, 0, 10), { kind: 'turret' })]).pk.preview().reason).toBe('portal.anchored');
  });

  it('Voss is anchored like a turret: steady or stunned, the grab refuses him', () => {
    for (const offBalance of [false, true]) {
      const e = fakeEnemy(4, V(0, 0, 10), { kind: 'boss', offBalance });
      const { rifts, pk } = rig([e]);
      expect(pk.preview()).toEqual({ mode: 'grab', reason: 'portal.anchored', key: 'enemy:4' });
      const r = pk.press();
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('portal.anchored');
      expect(e.held).toBe(false);
      expect(rifts.playerEnds().entrance).toBeNull();
    }
  });

  it('a grab holds him in a dormant floor end; a tap throws him straight on, away from you', () => {
    const e = fakeEnemy(1, V(4, 0, 10));
    const { rifts, pk, camDir } = rig([e]);
    // (look at him)
    camDir.copy(V(4, 1.3, 10).sub(V(0, 2.2, -3)).normalize());
    const r = pk.press();
    expect(r.ok).toBe(true);
    expect(r.mode).toBe('grab');
    expect(e.held).toBe(true);
    const ends = rifts.playerEnds();
    expect(ends.entrance?.kind).toBe('floor');
    expect(ends.entrance?.isOpen).toBe(false); // no exit yet: the floor still holds
    expect(ends.entrance?.noPlayer).toBe(true);
    const out = step(pk, false);
    expect(out?.ok).toBe(true);
    expect(e.held).toBe(false);
    expect(e.launched).not.toBeNull();
    const ex = rifts.playerEnds().exit!;
    expect(ex.noPlayer).toBe(true);
    expect(ex.boost).toBe(PORTAL.throwSpeed.grab);
    // 2 m past him on the line from you through him, 2 m over his feet (not off to the sea at x > 12)
    const d = V(4, 0, 10).normalize();
    expect(ex.position.distanceTo(V(4, PORTAL.straight.up, 10).addScaledVector(d, PORTAL.straight.past))).toBeLessThan(0.01);
    // facing on along that line, tilted up
    expect(ex.normal.y).toBeCloseTo(Math.sin(PORTAL.straight.tilt), 3);
    expect(V(ex.normal.x, 0, ex.normal.z).normalize().dot(d)).toBeGreaterThan(0.999);
    expect(rifts.playerEnds().entrance?.isOpen).toBe(true);
  });

  it('a held grab sinks him, aims a launcher end along the view and throws him there', () => {
    const e = fakeEnemy(1, V(0, 0, 10));
    const { rifts, pk, camDir } = rig([e]);
    pk.press();
    step(pk, true, 20);
    expect(e.sink).toBeGreaterThan(0.3);
    expect(pk.aiming).toBe(true);
    expect(pk.timeScale()).toBeLessThan(0.2);
    // look off to the left and let go
    camDir.set(-1, 0.1, 1).normalize();
    step(pk, true, 2);
    expect(pk.hold?.launch?.valid).toBe(true);
    expect(pk.arcN).toBeGreaterThan(2);
    const out = step(pk, false);
    expect(out?.ok).toBe(true);
    const ex = rifts.playerEnds().exit!;
    // facing where you looked, thrown hard
    expect(ex.normal.x).toBeLessThan(-0.5);
    expect(ex.boost).toBe(PORTAL.throwSpeed.grab);
  });

  it('a hold let go of with no valid aim throws him straight on too', () => {
    const e = fakeEnemy(1, V(0, 0, 10));
    const { rifts, pk, camDir } = rig([e]);
    pk.press();
    // (looking at the floor at your feet: no room for a launcher end)
    camDir.set(0, -1, 0.05).normalize();
    step(pk, true, 20);
    expect(pk.hold?.launch?.valid).toBe(false);
    expect(step(pk, false)?.ok).toBe(true);
    const ex = rifts.playerEnds().exit!;
    expect(ex.position.distanceTo(V(0, 2, 12))).toBeLessThan(0.01);
    expect(ex.normal.z).toBeGreaterThan(0.9);
  });

  it('grabbing a man who is fighting you is free; let go without an exit, he climbs out stumbling', () => {
    const e = fakeEnemy(7, V(0, 0, 10), { offBalance: false });
    const t = rig([e]);
    const r = t.pk.press();
    expect(r.ok).toBe(true);
    expect(e.held).toBe(true);
    t.pk.cancel();
    expect(e.held).toBe(false);
    expect(e.staggered).toBeGreaterThan(0);
    expect(t.rifts.playerEnds().entrance).toBeNull();
  });

  it('a tap with no room straight on (a low roof over him) lets him climb out', () => {
    const e = fakeEnemy(1, V(0, 0, 10));
    const t = rig([e]);
    t.world.add(V(-10, 2.5, 6), V(10, 3, 16), { tag: 'roof' });
    expect(t.pk.press().ok).toBe(true);
    const out = step(t.pk, false);
    expect(out?.ok).toBe(false);
    expect(out?.reason).toBe('portal.nowhere');
    expect(e.held).toBe(false);
    expect(e.staggered).toBeGreaterThan(0);
    expect(t.rifts.playerEnds().entrance).toBeNull();
  });

  it('a door opens its exit on release where you aim; a new press replaces the pair', () => {
    const { world, rifts, pk } = rig([]);
    world.add(V(-10, 0, 20), V(10, 30, 21), { tag: 'wall' });
    expect(pk.press().mode).toBe('door');
    expect(rifts.playerEnds().exit).toBeNull();
    const out = step(pk, false);
    expect(out?.ok).toBe(true);
    const a = rifts.playerEnds();
    expect(a.exit?.kind).toBe('wall');
    expect(a.entrance?.isOpen).toBe(true);
    expect(a.exit?.noPlayer).toBe(false);
    pk.press();
    expect(rifts.playerEnds().exit).toBeNull();
  });
});

/**
 * Tap-grab `e` (the player at the origin), then fly him through the pair with
 * real physics, the PORTAL key ticking as the game runs it.
 */
function tapFlight(e: Fake, o: { wall?: number; men?: THREE.Vector3[] } = {}) {
  const t = rig([e]);
  t.camDir.copy(e.chest().sub(V(0, 2.2, -3)).normalize());
  if (o.wall !== undefined) t.world.add(V(-10, 0, e.pos.z + o.wall), V(10, 6, e.pos.z + o.wall + 1), { tag: 'wall' });
  t.pk.press();
  step(t.pk, false);
  const exit = t.rifts.playerEnds().exit!.position.clone();
  const phys = makePhysics(t.world, t.rifts, { seaY: -20, isSea: (p) => p.x > 12, killYAt: () => -100 });
  const ev = recorder();
  const b = phys.createBody('enemy', { pos: e.pos.clone(), radius: e.radius, height: e.height });
  b.vel.copy(e.launched!);
  const men = (o.men ?? []).map((p) => phys.createBody('enemy', { pos: p.clone(), radius: 0.42, height: 1.8 }));
  let time = 0;
  for (let i = 0; i < 150 && !ev.log.splash.length; i++) {
    const n = ev.log.crossed.length;
    time += 1 / 60;
    phys.step(1 / 60, ev, time);
    if (ev.log.crossed.length > n) t.pk.crossed(`enemy:${e.id}`);
    t.pk.update(1 / 60, false);
  }
  const hits = ev.log.impacts.filter((i) => i.b === b);
  return { ev, b, men, exit, crossings: ev.log.crossed.filter((c) => c.b === b).length, ground: hits.find((i) => i.e.surface === 'ground'), wall: hits.find((i) => i.e.surface === 'wall') };
}

describe('PORTAL key: the straight-on throw', () => {
  it('the numbers: out at 17 m/s, 20 degrees up, from 2 m over his feet: down at 8..12 m/s, 16 m/s on the level', () => {
    const S = PORTAL.straight, v = PORTAL.throwSpeed.grab;
    // (his feet come down 2 m − half his 1.8 m height below where he left)
    const down = Math.sqrt((v * Math.sin(S.tilt)) ** 2 + 2 * LAW.gravity * (S.up - 0.9));
    expect(down).toBeGreaterThanOrEqual(LAW.knockSpeed);
    expect(down).toBeLessThan(LAW.killSpeed);
    expect(v * Math.cos(S.tilt)).toBeGreaterThanOrEqual(LAW.killSpeed);
  });

  it('on open floor he is knocked down, not killed', () => {
    const f = tapFlight(fakeEnemy(1, V(0, 0, 10)));
    expect(f.crossings).toBe(1);
    expect(f.ground?.e.charged).toBe(true);
    expect(f.ground!.e.speed).toBeGreaterThanOrEqual(LAW.knockSpeed);
    expect(f.ground!.e.speed).toBeLessThan(LAW.killSpeed);
    // ~11 m on from the exit
    expect(f.ground!.e.point.z - f.exit.z).toBeGreaterThan(9);
    expect(f.ground!.e.point.z - f.exit.z).toBeLessThan(13);
  });

  it('a wall right behind him pulls the exit back: he is slammed into it, and not thrown again', () => {
    const f = tapFlight(fakeEnemy(1, V(0, 0, 10)), { wall: 1 });
    // 1.4 m short of the wall, on your side of him
    expect(f.exit.z).toBeCloseTo(11 - 1.4, 2);
    expect(f.wall?.e.charged).toBe(true);
    expect(f.wall!.e.speed).toBeGreaterThanOrEqual(LAW.killSpeed);
    // (he drops back onto his hole: it has shut by then)
    expect(f.crossings).toBe(1);
  });

  it('the sea past him takes him', () => {
    const f = tapFlight(fakeEnemy(1, V(8, 0, 0)));
    expect(f.ev.log.splash).toContain(f.b);
  });

  it('a man where he comes down is hit at a killing speed', () => {
    const f = tapFlight(fakeEnemy(1, V(0, 0, 10)), { men: [V(0, 0, 22)] });
    const hit = f.ev.log.touches.find((x) => (x.a === f.b && x.b === f.men[0]) || (x.b === f.b && x.a === f.men[0]));
    expect(hit?.rel ?? 0).toBeGreaterThanOrEqual(LAW.killSpeed);
  });
});

describe('rift ends only for what they were opened for', () => {
  it('the player passes through a noPlayer pair (and its floor holds him); an enemy body falls in', () => {
    const world = makeWorld();
    const rifts = makeRifts(world);
    const phys = makePhysics(world, rifts);
    const ev = recorder();
    const flat = (p: THREE.Vector3, n: THREE.Vector3) => ({ position: p, quaternion: new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n), width: LAW.floorEndSize, height: LAW.floorEndSize });
    rifts.openEntranceFrame(flat(V(0, 0.01, 0), V(0, 1, 0)), 'floor', true);
    rifts.placeExitFrame({ ...flat(V(20, 8, 0), V(0, -1, 0)), kind: 'air' }, null, { noPlayer: true });
    const pl = phys.createBody('player', { pos: V(0, 0.3, 0), radius: 0.35, height: 1.8 });
    const en = phys.createBody('enemy', { pos: V(0, 0.3, 0.1), radius: 0.4, height: 1.8 });
    for (let i = 0; i < 60; i++) phys.step(1 / 60, ev, i / 60);
    expect(pl.pos.y).toBeGreaterThan(-0.05);
    expect(Math.abs(pl.pos.x)).toBeLessThan(1);
    expect(ev.log.crossed.some((c) => c.b === en)).toBe(true);
    expect(ev.log.crossed.some((c) => c.b === pl)).toBe(false);
  });

  it('a falling player just past the rim of an open floor end drifts onto it and goes through', () => {
    const world = makeWorld();
    const rifts = makeRifts(world);
    const phys = makePhysics(world, rifts);
    const ev = recorder();
    const flat = (p: THREE.Vector3, n: THREE.Vector3) => ({ position: p, quaternion: new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n), width: LAW.floorEndSize, height: LAW.floorEndSize });
    rifts.openEntranceFrame(flat(V(0, 0.01, 0), V(0, 1, 0)), 'floor');
    rifts.placeExitFrame({ ...flat(V(30, 1.2, 0), V(1, 0, 0)), kind: 'air' });
    // 1.9 m off its middle (past the 0.85 m rim), 5 m up, falling
    const pl = phys.createBody('player', { pos: V(1.9, 5, 0), radius: 0.35, height: 1.8 });
    pl.vel.set(0, -3, 0);
    for (let i = 0; i < 90; i++) phys.step(1 / 60, ev, i / 60);
    expect(ev.log.crossed.some((c) => c.b === pl)).toBe(true);
  });
});


function strikeRig(enemies: Fake[], o: { airborne?: boolean } = {}) {
  const world = makeWorld(false);
  world.add(V(-40, -2, -40), V(12, 0, 40), { tag: 'ground' });
  const rifts = makeRifts(world);
  const phys = makePhysics(world, rifts);
  const body = phys.createBody('player', { pos: V(0, 0, 0), radius: 0.35, height: 1.8 });
  const camPos = V(0, 2.2, -3);
  const camDir = V(0, 0, 1);
  const provoked: number[] = [];
  const host: StrikeHost = {
    rifts,
    world,
    level: { seaY: -20, isSea: (p) => p.x > 12 },
    killYAt: () => -100,
    enemies: {
      list: enemies as unknown as EnemyView[],
      launch: (v, vel) => ((v as unknown as Fake).launched = vel ? vel.clone() : V(0, 0, 0)),
      provoke: (v) => (provoked.push(v.id), true),
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
    playerGrounded: () => !o.airborne,
    aimRay: () => ({ origin: camPos.clone(), dir: camDir.clone() }),
    touch: () => false,
  };
  return { rifts, s: new Strikes(host), camDir, provoked, body };
}

describe('STRIKES', () => {
  it('LOOP: the floor under him and a hatch right over it; again = geyser, held = the cannon', () => {
    const e = fakeEnemy(1, V(0, 0, 10));
    const { rifts, s, camDir } = strikeRig([e]);
    const r = s.input('loop', true, true);
    expect(r?.ok).toBe(true);
    expect(e.launched).not.toBeNull();
    const ends = (rifts as any).strikes.get(1);
    expect(ends.a.kind).toBe('floor');
    expect(ends.b.normal.y).toBeLessThan(-0.9);
    expect(Math.hypot(ends.b.position.x - ends.a.position.x, ends.b.position.z - ends.a.position.z)).toBeLessThan(0.01);
    expect(ends.b.position.y - ends.a.position.y).toBeGreaterThan(STRIKE.loopMin);
    expect(s.armed('loop')).toBe(true);
    // (the first key press let go)
    s.update(1 / 60, 1 / 60);
    expect(s.input('loop', false, false)).toBeNull();
    // second press, held: the cannon aims (slow motion) along your view
    camDir.set(-1, 0.05, 1).normalize();
    s.update(1 / 60, 1 / 60);
    s.input('loop', true, true);
    for (let i = 0; i < 20; i++) {
      s.update(1 / 60, 1 / 60);
      s.input('loop', false, true);
    }
    expect(s.aiming).toBe(true);
    s.update(1 / 60, 1 / 60);
    const out = s.input('loop', false, false);
    expect(out?.release).toBe('cannon');
    expect(ends.b.boost).toBeGreaterThanOrEqual(STRIKE.cannonSpeed);
    expect(ends.b.normal.x).toBeLessThan(-0.5);
  });

  it('LOOP left alone lets him out as a geyser (up, over the drop if there is one)', () => {
    const e = fakeEnemy(1, V(8, 0, 10));
    const { rifts, s, camDir } = strikeRig([e]);
    camDir.copy(V(8, 1.3, 10).sub(V(0, 2.2, -3)).normalize());
    expect(s.input('loop', true, false)?.ok).toBe(true);
    for (let i = 0; i < Math.ceil(STRIKE.loopLife * 60) + 2; i++) s.update(1 / 60, 1 / 60);
    const ends = (rifts as any).strikes.get(1);
    expect(s.loop?.fired).toBe('geyser');
    expect(ends.b.normal.y).toBeGreaterThan(0.9);
    expect(ends.b.boost).toBeGreaterThanOrEqual(STRIKE.geyserSpeed);
    expect(ends.b.position.x).toBeGreaterThan(12);
  });

  it('REFLECT puts an end on his muzzle facing him and makes him fire', () => {
    const e = fakeEnemy(3, V(0, 0, 10));
    const { rifts, s, provoked } = strikeRig([e]);
    const r = s.input('reflect', true, true);
    expect(r?.ok).toBe(true);
    expect(provoked).toEqual([3]);
    const ends = (rifts as any).strikes.get(1);
    // 0.9 m out of the muzzle along his aim (-Z), facing back at him (+Z)
    expect(ends.a.position.z).toBeCloseTo(9.1, 1);
    expect(ends.a.normal.z).toBeGreaterThan(0.9);
    expect(ends.a.noPlayer && ends.b.noPlayer).toBe(true);
    expect(ends.b.aimAt).toBe(3);
  });

  it('REFLECT on a gunman who cannot fire now is refused, free', () => {
    const e = fakeEnemy(3, V(0, 0, 10));
    const r = strikeRig([e]);
    (r.s as any).h.enemies.provoke = () => false;
    const out = r.s.input('reflect', true, true);
    expect(out?.ok).toBe(false);
    expect(out?.reason).toBe('strike.cantFire');
    expect(r.s.charges).toBe(STRIKE.maxCharges);
  });

  it('SWAP needs your feet on the ground; DASH with no one in sight dashes ahead at your height', () => {
    const e = fakeEnemy(1, V(0, 0, 10));
    expect(strikeRig([e], { airborne: true }).s.input('swap', true, true)?.reason).toBe('strike.grounded');
    const { rifts, s, body } = strikeRig([]);
    const r = s.input('dash', true, true);
    expect(r?.ok).toBe(true);
    const ends = (rifts as any).strikes.get(1);
    expect(ends.a.kind).toBe('floor');
    expect(ends.b.normal.z).toBeGreaterThan(0.9);
    expect(ends.b.position.z).toBeGreaterThan(8);
    expect(ends.b.position.y - ends.b.height / 2).toBeLessThan(0.3);
    expect(body.vel.y).toBeLessThan(0);
    expect(s.charges).toBe(STRIKE.maxCharges - 1);
  });

  it('LOOP / SWAP refuse the anchored: only Voss is told to be stunned first (a turret never moves)', () => {
    expect(strikeRig([fakeEnemy(1, V(0, 0, 10), { kind: 'turret' })]).s.input('loop', true, true)?.reason).toBe('portal.anchored');
    const voss = fakeEnemy(2, V(0, 0, 10), { kind: 'boss', offBalance: false });
    expect(strikeRig([voss]).s.input('swap', true, true)?.reason).toBe('strike.anchored');
    voss.offBalance = true;
    expect(strikeRig([voss]).s.input('loop', true, true)?.ok).toBe(true);
  });
});
