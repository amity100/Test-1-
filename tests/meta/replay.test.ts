import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { CharacterPose, ReplayHost, RiftSnap, Snapshot, TrickAward, Tuple3 } from '../../src/core/contracts';
import { ReplayPlayer, ReplayRecorder, SnapshotLerper, lerpAngle, DIRECTOR } from '../../src/meta/replay';

function pose(tag: number): CharacterPose {
  return {
    loco: { speed: tag, grounded: true, vy: 0, crouch: 0, aim: 0, downed: false, weaponUp: 0 },
    clip: null, clipT: 0, clipW: 0, tumble: null, dead: false, deathKind: null, mixerT: tag,
  };
}

interface SnapOpts {
  actorX?: number;
  yaw?: number;
  tricks?: TrickAward[];
  rifts?: RiftSnap[];
  camPos?: Tuple3;
  extraActors?: Snapshot['actors'];
}

function snap(t: number, o: SnapOpts = {}): Snapshot {
  const x = o.actorX ?? 0;
  return {
    t,
    cam: { pos: o.camPos ?? [x, 3, 6], quat: [0, 0, 0, 1], fov: 60 },
    actors: [
      { key: 'player', pos: [x, 0, 0], yaw: o.yaw ?? 0, pose: pose(t), visible: true },
      ...(o.extraActors ?? []),
    ],
    rifts: o.rifts ?? [],
    projs: [],
    props: [{ key: 'prop:1', pos: [x, 1, 0], quat: [0, 0, 0, 1], visible: true }],
    tricks: o.tricks ?? [],
    timeScale: 1,
    focus: [x, 0, 0],
  };
}

class FakeHost implements ReplayHost {
  camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  canvas = { width: 1280, height: 720 } as unknown as HTMLCanvasElement;
  applied: { t: number; x: number; yaw: number; poseTag: number }[] = [];
  cams: THREE.Vector3[] = [];
  begins = 0;
  ends = 0;
  renders = 0;
  losCalls = 0;
  losResult: (a: THREE.Vector3, b: THREE.Vector3) => boolean = () => true;
  apply(s: Snapshot): void {
    const a = s.actors[0];
    this.applied.push({ t: s.t, x: a.pos[0], yaw: a.yaw, poseTag: a.pose.mixerT });
  }
  render(): void {
    this.renders++;
    this.cams.push(this.camera.position.clone());
  }
  beginReplay(): void { this.begins++; }
  endReplay(): void { this.ends++; }
  lineOfSight(a: THREE.Vector3, b: THREE.Vector3): boolean {
    this.losCalls++;
    return this.losResult(a, b);
  }
}

/** frames over [0, dur] at 30 Hz, player moving +x at `speed` m/s */
function track(dur: number, speed = 3, extra?: (t: number) => SnapOpts): Snapshot[] {
  const out: Snapshot[] = [];
  const n = Math.round(dur * 30);
  for (let i = 0; i <= n; i++) {
    const t = i / 30;
    out.push(snap(t, { actorX: t * speed, ...(extra ? extra(t) : {}) }));
  }
  return out;
}

function runAll(p: ReplayPlayer, dt = 1 / 60, max = 100000): number {
  let frames = 0;
  while (p.update(dt) && frames < max) frames++;
  return frames;
}

describe('ReplayRecorder', () => {
  it('throttles to hz by snapshot time', () => {
    const r = new ReplayRecorder(15, 30);
    let kept = 0;
    for (let i = 0; i <= 60; i++) if (r.record(snap(i / 60))) kept++;
    expect(kept).toBeGreaterThanOrEqual(30);
    expect(kept).toBeLessThanOrEqual(31);
    expect(r.size).toBe(kept);
    // Uneven frame rates still average ~hz.
    const r2 = new ReplayRecorder(15, 30);
    let k2 = 0;
    for (let i = 0; i <= 100; i++) if (r2.record(snap(i / 50))) k2++;
    expect(k2).toBeGreaterThanOrEqual(58);
    expect(k2).toBeLessThanOrEqual(62);
  });

  it('is a bounded ring buffer', () => {
    const r = new ReplayRecorder(15, 30);
    for (let i = 0; i < 3000; i++) r.record(snap(i / 30));
    expect(r.size).toBe(r.capacity);
    expect(r.capacity).toBeLessThanOrEqual(15 * 30 + 2);
    const f = r.frames();
    expect(f.length).toBeLessThanOrEqual(r.capacity);
    for (let i = 1; i < f.length; i++) expect(f[i].t).toBeGreaterThan(f[i - 1].t);
    expect(f[f.length - 1].t).toBeCloseTo(2999 / 30, 6);
    expect(r.lastT).toBeCloseTo(2999 / 30, 6);
  });

  it('keeps only the time window, and filters by range', () => {
    const r = new ReplayRecorder(2, 30);
    // Recording slower than hz: the ring could hold 6 s, the window is 2 s.
    for (let i = 0; i <= 100; i++) r.record(snap(i / 10));
    const f = r.frames();
    expect(f[0].t).toBeGreaterThanOrEqual(10 - 2 - 1e-9);
    expect(f[f.length - 1].t).toBeCloseTo(10, 6);
    expect(r.firstT).toBeCloseTo(8, 6);
    const part = r.frames(9, 9.5);
    expect(part.map((s) => Math.round(s.t * 10))).toEqual([90, 91, 92, 93, 94, 95]);
  });

  it('time going backwards starts over; clear() empties', () => {
    const r = new ReplayRecorder(15, 30);
    for (let i = 0; i < 30; i++) r.record(snap(10 + i / 30));
    expect(r.record(snap(1))).toBe(true);
    expect(r.size).toBe(1);
    expect(r.lastT).toBe(1);
    r.clear();
    expect(r.size).toBe(0);
    expect(r.frames()).toEqual([]);
    expect(r.lastT).toBe(-Infinity);
  });

  it('aroundCombo picks ~10 s around the combo, keeping its end', () => {
    const r = new ReplayRecorder(15, 30);
    for (let i = 0; i <= 20 * 30; i++) r.record(snap(i / 30));
    const a = r.aroundCombo({ from: 14, to: 16 });
    expect(a[0].t).toBeCloseTo(11, 6);
    expect(a[a.length - 1].t).toBeCloseTo(17.5, 6);
    const long = r.aroundCombo({ from: 6, to: 19 });
    expect(long[long.length - 1].t).toBeCloseTo(20, 6);
    expect(long[0].t).toBeCloseTo(10, 6);
    const none = r.aroundCombo(null, 4);
    expect(none[0].t).toBeCloseTo(16, 6);
    expect(new ReplayRecorder().aroundCombo({ from: 0, to: 1 })).toEqual([]);
    // The returned array survives the ring buffer moving on.
    for (let i = 1; i <= 30 * 30; i++) r.record(snap(20 + i / 30));
    expect(a[0].t).toBeCloseTo(11, 6);
  });

  it('tricks on dropped snapshots (and addTricks) move to the next kept one', () => {
    const r = new ReplayRecorder(15, 30);
    const a: TrickAward = { id: 'boom', key: 'trick.boom', points: 250, t: 0.017 };
    const b: TrickAward = { id: 'ghost', key: 'trick.ghost', points: 150, t: 0.02 };
    r.record(snap(0));
    expect(r.wants(1 / 60)).toBe(false);
    expect(r.record(snap(1 / 60, { tricks: [a] }))).toBe(false);
    r.addTricks([b]);
    expect(r.wants(2 / 60)).toBe(true);
    expect(r.record(snap(2 / 60))).toBe(true);
    const f = r.frames();
    expect(f[1].tricks.map((x) => x.id)).toEqual(['boom', 'ghost']);
  });
});

describe('interpolation', () => {
  it('lerpAngle takes the short way around', () => {
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5, 6);
    const m = lerpAngle(3, -3, 0.5);
    expect(Math.abs(Math.abs(m) - Math.PI)).toBeLessThan(1e-6);
    expect(lerpAngle(-3, 3, 0.25)).toBeCloseTo(-3 - (2 * Math.PI - 6) * 0.25, 6);
  });

  it('lerps positions, slerps quats, lerps yaw, takes the nearer pose', () => {
    const L = new SnapshotLerper();
    const a = snap(0, { actorX: 0, yaw: 3 });
    const b = snap(0.1, { actorX: 1, yaw: -3 });
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    b.props[0].quat = [q.x, q.y, q.z, q.w];
    b.cam.fov = 70;
    const o = L.lerp(a, b, 0.25);
    expect(o.t).toBeCloseTo(0.025, 9);
    expect(o.actors[0].pos[0]).toBeCloseTo(0.25, 9);
    expect(o.props[0].pos[0]).toBeCloseTo(0.25, 9);
    expect(o.focus[0]).toBeCloseTo(0.25, 9);
    expect(o.cam.fov).toBeCloseTo(62.5, 9);
    expect(o.actors[0].pose).toBe(a.actors[0].pose);
    const expectedYaw = lerpAngle(3, -3, 0.25);
    expect(o.actors[0].yaw).toBeCloseTo(expectedYaw, 9);
    const oq = new THREE.Quaternion(...o.props[0].quat);
    const eq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 8);
    expect(oq.angleTo(eq)).toBeLessThan(1e-6);
    const o2 = L.lerp(a, b, 0.75);
    expect(o2.actors[0].pose).toBe(b.actors[0].pose);
    expect(o2.actors[0].pos[0]).toBeCloseTo(0.75, 9);
  });

  it("carries the player's blade from the nearer frame (a replay shows the stab, and nothing frozen out)", () => {
    const L = new SnapshotLerper();
    const a = snap(0);
    const b = snap(0.1);
    a.actors[0].blade = 0;
    b.actors[0].blade = 1;
    expect(L.lerp(a, b, 0.25).actors[0].blade).toBe(0);
    expect(L.lerp(a, b, 0.75).actors[0].blade).toBe(1);
  });

  it('reuses its output objects (no per-frame allocation)', () => {
    const L = new SnapshotLerper();
    const a = snap(0);
    const b = snap(0.1, { actorX: 1 });
    const o1 = L.lerp(a, b, 0.3);
    const actor = o1.actors[0];
    const o2 = L.lerp(a, b, 0.6);
    expect(o2).toBe(o1);
    expect(o2.actors[0]).toBe(actor);
  });

  it('snaps things that teleported (rift pass) instead of sliding', () => {
    const L = new SnapshotLerper();
    const a = snap(0, { actorX: 0 });
    const b = snap(1 / 30, { actorX: 30 }); // 900 m/s: impossible, it's a rift pass
    expect(L.lerp(a, b, 0.4).actors[0].pos[0]).toBe(0);
    expect(L.lerp(a, b, 0.6).actors[0].pos[0]).toBe(30);
  });

  it('membership comes from the nearer frame; matching is by key / id', () => {
    const L = new SnapshotLerper();
    const r1: RiftSnap = { id: 7, pos: [0, 0, 0], quat: [0, 0, 0, 1], kind: 'wall', open: 0, color: 'exit', linkedId: 8 };
    const r2: RiftSnap = { ...r1, pos: [0, 0, 0], open: 1 };
    const a = snap(0, { rifts: [r1] });
    const b = snap(0.1, {
      rifts: [r2],
      extraActors: [{ key: 'enemy:2', pos: [5, 0, 0], yaw: 0, pose: pose(99), visible: true }],
    });
    // Reorder b's actors to check key matching.
    b.actors.reverse();
    const o = L.lerp(a, b, 0.25);
    expect(o.actors.length).toBe(1);
    expect(o.actors[0].key).toBe('player');
    expect(o.rifts[0].open).toBeCloseTo(0.25, 9);
    const o2 = L.lerp(a, b, 0.75);
    expect(o2.actors.length).toBe(2);
    expect(o2.actors.find((x) => x.key === 'player')!.pos[0]).toBeCloseTo(0, 9);
  });
});

describe('ReplayPlayer (plain)', () => {
  it('plays interpolated frames with the recorded camera, then stops', () => {
    const host = new FakeHost();
    host.camera.position.set(100, 100, 100);
    host.camera.fov = 42;
    host.camera.updateProjectionMatrix();
    const p = new ReplayPlayer(host);
    const frames = track(1, 3);
    p.play(frames, { cinematic: false, overlay: true });
    expect(p.playing).toBe(true);
    expect(host.begins).toBe(1);
    expect(p.overlayCanvas).toBeNull(); // node: no DOM
    expect(p.duration).toBeCloseTo(1, 6);
    expect(p.progress).toBe(0);

    const n = runAll(p, 1 / 60);
    expect(n).toBeGreaterThanOrEqual(60);
    expect(n).toBeLessThanOrEqual(62);
    expect(p.playing).toBe(false);
    expect(host.ends).toBe(1);
    expect(p.progress).toBe(1);
    // Interpolation: x = 3 t exactly (linear motion), camera follows the recording.
    for (let i = 0; i < host.applied.length; i++) {
      const a = host.applied[i];
      expect(a.x).toBeCloseTo(a.t * 3, 6);
      expect(host.cams[i].x).toBeCloseTo(a.t * 3, 6);
      expect(host.cams[i].y).toBeCloseTo(3, 6);
    }
    // Times strictly increase and reach the end.
    for (let i = 1; i < host.applied.length; i++) expect(host.applied[i].t).toBeGreaterThan(host.applied[i - 1].t);
    expect(host.applied[host.applied.length - 1].t).toBeCloseTo(1, 6);
    // Poses come from the nearer frame.
    const mid = host.applied.find((a) => Math.abs(a.t - 0.51) < 0.009)!;
    expect(mid.poseTag).toBeCloseTo(Math.round(mid.t * 30) / 30, 6);
    // Camera restored.
    expect(host.camera.position.x).toBe(100);
    expect(host.camera.fov).toBe(42);
    // update() after the end is a no-op.
    expect(p.update(0.1)).toBe(false);
    expect(host.ends).toBe(1);
  });

  it('speed option scales playback', () => {
    const host = new FakeHost();
    const p = new ReplayPlayer(host);
    p.play(track(2), { cinematic: false, overlay: false, speed: 2 });
    expect(p.duration).toBeCloseTo(1, 6);
    const n = runAll(p, 1 / 30);
    expect(n).toBeGreaterThanOrEqual(30);
    expect(n).toBeLessThanOrEqual(32);
  });

  it('stop() ends early and restores', () => {
    const host = new FakeHost();
    const p = new ReplayPlayer(host);
    p.play(track(2), { cinematic: false, overlay: false });
    p.update(0.1);
    p.stop();
    p.stop();
    expect(p.playing).toBe(false);
    expect(host.ends).toBe(1);
  });

  it('handles empty / single-frame input', () => {
    const host = new FakeHost();
    const p = new ReplayPlayer(host);
    p.play([], { cinematic: true, overlay: false });
    expect(p.playing).toBe(false);
    expect(host.begins).toBe(0);
    p.play([snap(3)], { cinematic: true, overlay: false });
    expect(p.playing).toBe(true);
    expect(runAll(p, 1 / 30)).toBeGreaterThan(0);
    expect(host.ends).toBe(1);
  });

  it('never throws into the game loop when the host fails', () => {
    const host = new FakeHost();
    host.apply = () => { throw new Error('boom'); };
    const p = new ReplayPlayer(host);
    p.play(track(1), { cinematic: false, overlay: false });
    expect(p.update(1 / 60)).toBe(false);
    expect(p.playing).toBe(false);
    expect(host.ends).toBe(1);
  });
});

describe('ReplayPlayer (cinematic director)', () => {
  const trick = (t: number, at: THREE.Vector3): TrickAward => ({ id: 'returnToSender', key: 'trick.returnToSender', points: 300, t, at });

  it('slow-mo around a trick lengthens the replay; orbit + wide shots', () => {
    const host = new FakeHost();
    const p = new ReplayPlayer(host);
    const at = new THREE.Vector3(15, 0, 0);
    const frames = track(10, 3, (t) => (Math.abs(t - 5) < 1e-6 ? { tricks: [trick(5, at)] } : {}));
    p.play(frames, { cinematic: true, overlay: false });
    const kinds = p.shots.map((s) => s.kind);
    expect(kinds[0]).toBe('wide');
    expect(kinds).toContain('orbit');
    expect(kinds).toContain('game');
    // Shots tile the source span.
    const shots = p.shots;
    expect(shots[0].a).toBeCloseTo(0, 6);
    expect(shots[shots.length - 1].b).toBeCloseTo(10, 6);
    for (let i = 1; i < shots.length; i++) expect(shots[i].a).toBeCloseTo(shots[i - 1].b, 6);
    // Duration ≈ source + slow-mo extra + end card.
    const slowExtra = DIRECTOR.slowSource / DIRECTOR.slowFactor - DIRECTOR.slowSource;
    expect(p.duration).toBeGreaterThan(10 + slowExtra + DIRECTOR.tail - 0.01);
    expect(p.duration).toBeLessThan(10 + slowExtra + DIRECTOR.tail + 0.3);

    // Measure source speed: slow near the award, normal elsewhere.
    let prevSrc = p.sourceTime;
    const rates: { src: number; rate: number }[] = [];
    let orbitCam: THREE.Vector3 | null = null;
    while (p.update(1 / 60)) {
      rates.push({ src: p.sourceTime, rate: (p.sourceTime - prevSrc) * 60 });
      prevSrc = p.sourceTime;
      if (p.shotKind === 'orbit' && Math.abs(p.sourceTime - 5) < 0.05) orbitCam = host.camera.position.clone();
    }
    const at5 = rates.filter((r) => Math.abs(r.src - (5 - DIRECTOR.slowLead + DIRECTOR.slowSource / 2)) < 0.05);
    expect(at5.length).toBeGreaterThan(0);
    for (const r of at5) expect(r.rate).toBeCloseTo(DIRECTOR.slowFactor, 2);
    const at2 = rates.filter((r) => Math.abs(r.src - 2.5) < 0.1);
    for (const r of at2) expect(r.rate).toBeCloseTo(1, 2);
    // The orbit camera circles the trick point (chest height centre).
    expect(orbitCam).not.toBeNull();
    const c = at.clone().add(new THREE.Vector3(0, 1, 0));
    const horiz = Math.hypot(orbitCam!.x - c.x, orbitCam!.z - c.z);
    expect(horiz).toBeGreaterThan(DIRECTOR.orbitRadius * 0.6);
    expect(horiz).toBeLessThan(DIRECTOR.orbitRadius + 0.01);
    expect(orbitCam!.y).toBeCloseTo(c.y + DIRECTOR.orbitHeight, 3);
    expect(host.ends).toBe(1);
  });

  it('falls back to the recorded camera when nothing has line of sight', () => {
    const host = new FakeHost();
    host.losResult = () => false;
    const p = new ReplayPlayer(host);
    const at = new THREE.Vector3(15, 0, 0);
    const frames = track(10, 3, (t) => (Math.abs(t - 5) < 1e-6 ? { tricks: [trick(5, at)] } : {}));
    p.play(frames, { cinematic: true, overlay: false });
    expect(p.shots.every((s) => s.kind === 'game')).toBe(true);
    let checked = 0;
    while (p.update(1 / 30)) {
      const a = host.applied[host.applied.length - 1];
      const cam = host.cams[host.cams.length - 1];
      // Smoothed gameplay camera stays close to the recorded one.
      expect(Math.abs(cam.x - a.t * 3)).toBeLessThan(0.6);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('a shot blocked mid-way falls back to the gameplay camera', () => {
    const host = new FakeHost();
    const p = new ReplayPlayer(host);
    const at = new THREE.Vector3(15, 0, 0);
    const frames = track(10, 3, (t) => (Math.abs(t - 5) < 1e-6 ? { tricks: [trick(5, at)] } : {}));
    p.play(frames, { cinematic: true, overlay: false });
    // Validated at play time; now the world "changes" and blocks everything.
    host.losResult = () => false;
    const kinds = new Set<string>();
    while (p.update(1 / 60)) kinds.add(p.shotKind);
    expect(kinds.has('orbit')).toBe(false);
    expect(kinds.has('wide')).toBe(false);
  });

  it('portal cam when something emerges from an exit near the trick point', () => {
    const host = new FakeHost();
    const p = new ReplayPlayer(host);
    // Exit rift on a wall at x=20 facing -x; a guard pops out of it at t≈3.8 and dies at t=5.
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0));
    const exit: RiftSnap = { id: 2, pos: [20, 1.2, 0], quat: [q.x, q.y, q.z, q.w], kind: 'wall', open: 1, color: 'exit', linkedId: 1 };
    const entrance: RiftSnap = { id: 1, pos: [0, 1.2, 10], quat: [0, 0, 0, 1], kind: 'wall', open: 1, color: 'entrance', linkedId: 2 };
    const at = new THREE.Vector3(14, 0, 0);
    const frames = track(8, 0, (t) => {
      const o: SnapOpts = { rifts: [entrance, exit] };
      if (t >= 3.8) {
        const gx = 19.3 - (t - 3.8) * 4.5;
        o.extraActors = [{ key: 'enemy:4', pos: [gx, 0.3, 0], yaw: 0, pose: pose(1), visible: true }];
      }
      if (Math.abs(t - 5) < 1e-6) o.tricks = [trick(5, at)];
      return o;
    });
    p.play(frames, { cinematic: true, overlay: false });
    const kinds = p.shots.map((s) => s.kind);
    expect(kinds).toContain('portal');
    const portal = p.shots.find((s) => s.kind === 'portal')!;
    expect(portal.a).toBeLessThan(3.8);
    expect(portal.b).toBeGreaterThan(3.8);
    let cam: THREE.Vector3 | null = null;
    while (p.update(1 / 60)) if (p.shotKind === 'portal' && !cam) cam = host.camera.position.clone();
    expect(cam).not.toBeNull();
    // Beside the exit, just in front of its plane.
    expect(cam!.distanceTo(new THREE.Vector3(20, 1.2, 0))).toBeLessThan(2);
    expect(cam!.x).toBeLessThan(20);
  });

  it('several close tricks merge into one orbit with one cut', () => {
    const host = new FakeHost();
    const p = new ReplayPlayer(host);
    const frames = track(10, 1, (t) => {
      if (Math.abs(t - 4) < 1e-6) return { tricks: [trick(4, new THREE.Vector3(4, 0, 0))] };
      if (Math.abs(t - 4.6) < 1e-6) return { tricks: [trick(4.6, new THREE.Vector3(5, 0, 0))] };
      return {};
    });
    p.play(frames, { cinematic: true, overlay: false });
    const orbits = p.shots.filter((s) => s.kind === 'orbit');
    expect(orbits.length).toBe(1);
    expect(orbits[0].a).toBeLessThan(4);
    expect(orbits[0].b).toBeGreaterThan(4.6);
  });

  it('progress runs 0 → 1', () => {
    const host = new FakeHost();
    const p = new ReplayPlayer(host);
    p.play(track(3), { cinematic: true, overlay: false });
    let last = p.progress;
    while (p.update(1 / 30)) {
      expect(p.progress).toBeGreaterThanOrEqual(last);
      last = p.progress;
    }
    expect(last).toBeCloseTo(1, 6);
  });
});
