/**
 * Replay: a ring-buffer snapshot recorder and a cinematic replay player
 * (interpolation, camera director with slow-mo time remap, video overlay).
 *
 * Game loop integration:
 *   every sim frame   if (rec.wants(time)) rec.record(buildSnapshot(time))  // fresh object each time
 *   on style awards   rec.addTricks(awards)
 *   offer a clip      frames = rec.aroundCombo(style.lastChainSpan)          // grab now, the ring moves on
 *   start             player.play(frames, { cinematic: true, overlay: true });
 *                     clip.begin(renderer.domElement, player.overlayCanvas)
 *   each rAF          if (player.update(realDt)) clip.frame(); else blob = await clip.end()
 *
 * Node-safe to import. The overlay canvas is only created in a browser.
 */
import * as THREE from 'three';
import { LAW } from '../core/contracts';
import type {
  ActorSnap, CharacterPose, ProjSnap, PropSnap, ReplayHost, RiftSnap, Snapshot, TrickAward, Tuple3, Tuple4,
} from '../core/contracts';
import { clipOutputSize } from './clip';
import { META_STRINGS } from './strings';

// ===========================================================================
// Recorder
// ===========================================================================

export class ReplayRecorder {
  readonly seconds: number;
  readonly hz: number;
  readonly capacity: number;
  /** Seconds between recorded snapshots. */
  readonly interval: number;

  private buf: (Snapshot | null)[];
  private head = 0;
  private count = 0;
  private last = -Infinity;
  private nextDue = -Infinity;
  private pending: TrickAward[] = [];

  constructor(seconds = 15, hz = 30) {
    this.seconds = seconds > 0 ? seconds : 15;
    this.hz = hz > 0 ? hz : 30;
    this.interval = 1 / this.hz;
    this.capacity = Math.max(2, Math.ceil(this.seconds * this.hz) + 2);
    this.buf = new Array<Snapshot | null>(this.capacity).fill(null);
  }

  /** Time of the newest recorded snapshot (-Infinity when empty). */
  get lastT(): number { return this.last; }

  /** Time of the oldest snapshot inside the time window (-Infinity when empty). */
  get firstT(): number {
    if (!this.count) return -Infinity;
    const minT = this.last - this.seconds - 1e-9;
    for (let i = 0; i < this.count; i++) {
      const s = this.buf[(this.head - this.count + i + this.capacity) % this.capacity];
      if (s && s.t >= minT) return s.t;
    }
    return this.last;
  }

  /** Stored snapshots (≤ capacity). */
  get size(): number { return this.count; }

  /**
   * Would a snapshot at time t be kept? Lets the game skip building a
   * snapshot on frames the throttle would drop (use addTricks() for awards).
   */
  wants(t: number): boolean {
    if (!Number.isFinite(t)) return false;
    return this.count === 0 || t < this.last || t >= this.nextDue - this.interval * 0.25;
  }

  /** Attach trick awards to the next recorded snapshot. */
  addTricks(awards: readonly TrickAward[]): void {
    for (const a of awards) this.pending.push(a);
  }

  /**
   * Record a snapshot (throttled to hz by s.t). The recorder keeps the object:
   * build a fresh one per call and don't mutate it afterwards. Returns true if kept.
   */
  record(s: Snapshot): boolean {
    const t = s.t;
    if (!Number.isFinite(t)) return false;
    if (this.count > 0 && t < this.last) {
      // Time went backwards (checkpoint restart, new run): start over.
      this.clearFrames();
    } else if (this.count > 0 && t < this.nextDue - this.interval * 0.25) {
      if (s.tricks && s.tricks.length) this.addTricks(s.tricks);
      return false;
    }
    if (this.pending.length) {
      s.tricks = s.tricks && s.tricks.length ? this.pending.concat(s.tricks) : this.pending;
      this.pending = [];
    }
    this.buf[this.head] = s;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
    this.last = t;
    if (this.nextDue === -Infinity) this.nextDue = t + this.interval;
    else {
      this.nextDue += this.interval;
      if (this.nextDue <= t) this.nextDue = t + this.interval;
    }
    return true;
  }

  /** Snapshots in [fromT, toT] (within the time window), oldest first. */
  frames(fromT = -Infinity, toT = Infinity): Snapshot[] {
    const out: Snapshot[] = [];
    if (!this.count) return out;
    const minT = Math.max(fromT, this.last - this.seconds - 1e-9);
    for (let i = 0; i < this.count; i++) {
      const s = this.buf[(this.head - this.count + i + this.capacity) % this.capacity];
      if (s && s.t >= minT && s.t <= toT) out.push(s);
    }
    return out;
  }

  /**
   * The clip window for a combo (DESIGN §7: "the last ~10 s around the combo"):
   * `pre` s before its first trick to `post` s after its last, keeping the end
   * when it's longer than maxSeconds. No span: the last maxSeconds.
   * Grab it when you offer the clip: the returned array keeps its snapshots
   * even after the ring buffer moves on.
   */
  aroundCombo(span: { from: number; to: number } | null, maxSeconds = 10, pre = 3, post = 1.5): Snapshot[] {
    if (!this.count) return [];
    if (!span) return this.frames(this.last - maxSeconds, this.last);
    const to = Math.min(this.last, span.to + post);
    const from = Math.max(span.from - pre, to - maxSeconds);
    return this.frames(from, to);
  }

  clear(): void {
    this.clearFrames();
    this.pending = [];
  }

  private clearFrames(): void {
    this.buf.fill(null);
    this.head = 0;
    this.count = 0;
    this.last = -Infinity;
    this.nextDue = -Infinity;
  }
}

// ===========================================================================
// Interpolation
// ===========================================================================

const TAU = Math.PI * 2;
const EMPTY_TRICKS: TrickAward[] = [];

export function lerpAngle(a: number, b: number, u: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return a + d * u;
}

function dist2(a: Tuple3, b: Tuple3): number {
  const x = a[0] - b[0];
  const y = a[1] - b[1];
  const z = a[2] - b[2];
  return x * x + y * y + z * z;
}

function lerp3(a: Tuple3, b: Tuple3, u: number, out: Tuple3): void {
  out[0] = a[0] + (b[0] - a[0]) * u;
  out[1] = a[1] + (b[1] - a[1]) * u;
  out[2] = a[2] + (b[2] - a[2]) * u;
}

function copy3(a: Tuple3, out: Tuple3): void {
  out[0] = a[0]; out[1] = a[1]; out[2] = a[2];
}

function copy4(a: Tuple4, out: Tuple4): void {
  out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
}

function slerp4(a: Tuple4, b: Tuple4, u: number, out: Tuple4): void {
  THREE.Quaternion.slerpFlat(out, 0, a, 0, b, 0, u);
}

/**
 * Interpolates two snapshots into one reusable output snapshot (no per-frame
 * allocations once the pools are warm). Membership of every list and discrete
 * state (poses, visibility, kinds) comes from the nearer frame. Things that
 * jumped further than physically possible between the frames (a rift pass, a
 * respawn) snap instead of sliding across the world.
 */
export class SnapshotLerper {
  readonly out: Snapshot = {
    t: 0,
    cam: { pos: [0, 0, 0], quat: [0, 0, 0, 1], fov: 60 },
    actors: [],
    rifts: [],
    projs: [],
    props: [],
    tricks: EMPTY_TRICKS,
    timeScale: 1,
    focus: [0, 0, 0],
  };

  private actorPool: ActorSnap[] = [];
  private riftPool: RiftSnap[] = [];
  private projPool: ProjSnap[] = [];
  private propPool: PropSnap[] = [];

  lerp(a: Snapshot, b: Snapshot, u: number): Snapshot {
    const out = this.out;
    if (!(u > 0)) u = 0;
    else if (u > 1) u = 1;
    const aNear = u < 0.5;
    const near = aNear ? a : b;
    const far = aNear ? b : a;
    const dt = Math.abs(b.t - a.t);
    const maxJ = LAW.maxSpeed * dt * 1.3 + 0.35;
    const maxJ2 = maxJ * maxJ;

    out.t = a.t + (b.t - a.t) * u;
    out.timeScale = near.timeScale;
    out.tricks = EMPTY_TRICKS;

    // Camera (a cut or a rift pass snaps).
    const camJ = maxJ * 2 + 1;
    if (dist2(a.cam.pos, b.cam.pos) <= camJ * camJ) {
      lerp3(a.cam.pos, b.cam.pos, u, out.cam.pos);
      slerp4(a.cam.quat, b.cam.quat, u, out.cam.quat);
      out.cam.fov = a.cam.fov + (b.cam.fov - a.cam.fov) * u;
    } else {
      copy3(near.cam.pos, out.cam.pos);
      copy4(near.cam.quat, out.cam.quat);
      out.cam.fov = near.cam.fov;
    }
    if (dist2(a.focus, b.focus) <= maxJ2) lerp3(a.focus, b.focus, u, out.focus);
    else copy3(near.focus, out.focus);

    // Actors (by key).
    const na = near.actors;
    const fa = far.actors;
    const oa = out.actors;
    oa.length = na.length;
    for (let j = 0; j < na.length; j++) {
      const n = na[j];
      let o = this.actorPool[j];
      if (!o) {
        o = { key: '', pos: [0, 0, 0], yaw: 0, pose: n.pose, visible: true };
        this.actorPool[j] = o;
      }
      o.key = n.key;
      o.visible = n.visible;
      o.pose = n.pose as CharacterPose;
      let f: ActorSnap | null = j < fa.length && fa[j].key === n.key ? fa[j] : null;
      if (!f) for (let k = 0; k < fa.length; k++) if (fa[k].key === n.key) { f = fa[k]; break; }
      if (f && dist2(n.pos, f.pos) <= maxJ2) {
        const A = aNear ? n : f;
        const B = aNear ? f : n;
        lerp3(A.pos, B.pos, u, o.pos);
        o.yaw = lerpAngle(A.yaw, B.yaw, u);
      } else {
        copy3(n.pos, o.pos);
        o.yaw = n.yaw;
      }
      oa[j] = o;
    }

    // Rifts (by id). They don't move: only the opening animates.
    const nr = near.rifts;
    const fr = far.rifts;
    const or = out.rifts;
    or.length = nr.length;
    for (let j = 0; j < nr.length; j++) {
      const n = nr[j];
      let o = this.riftPool[j];
      if (!o) {
        o = { id: 0, pos: [0, 0, 0], quat: [0, 0, 0, 1], kind: n.kind, open: 1, color: n.color, linkedId: 0 };
        this.riftPool[j] = o;
      }
      o.id = n.id;
      o.kind = n.kind;
      o.color = n.color;
      o.linkedId = n.linkedId;
      let f: RiftSnap | null = j < fr.length && fr[j].id === n.id ? fr[j] : null;
      if (!f) for (let k = 0; k < fr.length; k++) if (fr[k].id === n.id) { f = fr[k]; break; }
      if (f && dist2(n.pos, f.pos) <= 0.0025) {
        const A = aNear ? n : f;
        const B = aNear ? f : n;
        lerp3(A.pos, B.pos, u, o.pos);
        slerp4(A.quat, B.quat, u, o.quat);
        o.open = A.open + (B.open - A.open) * u;
      } else {
        copy3(n.pos, o.pos);
        copy4(n.quat, o.quat);
        o.open = n.open;
      }
      or[j] = o;
    }

    // Projectiles (no ids: same index / neighbours, same kind, plausible distance).
    const np = near.projs;
    const fp = far.projs;
    const op = out.projs;
    op.length = np.length;
    for (let j = 0; j < np.length; j++) {
      const n = np[j];
      let o = this.projPool[j];
      if (!o) {
        o = { kind: n.kind, pos: [0, 0, 0], charged: false };
        this.projPool[j] = o;
      }
      o.kind = n.kind;
      o.charged = n.charged;
      o.to = n.to;
      let f: ProjSnap | null = null;
      for (let k = j - 1; k <= j + 1; k++) {
        const c = k >= 0 && k < fp.length ? fp[k] : null;
        if (c && c.kind === n.kind && dist2(c.pos, n.pos) <= maxJ2) { f = c; break; }
      }
      if (f) {
        const A = aNear ? n : f;
        const B = aNear ? f : n;
        lerp3(A.pos, B.pos, u, o.pos);
      } else {
        copy3(n.pos, o.pos);
      }
      op[j] = o;
    }

    // Props (by key).
    const nq = near.props;
    const fq = far.props;
    const oq = out.props;
    oq.length = nq.length;
    for (let j = 0; j < nq.length; j++) {
      const n = nq[j];
      let o = this.propPool[j];
      if (!o) {
        o = { key: '', pos: [0, 0, 0], quat: [0, 0, 0, 1], visible: true };
        this.propPool[j] = o;
      }
      o.key = n.key;
      o.visible = n.visible;
      let f: PropSnap | null = j < fq.length && fq[j].key === n.key ? fq[j] : null;
      if (!f) for (let k = 0; k < fq.length; k++) if (fq[k].key === n.key) { f = fq[k]; break; }
      if (f && dist2(n.pos, f.pos) <= maxJ2) {
        const A = aNear ? n : f;
        const B = aNear ? f : n;
        lerp3(A.pos, B.pos, u, o.pos);
        slerp4(A.quat, B.quat, u, o.quat);
      } else {
        copy3(n.pos, o.pos);
        copy4(n.quat, o.quat);
      }
      oq[j] = o;
    }
    return out;
  }
}

// ===========================================================================
// Player + director
// ===========================================================================

export interface ReplayPlayOptions {
  /** Director shots + slow-mo (else the recorded camera at constant speed). */
  cinematic: boolean;
  /** Draw trick names / combo / watermark into overlayCanvas (browser only). */
  overlay: boolean;
  /** Playback speed multiplier (default 1). */
  speed?: number;
}

export type ShotKind = 'game' | 'wide' | 'orbit' | 'portal';

/** Director tuning. Source seconds = recorded time, real seconds = playback time. */
export const DIRECTOR = {
  slowFactor: 0.25,
  /** Source seconds played at slowFactor per trick moment (0.2 / 0.25 = 0.8 s real). */
  slowSource: 0.2,
  /** Source seconds of cosine ease into / out of slow-mo. */
  slowRamp: 0.12,
  /** The slow-mo core starts this long before the award. */
  slowLead: 0.12,
  /** Only the highest-scoring moments get slow-mo. */
  maxSlowMoments: 4,
  /** Tricks closer than this (source s) are one moment. */
  momentMerge: 0.45,
  orbitPre: 0.3,
  orbitPost: 0.7,
  orbitRadius: 4.2,
  orbitHeight: 1.5,
  /** Radians per real second. */
  orbitSpeed: 0.45,
  orbitFov: 50,
  portalPre: 0.35,
  portalPost: 0.9,
  /** Look this far back (source s) for something emerging from the exit. */
  portalSearch: 2.5,
  /** Exit must be this close to the trick point. */
  portalNear: 16,
  /** "Emerging" = within this of the exit mouth. */
  mouthRadius: 1.8,
  portalFov: 64,
  wideLen: 1.6,
  wideDist: 10,
  wideHeight: 5.5,
  wideFov: 55,
  minShot: 0.35,
  minGap: 0.4,
  /** Consecutive blocked frames before a shot falls back to the gameplay camera. */
  losFailFrames: 4,
  /** Cinematic end card hold (real s). */
  tail: 1.2,
  /** Gameplay camera smoothing time constant (real s). */
  smoothTau: 0.08,
  /** Time-remap table step (source s). */
  step: 1 / 240,
  popLife: 1.9,
} as const;

interface CenterKey { t: number; p: THREE.Vector3 }

interface Shot {
  kind: ShotKind;
  a: number;
  b: number;
  ra: number;
  keys: CenterKey[];
  angle0: number;
  dir: number;
  radius: number;
  cam0: THREE.Vector3;
  cam1: THREE.Vector3;
  look0: THREE.Vector3;
  look1: THREE.Vector3;
  fov: number;
  blocked: number;
  failed: boolean;
}

interface Moment {
  t: number;
  at: THREE.Vector3;
  points: number;
  slow: boolean;
}

interface OverlayTrick {
  t: number;
  rt: number;
  name: string;
  pts: string;
  halved: boolean;
  big: boolean;
  nameW: number;
  ptsW: number;
  /** Right-to-left name (Hebrew): points go on the left. */
  rtl: boolean;
  combo: string;
  variety: string;
  comboW: number;
  varietyW: number;
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans Hebrew", sans-serif';
const COL_EXIT = '#38b6ff';
const COL_ENTRANCE = '#ff7a1a';
const COL_GOLD = '#ffd23f';

function smoothstep(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x * x * (3 - 2 * x);
}

function clamp(x: number, a: number, b: number): number {
  return x < a ? a : x > b ? b : x;
}

function fmtInt(n: number): string {
  const s = String(Math.round(Math.abs(n)));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return n < 0 ? `-${out}` : out;
}

function newShot(kind: ShotKind, a: number, b: number): Shot {
  return {
    kind, a, b, ra: 0, keys: [], angle0: 0, dir: 1, radius: DIRECTOR.orbitRadius,
    cam0: new THREE.Vector3(), cam1: new THREE.Vector3(), look0: new THREE.Vector3(), look1: new THREE.Vector3(),
    fov: 60, blocked: 0, failed: false,
  };
}

const _up = new THREE.Vector3(0, 1, 0);

export class ReplayPlayer {
  /** 2D overlay (output-video sized) for the current replay, or null (node / overlay off). */
  overlayCanvas: HTMLCanvasElement | null = null;
  /** Label lookup for the overlay (default: English META strings). Set it to the UI's t(). */
  translate: (key: string) => string = (k) => META_STRINGS.en[k] ?? k;
  /** Override the overlay size (defaults to the clip output size for host.canvas). */
  overlaySize: { width: number; height: number } | null = null;

  private readonly host: ReplayHost;
  private isPlaying = false;
  private finished = false;
  private cinematic = false;
  private speed = 1;
  private frames: Snapshot[] = [];
  private t0 = 0;
  private t1 = 0;
  private cursor = 0;
  private lerper = new SnapshotLerper();

  // time remap
  private h = 0;
  private N = 1;
  private realAt: Float64Array = new Float64Array(2);
  private realCursor = 0;
  private srcEndReal = 0;
  private total = 0;
  private clock = 0;
  private src = 0;

  // director
  private moments: Moment[] = [];
  private overlayTricks: TrickAward[] = [];
  private shotList: Shot[] = [];
  private shotCursor = 0;
  private curShot: Shot | null = null;
  private smoothInit = false;
  private sPos = new THREE.Vector3();
  private sQuat = new THREE.Quaternion();
  private tPos = new THREE.Vector3();
  private tQuat = new THREE.Quaternion();
  private vCam = new THREE.Vector3();
  private vLook = new THREE.Vector3();
  private vA = new THREE.Vector3();
  private vB = new THREE.Vector3();

  // saved camera
  private savedPos = new THREE.Vector3();
  private savedQuat = new THREE.Quaternion();
  private savedUp = new THREE.Vector3(0, 1, 0);
  private savedFov = 60;

  // overlay
  private ovCanvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private overlayOn = false;
  private ovTricks: OverlayTrick[] = [];
  private ovUnit = 1;
  private ovPortrait = false;
  private labels = { mark: 'THRESHOLD', tag: 'RIFT ACTION', replay: 'REPLAY', combo: 'COMBO', end: '' };
  private visIdx: number[] = [];

  constructor(host: ReplayHost) {
    this.host = host;
  }

  get playing(): boolean { return this.isPlaying; }
  /** 0..1 through the replay. */
  get progress(): number { return this.total > 0 ? clamp(this.clock / this.total, 0, 1) : this.isPlaying ? 0 : 1; }
  /** Replay length in real seconds (at the chosen speed). */
  get duration(): number { return this.total / this.speed; }
  /** Recorded time currently shown. */
  get sourceTime(): number { return this.src; }
  /** Kind of the shot on screen ('game' also when a shot fell back). */
  get shotKind(): ShotKind { return this.curShot ? (this.curShot.failed ? 'game' : this.curShot.kind) : 'game'; }
  /** The director's cut: source windows of every shot. */
  get shots(): readonly { kind: ShotKind; a: number; b: number }[] {
    return this.shotList.map((s) => ({ kind: s.kind, a: s.a, b: s.b }));
  }

  play(frames: Snapshot[], opts: ReplayPlayOptions): void {
    this.stop();
    if (!frames || !frames.length) return;
    const fr = frames.filter((f) => f && Number.isFinite(f.t));
    if (!fr.length) return;
    for (let i = 1; i < fr.length; i++) {
      if (fr[i].t < fr[i - 1].t) { fr.sort((x, y) => x.t - y.t); break; }
    }
    this.frames = fr;
    this.t0 = fr[0].t;
    this.t1 = fr[fr.length - 1].t;
    this.cinematic = !!opts.cinematic;
    this.speed = clamp(opts.speed ?? 1, 0.05, 8);
    this.cursor = 0;
    this.realCursor = 0;
    this.shotCursor = 0;
    this.curShot = null;
    this.smoothInit = false;
    this.clock = 0;
    this.src = this.t0;
    this.finished = false;

    const cam = this.host.camera;
    this.savedPos.copy(cam.position);
    this.savedQuat.copy(cam.quaternion);
    this.savedUp.copy(cam.up);
    this.savedFov = cam.fov;

    try { this.host.beginReplay(); } catch (err) { console.warn('[replay] beginReplay failed', err); }
    try {
      this.buildMoments();
      this.buildTimeTable();
      this.buildShots();
    } catch (err) {
      console.warn('[replay] director failed, plain replay', err);
      this.cinematic = false;
      this.moments = [];
      this.buildTimeTable();
      this.shotList = [newShot('game', this.t0, this.t1)];
    }
    this.prepareOverlay(!!opts.overlay);
    this.isPlaying = true;
  }

  /** Advance and render one replay frame. Returns false once the replay is over (and stopped). */
  update(realDt: number): boolean {
    if (!this.isPlaying) return false;
    if (this.finished) {
      this.stop();
      return false;
    }
    try {
      const dt = realDt > 0 && Number.isFinite(realDt) ? Math.min(realDt, 0.25) : 0;
      this.clock += dt * this.speed;
      if (this.clock >= this.total) {
        this.clock = this.total;
        this.finished = true;
      }
      const src = this.srcOfReal(this.clock);
      this.src = src;
      const snap = this.sample(src);
      this.host.apply(snap);
      this.placeCamera(src, snap, dt);
      this.host.render();
      if (this.overlayOn) this.drawOverlay();
      return true;
    } catch (err) {
      console.warn('[replay] frame failed', err);
      this.stop();
      return false;
    }
  }

  stop(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.finished = false;
    try {
      const cam = this.host.camera;
      cam.position.copy(this.savedPos);
      cam.quaternion.copy(this.savedQuat);
      cam.up.copy(this.savedUp);
      if (cam.fov !== this.savedFov) {
        cam.fov = this.savedFov;
        cam.updateProjectionMatrix();
      }
      cam.updateMatrixWorld();
    } catch { /* ignore */ }
    try { this.host.endReplay(); } catch (err) { console.warn('[replay] endReplay failed', err); }
  }

  // -------------------------------------------------------------------------
  // Sampling

  private sample(t: number): Snapshot {
    const fr = this.frames;
    if (fr.length === 1) return this.lerper.lerp(fr[0], fr[0], 0);
    let i = this.cursor;
    if (i >= fr.length - 1 || fr[i].t > t) i = this.indexAt(t);
    while (i < fr.length - 2 && fr[i + 1].t <= t) i++;
    this.cursor = i;
    const a = fr[i];
    const b = fr[i + 1];
    const span = b.t - a.t;
    const u = span > 1e-9 ? (t - a.t) / span : 0;
    return this.lerper.lerp(a, b, u);
  }

  /** Index of the last frame with t ≤ time (binary search). */
  private indexAt(time: number): number {
    const fr = this.frames;
    let lo = 0;
    let hi = fr.length - 1;
    if (time <= fr[0].t) return 0;
    if (time >= fr[hi].t) return Math.max(0, hi - 1);
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (fr[mid].t <= time) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  private nearestFrame(time: number): Snapshot {
    const fr = this.frames;
    const i = this.indexAt(time);
    const j = Math.min(i + 1, fr.length - 1);
    return Math.abs(fr[j].t - time) < Math.abs(fr[i].t - time) ? fr[j] : fr[i];
  }

  private focusAt(time: number, out: THREE.Vector3): THREE.Vector3 {
    const f = this.nearestFrame(time).focus;
    return out.set(f[0], f[1], f[2]);
  }

  // -------------------------------------------------------------------------
  // Time remap

  private speedAt(src: number): number {
    let s = 1;
    if (!this.cinematic) return s;
    const D = DIRECTOR;
    const half = D.slowSource / 2;
    for (const m of this.moments) {
      if (!m.slow) continue;
      const c = m.t - D.slowLead + half;
      const x = Math.abs(src - c);
      if (x < half) s = Math.min(s, D.slowFactor);
      else if (x < half + D.slowRamp) {
        const k = (x - half) / D.slowRamp;
        s = Math.min(s, D.slowFactor + (1 - D.slowFactor) * (0.5 - 0.5 * Math.cos(Math.PI * k)));
      }
    }
    return s;
  }

  private buildTimeTable(): void {
    const span = Math.max(0, this.t1 - this.t0);
    const N = Math.max(1, Math.ceil(span / DIRECTOR.step));
    const h = span / N;
    const real = new Float64Array(N + 1);
    for (let k = 0; k < N; k++) real[k + 1] = real[k] + h / this.speedAt(this.t0 + (k + 0.5) * h);
    this.h = h;
    this.N = N;
    this.realAt = real;
    this.srcEndReal = real[N];
    this.total = real[N] + (this.cinematic ? DIRECTOR.tail : 0);
    if (this.total < 0.5) this.total = 0.5;
  }

  private srcOfReal(r: number): number {
    const real = this.realAt;
    const N = this.N;
    if (this.h <= 0 || r <= 0) return this.t0;
    if (r >= real[N]) return this.t1;
    let k = this.realCursor;
    if (k >= N || real[k] > r) k = 0;
    if (real[k + 1] <= r) {
      // Jump with a binary search when far away, else walk.
      if (N - k > 64) {
        let lo = k;
        let hi = N;
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1;
          if (real[mid] <= r) lo = mid;
          else hi = mid;
        }
        k = lo;
      }
      while (k < N - 1 && real[k + 1] <= r) k++;
    }
    this.realCursor = k;
    const seg = real[k + 1] - real[k];
    const f = seg > 0 ? (r - real[k]) / seg : 0;
    return this.t0 + (k + f) * this.h;
  }

  /** Director time at which source time `s` is shown. */
  private realOfSrc(s: number): number {
    if (this.h <= 0) return 0;
    const x = clamp((s - this.t0) / this.h, 0, this.N);
    const k = Math.min(this.N - 1, Math.floor(x));
    const f = x - k;
    return this.realAt[k] + (this.realAt[k + 1] - this.realAt[k]) * f;
  }

  // -------------------------------------------------------------------------
  // Director

  private collectTricks(): TrickAward[] {
    const seen = new Set<TrickAward>();
    const keys = new Set<string>();
    const list: TrickAward[] = [];
    for (const f of this.frames) {
      if (!f.tricks) continue;
      for (const a of f.tricks) {
        if (seen.has(a)) continue;
        seen.add(a);
        const k = `${a.id}@${a.t.toFixed(3)}@${a.points}`;
        if (keys.has(k)) continue;
        keys.add(k);
        list.push(a);
      }
    }
    list.sort((x, y) => x.t - y.t);
    return list;
  }

  private buildMoments(): void {
    const tricks = this.collectTricks();
    this.moments = [];
    let cur: Moment | null = null;
    let lastT = -Infinity;
    for (const a of tricks) {
      const t = clamp(a.t, this.t0, this.t1);
      if (!cur || t - lastT > DIRECTOR.momentMerge) {
        const at = new THREE.Vector3();
        if (a.at) at.copy(a.at);
        else this.focusAt(t, at);
        cur = { t, at, points: 0, slow: false };
        this.moments.push(cur);
      }
      cur.points += a.points;
      lastT = t;
    }
    if (this.cinematic) {
      const ranked = this.moments.slice().sort((x, y) => y.points - x.points);
      for (let i = 0; i < ranked.length && i < DIRECTOR.maxSlowMoments; i++) ranked[i].slow = true;
    }
    this.overlayTricks = tricks;
  }

  private buildShots(): void {
    const D = DIRECTOR;
    const t0 = this.t0;
    const t1 = this.t1;
    if (!this.cinematic || t1 - t0 < 0.2) {
      this.shotList = [newShot('game', t0, t1)];
      this.shotList[0].ra = 0;
      return;
    }

    // Candidate shots per moment.
    const cand: Shot[] = [];
    for (const m of this.moments) {
      const portal = this.makePortalShot(m);
      if (portal) cand.push(portal);
      if (!portal || portal.b < m.t) {
        const o = newShot('orbit', m.t - D.orbitPre, m.t + D.orbitPost);
        o.keys.push({ t: m.t, p: m.at.clone().add(new THREE.Vector3(0, 1, 0)) });
        o.fov = D.orbitFov;
        cand.push(o);
      }
    }

    // Resolve overlaps (moments are time-ordered, portal before its orbit).
    const list: Shot[] = [];
    for (const s of cand) {
      s.a = Math.max(s.a, t0);
      s.b = Math.min(s.b, t1);
      if (s.b - s.a < D.minShot) continue;
      const prev = list[list.length - 1];
      if (prev && s.a < prev.b + D.minGap) {
        if (prev.kind === 'orbit' && s.kind === 'orbit') {
          prev.b = Math.max(prev.b, s.b);
          for (const k of s.keys) prev.keys.push(k);
          continue;
        }
        if (s.kind === 'portal' && s.a < prev.b) continue;
        if (s.a < prev.b) {
          prev.b = s.a;
          if (prev.b - prev.a < D.minShot) list.pop();
        }
      }
      list.push(s);
    }

    // Validate orbits (line of sight at the start, middle and end).
    for (const s of list) {
      s.ra = this.realOfSrc(s.a);
      if (s.kind === 'orbit' && !this.validateOrbit(s)) s.kind = 'game';
    }

    // Establishing wide shot.
    const firstA = list.length ? list[0].a : t1;
    const wideLen = Math.min(D.wideLen, firstA - t0 - 0.1);
    if (wideLen >= 0.8) {
      const w = this.makeWideShot(t0, t0 + wideLen);
      if (w) list.unshift(w);
    }

    // Fill gaps with the gameplay camera; swallow tiny gaps.
    const out: Shot[] = [];
    let cur = t0;
    for (const s of list) {
      if (s.a > cur + 1e-6) {
        const gap = s.a - cur;
        const prev = out[out.length - 1];
        if (gap < D.minGap && prev) prev.b = s.a;
        else if (gap < D.minGap && !prev) s.a = cur;
        else out.push(newShot('game', cur, s.a));
      }
      out.push(s);
      cur = Math.max(cur, s.b);
    }
    if (t1 > cur + 1e-6) {
      const prev = out[out.length - 1];
      if (prev && t1 - cur < D.minGap) prev.b = t1;
      else out.push(newShot('game', cur, t1));
    }
    if (!out.length) out.push(newShot('game', t0, t1));
    for (const s of out) s.ra = this.realOfSrc(s.a);
    this.shotList = out;
  }

  private los(a: THREE.Vector3, b: THREE.Vector3): boolean {
    try {
      return this.host.lineOfSight(a, b);
    } catch {
      return true;
    }
  }

  private centerAt(s: Shot, src: number, out: THREE.Vector3): THREE.Vector3 {
    const k = s.keys;
    if (!k.length) return this.focusAt(src, out).add(_up);
    if (src <= k[0].t || k.length === 1) return out.copy(k[0].p);
    const last = k[k.length - 1];
    if (src >= last.t) return out.copy(last.p);
    for (let i = 0; i < k.length - 1; i++) {
      if (src < k[i + 1].t) {
        const f = smoothstep((src - k[i].t) / Math.max(1e-6, k[i + 1].t - k[i].t));
        return out.copy(k[i].p).lerp(k[i + 1].p, f);
      }
    }
    return out.copy(last.p);
  }

  private orbitPose(s: Shot, src: number, rt: number, cam: THREE.Vector3, look: THREE.Vector3): void {
    this.centerAt(s, src, look);
    const th = s.angle0 + s.dir * DIRECTOR.orbitSpeed * (rt - s.ra);
    cam.set(look.x + Math.cos(th) * s.radius, look.y + DIRECTOR.orbitHeight, look.z + Math.sin(th) * s.radius);
  }

  private validateOrbit(s: Shot): boolean {
    const f0 = this.nearestFrame(s.a);
    const c = this.centerAt(s, s.a, this.vA);
    const base = Math.atan2(f0.cam.pos[2] - c.z, f0.cam.pos[0] - c.x);
    const offsets = [0.7, -0.7, 1.6, -1.6, 2.5, -2.5, Math.PI];
    const radii = [DIRECTOR.orbitRadius, DIRECTOR.orbitRadius * 0.65];
    for (const r of radii) {
      for (const off of offsets) {
        s.angle0 = base + off;
        s.dir = off >= 0 ? 1 : -1;
        s.radius = r;
        let ok = true;
        for (let i = 0; i <= 2 && ok; i++) {
          const src = s.a + (s.b - s.a) * (i / 2);
          this.orbitPose(s, src, this.realOfSrc(src), this.vCam, this.vLook);
          if (!this.los(this.vCam, this.vLook)) ok = false;
        }
        if (ok) return true;
      }
    }
    return false;
  }

  private makePortalShot(m: Moment): Shot | null {
    const D = DIRECTOR;
    const f = this.nearestFrame(m.t - 0.3);
    let best: RiftSnap | null = null;
    let bestD = D.portalNear * D.portalNear;
    const n = this.vA;
    const p = this.vB;
    for (const r of f.rifts) {
      if (r.color !== 'exit') continue;
      p.set(r.pos[0], r.pos[1], r.pos[2]);
      const d2 = p.distanceToSquared(m.at);
      if (d2 > bestD) continue;
      n.set(0, 0, 1).applyQuaternion(new THREE.Quaternion(r.quat[0], r.quat[1], r.quat[2], r.quat[3]));
      const front = (m.at.x - p.x) * n.x + (m.at.y - p.y) * n.y + (m.at.z - p.z) * n.z;
      if (front < -0.5) continue;
      best = r;
      bestD = d2;
    }
    if (!best) return null;

    const q = new THREE.Quaternion(best.quat[0], best.quat[1], best.quat[2], best.quat[3]);
    const pos = new THREE.Vector3(best.pos[0], best.pos[1], best.pos[2]);
    const nrm = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const mouth = pos.clone().addScaledVector(nrm, 0.8);

    // The latest stretch of time something is at the mouth; it emerged when that stretch began.
    const r2 = D.mouthRadius * D.mouthRadius;
    const fr = this.frames;
    const from = m.t - D.portalSearch;
    let te = -Infinity;
    let inRun = false;
    let reachedStart = true;
    const iEnd = this.indexAt(m.t);
    for (let i = Math.min(iEnd + 1, fr.length - 1); i >= 0; i--) {
      const s = fr[i];
      if (s.t > m.t) continue;
      if (s.t < from) break;
      const near = this.somethingNear(s, mouth, r2);
      if (near) {
        inRun = true;
        te = s.t;
      } else if (inRun) {
        reachedStart = false;
        break;
      }
    }
    // Nothing there, or something that sat by the exit the whole time (clutter, not an entrance).
    if (te === -Infinity || (reachedStart && te <= Math.max(this.t0, from) + 1e-6)) return null;

    const fast = te > m.t - 0.6;
    const a = te - D.portalPre;
    const b = fast ? m.t + 0.5 : Math.min(te + D.portalPost, m.t - 0.25);
    if (b - a < D.minShot) return null;

    const look1 = m.at.clone().add(new THREE.Vector3(0, 0.8, 0));
    const look0 = pos.clone().addScaledVector(nrm, 3.5);
    const offs: [number, number][] = [[1.05, 0.35], [-1.05, 0.35], [1.05, -0.35], [-1.05, -0.35], [0, 1.1], [0, -1.1]];
    for (const [sx, sy] of offs) {
      const cam0 = pos.clone().addScaledVector(nrm, 0.3).addScaledVector(side, sx).addScaledVector(up, sy);
      const cam1 = cam0.clone().addScaledVector(nrm, 0.35);
      if (!this.los(cam0, look0) || !this.los(cam0, look1) || !this.los(cam1, look1)) continue;
      const s = newShot('portal', a, b);
      s.cam0.copy(cam0);
      s.cam1.copy(cam1);
      s.look0.copy(look0);
      s.look1.copy(look1);
      s.fov = D.portalFov;
      return s;
    }
    return null;
  }

  private somethingNear(s: Snapshot, p: THREE.Vector3, r2: number): boolean {
    for (const a of s.actors) {
      if (!a.visible) continue;
      const dx = a.pos[0] - p.x;
      const dy = a.pos[1] + 0.9 - p.y;
      const dz = a.pos[2] - p.z;
      if (dx * dx + dy * dy + dz * dz <= r2) return true;
    }
    for (const a of s.props) {
      if (!a.visible) continue;
      const dx = a.pos[0] - p.x;
      const dy = a.pos[1] - p.y;
      const dz = a.pos[2] - p.z;
      if (dx * dx + dy * dy + dz * dz <= r2) return true;
    }
    for (const a of s.projs) {
      const dx = a.pos[0] - p.x;
      const dy = a.pos[1] - p.y;
      const dz = a.pos[2] - p.z;
      if (dx * dx + dy * dy + dz * dz <= r2) return true;
    }
    return false;
  }

  private makeWideShot(a: number, b: number): Shot | null {
    const D = DIRECTOR;
    const f0 = this.nearestFrame(a);
    const look0 = this.focusAt(a, new THREE.Vector3()).add(_up);
    const look1 = this.focusAt(b, new THREE.Vector3()).add(_up);
    const base = new THREE.Vector3(f0.cam.pos[0] - f0.focus[0], 0, f0.cam.pos[2] - f0.focus[2]);
    if (base.lengthSq() < 1e-6) base.set(0, 0, 1);
    base.normalize();
    const offsets = [0.6, -0.6, 0, 1.3, -1.3, Math.PI];
    const d = new THREE.Vector3();
    for (const off of offsets) {
      d.copy(base).applyAxisAngle(_up, off);
      const cam0 = look0.clone().addScaledVector(d, D.wideDist).addScaledVector(_up, D.wideHeight);
      const cam1 = look1.clone().addScaledVector(d, D.wideDist * 0.75).addScaledVector(_up, D.wideHeight * 0.8);
      if (!this.los(cam0, look0) || !this.los(cam1, look1)) continue;
      const s = newShot('wide', a, b);
      s.cam0.copy(cam0);
      s.cam1.copy(cam1);
      s.look0.copy(look0);
      s.look1.copy(look1);
      s.fov = D.wideFov;
      return s;
    }
    return null;
  }

  private shotAt(src: number): Shot {
    const list = this.shotList;
    let i = this.shotCursor;
    if (i >= list.length || list[i].a > src) i = 0;
    while (i < list.length - 1 && src >= list[i].b) i++;
    this.shotCursor = i;
    return list[i];
  }

  private placeCamera(src: number, snap: Snapshot, dt: number): void {
    const cam = this.host.camera;
    const shot = this.shotAt(src);
    const cut = shot !== this.curShot;
    if (cut) {
      this.curShot = shot;
      shot.blocked = 0;
    }
    let game = shot.kind === 'game' || shot.failed;
    if (!game) {
      const c = this.vCam;
      const l = this.vLook;
      if (shot.kind === 'orbit') {
        this.orbitPose(shot, src, this.clock, c, l);
      } else {
        const span = Math.max(1e-6, shot.b - shot.a);
        const f = smoothstep((src - shot.a) / span);
        c.copy(shot.cam0).lerp(shot.cam1, f);
        if (shot.kind === 'wide') {
          this.vB.copy(shot.look0).lerp(shot.look1, f);
          l.set(snap.focus[0], snap.focus[1] + 1, snap.focus[2]).lerp(this.vB, 0.5);
        } else {
          l.copy(shot.look0).lerp(shot.look1, f);
        }
      }
      if (!this.los(c, l)) {
        // Cutting into a blocked view falls back at once; mid-shot, allow brief occluders.
        if (cut || ++shot.blocked >= DIRECTOR.losFailFrames) {
          shot.failed = true;
          game = true;
          this.smoothInit = false;
        }
      } else {
        shot.blocked = 0;
      }
      if (!game) {
        cam.position.copy(c);
        cam.up.set(0, 1, 0);
        cam.lookAt(l);
        this.setFov(shot.fov);
        this.smoothInit = false;
      }
    }
    if (game) {
      const p = snap.cam.pos;
      const q = snap.cam.quat;
      this.tPos.set(p[0], p[1], p[2]);
      this.tQuat.set(q[0], q[1], q[2], q[3]);
      if (!this.cinematic || cut || !this.smoothInit || this.sPos.distanceToSquared(this.tPos) > 36) {
        this.sPos.copy(this.tPos);
        this.sQuat.copy(this.tQuat);
        this.smoothInit = true;
      } else {
        const k = 1 - Math.exp(-dt / DIRECTOR.smoothTau);
        this.sPos.lerp(this.tPos, k);
        this.sQuat.slerp(this.tQuat, k);
      }
      cam.position.copy(this.sPos);
      cam.quaternion.copy(this.sQuat);
      this.setFov(snap.cam.fov);
    }
    cam.updateMatrixWorld();
  }

  private setFov(fov: number): void {
    const cam = this.host.camera;
    if (Number.isFinite(fov) && Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }

  // -------------------------------------------------------------------------
  // Overlay (all strings, fonts and text widths are prepared in play(); drawing allocates nothing)

  private prepareOverlay(on: boolean): void {
    this.overlayOn = false;
    this.overlayCanvas = null;
    if (!on || typeof document === 'undefined') return;
    try {
      const hc = this.host.canvas;
      const size = this.overlaySize ?? clipOutputSize(hc?.width || 1280, hc?.height || 720);
      let cv = this.ovCanvas;
      if (!cv) {
        cv = document.createElement('canvas');
        this.ovCanvas = cv;
      }
      if (cv.width !== size.width) cv.width = size.width;
      if (cv.height !== size.height) cv.height = size.height;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      this.ctx = ctx;
      this.ovPortrait = size.height > size.width;
      const u = Math.min(size.width, size.height) / 720;
      this.ovUnit = u;
      const f = (w: number, px: number) => `${w} ${Math.round(px * u * 10) / 10}px ${FONT}`;
      const F = this.fonts;
      F.mark = f(900, 38);
      F.tag = f(800, 16);
      F.badge = f(800, 20);
      F.name = f(900, 52);
      F.pts = f(800, 34);
      F.comboLabel = f(800, 20);
      F.comboBig = f(900, 50);
      F.comboVar = f(900, 34);
      F.endMark = f(900, 92);
      F.endTag = f(800, 24);
      F.endCombo = f(900, 56);
      const tr = this.translate;
      const L = this.labels;
      L.tag = tr('replay.tag');
      L.replay = tr('replay.title');
      L.combo = tr('replay.combo');
      L.end = tr('replay.end');
      const W = this.widths;
      ctx.font = F.tag;
      W.tag = ctx.measureText(L.tag).width;
      ctx.font = F.badge;
      W.replay = ctx.measureText(L.replay).width;
      ctx.font = F.endMark;
      W.endMark = ctx.measureText(L.mark).width;
      ctx.font = F.endTag;
      W.endTag = ctx.measureText(L.tag).width;
      this.prepareOverlayTricks(ctx);
      this.overlayCanvas = cv;
      this.overlayOn = true;
    } catch (err) {
      console.warn('[replay] overlay unavailable', err);
      this.overlayOn = false;
      this.overlayCanvas = null;
    }
  }

  private fonts = {
    mark: '', tag: '', badge: '', name: '', pts: '', comboLabel: '', comboBig: '', comboVar: '', endMark: '', endTag: '', endCombo: '',
  };

  private widths = { tag: 0, replay: 0, endMark: 0, endTag: 0 };

  private prepareOverlayTricks(ctx: CanvasRenderingContext2D): void {
    const F = this.fonts;
    this.ovTricks = [];
    let sum = 0;
    const ids = new Set<string>();
    for (const a of this.overlayTricks) {
      sum += a.points;
      ids.add(a.id);
      const variety = Math.min(8, ids.size);
      const name = `${this.translate(a.key)}${a.suffix ? ` ${a.suffix}` : ''}`;
      const pts = `+${fmtInt(a.points)}`;
      const combo = fmtInt(sum * variety);
      const varietyS = `×${variety}`;
      ctx.font = F.name;
      const nameW = ctx.measureText(name).width;
      ctx.font = F.pts;
      const ptsW = ctx.measureText(pts).width;
      ctx.font = F.comboBig;
      const comboW = ctx.measureText(combo).width;
      ctx.font = F.comboVar;
      const varietyW = ctx.measureText(varietyS).width;
      this.ovTricks.push({
        t: a.t,
        rt: this.realOfSrc(clamp(a.t, this.t0, this.t1)),
        name,
        pts,
        halved: !!a.halved,
        big: a.points >= 400,
        nameW,
        ptsW,
        rtl: /[֐-׿؀-ۿ]/.test(name),
        combo,
        variety: varietyS,
        comboW,
        varietyW,
      });
    }
  }

  private strokeText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, fill: string, stroke: number): void {
    ctx.lineWidth = stroke;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(s, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(s, x, y);
  }

  private drawOverlay(): void {
    const ctx = this.ctx;
    const cv = this.overlayCanvas;
    if (!ctx || !cv) return;
    const F = this.fonts;
    const TW = this.widths;
    const L = this.labels;
    const W = cv.width;
    const H = cv.height;
    const u = this.ovUnit;
    const clock = this.clock;
    const portrait = this.ovPortrait;
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.textBaseline = 'alphabetic';
    // The end card fades in over the last DIRECTOR.tail seconds and replaces the HUD layer.
    const endA = this.cinematic && clock > this.srcEndReal ? clamp((clock - this.srcEndReal) / 0.4, 0, 1) : 0;
    const hudA = 1 - endA;
    ctx.globalAlpha = hudA;

    // Watermark + tag (top-left; lower in portrait to clear app UI).
    const mx = 28 * u;
    const my = portrait ? H * 0.075 : 26 * u;
    ctx.textAlign = 'left';
    ctx.font = F.mark;
    this.strokeText(ctx, L.mark, mx, my + 36 * u, '#ffffff', 7 * u);
    ctx.font = F.tag;
    const ty = my + 50 * u;
    ctx.fillStyle = COL_ENTRANCE;
    ctx.fillRect(mx, ty, TW.tag + 20 * u, 26 * u);
    ctx.fillStyle = COL_EXIT;
    ctx.fillRect(mx, ty + 22 * u, TW.tag + 20 * u, 4 * u);
    ctx.fillStyle = '#140a02';
    ctx.fillText(L.tag, mx + 10 * u, ty + 19 * u);

    // REPLAY badge (top-right) with a blinking dot.
    ctx.textAlign = 'right';
    ctx.font = F.badge;
    const rx = W - mx;
    const ry = my + 30 * u;
    this.strokeText(ctx, L.replay, rx, ry, '#ffffff', 5 * u);
    if ((clock * 1.6) % 1 < 0.6) {
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(rx - TW.replay - 16 * u, ry - 7 * u, 7 * u, 0, TAU);
      ctx.fill();
    }

    // Trick pops (newest at the bottom of the stack).
    const list = this.ovTricks;
    const vis = this.visIdx;
    vis.length = 0;
    let lastIdx = -1;
    for (let i = 0; i < list.length; i++) {
      const age = clock - list[i].rt;
      if (age < 0) break;
      lastIdx = i;
      if (age <= DIRECTOR.popLife) vis.push(i);
    }
    while (vis.length > 4) vis.shift();
    const baseY = portrait ? H * 0.6 : H * 0.72;
    const lineH = 64 * u;
    ctx.textAlign = 'left';
    for (let v = 0; v < vis.length; v++) {
      const tr = list[vis[v]];
      const age = clock - tr.rt;
      const pop = Math.max(0, 1 - age / 0.18);
      const s0 = 1 + 0.35 * pop * pop;
      let alpha = Math.min(1, age / 0.06);
      if (age > DIRECTOR.popLife - 0.3) alpha *= Math.max(0, (DIRECTOR.popLife - age) / 0.3);
      const total = tr.nameW + 18 * u + tr.ptsW;
      const fit = Math.min(1, (W * 0.92) / total);
      const y = baseY - (vis.length - 1 - v) * lineH;
      ctx.save();
      ctx.globalAlpha = alpha * hudA;
      ctx.translate(W / 2, y);
      ctx.scale(s0 * fit, s0 * fit);
      const x0 = -total / 2;
      const nameX = tr.rtl ? x0 + tr.ptsW + 18 * u : x0;
      const ptsX = tr.rtl ? x0 : x0 + tr.nameW + 18 * u;
      ctx.font = F.name;
      this.strokeText(ctx, tr.name, nameX, 0, tr.big ? COL_GOLD : '#ffffff', 9 * u);
      ctx.font = F.pts;
      this.strokeText(ctx, tr.pts, ptsX, 0, tr.halved ? '#b8b8b8' : COL_GOLD, 7 * u);
      ctx.restore();
    }

    // Running combo.
    if (lastIdx >= 0) {
      const tr = list[lastIdx];
      const cy = portrait ? H * 0.74 : H - 40 * u;
      ctx.textAlign = 'center';
      ctx.font = F.comboLabel;
      this.strokeText(ctx, L.combo, W / 2, cy - 50 * u, '#ffffff', 5 * u);
      const x0 = W / 2 - (tr.comboW + 10 * u + tr.varietyW) / 2;
      ctx.textAlign = 'left';
      ctx.font = F.comboBig;
      this.strokeText(ctx, tr.combo, x0, cy, COL_GOLD, 8 * u);
      ctx.font = F.comboVar;
      this.strokeText(ctx, tr.variety, x0 + tr.comboW + 10 * u, cy, COL_EXIT, 6 * u);
    }

    // End card.
    if (endA > 0) {
      ctx.save();
      ctx.globalAlpha = endA;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = F.endMark;
      const ls = Math.min(1, (W * 0.76) / Math.max(1, TW.endMark));
      ctx.save();
      ctx.translate(W / 2, H * 0.48);
      ctx.scale(ls, ls);
      this.strokeText(ctx, L.mark, 0, 0, '#ffffff', 10 * u);
      ctx.restore();
      ctx.font = F.endTag;
      ctx.fillStyle = COL_ENTRANCE;
      ctx.fillRect(W / 2 - TW.endTag / 2 - 14 * u, H * 0.48 + 22 * u, TW.endTag + 28 * u, 36 * u);
      ctx.fillStyle = '#140a02';
      ctx.fillText(L.tag, W / 2, H * 0.48 + 48 * u);
      if (lastIdx >= 0) {
        ctx.font = F.endCombo;
        this.strokeText(ctx, list[lastIdx].combo, W / 2, H * 0.48 + 130 * u, COL_GOLD, 8 * u);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
