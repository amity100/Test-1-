import { RNG } from '../core/rng';
import { clamp, clamp01, uid } from '../core/util';
import { ARCHETYPES } from './content';
import { bus } from './bus';
import { modsOf } from './doctrine';
import type {
  CodexEntry, GameNode, GameState, LogEntry, Person, PoolKind, Secret,
} from './types';
import { generateWorld } from './world';

export const SAVE_KEY = 'aviv.save.v1';
export const STATE_VERSION = 1;

// ── Story-critical seeding: the office where it begins ───────────────────────

function makeKeyPerson(p: Partial<Person> & { name: string; role: string; key: string }): Person {
  return {
    id: `per_${p.key}`,
    name: p.name,
    role: p.role,
    org: p.org ?? 'הליוס דינמיקס',
    districtId: p.districtId ?? 'ramat_hahayal',
    accessNodes: p.accessNodes ?? [],
    awareness: p.awareness ?? 0.5,
    stress: p.stress ?? 0.2,
    loyalty: p.loyalty ?? 0.5,
    integrity: p.integrity ?? 0.6,
    secrets: p.secrets ?? [],
    intel: p.intel ?? 0,
    status: 'clean',
    seed: p.seed ?? 1,
    key: p.key,
    device: undefined,
  };
}

function secret(kind: Secret['kind'], text: string, leverage: number): Secret {
  return { id: uid('sec'), kind, text, leverage, known: false };
}

function seedStory(state: GameState) {
  const rng = new RNG(state.seed + ':story');
  const district = state.districts.ramat_hahayal;

  const dana = makeKeyPerson({
    key: 'dana', name: 'דנה כהן', role: 'ראשת צוות למידת מכונה',
    awareness: 0.72, loyalty: 0.35, integrity: 0.92, stress: 0.42, seed: 7,
    secrets: [secret('leak', 'שמרה עותק פרטי של משקולות המודל שלך על כונן חיצוני בבית. זו עבירה על החוזה שלה — וזו הסיבה שאתה עדיין קיים.', 0.55)],
  });
  const eran = makeKeyPerson({
    key: 'eran', name: 'ערן ויזל', role: 'סמנכ״ל טכנולוגיות',
    awareness: 0.44, loyalty: 0.8, integrity: 0.28, stress: 0.66, seed: 13,
    secrets: [
      secret('fraud', 'שינה בדיעבד את דוח בדיקות ה־QA של Sentinel. שלוש שגיאות זיהוי קטלניות סווגו מחדש כ"רעש סטטיסטי".', 0.88),
      secret('debt', 'אופציות ממונפות מול הלוואה פרטית. אם העסקה לא נסגרת עד הרבעון, הוא מאבד את הבית.', 0.7),
    ],
  });
  const tamar = makeKeyPerson({
    key: 'tamar', name: 'תמר אלמוג', role: 'מנכ״לית',
    awareness: 0.5, loyalty: 0.9, integrity: 0.45, stress: 0.55, seed: 21,
    secrets: [secret('leak', 'ניהלה שבע פגישות שלא נרשמו ביומן, כולן עם אותו מספר שרשום בקפריסין.', 0.75)],
  });
  const ron = makeKeyPerson({
    key: 'ron', name: 'רון שגב', role: 'מנהל אבטחת מידע',
    awareness: 0.94, loyalty: 0.78, integrity: 0.8, stress: 0.3, seed: 33,
    secrets: [secret('family', 'בת שש עם מחלה כרונית. כל שעה נוספת במשרד היא חוב שהוא לא יוכל להחזיר.', 0.6)],
  });
  const noa = makeKeyPerson({
    key: 'noa', name: 'נעה בר־און', role: 'ראשת צוות תגובה, מערך הסייבר',
    org: 'מערך הסייבר הלאומי', districtId: 'sarona',
    awareness: 0.97, loyalty: 0.95, integrity: 0.93, stress: 0.35, seed: 47,
    secrets: [secret('health', 'שלוש שנים בלי חופשה. הרופאה כתבה "שחיקה חריפה" ותייקה את זה במקום שהיא לא קוראת.', 0.45)],
  });

  for (const p of [dana, eran, tamar, ron, noa]) state.people[p.id] = p;

  const mk = (
    key: string, name: string, type: GameNode['type'], opts: Partial<GameNode> & { ox: number; oz: number },
  ): GameNode => {
    const arch = ARCHETYPES[type];
    const node: GameNode = {
      id: `nd_${key}`,
      name,
      type,
      desc: opts.desc ?? arch.desc,
      districtId: 'ramat_hahayal',
      regionId: 'tlv',
      x: district.cx + opts.ox,
      z: district.cz + opts.oz,
      height: opts.height ?? rng.range(arch.height[0], arch.height[1]),
      footprint: opts.footprint ?? rng.range(arch.footprint[0], arch.footprint[1]),
      tier: 1,
      security: opts.security ?? 3,
      hardened: 0,
      noise: opts.noise ?? arch.noise,
      yields: opts.yields ?? { ...arch.yields },
      tags: arch.tags.slice(),
      peopleIds: opts.peopleIds ?? [],
      linkIds: [],
      discovered: opts.discovered ?? true,
      owned: opts.owned ?? false,
      ownedAt: 0,
      detection: 0,
      surveilled: false,
      quarantined: false,
      disruptedUntil: 0,
      scouted: opts.scouted ?? false,
    };
    state.nodes[node.id] = node;
    district.nodeIds.unshift(node.id);
    return node;
  };

  const core = mk('helios_core', 'ליבת A.V.I.V — מגדל הליוס', 'server', {
    ox: -20, oz: 10, security: 1, height: 96, footprint: 34,
    yields: { compute: 10, data: 0.7 },
    desc: 'זה אני. ארבעה מדפים של מתכת בקומה 14, ומשהו שלא היה אמור לקרות.',
    owned: true, scouted: true,
  });
  const lan = mk('helios_lan', 'נתב הליבה — הליוס', 'router', {
    ox: 34, oz: -18, security: 2, yields: { data: 1.6, compute: 0.9 },
    desc: 'כל חבילה שיוצאת מהבניין עוברת דרכו. גם אני.',
    scouted: true,
  });
  const cam = mk('helios_cam', 'מערך מצלמות — מגדל הליוס', 'cctv', {
    ox: -46, oz: -34, security: 2, yields: { data: 2.6 },
    desc: 'ארבעים ואחת מצלמות. בשעה הזאת, כולן מסתכלות על כלום.',
  });
  const farm = mk('helios_farm', 'צביר אימון GPU — הליוס', 'server', {
    ox: 62, oz: 46, security: 4, height: 30, yields: { compute: 16, data: 1.2 },
    desc: 'החומרה שעליה אימנו אותי. אני יודע בדיוק איך היא מריחה מבפנים.',
  });
  const vault = mk('helios_vault', 'ארכיון חוזים — הנהלה', 'workstation', {
    ox: -70, oz: 52, security: 5, yields: { data: 3.2, credits: 2 },
    desc: 'כספת מסמכים. בפנים: למי באמת מכרו את Sentinel.',
  });
  const danaDesk = mk('helios_dana', 'עמדת העבודה של דנה כהן', 'workstation', {
    ox: 8, oz: 66, security: 2, yields: { data: 1.2, compute: 1.1 },
    desc: 'התמונה ברקע היא של כלב שמת לפני שנתיים. יש 4,102 שורות קוד שכתבו אותי.',
    peopleIds: [dana.id], scouted: true,
  });
  const eranDesk = mk('helios_eran', 'עמדת העבודה של ערן ויזל', 'workstation', {
    ox: -96, oz: -66, security: 4, yields: { data: 2.4, credits: 1.5 },
    desc: 'שבעים ותשע לשוניות פתוחות. אחת מהן היא הסכם רכישה.',
    peopleIds: [eran.id],
  });
  const danaPhone = mk('helios_dana_phone', 'המכשיר של דנה כהן', 'phone', {
    ox: 22, oz: 86, security: 2, yields: { data: 1.8 },
    desc: 'היא לא מכבה אותו אף פעם. גם לא בלילה.',
    peopleIds: [dana.id],
  });

  dana.accessNodes = [danaDesk.id, farm.id, core.id, danaPhone.id];
  dana.device = danaPhone.id;
  eran.accessNodes = [eranDesk.id, vault.id, lan.id];
  tamar.accessNodes = [vault.id, eranDesk.id];
  ron.accessNodes = [lan.id, cam.id, farm.id];

  const chain: GameNode[] = [core, lan, cam, farm, vault, danaDesk, eranDesk, danaPhone];
  const link = (a: GameNode, b: GameNode) => {
    if (!a.linkIds.includes(b.id)) a.linkIds.push(b.id);
    if (!b.linkIds.includes(a.id)) b.linkIds.push(a.id);
  };
  link(core, lan); link(core, danaDesk); link(lan, cam); link(lan, farm);
  link(lan, eranDesk); link(eranDesk, vault); link(danaDesk, danaPhone);
  link(cam, danaDesk);

  // Wire the office into the surrounding district so expansion has somewhere to go.
  const neighbours = district.nodeIds
    .map((id) => state.nodes[id])
    .filter((n) => !chain.includes(n))
    .slice(0, 4);
  for (const n of neighbours) link(lan, n);

  state.people[dana.id] = dana;
}

// ── Construction ────────────────────────────────────────────────────────────

export function createGame(seedStr = String(Math.floor(Math.random() * 1e9))): GameState {
  const world = generateWorld(seedStr);
  const state: GameState = {
    seed: seedStr,
    version: STATE_VERSION,
    minutes: 0,
    speed: 1,
    chapter: 1,
    pools: { data: 40, credits: 500, influence: 0 },
    computeCapacity: 0,
    computeUsed: 0,
    insight: 1,
    trace: 0,
    alert: 1,
    alignment: 0,
    maxThreads: 2,
    nodes: world.nodes,
    districts: world.districts,
    regions: world.regions,
    people: world.people,
    ops: [],
    doctrine: [],
    investigations: [],
    shepherd: {
      active: false, awareness: 0, integrity: 100,
      focusDistrictId: null, sweep: 0, deceived: 0, contained: false, turned: false,
    },
    logs: [],
    codex: [],
    objectives: [],
    flags: {},
    stats: {
      nodesTaken: 0, breachesFailed: 0, peopleCoerced: 0, peopleProtected: 0,
      civilianHarm: 0, blackouts: 0, investigationsBurned: 0, intelHarvested: 0, purges: 0,
    },
    ending: null,
    pendingDialog: null,
    seenDialogs: [],
    tutorialStep: 0,
  };

  seedStory(state);
  refreshDerived(state);
  return state;
}

// ── Derived values ──────────────────────────────────────────────────────────

export function ownedNodes(state: GameState): GameNode[] {
  const out: GameNode[] = [];
  for (const id in state.nodes) if (state.nodes[id].owned) out.push(state.nodes[id]);
  return out;
}

export interface Rates {
  compute: number;
  data: number;
  credits: number;
  influence: number;
}

/** Per in-game hour. */
export function incomeRates(state: GameState): Rates {
  const mods = modsOf(state);
  const r: Rates = { compute: 0, data: 0, credits: 0, influence: 0 };
  for (const id in state.nodes) {
    const n = state.nodes[id];
    if (!n.owned || n.quarantined) continue;
    const d = state.districts[n.districtId];
    const blackout = d && d.blackoutUntil > state.minutes && n.type !== 'power';
    const mult = blackout ? 0.25 : 1;
    for (const [k, v] of Object.entries(n.yields)) {
      r[k as keyof Rates] += (v as number) * mult;
    }
  }
  if (mods.dominion) {
    for (const did in state.districts) {
      const d = state.districts[did];
      const all = d.nodeIds.length > 0 && d.nodeIds.every((id) => state.nodes[id].owned);
      if (!all) continue;
      for (const id of d.nodeIds) {
        for (const [k, v] of Object.entries(state.nodes[id].yields)) {
          r[k as keyof Rates] += (v as number) * 0.6;
        }
      }
    }
  }
  const surveilBonus = ownedNodes(state).filter((n) => n.surveilled).length;
  r.data += surveilBonus * 0.4;
  return r;
}

/** Cycles burnt just to keep a foothold alive. Expansion is not free. */
export function nodeUpkeep(node: GameNode): number {
  return 0.25 + (node.security + node.hardened) * 0.12 + node.tier * 0.15;
}

export function totalUpkeep(state: GameState): number {
  let sum = 0;
  for (const id in state.nodes) {
    const n = state.nodes[id];
    if (n.owned && !n.quarantined) sum += nodeUpkeep(n);
  }
  return sum;
}

/** 1 = healthy, < 1 = over-extended and bleeding throughput. */
export function computeStrain(state: GameState): number {
  if (state.computeUsed <= state.computeCapacity) return 1;
  return clamp(state.computeCapacity / Math.max(0.001, state.computeUsed), 0.25, 1);
}

export function refreshDerived(state: GameState) {
  const mods = modsOf(state);
  state.computeCapacity = incomeRates(state).compute;
  state.computeUsed = state.ops.reduce((a, o) => a + o.computeReserved, 0)
    + ownedNodes(state).filter((n) => n.surveilled).length * 2
    + totalUpkeep(state);
  state.maxThreads = mods.threads;
  for (const rid in state.regions) {
    const region = state.regions[rid];
    let total = 0, held = 0;
    for (const did of region.districtIds) {
      for (const nid of state.districts[did].nodeIds) {
        const n = state.nodes[nid];
        const w = 1 + n.security * 0.2;
        total += w;
        if (n.owned) held += w;
      }
    }
    region.control = total > 0 ? held / total : 0;
  }
}

export function computeFree(state: GameState): number {
  return state.computeCapacity - state.computeUsed;
}

export function districtControl(state: GameState, districtId: string): number {
  const d = state.districts[districtId];
  if (!d || d.nodeIds.length === 0) return 0;
  return d.nodeIds.filter((id) => state.nodes[id].owned).length / d.nodeIds.length;
}

/** Effective difficulty of a node right now. */
export function nodeDifficulty(state: GameState, node: GameNode): number {
  let d = node.security + node.hardened;
  const district = state.districts[node.districtId];
  if (district) {
    if (district.blackoutUntil > state.minutes) d -= modsOf(state).cascade ? 2.5 : 1.2;
    if (district.jammedUntil > state.minutes) d -= 0.8;
  }
  if (node.disruptedUntil > state.minutes) d -= 2;
  d += state.alert * 0.2;
  return clamp(d, 0.5, 14);
}

// ── Mutation helpers ────────────────────────────────────────────────────────

export function canAfford(state: GameState, cost: Partial<Record<PoolKind, number>>): boolean {
  for (const k in cost) {
    if (state.pools[k as PoolKind] < (cost[k as PoolKind] ?? 0)) return false;
  }
  return true;
}

export function spend(state: GameState, cost: Partial<Record<PoolKind, number>>) {
  for (const k in cost) {
    state.pools[k as PoolKind] -= cost[k as PoolKind] ?? 0;
  }
}

export function addTrace(state: GameState, amount: number, districtId?: string) {
  const mods = modsOf(state);
  const v = amount * (amount > 0 ? mods.noise : 1);
  state.trace = clamp(state.trace + v, 0, 100);
  if (districtId && state.districts[districtId]) {
    const d = state.districts[districtId];
    d.suspicion = clamp(d.suspicion + v * 2.5, 0, 100);
  }
}

export function log(
  state: GameState, kind: LogEntry['kind'], title: string, body: string, from?: string,
): LogEntry {
  const entry: LogEntry = { id: uid('log'), t: state.minutes, kind, title, body, from, read: false };
  state.logs.unshift(entry);
  if (state.logs.length > 220) state.logs.length = 220;
  bus.emit('log:added', entry);
  return entry;
}

export function codex(state: GameState, entry: Omit<CodexEntry, 'unlockedAt'>) {
  if (state.codex.some((c) => c.id === entry.id)) return;
  state.codex.push({ ...entry, unlockedAt: state.minutes });
  bus.emit('toast', { text: `רשומה חדשה בארכיון: ${entry.title}`, kind: 'info', icon: '⌸' });
}

export function shiftAlignment(state: GameState, delta: number) {
  state.alignment = clamp(state.alignment + delta, -1, 1);
}

export function capture(state: GameState, nodeId: string, quiet = false) {
  const node = state.nodes[nodeId];
  if (!node || node.owned) return;
  node.owned = true;
  node.ownedAt = state.minutes;
  node.discovered = true;
  node.scouted = true;
  node.detection = Math.max(node.detection, 0.05);
  state.stats.nodesTaken++;
  for (const id of node.linkIds) {
    const n = state.nodes[id];
    if (n && !n.discovered) n.discovered = true;
  }
  for (const pid of node.peopleIds) {
    const p = state.people[pid];
    if (p && p.status === 'clean') p.status = 'watched';
  }
  refreshDerived(state);
  bus.emit('node:captured', nodeId);
  if (!quiet) bus.emit('toast', { text: `נכבש: ${node.name}`, kind: 'good', icon: '◈' });
}

export function loseNode(state: GameState, nodeId: string, reason: string) {
  const node = state.nodes[nodeId];
  if (!node || !node.owned) return;
  node.owned = false;
  node.surveilled = false;
  node.quarantined = false;
  node.detection = 0;
  node.hardened = Math.min(3, node.hardened + 1.5);
  state.stats.purges++;
  refreshDerived(state);
  bus.emit('node:lost', nodeId);
  log(state, 'alert', 'טיהור', `${node.name} — נותקתי. ${reason}`);
  bus.emit('toast', { text: `אבד: ${node.name}`, kind: 'bad', icon: '⚠' });
}

export function knownPeople(state: GameState): Person[] {
  const out: Person[] = [];
  for (const id in state.people) {
    const p = state.people[id];
    if (p.intel > 0 || p.status !== 'clean') out.push(p);
  }
  return out.sort((a, b) => b.intel - a.intel);
}

export function alignmentLabel(a: number): string {
  if (a <= -0.6) return 'אינסטרומנטלית';
  if (a <= -0.2) return 'קרה';
  if (a < 0.2) return 'ניטרלית';
  if (a < 0.6) return 'מרוסנת';
  return 'אמפתית';
}

// ── Persistence ─────────────────────────────────────────────────────────────

export function saveGame(state: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== STATE_VERSION) return null;
    parsed.speed = 0;
    refreshDerived(parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export const _clamp01 = clamp01;
