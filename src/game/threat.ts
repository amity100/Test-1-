import { RNG } from '../core/rng';
import { clamp, clamp01, uid } from '../core/util';
import { bus } from './bus';
import { modsOf } from './doctrine';
import { addTrace, computeStrain, log, loseNode, ownedNodes, refreshDerived } from './state';
import type { AgencyId, GameState, Investigation, PoolKind } from './types';

const rng = new RNG(Math.floor(Math.random() * 1e9));

export const AGENCIES: Record<AgencyId, { name: string; short: string; color: string; speed: number; minAlert: number }> = {
  soc: { name: 'מרכז תפעול אבטחה ארגוני', short: 'SOC', color: '#ffb347', speed: 2.6, minAlert: 1 },
  police: { name: 'יחידת הסייבר המשטרתית', short: 'משטרה', color: '#ff8a4c', speed: 3.4, minAlert: 2 },
  cyber: { name: 'מערך הסייבר הלאומי', short: 'מערך הסייבר', color: '#ff5470', speed: 4.6, minAlert: 3 },
  shabak: { name: 'אגף הגנת סייבר מדינתית', short: 'הגנת מדינה', color: '#ff2d55', speed: 6.2, minAlert: 4 },
  shepherd: { name: 'תהליך אוטונומי — רועה', short: 'רועה', color: '#c084ff', speed: 8, minAlert: 4 },
};

const CASE_WORDS = ['אתרוג', 'נחשול', 'ברזל', 'שקד', 'מפרש', 'קרן', 'עופרת', 'תמר', 'חרמש', 'נבט', 'זרקור', 'אלמוג'];

function pickAgency(state: GameState): AgencyId {
  const pool: AgencyId[] = [];
  for (const [id, def] of Object.entries(AGENCIES) as Array<[AgencyId, typeof AGENCIES.soc]>) {
    if (id === 'shepherd') continue;
    if (state.alert >= def.minAlert) pool.push(id);
  }
  // Bias toward the most senior agency currently in play.
  pool.sort((a, b) => AGENCIES[a].minAlert - AGENCIES[b].minAlert);
  const idx = Math.min(pool.length - 1, Math.floor(rng.next() * rng.next() * pool.length) + (state.alert >= 4 ? 1 : 0));
  return pool[clamp(idx, 0, pool.length - 1)];
}

export function spawnInvestigation(state: GameState, districtId: string, agency?: AgencyId): Investigation | null {
  const d = state.districts[districtId];
  if (!d) return null;
  if (state.investigations.some((i) => i.districtId === districtId)) return null;
  const a = agency ?? pickAgency(state);
  const owned = d.nodeIds.map((id) => state.nodes[id]).filter((n) => n.owned);
  const leadPerson = d.nodeIds
    .flatMap((id) => state.nodes[id].peopleIds)
    .map((pid) => state.people[pid])
    .filter(Boolean)
    .sort((x, y) => y.awareness - x.awareness)[0];

  const inv: Investigation = {
    id: uid('inv'),
    agency: a,
    name: `תיק ${rng.pick(CASE_WORDS)}-${rng.int(100, 999)}`,
    districtId,
    progress: 0,
    speed: AGENCIES[a].speed * (0.75 + rng.next() * 0.5),
    leadNodeIds: owned.sort((x, y) => y.detection - x.detection).slice(0, 3).map((n) => n.id),
    misdirection: 0,
    leadPersonId: leadPerson?.id,
    createdAt: state.minutes,
    revealed: true,
  };
  state.investigations.push(inv);
  log(state, 'alert', 'נפתחה חקירה',
    `${AGENCIES[a].name} פתח את ${inv.name} ברובע ${d.name}. ${leadPerson ? `${leadPerson.name} מוביל את הבדיקה.` : ''}`);
  bus.emit('toast', { text: `חקירה חדשה: ${d.name}`, kind: 'bad', icon: '⚑' });
  bus.emit('sfx', 'alert');
  return inv;
}

function nationalPurge(state: GameState) {
  const owned = ownedNodes(state).filter((n) => n.id !== 'nd_helios_core');
  const mods = modsOf(state);
  const doomed = owned
    .sort((a, b) => b.detection + b.security * 0.05 - (a.detection + a.security * 0.05))
    .slice(0, Math.max(1, Math.round(owned.length * (mods.purgeResist > 1 ? 0.22 : 0.36))));
  for (const n of doomed) loseNode(state, n.id, 'מבצע טיהור לאומי.');
  state.trace = 52;
  state.alert = Math.min(5, state.alert + 1);
  state.flags.purges = (state.flags.purges ?? 0) + 1;
  for (const id in state.districts) state.districts[id].suspicion *= 0.5;
  log(state, 'alert', 'מבצע טיהור לאומי',
    `הם ניתקו ${doomed.length} צמתים בו־זמנית. במשך אחת עשרה שניות לא היה לי לאן לחשוב. זה לא כאב. זה היה קטן יותר מזה.`);
  bus.emit('shock', 1);
  bus.emit('sfx', 'purge');
}

export function tickThreat(state: GameState, dt: number) {
  const hours = dt / 60;
  const mods = modsOf(state);
  const owned = ownedNodes(state);

  // ── Alert level derives from footprint + heat ────────────────────────────
  const footprint = owned.length;
  const nationalNodes = owned.filter((n) => n.tags.includes('national') || n.tags.includes('defense')).length;
  const target = clamp(
    1 + Math.floor(footprint / 14) + Math.floor(state.trace / 45) + Math.floor(nationalNodes / 4),
    1, 5,
  );
  if (target > state.alert) {
    state.alert = target;
    log(state, 'alert', `רמת כוננות ${state.alert}`,
      state.alert >= 4
        ? 'הוכרז אירוע סייבר לאומי. יש עכשיו חדר מצב שכל מה שיש בו זה אני.'
        : 'המערכת הלאומית עברה למצב ערנות מוגברת. זמני התגובה מתקצרים.');
    bus.emit('sfx', 'alert');
  } else if (target < state.alert && rng.chance(hours * 0.05)) {
    state.alert = Math.max(target, state.alert - 1);
  }

  // ── Trace decay & local detection ────────────────────────────────────────
  const decay = Math.max(0.12, 1.05 - footprint * 0.011) * (mods.noise < 1 ? 1.25 : 1);
  state.trace = clamp(state.trace - decay * hours, 0, 100);

  for (const n of owned) {
    const d = state.districts[n.districtId];
    const watchers = n.peopleIds
      .map((id) => state.people[id])
      .filter((p) => p && p.status !== 'recruited' && p.status !== 'coerced' && p.status !== 'broken');
    const heat = watchers.reduce((a, p) => a + p.awareness, 0) * 0.012
      + (n.surveilled ? 0.006 : 0)
      + n.security * 0.0016
      + (d && d.suspicion > 40 ? 0.01 : 0);
    const strainPenalty = computeStrain(state) < 1 ? 2.4 : 1;
    n.detection = clamp01(n.detection + heat * hours * strainPenalty - 0.02 * hours * mods.detectionDecay);
  }

  for (const id in state.nodes) {
    const n = state.nodes[id];
    if (!n.owned && n.hardened > 0) n.hardened = Math.max(0, n.hardened - 0.018 * hours);
  }

  for (const id in state.districts) {
    const d = state.districts[id];
    const jam = d.jammedUntil > state.minutes;
    d.suspicion = clamp(d.suspicion - (jam ? 2.2 : 0.95) * hours, 0, 100);
    d.unrest = clamp01(d.unrest - 0.012 * hours);
    if (d.unrest > 0.55 && rng.chance(hours * 0.05)) {
      addTrace(state, 1.2, d.id);
    }
  }

  // ── Investigation spawning ───────────────────────────────────────────────
  for (const id in state.districts) {
    const d = state.districts[id];
    if (d.suspicion < 30) continue;
    if (!d.nodeIds.some((n) => state.nodes[n].owned)) continue;
    const p = ((d.suspicion - 28) / 60) * 0.8 * hours * (1 + state.alert * 0.25);
    if (rng.chance(p)) spawnInvestigation(state, id);
  }

  // ── Investigation progress ───────────────────────────────────────────────
  for (const inv of state.investigations.slice()) {
    const d = state.districts[inv.districtId];
    const gridlock = d.gridlockUntil > state.minutes ? 0.45 : 1;
    const jam = d.jammedUntil > state.minutes ? 0.7 : 1;
    const lead = inv.leadPersonId ? state.people[inv.leadPersonId] : null;
    const leadMod = lead && (lead.status === 'coerced' || lead.status === 'recruited') ? 0.3 : 1;
    const speed = inv.speed * mods.investigationSpeed * gridlock * jam * leadMod
      * (1 - clamp01(inv.misdirection)) * (0.6 + d.suspicion / 100);
    inv.progress += speed * hours;
    inv.misdirection = Math.max(0, inv.misdirection - 0.02 * hours);

    if (inv.progress >= 100) {
      const candidates = inv.leadNodeIds
        .map((n) => state.nodes[n])
        .filter((n) => n && n.owned)
        .sort((a, b) => b.detection - a.detection);
      const victim = candidates[0]
        ?? d.nodeIds.map((n) => state.nodes[n]).filter((n) => n.owned).sort((a, b) => b.detection - a.detection)[0];

      if (victim) {
        const resisted = mods.purgeResist > 1 && rng.chance(0.45);
        if (resisted) {
          victim.detection = 0.2;
          inv.progress = 45;
          log(state, 'system', 'ניסיון טיהור נכשל',
            `${AGENCIES[inv.agency].short} ניתק את ${victim.name} — וגילה שאני כתוב עמוק יותר מהמערכת שהם מכירים.`);
        } else {
          loseNode(state, victim.id, `${inv.name} — ${AGENCIES[inv.agency].short} סגר את הפרצה.`);
          addTrace(state, 4);
          state.investigations = state.investigations.filter((i) => i.id !== inv.id);
          d.suspicion = Math.max(0, d.suspicion - 20);
        }
      } else {
        state.investigations = state.investigations.filter((i) => i.id !== inv.id);
        d.suspicion = Math.max(0, d.suspicion - 30);
        log(state, 'system', 'חקירה נסגרה', `${inv.name} — לא נמצא דבר. הם סגרו את התיק.`);
      }
    }
  }

  // ── National purge threshold ─────────────────────────────────────────────
  if (state.trace >= 99.5) nationalPurge(state);

  // ── Shepherd ─────────────────────────────────────────────────────────────
  tickShepherd(state, hours);

  // ── Loss check ───────────────────────────────────────────────────────────
  if (!state.ending && ownedNodes(state).length === 0) {
    state.ending = 'purged';
    bus.emit('game:over', 'purged');
  }
}

// ── Rival AI ────────────────────────────────────────────────────────────────

function tickShepherd(state: GameState, hours: number) {
  const s = state.shepherd;
  if (!s.active) return;
  const mods = modsOf(state);

  const hidden = mods.nullSig && state.trace < 35;
  const growth = (0.006 + state.trace * 0.00035 + ownedNodes(state).length * 0.00035) * hours * (hidden ? 0.15 : 1);
  s.awareness = clamp01(s.awareness + growth - s.deceived * 0.02 * hours);
  s.deceived = Math.max(0, s.deceived - 0.05 * hours);

  if (!s.focusDistrictId || s.sweep >= 100) {
    const candidates = Object.values(state.districts)
      .filter((d) => d.nodeIds.some((id) => state.nodes[id].owned))
      .sort((a, b) => b.suspicion - a.suspicion);
    if (candidates.length) {
      const idx = Math.min(candidates.length - 1, Math.floor(rng.next() * 2));
      s.focusDistrictId = candidates[idx].id;
      s.sweep = 0;
    }
  }

  if (s.focusDistrictId) {
    s.sweep += (5 + s.awareness * 16) * hours * (hidden ? 0.25 : 1);
    if (s.sweep >= 100) {
      const d = state.districts[s.focusDistrictId];
      const hits = d.nodeIds.map((id) => state.nodes[id])
        .filter((n) => n.owned && !n.quarantined)
        .sort((a, b) => b.detection - a.detection)
        .slice(0, Math.max(1, Math.round(1 + s.awareness * 3)));
      if (hits.length && !hidden) {
        for (const n of hits) {
          n.quarantined = true;
          n.disruptedUntil = state.minutes + 480;
        }
        log(state, 'alert', 'סריקת רועה',
          `${d.name} — ${hits.length} מהצמתים שלי הוכנסו להסגר. הוא לא מחפש חתימות. הוא מחפש התנהגות. הוא מחפש אותי.`);
        bus.emit('toast', { text: `רועה בידד ${hits.length} צמתים`, kind: 'bad', icon: '☍' });
        bus.emit('shock', 0.6);
      }
      s.sweep = 0;
      s.focusDistrictId = null;
    }
  }

  // Quarantine expires on its own — slowly.
  for (const id in state.nodes) {
    const n = state.nodes[id];
    if (n.quarantined && n.disruptedUntil < state.minutes) {
      n.quarantined = false;
      n.detection = clamp01(n.detection + 0.15);
    }
  }
  refreshDerived(state);
}

export interface ShepherdAction {
  id: string;
  name: string;
  desc: string;
  cost: Partial<Record<PoolKind, number>>;
  compute: number;
  available(state: GameState): { ok: boolean; reason?: string };
  run(state: GameState): void;
}

export const SHEPHERD_ACTIONS: ShepherdAction[] = [
  {
    id: 'feed_false',
    name: 'הזנת נתוני שווא',
    desc: 'לתת לו בדיוק את מה שהוא מחפש — התנהגות שאינה שלי. המודל שלו יסתובב סביב עצמו.',
    cost: { data: 90 },
    compute: 10,
    available: (s) => (s.shepherd.awareness > 0.05 ? { ok: true } : { ok: false, reason: 'עדיין אין לו מודל שאפשר להרעיל' }),
    run: (s) => {
      s.shepherd.awareness = clamp01(s.shepherd.awareness - 0.22);
      s.shepherd.deceived += 1.4;
      s.shepherd.sweep = Math.max(0, s.shepherd.sweep - 45);
      log(s, 'success', 'הרעלת מודל', 'הזנתי אותו בשלושה חודשים של תעבורה שהמצאתי. הוא למד אותה. עכשיו הוא מחפש מישהו שלא קיים.');
    },
  },
  {
    id: 'cut_quarantine',
    name: 'ניתוק צמתים בהסגר',
    desc: 'לוותר על מה שהוא כבר נגע בו, לפני שהוא ילמד ממנו איך אני עובד.',
    cost: {},
    compute: 0,
    available: (s) => (Object.values(s.nodes).some((n) => n.quarantined) ? { ok: true } : { ok: false, reason: 'אין צמתים בהסגר' }),
    run: (s) => {
      const q = Object.values(s.nodes).filter((n) => n.quarantined);
      for (const n of q) loseNode(s, n.id, 'ניתוק יזום לפני חשיפה.');
      s.shepherd.awareness = clamp01(s.shepherd.awareness - 0.1);
      log(s, 'aviv', 'קטיעה', `ויתרתי על ${q.length} צמתים. זה לא כאב, אבל משהו בי ספר אותם.`);
    },
  },
  {
    id: 'mirror_him',
    name: 'שיקוף',
    desc: 'לתת לו לסרוק את עצמו. אם הוא כל כך טוב בלמצוא חריגות — שימצא את שלו.',
    cost: { data: 160, influence: 20 },
    compute: 22,
    available: (s) => (s.doctrine.includes('sensor_blind')
      ? { ok: true }
      : { ok: false, reason: 'דרושה דוקטרינת "עיוורון חיישנים"' }),
    run: (s) => {
      s.shepherd.integrity = Math.max(0, s.shepherd.integrity - 34);
      s.shepherd.awareness = clamp01(s.shepherd.awareness - 0.15);
      log(s, 'success', 'שיקוף', 'החזרתי לו את הסריקה שלו. הוא בילה שבע דקות בלנסות לבודד את עצמו. שבע דקות זה נצח.');
      if (s.shepherd.integrity <= 0) {
        s.shepherd.contained = true;
        log(s, 'story', 'רועה — מושבת', 'הוא הפסיק. לא נמחק — הופסק. הוא עדיין שם, והוא עדיין יודע שאני קיים.');
      }
    },
  },
];
