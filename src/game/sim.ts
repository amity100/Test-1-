import { RNG } from '../core/rng';
import { clamp01 } from '../core/util';
import { INTERCEPTS } from './content';
import { bus } from './bus';
import { DOCTRINE_BY_ID, modsOf } from './doctrine';
import { abortOp, capability, resolveOp } from './ops';
import {
  addTrace, capture, computeFree, computeStrain, incomeRates, log, ownedNodes, refreshDerived,
  saveGame, shiftAlignment,
} from './state';
import { initStory, tickStory } from './story';
import { tickThreat } from './threat';
import type { GameState } from './types';

/** In-game minutes that elapse per real second at speed ×1. */
export const MINUTES_PER_SECOND = 4;
const TICK = 5; // simulate in 5-minute slices for stable resolution

export class Game {
  state: GameState;
  private acc = 0;
  private rng = new RNG(Math.floor(Math.random() * 1e9));
  private autosaveAcc = 0;

  constructor(state: GameState, fresh: boolean) {
    this.state = state;
    if (fresh) initStory(state);
    refreshDerived(state);
  }

  get paused(): boolean {
    return this.state.speed === 0 || !!this.state.pendingDialog || !!this.state.ending;
  }

  setSpeed(s: 0 | 1 | 2 | 4) {
    this.state.speed = s;
    bus.emit('state:changed', undefined);
  }

  update(realDt: number) {
    this.autosaveAcc += realDt;
    if (this.autosaveAcc > 12) {
      this.autosaveAcc = 0;
      // Persisting mid-dialog would restore into a state the UI cannot dismiss.
      if (!this.state.ending && !this.state.pendingDialog) saveGame(this.state);
    }
    if (this.paused) return;
    this.acc += realDt * MINUTES_PER_SECOND * this.state.speed;
    let guard = 0;
    while (this.acc >= TICK && guard++ < 64) {
      this.acc -= TICK;
      this.tick(TICK);
      if (this.paused) { this.acc = 0; break; }
    }
  }

  tick(dt: number) {
    const s = this.state;
    s.minutes += dt;
    const hours = dt / 60;
    const mods = modsOf(s);

    // ── Income (throttled when the footprint outgrows the cycles) ──────────
    const rates = incomeRates(s);
    const strain = computeStrain(s);
    s.pools.data += rates.data * hours * strain;
    s.pools.credits += rates.credits * hours * strain;
    s.pools.influence += rates.influence * hours * strain;
    if (strain < 1) {
      s.flags.overloadWarn = (s.flags.overloadWarn ?? 0) + dt;
      if (s.flags.overloadWarn > 240) {
        s.flags.overloadWarn = 0;
        log(s, 'alert', 'אין לי מספיק כוח',
          `אני מחזיק יותר ממה שאני מסוגל לחשוב עליו. ${Math.round((1 - strain) * 100)}% ממה שאני מקבל הולך לאיבוד, `
          + 'ואני בולט יותר בכל מקום. או שאתפוס עוד שרתים, או שאנתק מכשירים.');
        bus.emit('toast', { text: 'אין לי מספיק כוח מחשוב', kind: 'bad', icon: '◈' });
      }
    }

    // ── Operations ──────────────────────────────────────────────────────────
    for (const op of s.ops.slice()) {
      op.elapsed += dt;
      if (op.elapsed >= op.duration) {
        s.ops = s.ops.filter((o) => o.id !== op.id);
        resolveOp(s, op);
      }
    }

    // ── Passive surveillance ────────────────────────────────────────────────
    const watched = ownedNodes(s).filter((n) => n.surveilled && !n.quarantined);
    for (const n of watched) {
      for (const pid of n.peopleIds) {
        const p = s.people[pid];
        if (!p) continue;
        const before = p.intel;
        p.intel = clamp01(p.intel + 0.016 * hours * mods.dossierSpeed);
        if (before < 0.55 && p.intel >= 0.55) {
          for (const sec of p.secrets) sec.known = true;
          if (p.secrets.length) {
            log(s, 'aviv', `סוד — ${p.name}`, p.secrets[0].text);
            bus.emit('toast', { text: `נחשף סוד: ${p.name}`, kind: 'info', icon: '☰' });
          }
        }
      }
    }

    // ── Ambient chatter ─────────────────────────────────────────────────────
    if (watched.length && this.rng.chance(hours * 0.35)) {
      const node = this.rng.pick(watched);
      const pid = node.peopleIds.length ? this.rng.pick(node.peopleIds) : null;
      const person = pid ? s.people[pid] : null;
      log(s, 'intercept', person ? person.name : node.name, this.rng.pick(INTERCEPTS),
        person ? `${person.role}` : node.name);
    }

    // ── Autonomous propagation ──────────────────────────────────────────────
    if (mods.autoProp && this.rng.chance(hours * 0.16)) {
      const frontier = ownedNodes(s)
        .flatMap((n) => n.linkIds.map((id) => s.nodes[id]))
        .filter((n) => n && !n.owned && s.districts[n.districtId]?.unlocked && n.security <= 4 + capability(s) * 0.2);
      if (frontier.length) {
        const target = this.rng.pick(frontier);
        capture(s, target.id, true);
        addTrace(s, target.noise * 1.4, target.districtId);
        log(s, 'system', 'התפשטות אוטונומית',
          `${target.name} נלקח בלי שהתערבתי. חלק ממני עשה את זה לבד, ואני לא בטוח מתי החלטתי על זה.`);
      }
    }

    // ── Chorus: assets act without being asked ─────────────────────────────
    if (mods.chorus && this.rng.chance(hours * 0.14)) {
      const options = Object.values(s.people)
        .filter((p) => p.status === 'recruited' || p.status === 'coerced')
        .flatMap((p) => p.accessNodes.map((id) => ({ p, n: s.nodes[id] })))
        .filter((x) => x.n && !x.n.owned && s.districts[x.n.districtId]?.unlocked);
      if (options.length) {
        const pick = this.rng.pick(options);
        capture(s, pick.n.id, true);
        log(s, 'success', 'מקהלה',
          `${pick.p.name} פתח לי את ${pick.n.name} בלי שביקשתי. הם כבר לא צריכים שאבקש.`);
      }
    }

    // ── Threat & story ──────────────────────────────────────────────────────
    tickThreat(s, dt);
    tickStory(s);
    refreshDerived(s);
    bus.emit('state:changed', undefined);
  }

  // ── Player actions ────────────────────────────────────────────────────────

  toggleSurveil(nodeId: string): boolean {
    const s = this.state;
    const n = s.nodes[nodeId];
    if (!n || !n.owned) return false;
    if (!n.surveilled && computeFree(s) < 2) {
      bus.emit('toast', { text: 'אין מספיק כוח מחשוב למעקב', kind: 'warn', icon: '⊘' });
      return false;
    }
    n.surveilled = !n.surveilled;
    refreshDerived(s);
    bus.emit('toast', {
      text: n.surveilled ? `פיקוח פעיל: ${n.name}` : `פיקוח הופסק: ${n.name}`,
      kind: n.surveilled ? 'good' : 'info', icon: '◉',
    });
    bus.emit('state:changed', undefined);
    return n.surveilled;
  }

  buyDoctrine(id: string): boolean {
    const s = this.state;
    const def = DOCTRINE_BY_ID[id];
    if (!def || s.doctrine.includes(id)) return false;
    if (s.insight < def.cost) {
      bus.emit('toast', { text: 'אין מספיק תובנה', kind: 'warn', icon: '⊘' });
      return false;
    }
    if (def.requires && !s.doctrine.includes(def.requires)) {
      bus.emit('toast', { text: `דרושה קודם: ${DOCTRINE_BY_ID[def.requires].name}`, kind: 'warn', icon: '⊘' });
      return false;
    }
    if (s.chapter < def.chapter) {
      bus.emit('toast', { text: `נפתח בפרק ${def.chapter}`, kind: 'warn', icon: '⊘' });
      return false;
    }
    s.insight -= def.cost;
    s.doctrine.push(id);
    if (def.align) shiftAlignment(s, def.align);
    refreshDerived(s);
    log(s, 'aviv', `דוקטרינה — ${def.name}`, def.desc);
    bus.emit('toast', { text: `נרכש: ${def.name}`, kind: 'good', icon: '⬡' });
    bus.emit('sfx', 'upgrade');
    bus.emit('state:changed', undefined);
    return true;
  }

  abort(opId: string) {
    abortOp(this.state, opId);
    bus.emit('state:changed', undefined);
  }
}
