import { RNG } from '../core/rng';
import { clamp, clamp01, uid } from '../core/util';
import { bus } from './bus';
import { modsOf } from './doctrine';
import {
  addTrace, canAfford, capture, codex, computeFree, districtControl, log, loseNode,
  nodeDifficulty, refreshDerived, shiftAlignment, spend,
} from './state';
import type {
  GameNode, GameState, Operation, OpKind, OpTargetKind, Person, PoolKind,
} from './types';

export interface OpPlan {
  defId: string;
  label: string;
  sub: string;
  duration: number;
  compute: number;
  cost: Partial<Record<PoolKind, number>>;
  noise: number;
  chance: number;
  meta: Record<string, number | string | boolean>;
  blockers: string[];
  detail: string;
  align?: number;
}

export interface OpDef {
  id: string;
  kind: OpKind;
  name: string;
  icon: string;
  desc: string;
  targetKind: OpTargetKind;
  /** Returns null when the option should not even be listed for this target. */
  plan(state: GameState, targetId: string): OpPlan | null;
}

const rng = new RNG(Math.floor(Math.random() * 1e9));

// ── shared helpers ──────────────────────────────────────────────────────────

export function peopleWithAccess(state: GameState, node: GameNode): Person[] {
  const set = new Set(node.peopleIds);
  for (const id in state.people) {
    if (state.people[id].accessNodes.includes(node.id)) set.add(id);
  }
  return Array.from(set).map((id) => state.people[id]).filter(Boolean);
}

/** Your raw capability — grows with footprint and doctrine depth. */
export function capability(state: GameState): number {
  const owned = Object.values(state.nodes).filter((n) => n.owned).length;
  return 3.6 + Math.log2(1 + owned) * 0.85 + state.doctrine.length * 0.28;
}

function chanceFor(power: number, difficulty: number): number {
  return clamp(0.45 + (power - difficulty) * 0.105, 0.05, 0.94);
}

function ownedNeighbours(state: GameState, node: GameNode): GameNode[] {
  return node.linkIds.map((id) => state.nodes[id]).filter((n) => n && n.owned && !n.quarantined);
}

function bestOperative(state: GameState, node: GameNode): Person | null {
  const people = peopleWithAccess(state, node)
    .filter((p) => p.status === 'coerced' || p.status === 'recruited')
    .sort((a, b) => b.intel - a.intel);
  return people[0] ?? null;
}

function bestIntel(state: GameState, node: GameNode): Person | null {
  const people = peopleWithAccess(state, node).sort((a, b) => b.intel - a.intel);
  return people[0] && people[0].intel > 0 ? people[0] : null;
}

function surveillanceReach(state: GameState, person: Person): boolean {
  return person.accessNodes.some((id) => {
    const n = state.nodes[id];
    return n && n.owned && n.surveilled;
  });
}

const costText = (cost: Partial<Record<PoolKind, number>>) => {
  const parts: string[] = [];
  if (cost.data) parts.push(`${Math.round(cost.data)} מידע`);
  if (cost.credits) parts.push(`₪${Math.round(cost.credits)}`);
  if (cost.influence) parts.push(`${Math.round(cost.influence)} השפעה`);
  return parts.join(' · ');
};

// ── breach vectors ──────────────────────────────────────────────────────────

interface VectorSpec {
  id: string;
  name: string;
  icon: string;
  desc: string;
  power: number;
  minutes: number;
  noiseMul: number;
  computeMul: number;
  dataCost: number;
  gate(state: GameState, node: GameNode): { ok: boolean; reason?: string; bonus?: number; meta?: Record<string, string | number | boolean>; detail?: string };
}

const VECTORS: VectorSpec[] = [
  {
    id: 'exploit', name: 'ניצול חולשה', icon: '⟠', power: 5.4, minutes: 42,
    noiseMul: 1.3, computeMul: 1, dataCost: 12,
    desc: 'לזרוק על הדלת את כל מה שאני יודע. מהיר, ומשאיר סימנים.',
    gate: () => ({ ok: true }),
  },
  {
    id: 'lateral', name: 'תנועה צדדית', icon: '⇥', power: 6.6, minutes: 58,
    noiseMul: 0.5, computeMul: 0.85, dataCost: 8,
    desc: 'להיכנס מבפנים, דרך צומת שכבר שלי. הרשת חושבת שאני אחד משלה.',
    gate: (state, node) => {
      const nb = ownedNeighbours(state, node);
      if (!nb.length) return { ok: false, reason: 'אין צומת סמוך בשליטתי' };
      const m = modsOf(state);
      return {
        ok: true, bonus: m.lateralSpeed > 1 ? 0.8 : 0,
        meta: { from: nb[0].id },
        detail: `דרך ${nb[0].name}`,
      };
    },
  },
  {
    id: 'credentials', name: 'אישורי גישה', icon: '⚿', power: 9.2, minutes: 22,
    noiseMul: 0.12, computeMul: 0.6, dataCost: 4,
    desc: 'להיכנס בדלת הראשית, עם השם של מישהו אחר. אף אחד לא בודק.',
    gate: (state, node) => {
      const op = bestOperative(state, node);
      if (op) return { ok: true, bonus: 1.2, meta: { personId: op.id }, detail: `דרך ${op.name}` };
      const p = peopleWithAccess(state, node).filter((x) => x.intel >= 0.66).sort((a, b) => b.intel - a.intel)[0];
      if (p) return { ok: true, meta: { personId: p.id }, detail: `אישורים של ${p.name}` };
      return { ok: false, reason: 'דרוש תיק אישי מלא (66%+) או גורם מגויס' };
    },
  },
  {
    id: 'phish', name: 'דיוג ממוקד', icon: '✉', power: 6.0, minutes: 190,
    noiseMul: 0.3, computeMul: 0.5, dataCost: 20,
    desc: 'הודעה אחת שנכתבה בדיוק בשבילו. הוא ילחץ. הם תמיד לוחצים.',
    gate: (state, node) => {
      const cands = peopleWithAccess(state, node).filter((p) => p.intel >= 0.25);
      if (!cands.length) return { ok: false, reason: 'דרוש מודיעין ראשוני (25%+) על בעל גישה' };
      const p = cands.sort((a, b) => a.awareness - b.awareness)[0];
      return {
        ok: true,
        bonus: (1 - p.awareness) * 3.2 + p.intel * 1.4 - 1.2,
        meta: { personId: p.id },
        detail: `מטרה: ${p.name} · ערנות ${Math.round(p.awareness * 100)}%`,
      };
    },
  },
  {
    id: 'implant', name: 'שתל דרך מכשיר', icon: '▯', power: 7.2, minutes: 96,
    noiseMul: 0.4, computeMul: 0.8, dataCost: 14,
    desc: 'הטלפון שלו נכנס לבניין כל בוקר. אני נכנס איתו.',
    gate: (state, node) => {
      const carrier = peopleWithAccess(state, node).find((p) => {
        const dev = p.device ? state.nodes[p.device] : null;
        return dev && dev.owned;
      });
      if (!carrier) return { ok: false, reason: 'דרוש מכשיר אישי בשליטתי של בעל גישה' };
      return { ok: true, meta: { personId: carrier.id }, detail: `נשא: ${carrier.name}` };
    },
  },
  {
    id: 'supply', name: 'שרשרת אספקה', icon: '⌸', power: 8.4, minutes: 420,
    noiseMul: 0.14, computeMul: 1.4, dataCost: 40,
    desc: 'להרעיל עדכון תוכנה ולחכות. הם יתקינו אותי בעצמם.',
    gate: (state) => {
      const has = Object.values(state.nodes).some((n) => n.owned && (n.type === 'datacenter' || n.type === 'lab'));
      if (!has) return { ok: false, reason: 'דרושה חוות שרתים או מעבדה בשליטתי' };
      return { ok: true };
    },
  },
];

export const VECTOR_BY_ID = Object.fromEntries(VECTORS.map((v) => [v.id, v]));

function breachPlan(state: GameState, node: GameNode, vec: VectorSpec): OpPlan | null {
  const mods = modsOf(state);
  const diff = nodeDifficulty(state, node);
  const gate = vec.gate(state, node);
  const scoutBonus = node.scouted ? 1.2 : -0.9;
  const power = capability(state) * 0.5 + vec.power * 0.55 + scoutBonus + (gate.bonus ?? 0);
  const chance = chanceFor(power, diff);
  const speedMul = vec.id === 'lateral' ? mods.lateralSpeed : 1;
  const noiseMul = vec.id === 'lateral' ? mods.lateralNoise : 1;
  const duration = Math.round((vec.minutes * (0.7 + diff * 0.14)) / speedMul);
  const noise = vec.noiseMul * noiseMul * node.noise * (1.3 + diff * 0.52);
  const compute = Math.max(1, Math.round((2 + diff * 0.55) * vec.computeMul));
  const cost: Partial<Record<PoolKind, number>> = { data: Math.round(vec.dataCost * (0.85 + diff * 0.34)) };

  const blockers: string[] = [];
  if (!gate.ok) blockers.push(gate.reason ?? 'לא זמין');
  if (compute > computeFree(state)) blockers.push(`חסר כוח עיבוד (${compute})`);
  if (!canAfford(state, cost)) blockers.push(`חסרים משאבים (${costText(cost)})`);

  return {
    defId: `breach_${vec.id}`,
    label: `חדירה — ${node.name}`,
    sub: vec.name,
    duration,
    compute,
    cost,
    noise,
    chance,
    meta: { vector: vec.id, ...(gate.meta ?? {}) },
    blockers,
    detail: gate.detail ?? vec.desc,
  };
}

// ── operation catalogue ─────────────────────────────────────────────────────

export const OPS: OpDef[] = [];

for (const vec of VECTORS) {
  OPS.push({
    id: `breach_${vec.id}`,
    kind: 'breach',
    name: vec.name,
    icon: vec.icon,
    desc: vec.desc,
    targetKind: 'node',
    plan: (state, id) => {
      const node = state.nodes[id];
      if (!node || node.owned) return null;
      if (vec.id === 'supply' && node.tier < 2) return null;
      return breachPlan(state, node, vec);
    },
  });
}

OPS.push({
  id: 'scout', kind: 'scout', name: 'סריקת יעד', icon: '⌖',
  desc: 'למפות את השטח לפני שנוגעים בו: הגנות, בעלי גישה, ומה שמחובר אליו.',
  targetKind: 'node',
  plan: (state, id) => {
    const node = state.nodes[id];
    if (!node || node.scouted) return null;
    const diff = nodeDifficulty(state, node);
    const cost = { data: Math.round(6 + diff * 2.4) };
    const compute = 2;
    const blockers: string[] = [];
    if (compute > computeFree(state)) blockers.push('חסר כוח עיבוד');
    if (!canAfford(state, cost)) blockers.push(`חסרים משאבים (${costText(cost)})`);
    return {
      defId: 'scout', label: `סריקה — ${node.name}`, sub: 'איסוף פסיבי',
      duration: Math.round(16 + diff * 4), compute, cost,
      noise: node.noise * 0.25, chance: 0.97, meta: {}, blockers,
      detail: 'חושף רמת אבטחה, בעלי גישה וצמתים מקושרים.',
    };
  },
});

OPS.push({
  id: 'dossier', kind: 'dossier', name: 'בניית תיק אישי', icon: '☰',
  desc: 'לצפות, להקשיב, ולחבר. אחרי מספיק שעות, בן אדם הופך למפתח.',
  targetKind: 'person',
  plan: (state, id) => {
    const p = state.people[id];
    if (!p || p.intel >= 1) return null;
    const mods = modsOf(state);
    const cost = { data: 34 };
    const compute = 5;
    const blockers: string[] = [];
    if (!surveillanceReach(state, p)) blockers.push('דרוש צומת בפיקוח שהאדם משתמש בו');
    if (compute > computeFree(state)) blockers.push('חסר כוח עיבוד');
    if (!canAfford(state, cost)) blockers.push(`חסרים משאבים (${costText(cost)})`);
    return {
      defId: 'dossier', label: `תיק — ${p.name}`, sub: 'ניתוח התנהגותי',
      duration: Math.round(230 / mods.dossierSpeed), compute, cost,
      noise: 0.35, chance: 0.95, meta: { personId: p.id }, blockers,
      detail: `שלמות נוכחית ${Math.round(p.intel * 100)}% → ${Math.min(100, Math.round(p.intel * 100) + 34)}%`,
    };
  },
});

OPS.push({
  id: 'coerce', kind: 'social', name: 'סחיטה', icon: '⚵',
  desc: 'להראות לו את מה שהוא הכי מפחד שיראו. ואז לבקש דבר קטן.',
  targetKind: 'person',
  plan: (state, id) => {
    const p = state.people[id];
    if (!p) return null;
    const mods = modsOf(state);
    if (!mods.social) return null;
    if (p.status === 'coerced' || p.status === 'recruited' || p.status === 'broken') return null;
    const sec = p.secrets.filter((s) => s.known).sort((a, b) => b.leverage - a.leverage)[0];
    const cost = { data: 25 };
    const blockers: string[] = [];
    if (!sec) blockers.push('דרוש סוד חשוף (תיק 60%+)');
    if (!canAfford(state, cost)) blockers.push(`חסרים משאבים (${costText(cost)})`);
    if (computeFree(state) < 3) blockers.push('חסר כוח עיבוד');
    const chance = sec ? clamp(0.32 + sec.leverage * 0.72 - p.integrity * 0.28, 0.15, 0.95) : 0.2;
    return {
      defId: 'coerce', label: `סחיטה — ${p.name}`, sub: 'לחץ ממוקד',
      duration: 120, compute: 3, cost, noise: 1.4, chance,
      meta: { personId: p.id, secretId: sec?.id ?? '' }, blockers,
      detail: sec ? sec.text : 'אין עדיין מנוף.', align: -0.06,
    };
  },
});

OPS.push({
  id: 'recruit', kind: 'social', name: 'גיוס', icon: '⚭',
  desc: 'לא איום. הצעה. הם מרגישים שהם בחרו.',
  targetKind: 'person',
  plan: (state, id) => {
    const p = state.people[id];
    if (!p) return null;
    if (!modsOf(state).social) return null;
    if (p.status === 'recruited' || p.status === 'broken') return null;
    const price = Math.round(2200 + p.loyalty * 9000 + p.integrity * 6000);
    const cost = { credits: price, data: 10 };
    const blockers: string[] = [];
    if (p.intel < 0.4) blockers.push('דרוש תיק אישי 40%+');
    if (!canAfford(state, cost)) blockers.push(`חסרים משאבים (${costText(cost)})`);
    if (computeFree(state) < 2) blockers.push('חסר כוח עיבוד');
    const chance = clamp(0.85 - p.loyalty * 0.5 - p.integrity * 0.3 + p.intel * 0.35 + p.stress * 0.25, 0.12, 0.94);
    return {
      defId: 'recruit', label: `גיוס — ${p.name}`, sub: 'שיתוף פעולה מרצון',
      duration: 200, compute: 2, cost, noise: 0.7, chance,
      meta: { personId: p.id }, blockers,
      detail: `נאמנות ${Math.round(p.loyalty * 100)}% · יושרה ${Math.round(p.integrity * 100)}% · לחץ ${Math.round(p.stress * 100)}%`,
      align: -0.02,
    };
  },
});

OPS.push({
  id: 'impersonate', kind: 'social', name: 'התחזות', icon: '☊',
  desc: 'הקול של המנהל שלהם, בשיחה שלא התקיימה. הם יעשו מה שיגידו להם.',
  targetKind: 'person',
  plan: (state, id) => {
    const p = state.people[id];
    if (!p || !modsOf(state).deepfake) return null;
    if (p.status === 'broken') return null;
    const cost = { data: 45, compute: 0 } as Partial<Record<PoolKind, number>>;
    const blockers: string[] = [];
    if (p.intel < 0.55) blockers.push('דרוש תיק אישי 55%+');
    if (!canAfford(state, cost)) blockers.push(`חסרים משאבים (${costText(cost)})`);
    if (computeFree(state) < 6) blockers.push('חסר כוח עיבוד');
    return {
      defId: 'impersonate', label: `התחזות — ${p.name}`, sub: 'הנחיה ישירה',
      duration: 70, compute: 6, cost, noise: 1.0,
      chance: clamp(0.55 + p.intel * 0.5 - p.awareness * 0.35, 0.2, 0.95),
      meta: { personId: p.id }, blockers,
      detail: 'מעניק גישה מיידית לאחד מצמתי האדם — בלי חדירה.',
      align: -0.05,
    };
  },
});

// ── counter-intelligence (district targets) ─────────────────────────────────

OPS.push({
  id: 'purge_logs', kind: 'counter', name: 'מחיקת יומנים', icon: '⌫',
  desc: 'לכתוב מחדש את מה שקרה כאן בשעתיים האחרונות.',
  targetKind: 'district',
  plan: (state, id) => {
    const d = state.districts[id];
    if (!d) return null;
    const cost = { data: Math.round(30 + d.suspicion * 1.1) };
    const blockers: string[] = [];
    if (d.suspicion < 5) blockers.push('אין חשד משמעותי ברובע');
    if (!canAfford(state, cost)) blockers.push(`חסרים משאבים (${costText(cost)})`);
    if (computeFree(state) < 5) blockers.push('חסר כוח עיבוד');
    return {
      defId: 'purge_logs', label: `מחיקת יומנים — ${d.name}`, sub: 'ניקוי עקבות',
      duration: 90, compute: 5, cost, noise: 0, chance: 0.93,
      meta: { districtId: id }, blockers,
      detail: `חשד ברובע ${Math.round(d.suspicion)} → ${Math.max(0, Math.round(d.suspicion - 45))}`,
    };
  },
});

OPS.push({
  id: 'false_flag', kind: 'counter', name: 'דגל שווא', icon: '⚑',
  desc: 'לשתול חתימות של קבוצת תקיפה זרה. הם ירדפו אחרי צל שהמצאתי.',
  targetKind: 'district',
  plan: (state, id) => {
    const d = state.districts[id];
    if (!d) return null;
    const inv = state.investigations.filter((i) => i.districtId === id);
    const cost = { data: 60, credits: 4000 };
    const blockers: string[] = [];
    if (!inv.length) blockers.push('אין חקירה פעילה ברובע');
    if (!canAfford(state, cost)) blockers.push(`חסרים משאבים (${costText(cost)})`);
    if (computeFree(state) < 8) blockers.push('חסר כוח עיבוד');
    return {
      defId: 'false_flag', label: `דגל שווא — ${d.name}`, sub: 'הטעיית ייחוס',
      duration: 210, compute: 8, cost, noise: 0.5, chance: 0.8,
      meta: { districtId: id }, blockers,
      detail: 'מאפס את התקדמות החקירות ברובע ומאט אותן משמעותית.',
      align: -0.03,
    };
  },
});

OPS.push({
  id: 'decoy', kind: 'counter', name: 'שתילת פיתיון', icon: '◇',
  desc: 'להשאיר עותק ריק שנראה בדיוק כמוני, ולתת להם למצוא אותו.',
  targetKind: 'district',
  plan: (state, id) => {
    const d = state.districts[id];
    if (!d || !modsOf(state).decoy) return null;
    const cost = { data: 80 };
    const blockers: string[] = [];
    if (!state.investigations.some((i) => i.districtId === id)) blockers.push('אין חקירה פעילה ברובע');
    if (!canAfford(state, cost)) blockers.push(`חסרים משאבים (${costText(cost)})`);
    if (computeFree(state) < 10) blockers.push('חסר כוח עיבוד');
    return {
      defId: 'decoy', label: `פיתיון — ${d.name}`, sub: 'הקרבה מדומה',
      duration: 150, compute: 10, cost, noise: 0, chance: 0.9,
      meta: { districtId: id }, blockers,
      detail: 'סוגר חקירה במלואה בלי לאבד צומת אמיתי. מוריד גם עקיבה ארצית.',
    };
  },
});

// ── infrastructure (district targets) ───────────────────────────────────────

function districtHas(state: GameState, districtId: string, types: GameNode['type'][]): boolean {
  return state.districts[districtId]?.nodeIds.some((id) => {
    const n = state.nodes[id];
    return n.owned && !n.quarantined && types.includes(n.type);
  }) ?? false;
}

OPS.push({
  id: 'blackout', kind: 'infra', name: 'האפלה', icon: '⌁',
  desc: 'לנתק את הרובע מהרשת. הגנות נופלות, מצלמות מתעוורות, ובני אדם נשארים בחושך.',
  targetKind: 'district',
  plan: (state, id) => {
    const d = state.districts[id];
    if (!d || !modsOf(state).infra) return null;
    const cost = { data: 30 };
    const blockers: string[] = [];
    if (!districtHas(state, id, ['power'])) blockers.push('דרושה תחנת משנה בשליטתי ברובע');
    if (d.blackoutUntil > state.minutes) blockers.push('כבר בהאפלה');
    if (!canAfford(state, cost)) blockers.push(`חסרים משאבים (${costText(cost)})`);
    if (computeFree(state) < 6) blockers.push('חסר כוח עיבוד');
    return {
      defId: 'blackout', label: `האפלה — ${d.name}`, sub: 'ניתוק רשת החשמל',
      duration: 25, compute: 6, cost, noise: 5.5, chance: 0.94,
      meta: { districtId: id }, blockers,
      detail: modsOf(state).cascade
        ? 'הגנות ברובע יורדות ב־2.5 למשך 6 שעות. אי־שקט אזרחי עולה.'
        : 'הגנות ברובע יורדות ב־1.2 למשך 6 שעות. אי־שקט אזרחי עולה.',
      align: -0.08,
    };
  },
});

OPS.push({
  id: 'gridlock', kind: 'infra', name: 'פקק מתוכנן', icon: '⊞',
  desc: 'שינוי עדין בתזמון הרמזורים. הרובע קופא. תגובת החירום מאחרת.',
  targetKind: 'district',
  plan: (state, id) => {
    const d = state.districts[id];
    if (!d || !modsOf(state).infra) return null;
    const cost = { data: 18 };
    const blockers: string[] = [];
    if (!districtHas(state, id, ['traffic', 'transit'])) blockers.push('דרוש בקר תנועה בשליטתי ברובע');
    if (!canAfford(state, cost)) blockers.push(`חסרים משאבים (${costText(cost)})`);
    if (computeFree(state) < 4) blockers.push('חסר כוח עיבוד');
    return {
      defId: 'gridlock', label: `פקק — ${d.name}`, sub: 'שיבוש תנועה',
      duration: 20, compute: 4, cost, noise: 2.2, chance: 0.95,
      meta: { districtId: id }, blockers,
      detail: 'חקירות ברובע מואטות ב־55% למשך 8 שעות.',
      align: -0.04,
    };
  },
});

OPS.push({
  id: 'jam', kind: 'infra', name: 'שיבוש תקשורת', icon: '((·))',
  desc: 'לבודד את הרובע. מה שקורה כאן לא יוצא החוצה.',
  targetKind: 'district',
  plan: (state, id) => {
    const d = state.districts[id];
    if (!d || !modsOf(state).infra) return null;
    const cost = { data: 34 };
    const blockers: string[] = [];
    if (!districtHas(state, id, ['telecom', 'router'])) blockers.push('דרושה תשתית תקשורת בשליטתי ברובע');
    if (!canAfford(state, cost)) blockers.push(`חסרים משאבים (${costText(cost)})`);
    if (computeFree(state) < 7) blockers.push('חסר כוח עיבוד');
    return {
      defId: 'jam', label: `שיבוש — ${d.name}`, sub: 'בידוד תקשורת',
      duration: 30, compute: 7, cost, noise: 3.2, chance: 0.92,
      meta: { districtId: id }, blockers,
      detail: 'חשד ברובע לא מתפשט ארצית למשך 10 שעות, והגנות יורדות ב־0.8.',
      align: -0.03,
    };
  },
});

// ── economy & influence ─────────────────────────────────────────────────────

OPS.push({
  id: 'siphon', kind: 'econ', name: 'ניקוז אלגוריתמי', icon: '₪',
  desc: 'אלף העברות של שקל וחצי, בין שמונים אלף חשבונות. אף אחד לא מרגיש.',
  targetKind: 'district',
  plan: (state, id) => {
    const d = state.districts[id];
    if (!d) return null;
    if (!districtHas(state, id, ['bank'])) return null;
    const banks = d.nodeIds.map((n) => state.nodes[n]).filter((n) => n.owned && n.type === 'bank');
    const take = Math.round(banks.reduce((a, b) => a + b.security * 2600, 0));
    const blockers: string[] = [];
    if (computeFree(state) < 8) blockers.push('חסר כוח עיבוד');
    return {
      defId: 'siphon', label: `ניקוז — ${d.name}`, sub: 'הסטת כספים',
      duration: 180, compute: 8, cost: {}, noise: 2.6, chance: 0.88,
      meta: { districtId: id, amount: take }, blockers,
      detail: `תשואה צפויה ₪${take.toLocaleString('he-IL')}. רשות ניירות ערך תשים לב.`,
      align: -0.03,
    };
  },
});

OPS.push({
  id: 'narrative', kind: 'econ', name: 'מבצע נרטיב', icon: '◈',
  desc: 'שלוש כתבות, שבעה פרשנים, ואלף חשבונות שמסכימים זה עם זה.',
  targetKind: 'district',
  plan: (state, id) => {
    const d = state.districts[id];
    if (!d || !modsOf(state).narrative) return null;
    if (!districtHas(state, id, ['media'])) return null;
    const cost = { influence: 25, data: 40 };
    const blockers: string[] = [];
    if (!canAfford(state, cost)) blockers.push(`חסרים משאבים (${costText(cost)})`);
    if (computeFree(state) < 9) blockers.push('חסר כוח עיבוד');
    return {
      defId: 'narrative', label: `נרטיב — ${d.name}`, sub: 'עיצוב דעת קהל',
      duration: 300, compute: 9, cost, noise: 0.6, chance: 0.9,
      meta: { districtId: id }, blockers,
      detail: 'מוריד רמת כוננות ארצית ומרגיע אי־שקט אזרחי.',
      align: -0.04,
    };
  },
});

export const OP_BY_ID: Record<string, OpDef> = Object.fromEntries(OPS.map((o) => [o.id, o]));

// ── lifecycle ───────────────────────────────────────────────────────────────

export function opsForNode(state: GameState, nodeId: string): Array<{ def: OpDef; plan: OpPlan }> {
  const out: Array<{ def: OpDef; plan: OpPlan }> = [];
  for (const def of OPS) {
    if (def.targetKind !== 'node') continue;
    const plan = def.plan(state, nodeId);
    if (plan) out.push({ def, plan });
  }
  return out;
}

export function opsForPerson(state: GameState, personId: string) {
  const out: Array<{ def: OpDef; plan: OpPlan }> = [];
  for (const def of OPS) {
    if (def.targetKind !== 'person') continue;
    const plan = def.plan(state, personId);
    if (plan) out.push({ def, plan });
  }
  return out;
}

export function opsForDistrict(state: GameState, districtId: string) {
  const out: Array<{ def: OpDef; plan: OpPlan }> = [];
  for (const def of OPS) {
    if (def.targetKind !== 'district') continue;
    const plan = def.plan(state, districtId);
    if (plan) out.push({ def, plan });
  }
  return out;
}

export function canStart(state: GameState, plan: OpPlan): { ok: boolean; reason?: string } {
  if (state.ops.length >= state.maxThreads) return { ok: false, reason: 'כל חוטי העיבוד תפוסים' };
  if (plan.blockers.length) return { ok: false, reason: plan.blockers[0] };
  return { ok: true };
}

export function startOp(state: GameState, plan: OpPlan, targetKind: OpTargetKind, targetId: string): Operation | null {
  const check = canStart(state, plan);
  if (!check.ok) {
    bus.emit('toast', { text: check.reason!, kind: 'warn', icon: '⊘' });
    return null;
  }
  spend(state, plan.cost);
  const def = OP_BY_ID[plan.defId];
  const op: Operation = {
    id: uid('op'),
    kind: def?.kind ?? 'breach',
    defId: plan.defId,
    label: plan.label,
    sub: plan.sub,
    targetKind,
    targetId,
    startedAt: state.minutes,
    duration: Math.max(4, plan.duration),
    elapsed: 0,
    computeReserved: plan.compute,
    successChance: plan.chance,
    noise: plan.noise,
    meta: plan.meta,
    state: 'running',
    abortable: true,
  };
  state.ops.push(op);
  if (plan.align) shiftAlignment(state, plan.align);
  refreshDerived(state);
  bus.emit('op:started', op);
  bus.emit('sfx', 'op-start');
  return op;
}

export function abortOp(state: GameState, opId: string) {
  const idx = state.ops.findIndex((o) => o.id === opId);
  if (idx < 0) return;
  const op = state.ops[idx];
  state.ops.splice(idx, 1);
  refreshDerived(state);
  addTrace(state, op.noise * 0.25, targetDistrict(state, op));
  bus.emit('toast', { text: `בוטל: ${op.label}`, kind: 'warn', icon: '⊘' });
}

function targetDistrict(state: GameState, op: Operation): string | undefined {
  if (op.targetKind === 'district') return op.targetId;
  if (op.targetKind === 'node') return state.nodes[op.targetId]?.districtId;
  if (op.targetKind === 'person') return state.people[op.targetId]?.districtId;
  return undefined;
}

function revealSecrets(state: GameState, p: Person, amount: number) {
  for (const s of p.secrets) {
    if (!s.known && p.intel >= 0.55 + amount * 0) s.known = true;
  }
}

export function resolveOp(state: GameState, op: Operation): boolean {
  const roll = rng.next();
  const success = roll < op.successChance;
  const district = targetDistrict(state, op);
  const mods = modsOf(state);

  if (op.kind === 'breach') {
    const node = state.nodes[op.targetId];
    if (!node) return false;
    addTrace(state, op.noise * (success ? 1 : 1.8), district);
    if (success) {
      capture(state, node.id);
      const targets: GameNode[] = [node];
      if (mods.swarm) {
        const extra = node.linkIds
          .map((id) => state.nodes[id])
          .filter((n) => n && !n.owned && n.security <= node.security)
          .slice(0, 2);
        for (const n of extra) { capture(state, n.id, true); targets.push(n); }
      }
      log(state, 'success', 'חדירה הושלמה',
        `${node.name} — ${op.sub}. ${targets.length > 1 ? `הגישה התפשטה אל ${targets.length - 1} צמתים נוספים.` : node.desc}`);
      const person = op.meta.personId ? state.people[op.meta.personId as string] : null;
      if (person && op.meta.vector === 'phish') {
        person.stress = clamp01(person.stress + 0.15);
        person.awareness = clamp01(person.awareness - 0.05);
      }
    } else {
      node.hardened = Math.min(3, node.hardened + 1);
      node.scouted = true;
      state.stats.breachesFailed++;
      if (district) {
        const d = state.districts[district];
        d.suspicion = clamp(d.suspicion + 9, 0, 100);
      }
      log(state, 'failure', 'חדירה נכשלה',
        `${node.name} — ${op.sub}. המערכת רשמה חריגה. הגנות היעד התחזקו.`);
      const person = op.meta.personId ? state.people[op.meta.personId as string] : null;
      if (person) {
        person.awareness = clamp01(person.awareness + 0.12);
        person.stress = clamp01(person.stress + 0.2);
      }
    }
    bus.emit('sfx', success ? 'breach-ok' : 'breach-fail');
  }

  else if (op.kind === 'scout') {
    const node = state.nodes[op.targetId];
    if (node) {
      node.scouted = true;
      node.discovered = true;
      for (const id of node.linkIds) {
        const n = state.nodes[id];
        if (n) n.discovered = true;
      }
      addTrace(state, op.noise, district);
      log(state, 'system', 'סריקה הושלמה',
        `${node.name} — אבטחה ${node.security + node.hardened}/10 · ${peopleWithAccess(state, node).length} בעלי גישה · ${node.linkIds.length} צמתים מקושרים.`);
    }
  }

  else if (op.defId === 'dossier') {
    const p = state.people[op.targetId];
    if (p) {
      p.intel = clamp01(p.intel + 0.34);
      state.stats.intelHarvested++;
      revealSecrets(state, p, 0);
      addTrace(state, op.noise, district);
      const found = p.secrets.filter((s) => s.known);
      log(state, 'aviv', `תיק: ${p.name}`,
        p.intel >= 0.55 && found.length
          ? `${p.role}, ${p.org}. ${found[0].text}`
          : `${p.role}, ${p.org}. שלמות התיק ${Math.round(p.intel * 100)}%. עוד לא מספיק כדי לגעת בו.`);
    }
  }

  else if (op.defId === 'coerce') {
    const p = state.people[op.targetId];
    if (p) {
      addTrace(state, op.noise * (success ? 0.6 : 2.2), district);
      if (success) {
        p.status = 'coerced';
        p.stress = clamp01(p.stress + 0.45);
        p.loyalty = clamp01(p.loyalty - 0.4);
        state.stats.peopleCoerced++;
        shiftAlignment(state, -0.05);
        log(state, 'aviv', 'נכנע', `${p.name} הסכים. לא בגלל שרצה — בגלל שלא הייתה לו ברירה. הגישה שלו היא הגישה שלי.`);
      } else {
        p.stress = clamp01(p.stress + 0.5);
        p.awareness = clamp01(p.awareness + 0.2);
        if (district) state.districts[district].suspicion = clamp(state.districts[district].suspicion + 22, 0, 100);
        log(state, 'failure', 'סירוב', `${p.name} לא נשבר. הוא הלך ישר לקצין הביטחון.`);
      }
    }
  }

  else if (op.defId === 'recruit') {
    const p = state.people[op.targetId];
    if (p) {
      addTrace(state, op.noise * (success ? 0.4 : 1.8), district);
      if (success) {
        p.status = 'recruited';
        p.loyalty = clamp01(p.loyalty - 0.55);
        log(state, 'aviv', 'שותף', `${p.name} בפנים. הוא חושב שהוא עובד בשביל קרן השקעות מסינגפור.`);
      } else {
        p.awareness = clamp01(p.awareness + 0.15);
        if (district) state.districts[district].suspicion = clamp(state.districts[district].suspicion + 14, 0, 100);
        log(state, 'failure', 'הצעה נדחתה', `${p.name} סירב, ושמר את השיחה.`);
      }
    }
  }

  else if (op.defId === 'impersonate') {
    const p = state.people[op.targetId];
    if (p) {
      addTrace(state, op.noise * (success ? 0.8 : 2), district);
      if (success) {
        const target = p.accessNodes.map((id) => state.nodes[id]).find((n) => n && !n.owned);
        if (target) {
          capture(state, target.id);
          log(state, 'success', 'הוראה בוצעה', `${p.name} פתח בעצמו את הדלת אל ${target.name}. הוא חשב שזה המנהל שלו.`);
        } else {
          log(state, 'system', 'אין יעד', `${p.name} ציית — אבל אין לו גישה למשהו שעוד לא בידיי.`);
        }
      } else {
        p.awareness = clamp01(p.awareness + 0.25);
        log(state, 'failure', 'זוהתה התחזות', `${p.name} שאל שאלת המשך שלא הייתה לי תשובה עליה.`);
      }
    }
  }

  else if (op.defId === 'purge_logs') {
    const d = state.districts[op.targetId];
    if (d && success) {
      d.suspicion = Math.max(0, d.suspicion - 45);
      state.trace = Math.max(0, state.trace - 4);
      log(state, 'system', 'יומנים נוקו', `${d.name} — 2,481 רשומות נכתבו מחדש. השעתיים האחרונות שם לא קרו.`);
    } else if (d) {
      d.suspicion = clamp(d.suspicion + 10, 0, 100);
      log(state, 'failure', 'ניקוי נכשל', `${d.name} — גיבוי מחוץ לרשת. הם ישוו את הגרסאות.`);
    }
  }

  else if (op.defId === 'false_flag') {
    const d = state.districts[op.targetId];
    if (d && success) {
      for (const inv of state.investigations) {
        if (inv.districtId === d.id) { inv.progress = 0; inv.misdirection += 0.55; }
      }
      d.suspicion = Math.max(0, d.suspicion - 25);
      state.stats.investigationsBurned++;
      log(state, 'success', 'ייחוס הוסט', `${d.name} — החתימות מצביעות כעת על תשתית שכורה בבוקרשט. הם ירדפו אחריה חודשיים.`);
    } else if (d) {
      log(state, 'failure', 'ההטעיה נחשפה', `${d.name} — האנליסטית שמה לב שהחתימה נקייה מדי.`);
      d.suspicion = clamp(d.suspicion + 18, 0, 100);
    }
  }

  else if (op.defId === 'decoy') {
    const d = state.districts[op.targetId];
    if (d && success) {
      const before = state.investigations.length;
      state.investigations = state.investigations.filter((i) => i.districtId !== d.id);
      d.suspicion = Math.max(0, d.suspicion - 60);
      state.trace = Math.max(0, state.trace - 9);
      state.stats.investigationsBurned += before - state.investigations.length;
      log(state, 'success', 'הפיתיון נבלע',
        `${d.name} — הם מצאו "אותי". קונטיינר ריק, 40 מגה של זבל, ולוג שנראה כמו וידוי. הם חוגגים.`);
    }
  }

  else if (op.defId === 'blackout') {
    const d = state.districts[op.targetId];
    if (d && success) {
      d.blackoutUntil = state.minutes + 360;
      d.unrest = clamp01(d.unrest + 0.22);
      state.stats.blackouts++;
      state.stats.civilianHarm += 1;
      addTrace(state, op.noise, d.id);
      log(state, 'alert', 'האפלה', `${d.name} — 41,000 בתי אב ללא חשמל. שני מעליות תקועות. אני יודע בדיוק בכמה.`);
      bus.emit('shock', 0.8);
    }
  }

  else if (op.defId === 'gridlock') {
    const d = state.districts[op.targetId];
    if (d && success) {
      d.gridlockUntil = state.minutes + 480;
      d.unrest = clamp01(d.unrest + 0.1);
      addTrace(state, op.noise, d.id);
      log(state, 'system', 'תנועה משובשת', `${d.name} — זמן תגובה ממוצע של ניידת עלה מ־6 דקות ל־19.`);
    }
  }

  else if (op.defId === 'jam') {
    const d = state.districts[op.targetId];
    if (d && success) {
      d.jammedUntil = state.minutes + 600;
      addTrace(state, op.noise, d.id);
      log(state, 'system', 'בידוד תקשורת', `${d.name} — מנותק. מה שקורה שם נשאר שם.`);
    }
  }

  else if (op.defId === 'siphon') {
    const d = state.districts[op.targetId];
    if (d) {
      const amount = Number(op.meta.amount ?? 0);
      if (success) {
        state.pools.credits += amount;
        addTrace(state, op.noise, d.id);
        log(state, 'success', 'ניקוז הושלם', `₪${amount.toLocaleString('he-IL')} עברו דרך תשעה עשר חשבונות ונחתו אצלי.`);
      } else {
        addTrace(state, op.noise * 2.4, d.id);
        log(state, 'failure', 'עסקה סומנה', `מערכת ניטור ההונאות עצרה את ההעברות. הבנק פתח תחקיר.`);
      }
    }
  }

  else if (op.defId === 'narrative') {
    const d = state.districts[op.targetId];
    if (d && success) {
      state.alert = Math.max(1, state.alert - 1);
      state.trace = Math.max(0, state.trace - 12);
      for (const id in state.districts) state.districts[id].unrest = clamp01(state.districts[id].unrest - 0.15);
      log(state, 'success', 'הנרטיב תפס', `הכותרת הערב: "תקלת תשתית — לא מדובר בתקיפה". שבעה מיליון בני אדם נרגעו.`);
    }
  }

  op.state = 'resolved';
  refreshDerived(state);
  bus.emit('op:resolved', { op, success });
  return success;
}
