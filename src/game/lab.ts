import * as THREE from 'three';
import type { KillEvent, SpawnDef, V3 } from '../core/contracts';
import type { EnemySystem, Enemy } from '../actors/enemies';
import type { Audio } from '../engine/audio';
import type { LabArena, LabSpawn, LabWave } from '../world/combatlab/layout';
import { LabHud } from '../ui/labhud';
import { t } from '../ui/i18n';
import type { FxKit } from './fxkit';
import { killTool, LabDirector, type LabRunStats, type LabTool } from './labdirector';
import { chosenVariant, onslaughtOn, reachOn, type CombatVariant } from './variant';
import { REACH } from './reach';

/** REACH's men come in red (their portals' colour). */
const REACH_IN = new THREE.Color(2.8, 0.18, 0.55);

/** Kessler's gate orange (HDR), for the arrivals' rift flash. */
const KESSLER = new THREE.Color(2.6, 0.75, 0.2);
/** Seconds the WAVE CLEAR card holds before the next wave's banner. */
const CLEAR_HOLD = 1.3;
/** After a respawn on the pad: this long before anything can hurt you (s). */
export const LAB_SPAWN_GUARD = 1.5;

export interface LabHost {
  enemies: EnemySystem;
  fx: FxKit;
  audio: Audio;
  /** Where the player's feet are (the arrivals know it). */
  playerPos(): V3;
  /** A wave is down (a beat of slow motion, a sting). */
  onCleared(wave: number): void;
  /** The last wave is down: the results. */
  onFinished(stats: LabRunStats): void;
  /** A wave's breather starts (REACH: its weapons go down, everyone's hands are emptied). */
  onWave?(wave: number, def: LabWave): void;
  /** Kill credit by the game's own rules (REACH), else the lab's. */
  toolFor?(ev: KillEvent): LabTool | null;
}

/**
 * The COMBAT LAB in the game: its wave director, wired to the enemies (men
 * brought in through the arena's gates, already aware), the effects, and
 * the lab HUD (run panel, WAVE banner). The Game owns one while the lab world
 * is loaded and feeds it kills, damage and deaths.
 */
export class LabMode {
  readonly director: LabDirector;
  readonly hud: LabHud;
  private pending: { n: number; def: LabWave; secs: number } | null = null;
  private pendingT = 0;
  private seq = 0;

  constructor(readonly arena: LabArena, hudRoot: HTMLElement, private host: LabHost) {
    this.hud = new LabHud(hudRoot);
    // REACH's countdowns (its waves name no lead of their own: the numbers live in REACH)
    arena.variants?.reach?.forEach((w, i) => (w.lead = i === 0 ? REACH.waves.first : REACH.waves.between));
    this.director = new LabDirector(arena, {
      spawn: (s, gate, wave) => {
        const E = host.enemies;
        if (reachOn(this.director.stats.variant)) return this.spawnReach(s, wave);
        const def: SpawnDef = {
          id: `pier.lab.w${wave}.${++this.seq}`,
          kind: s.kind,
          pos: s.post.clone(),
          yaw: gate.yaw,
          zone: 'pier',
          squad: `pier.lab.w${wave}`,
          state: 'combat',
          role: s.role,
        };
        if (s.leash !== undefined) def.leash = s.leash;
        if (s.kind === 'sniper') def.perch = true;
        // ONSLAUGHT (and FLOW, which fights it): every man of its waves fights by its squad rules
        if (onslaughtOn(this.director.stats.variant)) {
          def.onslaught = true;
          if (s.arch) def.archetype = s.arch;
        }
        const v = E.spawn(def) as Enemy;
        // through an edge gate: he steps out of its rift and walks in to his post
        if (gate.kind === 'edge' && v.body) {
          v.body.pos.copy(gate.pos);
          v.char.root.position.copy(gate.pos);
        }
        E.inform(v, host.playerPos());
        const fwd = new THREE.Vector3(Math.sin(gate.yaw), 0, Math.cos(gate.yaw));
        const at = gate.pos.clone().setY(gate.pos.y + 1.1);
        host.fx.riftBurst(at, fwd, KESSLER);
        host.fx.ring(gate.pos.clone().setY(gate.pos.y + 0.05), 1.8, 0.4, KESSLER);
        host.fx.flash(at, 4, 0.35, 0xff7a2a);
        host.audio.riftOpen(at, 'gate');
        return v.id;
      },
      alive: (id) => host.enemies.get(id)?.alive ?? false,
      announce: (n, def, secs) => {
        host.onWave?.(n, def);
        // (right after a clear the card holds a moment first)
        if (n > 1) {
          this.pending = { n, def, secs };
          this.pendingT = CLEAR_HOLD;
          return;
        }
        this.showWave(n, def);
      },
      cleared: (n, time) => {
        this.hud.cleared(n, time);
        host.onCleared(n);
      },
      finished: (stats) => host.onFinished(stats),
    });
  }

  /** A REACH man: on his post at once, facing you, empty-handed (a red rift where he appears). */
  private spawnReach(s: LabSpawn, wave: number): number {
    const host = this.host;
    const pl = host.playerPos();
    const def: SpawnDef = {
      id: `pier.lab.r${wave}.${++this.seq}`,
      kind: s.kind,
      pos: s.post.clone(),
      yaw: Math.atan2(pl.x - s.post.x, pl.z - s.post.z),
      zone: 'pier',
      squad: `pier.lab.r${wave}`,
      state: 'combat',
      reach: true,
    };
    const v = host.enemies.spawn(def) as Enemy;
    host.enemies.inform(v, pl);
    const at = s.post.clone().setY(s.post.y + 1.1);
    host.fx.riftBurst(at, new THREE.Vector3(Math.sin(def.yaw), 0, Math.cos(def.yaw)), REACH_IN);
    host.fx.ring(s.post.clone().setY(s.post.y + 0.05), 1.4, 0.4, REACH_IN);
    host.fx.flash(at, 3, 0.3, 0xff2a6a);
    if (this.seq % 2 === 1) host.audio.riftOpen(at, 'gate');
    return v.id;
  }

  private showWave(n: number, def: LabWave) {
    this.hud.announce(n, this.director.waveCount, t(def.subKey), chosenVariant());
    this.host.audio.sting('zone');
  }

  /** A fresh run (the world around it is reset by the Game). */
  restart() {
    this.pending = null;
    this.seq = 0;
    this.director.start();
  }

  setVariant(v: CombatVariant) {
    this.pending = null;
    this.seq = 0;
    this.director.setVariant(v);
  }

  update(realDt: number) {
    const d = this.director;
    d.update(realDt);
    if (this.pending) {
      this.pendingT -= realDt;
      if (this.pendingT <= 0) {
        this.showWave(this.pending.n, this.pending.def);
        this.pending = null;
      }
    } else if (d.phase === 'breather') this.hud.countdown(d.breatherT);
    // REACH: the 3-2-1 and GO (big, short)
    if (reachOn(d.stats.variant)) this.hud.count(d.phase === 'breather' ? d.breatherT : d.phase === 'fight' && d.waveT < 0.7 ? 0 : null);
    else this.hud.count(null);
    this.hud.update({
      variant: chosenVariant(),
      wave: d.wave + 1,
      waves: d.waveCount,
      phase: d.phase,
      left: d.left,
      waveT: d.waveT,
      stats: d.stats,
    });
  }

  noteKill(ev: KillEvent) {
    this.director.noteKill(this.host.toolFor?.(ev) ?? killTool(ev));
  }

  /** The fight is on (REACH: after GO; anything else: always). */
  get fighting() {
    return this.director.phase === 'fight';
  }

  noteDamage(n: number) {
    this.director.noteDamage(n);
  }

  noteDeath() {
    this.director.noteDeath();
  }

  /** The current wave's men still standing (the markers find the last two). */
  standing(): Enemy[] {
    const out: Enemy[] = [];
    for (const id of this.director.ids) {
      const e = this.host.enemies.get(id) as Enemy | null;
      if (e && e.alive) out.push(e);
    }
    return out;
  }

  show(on: boolean) {
    this.hud.show(on);
  }

  dispose() {
    this.hud.dispose();
  }
}
