/**
 * Challenges: 3 per zone + a daily challenge seeded by the local date.
 * Definitions are data (CHALLENGES); progress persists in localStorage under
 * 'threshold.challenges'. Every storage access is guarded.
 */
import type {
  DamageSource, EnemyKind, GameEvent, StyleRank, StyleState, TrickAward, TrickId, ZoneId,
} from '../core/contracts';
import { rankIndex } from './style';
import { metaText, type MetaLang } from './strings';

export const CHALLENGE_STORAGE_KEY = 'threshold.challenges';

export type ChallengeCond =
  /** N awards of a trick (optionally all within `within` s, while airborne, or together with GHOST). */
  | { type: 'trick'; trick: TrickId; count: number; within?: number; airborne?: boolean; ghost?: boolean }
  /** Style rank reached. */
  | { type: 'rank'; rank: StyleRank }
  /** Running combo (chainPoints × variety) reaches `points` (optionally with `trick` in the chain). */
  | { type: 'combo'; points: number; trick?: TrickId }
  /** Count of simple events. */
  | { type: 'event'; event: 'hijack' | 'shear' | 'catch'; count: number }
  /** Something looped N times in a row. */
  | { type: 'loops'; loops: number }
  /** Airborne ≥ seconds with ≥ 1 crossing (the AirEvent 'end'). */
  | { type: 'airtime'; seconds: number }
  /** Kills matching a filter. */
  | { type: 'kill'; count: number; enemyKind?: EnemyKind; cause?: DamageSource[]; matador?: boolean; minKillerLoops?: number }
  /** Only completed by the game calling complete(id). */
  | { type: 'manual' };

export interface ChallengeDef {
  id: string;
  /** null = counts anywhere (daily). */
  zone: ZoneId | null;
  titleKey: string;
  descKey: string;
  cond: ChallengeCond;
  /** Values for `{var}` placeholders; `trick` holds a trick i18n key. */
  vars?: Record<string, string | number>;
}

export interface ChallengeProgress {
  id: string;
  count: number;
  goal: number;
  done: boolean;
  /** 0..1 */
  ratio: number;
}

export interface ChallengeInfo extends ChallengeDef, ChallengeProgress {
  daily: boolean;
}

function zoneDef(id: string, cond: ChallengeCond): ChallengeDef {
  return { id, zone: id.split('.')[0] as ZoneId, titleKey: `challenge.${id}.title`, descKey: `challenge.${id}.desc`, cond };
}

/** The 15 zone challenges (the level references exactly these ids). */
export const CHALLENGES: readonly ChallengeDef[] = [
  zoneDef('pier.1', { type: 'trick', trick: 'returnToSender', count: 3 }),
  zoneDef('pier.2', { type: 'trick', trick: 'splashdown', count: 2, within: 3 }),
  zoneDef('pier.3', { type: 'rank', rank: 'S' }),
  zoneDef('yard.1', { type: 'trick', trick: 'cargo', count: 1 }),
  zoneDef('yard.2', { type: 'kill', count: 1, enemyKind: 'brute', matador: true, cause: ['water'] }),
  zoneDef('yard.3', { type: 'airtime', seconds: 5 }),
  zoneDef('skeleton.1', { type: 'loops', loops: 6 }),
  zoneDef('skeleton.2', { type: 'trick', trick: 'firingLine', count: 1 }),
  zoneDef('skeleton.3', { type: 'trick', trick: 'cannonball', count: 1 }),
  zoneDef('lab.1', { type: 'event', event: 'hijack', count: 2 }),
  zoneDef('lab.2', { type: 'trick', trick: 'borrowedGun', count: 2 }),
  zoneDef('lab.3', { type: 'trick', trick: 'bowling', count: 1 }),
  zoneDef('crown.1', { type: 'kill', count: 1, enemyKind: 'boss' }),
  zoneDef('crown.2', { type: 'kill', count: 1, enemyKind: 'boss', minKillerLoops: 2 }),
  zoneDef('crown.3', { type: 'airtime', seconds: 3 }),
];

// ---------------------------------------------------------------------------
// Daily

/** Daily trick pool: trick + a count that is fair for one run. */
export const DAILY_POOL: readonly { trick: TrickId; n: number }[] = [
  { trick: 'returnToSender', n: 5 },
  { trick: 'crossfire', n: 3 },
  { trick: 'postage', n: 3 },
  { trick: 'firingLine', n: 2 },
  { trick: 'borrowedGun', n: 2 },
  { trick: 'trapdoor', n: 5 },
  { trick: 'splashdown', n: 4 },
  { trick: 'void', n: 3 },
  { trick: 'skyfall', n: 3 },
  { trick: 'matador', n: 1 },
  { trick: 'bowling', n: 2 },
  { trick: 'headsUp', n: 3 },
  { trick: 'cannonball', n: 2 },
  { trick: 'slingshot', n: 3 },
  { trick: 'comet', n: 2 },
  { trick: 'guillotine', n: 3 },
  { trick: 'cargo', n: 2 },
  { trick: 'boom', n: 3 },
  { trick: 'ghost', n: 5 },
  { trick: 'juggle', n: 2 },
  { trick: 'mirror', n: 2 },
  { trick: 'double', n: 3 },
];

type DailyTemplate = 'count' | 'within' | 'combo' | 'air' | 'ghost';
const DAILY_TEMPLATES: readonly { t: DailyTemplate; w: number }[] = [
  { t: 'count', w: 4 },
  { t: 'within', w: 2 },
  { t: 'combo', w: 2 },
  { t: 'air', w: 1 },
  { t: 'ghost', w: 1 },
];

/** Local calendar date as YYYY-MM-DD. */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 32-bit FNV-1a string hash. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The daily challenge for a date key (deterministic). */
export function dailyChallengeFor(dateKey: string): ChallengeDef {
  const r = rng(hashString(`threshold-daily:${dateKey}`));
  const pick = DAILY_POOL[Math.floor(r() * DAILY_POOL.length) % DAILY_POOL.length];
  let wsum = 0;
  for (const t of DAILY_TEMPLATES) wsum += t.w;
  let x = r() * wsum;
  let tpl: DailyTemplate = 'count';
  for (const t of DAILY_TEMPLATES) {
    if (x < t.w) { tpl = t.t; break; }
    x -= t.w;
  }
  // Keep combos sensible.
  if (tpl === 'within' && pick.n < 2) tpl = 'count';
  if (tpl === 'ghost' && (pick.trick === 'ghost' || pick.trick === 'double')) tpl = 'count';
  if (tpl === 'air' && pick.trick === 'ghost') tpl = 'count';

  const trickKey = `trick.${pick.trick}`;
  const id = `daily.${dateKey}`;
  const base = { id, zone: null, titleKey: 'challenge.daily.title', descKey: `challenge.daily.${tpl}.desc` };
  switch (tpl) {
    case 'within': {
      const s = r() < 0.5 ? 5 : 8;
      return { ...base, cond: { type: 'trick', trick: pick.trick, count: 2, within: s }, vars: { trick: trickKey, s } };
    }
    case 'combo': {
      const points = [1500, 2500, 4000][Math.floor(r() * 3) % 3];
      return { ...base, cond: { type: 'combo', points, trick: pick.trick }, vars: { trick: trickKey, points } };
    }
    case 'air':
      return { ...base, cond: { type: 'trick', trick: pick.trick, count: 1, airborne: true }, vars: { trick: trickKey } };
    case 'ghost':
      return { ...base, cond: { type: 'trick', trick: pick.trick, count: 1, ghost: true }, vars: { trick: trickKey } };
    default:
      return { ...base, cond: { type: 'trick', trick: pick.trick, count: pick.n }, vars: { trick: trickKey, n: pick.n } };
  }
}

/** Localized title + description (resolves `{trick}` to the trick name). */
export function formatChallenge(def: ChallengeDef, lang: MetaLang = 'en'): { title: string; desc: string } {
  const vars: Record<string, string | number> = {};
  if (def.vars) {
    for (const k in def.vars) {
      const v = def.vars[k];
      vars[k] = k === 'trick' && typeof v === 'string' ? metaText(v, lang) : v;
    }
  }
  return { title: metaText(def.titleKey, lang, vars), desc: metaText(def.descKey, lang, vars) };
}

export function goalOf(c: ChallengeCond): number {
  switch (c.type) {
    case 'trick': case 'kill': case 'event': return Math.max(1, c.count);
    case 'loops': return Math.max(1, c.loops);
    default: return 1;
  }
}

// ---------------------------------------------------------------------------
// Storage

function safeLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const k = '__threshold_probe';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
}

interface SaveData {
  v: 1;
  done: string[];
  progress: Record<string, number>;
}

// ---------------------------------------------------------------------------

export class ChallengeSystem {
  /** Zone the player is in (from 'zone' events or setZone). null = unknown (zone challenges count anywhere). */
  zone: ZoneId | null = null;

  private storage: Storage | null;
  private done = new Set<string>();
  private prog = new Map<string, number>();
  private windows = new Map<string, number[]>();
  private dailyCache: { key: string; def: ChallengeDef } | null = null;
  /** Date provider (tests can pin it). */
  now: () => Date = () => new Date();

  constructor(storage: Storage | null = safeLocalStorage()) {
    this.storage = storage;
    this.load();
  }

  /** Zone challenges (all, or one zone's three). */
  list(zone?: ZoneId): ChallengeInfo[] {
    const out: ChallengeInfo[] = [];
    for (const d of CHALLENGES) if (!zone || d.zone === zone) out.push(this.info(d, false));
    return out;
  }

  /** Today's challenge (local date), or the one for `date`. */
  daily(date?: Date): ChallengeInfo {
    return this.info(this.dailyDef(date), true);
  }

  progress(id: string): ChallengeProgress | null {
    const def = this.defOf(id);
    if (!def) return null;
    const goal = goalOf(def.cond);
    const done = this.done.has(id);
    const count = done ? Math.max(goal, this.prog.get(id) ?? 0) : Math.min(goal, this.prog.get(id) ?? 0);
    return { id, count, goal, done, ratio: goal > 0 ? Math.min(1, count / goal) : done ? 1 : 0 };
  }

  completed(): Set<string> {
    return new Set(this.done);
  }

  setZone(z: ZoneId | null): void {
    this.zone = z;
  }

  /**
   * Feed every game event with the awards style.push() returned for it and the
   * style state after it. Returns ids completed by this call. Pass e = null to
   * feed awards that arrived without an event (StyleSystem.drainLate()).
   */
  push(e: GameEvent | null, awards: readonly TrickAward[], style: StyleState): string[] {
    const newly: string[] = [];
    try {
      if (e && e.type === 'zone' && e.zone) this.zone = e.zone;
      let changed = false;
      const daily = this.dailyDef();
      for (let i = 0; i <= CHALLENGES.length; i++) {
        const def = i < CHALLENGES.length ? CHALLENGES[i] : daily;
        if (this.done.has(def.id)) continue;
        if (def.zone && this.zone && def.zone !== this.zone) continue;
        const prev = this.prog.get(def.id) ?? 0;
        const next = this.evaluate(def, prev, e, awards, style);
        if (next !== prev) {
          this.prog.set(def.id, next);
          changed = true;
        }
        if (next >= goalOf(def.cond)) {
          this.done.add(def.id);
          newly.push(def.id);
          changed = true;
        }
      }
      if (changed) this.save();
    } catch (err) {
      console.warn('[challenges] push failed', err);
    }
    return newly;
  }

  /** Mark a challenge complete from game logic (e.g. 'crown.3' at the ending). True if newly completed. */
  complete(id: string): boolean {
    if (this.done.has(id) || !this.defOf(id)) return false;
    this.done.add(id);
    this.save();
    return true;
  }

  /** Clear progress counters (a new run). Completions are kept. */
  reset(): void {
    this.prog.clear();
    this.windows.clear();
    this.zone = null;
    this.save();
  }

  // -------------------------------------------------------------------------

  private dailyDef(date?: Date): ChallengeDef {
    const key = localDateKey(date ?? this.now());
    if (this.dailyCache && this.dailyCache.key === key) return this.dailyCache.def;
    const def = dailyChallengeFor(key);
    if (!date) {
      this.dailyCache = { key, def };
      // A new day: forget other days' unfinished progress.
      for (const k of Array.from(this.prog.keys())) if (k.startsWith('daily.') && k !== def.id) this.prog.delete(k);
    }
    return def;
  }

  private defOf(id: string): ChallengeDef | null {
    for (const d of CHALLENGES) if (d.id === id) return d;
    if (id.startsWith('daily.')) {
      const key = id.slice(6);
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return dailyChallengeFor(key);
    }
    return null;
  }

  private info(def: ChallengeDef, daily: boolean): ChallengeInfo {
    const p = this.progress(def.id) ?? { id: def.id, count: 0, goal: goalOf(def.cond), done: false, ratio: 0 };
    return { ...def, ...p, daily };
  }

  private evaluate(def: ChallengeDef, prev: number, e: GameEvent | null, awards: readonly TrickAward[], style: StyleState): number {
    const c = def.cond;
    switch (c.type) {
      case 'trick': {
        let n = 0;
        let ghost = false;
        for (const a of awards) if (a.id === 'ghost') ghost = true;
        for (const a of awards) if (a.id === c.trick) n++;
        if (!n) return prev;
        if (c.airborne && !(e && e.type === 'kill' && e.playerAirborne)) return prev;
        if (c.ghost && !ghost) return prev;
        if (c.within && c.within > 0) {
          let w = this.windows.get(def.id);
          if (!w) { w = []; this.windows.set(def.id, w); }
          const t = e ? e.t : awards[0].t;
          for (let i = 0; i < n; i++) w.push(t);
          while (w.length && w[0] < t - c.within) w.shift();
          return Math.max(prev, w.length);
        }
        return prev + n;
      }
      case 'rank':
        return rankIndex(style.rank) >= rankIndex(c.rank) ? 1 : prev;
      case 'combo': {
        const v = style.chainPoints * Math.max(1, style.variety);
        if (v < c.points) return prev;
        if (c.trick && !style.chain.some((a) => a.id === c.trick)) return prev;
        return 1;
      }
      case 'event':
        if (!e) return prev;
        if (c.event === 'catch') return e.type === 'catch' ? prev + Math.max(1, e.count) : prev;
        return e.type === c.event ? prev + 1 : prev;
      case 'loops':
        if (!e || e.type !== 'cross') return prev;
        return Math.max(prev, Math.min(c.loops, e.loops));
      case 'airtime':
        if (!e || e.type !== 'air' || e.phase !== 'end') return prev;
        return e.seconds >= c.seconds && e.crossings >= 1 ? 1 : prev;
      case 'kill': {
        if (!e || e.type !== 'kill') return prev;
        if (c.enemyKind && e.enemyKind !== c.enemyKind) return prev;
        if (c.matador && !e.matador) return prev;
        if (c.cause && c.cause.indexOf(e.cause) < 0) return prev;
        if (c.minKillerLoops && e.killerLoops < c.minKillerLoops) return prev;
        return prev + 1;
      }
      default:
        return prev;
    }
  }

  private load(): void {
    try {
      const raw = this.storage ? this.storage.getItem(CHALLENGE_STORAGE_KEY) : null;
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<SaveData> | null;
      if (!data || typeof data !== 'object') return;
      if (Array.isArray(data.done)) for (const id of data.done) if (typeof id === 'string') this.done.add(id);
      if (data.progress && typeof data.progress === 'object') {
        for (const k in data.progress) {
          const v = (data.progress as Record<string, unknown>)[k];
          if (typeof v === 'number' && Number.isFinite(v)) this.prog.set(k, v);
        }
      }
    } catch {
      /* corrupt or unavailable storage: start fresh */
    }
  }

  private save(): void {
    if (!this.storage) return;
    try {
      const progress: Record<string, number> = {};
      for (const [k, v] of this.prog) progress[k] = v;
      const data: SaveData = { v: 1, done: Array.from(this.done), progress };
      this.storage.setItem(CHALLENGE_STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* quota / private mode: keep going in memory */
    }
  }
}
