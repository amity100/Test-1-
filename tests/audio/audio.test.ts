import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Audio } from '../../src/engine/audio';
import type { StyleRank } from '../../src/core/contracts';

// -----------------------------------------------------------------------------
// A strict fake WebAudio context: validates automation values like browsers do
// (RangeError on exponential ramps to 0, non-finite values, double start...),
// tracks live nodes and fires onended when time advances.
// -----------------------------------------------------------------------------

const errors: string[] = [];
function fail(msg: string): never {
  errors.push(msg);
  throw new RangeError(msg);
}
const finite = (x: number, what: string) => { if (!Number.isFinite(x)) fail(`${what} not finite: ${x}`); };

class FParam {
  value: number;
  events = 0;
  constructor(v = 0) { this.value = v; }
  setValueAtTime(v: number, t: number) { finite(v, 'setValueAtTime value'); finite(t, 'time'); if (t < 0) fail('negative time'); this.events++; this.value = v; return this; }
  linearRampToValueAtTime(v: number, t: number) { finite(v, 'linearRamp value'); finite(t, 'time'); this.events++; this.value = v; return this; }
  exponentialRampToValueAtTime(v: number, t: number) {
    finite(v, 'expRamp value'); finite(t, 'time');
    if (v === 0) fail('exponentialRamp to 0');
    this.events++; this.value = v; return this;
  }
  setTargetAtTime(v: number, t: number, tc: number) { finite(v, 'setTarget value'); finite(t, 'time'); finite(tc, 'tc'); if (tc < 0) fail('negative tc'); this.events++; return this; }
  cancelScheduledValues(t: number) { finite(t, 'cancel time'); return this; }
}

let live = 0;
let created = 0;
class FNode {
  outs = new Set<unknown>();
  channelCount = 2;
  channelCountMode = 'max';
  constructor(readonly ctx: FakeCtx) { live++; created++; }
  connect(d: unknown) {
    if (!(d instanceof FNode) && !(d instanceof FParam)) fail('connect to non-node');
    this.outs.add(d);
    return d;
  }
  disconnect(d?: unknown) {
    if (d === undefined) {
      if (this.outs.size) live--;
      this.outs.clear();
      // count a node as released once its outputs are gone
    } else this.outs.delete(d);
  }
}
class FSource extends FNode {
  started = false;
  stopAt = Infinity;
  onended: (() => void) | null = null;
  ended = false;
  start(t = 0, offset = 0) {
    finite(t, 'start'); finite(offset, 'offset');
    if (this.started) fail('start twice');
    this.started = true;
    this.ctx.sources.add(this);
  }
  stop(t = 0) { finite(t, 'stop'); if (!this.started) fail('stop before start'); this.stopAt = Math.min(this.stopAt, Math.max(t, this.ctx.currentTime)); }
}
class FOsc extends FSource { type = 'sine'; frequency = new FParam(440); detune = new FParam(0); }
class FBufSrc extends FSource { buffer: unknown = null; loop = false; playbackRate = new FParam(1); detune = new FParam(0); }
class FConst extends FSource { offset = new FParam(1); }
class FGain extends FNode { gain = new FParam(1); }
class FFilter extends FNode { type = 'lowpass'; frequency = new FParam(350); Q = new FParam(1); gain = new FParam(0); }
class FPanner extends FNode {
  panningModel = 'HRTF'; distanceModel = 'inverse'; refDistance = 1; rolloffFactor = 1; maxDistance = 10000;
  positionX = new FParam(); positionY = new FParam(); positionZ = new FParam();
  setPosition() {}
}

class FakeCtx {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  sources = new Set<FSource>();
  destination = new FNode(this);
  listener = {
    positionX: new FParam(), positionY: new FParam(), positionZ: new FParam(),
    forwardX: new FParam(), forwardY: new FParam(), forwardZ: new FParam(-1),
    upX: new FParam(), upY: new FParam(1), upZ: new FParam(),
    setPosition() {}, setOrientation() {},
  };
  createBuffer(ch: number, len: number, sr: number) {
    const data = new Float32Array(len);
    return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: () => data };
  }
  createGain() { return new FGain(this); }
  createOscillator() { return new FOsc(this); }
  createBufferSource() { return new FBufSrc(this); }
  createConstantSource() { return new FConst(this); }
  createBiquadFilter() { return new FFilter(this); }
  createPanner() { return new FPanner(this); }
  createStereoPanner() { return Object.assign(new FNode(this), { pan: new FParam() }); }
  createDelay() { return Object.assign(new FNode(this), { delayTime: new FParam() }); }
  createChannelMerger() { return new FNode(this); }
  createWaveShaper() { return Object.assign(new FNode(this), { curve: null as unknown, oversample: 'none' }); }
  createDynamicsCompressor() {
    return Object.assign(new FNode(this), {
      threshold: new FParam(), knee: new FParam(), ratio: new FParam(), attack: new FParam(), release: new FParam(),
    });
  }
  /** Advance time, firing onended for sources that stopped. */
  advance(dt: number) {
    this.currentTime += dt;
    for (const s of [...this.sources]) {
      if (s.stopAt <= this.currentTime && !s.ended) {
        s.ended = true;
        this.sources.delete(s);
        s.onended?.();
      }
    }
  }
}

const P = (x: number, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function everySound(a: Audio, at: THREE.Vector3) {
  a.riftOpen(at, 'entrance'); a.riftOpen(at, 'exit'); a.riftOpen(at, 'gate');
  a.riftClose(at); a.riftPass(at, 30); a.riftPass(at, 2); a.riftCatch(at); a.shear(at); a.hijack(at);
  a.boltFire(at); a.boltWhizz(at); a.boltImpact(at, false); a.boltImpact(P(at.x + 9, at.y, at.z), true);
  a.laserLock(at); a.beamCharge(at); a.beamFire(at); a.grenadeBounce(at);
  a.explosion(at, 1); a.explosion(P(at.x, at.y + 20, at.z), 2.5); a.splash(at, 1); a.impact(at, 6); a.impact(P(at.x, at.y, at.z + 9), 20);
  a.shieldClang(at); a.roar(at); a.bladeFinish(at); a.shove(at);
  a.footstep(at, 0.5); a.footstep(P(at.x + 5, at.y, at.z), 1, true); a.jump(at); a.land(at, 5); a.land(P(at.x - 5, at.y, at.z), 20); a.hurt();
  for (const r of ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] as StyleRank[]) a.trick(r, 300);
  a.comboBank(2500);
  for (const k of ['click', 'confirm', 'deny', 'pickup', 'objective', 'clip', 'shutter'] as const) a.ui(k);
  for (const k of ['alert', 'zone', 'boss', 'victory'] as const) a.sting(k);
  a.shout(at);
}

describe('Audio without WebAudio (node)', () => {
  it('constructs, and every call before unlock is a silent no-op', () => {
    const a = new Audio();
    expect(a.ctx).toBeNull();
    const cam = new THREE.PerspectiveCamera();
    expect(() => {
      a.unlock(); // no window in node: stays silent
      a.updateListener(cam);
      a.setIntensity(0.5, 1, 1 / 60);
      a.setAltitude(90);
      a.setSlowmo(1);
      a.wind(30);
      a.loopWhoosh(20);
      a.lift(P(0), true);
      a.lift(P(0), false);
      everySound(a, P(1, 2, 3));
      const h = a.hum(P(0));
      h.move(P(1));
      h.stop();
      h.stop();
      a.setVolume(0.5, 0.5, 0.5);
      a.setPaused(true);
      expect(a.mediaStream()).toBeNull();
    }).not.toThrow();
    expect(a.ctx).toBeNull();
    expect(a.stats().voices).toBe(0);
  });
});

describe('Audio on a strict fake context', () => {
  let ctx: FakeCtx;
  let a: Audio;
  beforeEach(() => {
    errors.length = 0;
    live = 0;
    created = 0;
    ctx = new FakeCtx();
    a = new Audio();
    expect(a.useContext(ctx as unknown as BaseAudioContext)).toBe(true);
    expect(a.useContext(ctx as unknown as BaseAudioContext)).toBe(false);
  });

  it('the strict fake rejects what browsers reject', () => {
    const g = ctx.createGain();
    expect(() => g.gain.exponentialRampToValueAtTime(0, 1)).toThrow(RangeError);
    const o = ctx.createOscillator();
    o.start(0);
    expect(() => o.start(0)).toThrow();
    errors.length = 0;
  });

  it('builds every sound without invalid automation', () => {
    const n0 = created;
    everySound(a, P(0, 0, -4));
    expect(created - n0).toBeGreaterThan(400);
    expect(a.stats().voices).toBeGreaterThan(20);
    ctx.advance(0.5);
    a.spatial = 'panner';
    everySound(a, P(3, 1, -6));
    a.spatial = 'stereo';
    const h = a.hum(P(0, 1, -2));
    h.move(P(0, 1.5, -2));
    h.stop();
    a.lift(P(2, 0, 0), true);
    a.lift(P(2, 1, 0), true);
    a.lift(P(2, 2, 0), false);
    for (let i = 0; i < 30; i++) {
      a.setSlowmo(i < 15 ? i / 15 : (30 - i) / 15);
      a.wind(i);
      a.loopWhoosh(5 + i);
      a.setAltitude(i * 3);
      a.setIntensity(i / 30, i / 30, 1 / 30);
      ctx.advance(1 / 30);
    }
    expect(errors).toEqual([]);
  });

  it('limits concurrent one-shots and never exceeds maxVoices', () => {
    a.maxVoices = 12;
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      const at = P(i * 7, 0, -3);
      a.shieldClang(at); a.boltImpact(at, true); a.impact(at, 8); a.riftClose(at);
      peak = Math.max(peak, a.stats().voices);
      expect(a.stats().voices).toBeLessThanOrEqual(12);
    }
    expect(peak).toBe(12);
    expect(errors).toEqual([]);
  });

  it('throttles repeated sounds from the same area', () => {
    const at = P(0, 0, -3);
    a.boltFire(at);
    const n1 = created;
    a.boltFire(at); // same frame, same place: dropped
    expect(created).toBe(n1);
    ctx.advance(0.05);
    a.boltFire(at);
    expect(created).toBeGreaterThan(n1);
    a.boltFire(P(30, 0, -3)); // a different area plays
  });

  it('stereo spatialisation pans by the listener and attenuates with distance', () => {
    const cam = new THREE.PerspectiveCamera(); // at origin, looking down -Z: +X is to the right
    cam.updateMatrixWorld(true);
    a.updateListener(cam);
    const pans: number[] = [];
    const orig = ctx.createStereoPanner.bind(ctx);
    ctx.createStereoPanner = () => {
      const p = orig();
      const i = pans.push(0) - 1;
      Object.defineProperty(p.pan, 'value', { set: (x: number) => { pans[i] = x; }, get: () => pans[i] });
      return p;
    };
    a.shieldClang(P(10, 0, 0)); // right
    a.shieldClang(P(-10, 0, 20)); // left, further
    expect(pans[0]).toBeGreaterThan(0.5);
    expect(pans[1]).toBeLessThan(-0.2);
    expect(errors).toEqual([]);
  });

  it('culls inaudible far sounds', () => {
    const n0 = created;
    a.footstep(P(5000, 0, 0), 0.2);
    expect(created).toBe(n0);
  });

  it('per-frame controls do not allocate nodes every frame', () => {
    const cam = new THREE.PerspectiveCamera();
    a.loopWhoosh(10); // lazily builds its chain once
    a.lift(P(0), true);
    const n0 = created;
    for (let i = 0; i < 120; i++) {
      a.updateListener(cam);
      a.wind(10 + i * 0.2);
      a.loopWhoosh(10 + i * 0.2);
      a.setAltitude(i);
      a.setSlowmo((i % 40) / 40 * 0.2); // stays below the bullet-time cue edge
      a.lift(P(0, i * 0.1, 0), true);
      ctx.advance(1 / 60);
    }
    expect(created).toBe(n0);
    expect(errors).toEqual([]);
  });

  it('frees voices and music notes when they end', () => {
    const base = live;
    everySound(a, P(0, 0, -4));
    for (let i = 0; i < 600; i++) {
      a.setIntensity(0.3, i < 300 ? 1 : 0, 1 / 60);
      ctx.advance(1 / 60);
    }
    ctx.advance(6);
    a.setIntensity(0, 0, 0); // reschedule after the jump, nothing pending
    ctx.advance(2);
    expect(a.stats().voices).toBe(0);
    // Only the persistent graph (plus at most a few pending notes) is left.
    expect(live - base).toBeLessThan(20);
    expect(errors).toEqual([]);
  });

  it('hum handles are idempotent and capped', () => {
    const hs = [];
    for (let i = 0; i < 12; i++) hs.push(a.hum(P(i, 0, 0)));
    expect(a.stats().hums).toBe(8);
    for (const h of hs) { h.stop(); h.stop(); }
    expect(a.stats().hums).toBe(0);
    expect(errors).toEqual([]);
  });
});
