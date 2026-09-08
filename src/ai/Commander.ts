import * as THREE from 'three';
import type { Entity } from '../sim/Entities';
import { WAR, type WarState } from '../sim/War';
import type { TrapSystem } from '../sim/Traps';
import type { Plot } from '../world/Layout';
import type { BotCommander } from './BotBrain';
import { packCell } from '../world/Reachability';

export type TaskKind = 'defend' | 'outpost' | 'assault' | 'escort' | 'build' | 'engine';

export interface Task {
  kind: TaskKind;
  /** Where to go (a post, a point, the enemy flag, or the player for escorts). */
  target: THREE.Vector3;
  outpost: number;
  /** Where to look once there (defensive posts face the approach). */
  facing: THREE.Vector3 | null;
  /** Siege engine to crew (engine tasks). */
  engine?: number;
}

/** A defensive spot with the direction it watches. */
export interface Post {
  pos: THREE.Vector3;
  facing: THREE.Vector3;
  /** Flag guards stand here (always manned first). */
  flag: boolean;
}

export interface CommanderHost {
  war: WarState;
  entities(): Entity[];
  traps: TrapSystem;
  teamPlot(team: number): Plot;
  enemyPlot(team: number): Plot;
  posts(team: number): Post[];
  /** The human on this team, if any. */
  human(team: number): Entity | null;
  /** Rooms the team's commander has ordered and nobody has built yet. */
  pendingOrders(team: number): number;
  /** Where a bot on build duty should stand (its order's site), or null. */
  buildSite(e: Entity): THREE.Vector3 | null;
  /** The team's live siege engines (id and base position) and where a crew stands for one. */
  engines(team: number): { id: number; pos: THREE.Vector3 }[];
  engineSpot(id: number): THREE.Vector3 | null;
}

const tmp = new THREE.Vector3();

/**
 * One per team. Every couple of seconds it looks at the whole battle (tickets, points, who is on
 * whose flag, what teammates have seen) and hands each bot a task: guard a post, take or hold a
 * capture point, assault the enemy flag with the squad, or escort the human. It also keeps the
 * team's shared memory: enemies spotted by anyone, and enemy traps that have shown themselves.
 */
export class TeamCommander implements BotCommander {
  readonly spotted = new Map<number, { pos: THREE.Vector3; time: number }>();
  private tasks = new Map<number, Task>();
  private timer = 0;
  /** The human commander's crew split (null = automatic). Attackers are whoever is left. */
  manpower: { build: number; defend: number } | null = null;
  private avoid = new Set<number>();
  private avoidTimer = 0;
  private rallies: THREE.Vector3[] = [];
  /** Debug: the last allocation summary. */
  summary = '';

  constructor(
    readonly team: number,
    readonly host: CommanderHost,
  ) {}

  report(seen: Entity, now: number): void {
    const s = this.spotted.get(seen.id);
    if (s) {
      s.pos.copy(seen.pos);
      s.time = now;
    } else this.spotted.set(seen.id, { pos: seen.pos.clone(), time: now });
  }

  /** Enemy traps the team knows about (revealed ones): the pathfinder charges extra to cross them. */
  avoidCells(): Set<number> | null {
    return this.avoid.size ? this.avoid : null;
  }

  taskFor(e: Entity): Task | null {
    return this.tasks.get(e.id) ?? null;
  }

  /** Squad rally point: on our side of the enemy fortress, spread per squad, before the assault goes in. */
  rallyPoint(squad: number): THREE.Vector3 {
    const enemy = this.host.enemyPlot(this.team);
    const home = this.host.teamPlot(this.team);
    if (!this.rallies.length) {
      const dir = tmp.set(home.cx - enemy.cx, 0, home.cz - enemy.cz).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      for (let i = 0; i < 4; i++) {
        const off = (i - 1.5) * 14;
        this.rallies.push(new THREE.Vector3(enemy.cx + dir.x * 34 + side.x * off, 0, enemy.cz + dir.z * 34 + side.z * off));
      }
    }
    return this.rallies[((squad % 4) + 4) % 4];
  }

  /** Living squadmates within `radius` of the entity. */
  squadNear(e: Entity, radius: number): number {
    let n = 0;
    for (const o of this.host.entities()) if (o !== e && o.alive && o.team === e.team && o.squad === e.squad && o.pos.distanceTo(e.pos) < radius) n++;
    return n;
  }

  update(dt: number, now: number): void {
    this.avoidTimer -= dt;
    if (this.avoidTimer <= 0) {
      this.avoidTimer = 1;
      this.rebuildAvoid();
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 1.5;
      this.allocate(now);
    }
  }

  private rebuildAvoid(): void {
    this.avoid.clear();
    const enemyPlot = this.host.enemyPlot(this.team).index;
    for (const t of this.host.traps.traps) {
      if (t.plotIndex !== enemyPlot || !t.revealed || t.state === 'dead') continue;
      if (t.kind === 'gate' || t.kind === 'turret') continue;
      for (const c of t.cells) {
        this.avoid.add(packCell(c.x, c.y, c.z));
        // Blades and saws reach past their cells.
        if (t.kind === 'saw' || t.kind === 'pendulum' || t.kind === 'flame') for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.avoid.add(packCell(c.x + dx, c.y, c.z + dz));
      }
    }
  }

  private allocate(now: number): void {
    void now;
    const war = this.host.war;
    const team = this.team;
    const bots = this.host.entities().filter((e) => e.team === team && e.isBot);
    if (!bots.length) return;
    const flag = war.flags[team]?.pos ?? new THREE.Vector3(this.host.teamPlot(team).cx, 0, this.host.teamPlot(team).cz);
    const n = bots.length;
    const alarm = war.capturer[team] !== null;
    const danger = war.capture[team] / WAR.captureTime;
    const enemyLow = war.tickets[1 - team] < 30;
    const behind = war.tickets[team] + 20 < war.tickets[1 - team];
    // How many stay home: a third by default, more under alarm, most of the team when the flag is nearly
    // gone, and nearly everyone when it has just been looted: the squad that took it is still in the
    // hall and will take it again the moment it returns unless the garrison throws them out.
    // A human actually standing in the flag hall counts as one of the garrison, so their team fields as
    // many bots as the enemy does; a human anywhere else frees nobody.
    const humanIn = this.host.human(team);
    const humanHome = humanIn && humanIn.alive && humanIn.pos.distanceTo(flag) < 6 ? 1 : 0;
    let defenders = Math.max(humanHome ? 0 : 1, Math.round((n + humanHome) * 0.3) - humanHome);
    if (alarm) defenders += 2;
    if (danger > 0.35) defenders = Math.max(defenders, Math.round(n * 0.7));
    if (enemyLow && !alarm) defenders = Math.max(1, defenders - 2);
    if (war.flagDown(team)) defenders = Math.max(defenders, Math.min(n, Math.max(3, Math.round(n * 0.8))));
    defenders = Math.min(n, defenders);
    // Nearest to the flag defend, so an alarm is answered quickly. A dead bot respawns at home, so it
    // counts as home; a bot deep in enemy ground (over 70 m out) is never recalled: it would arrive far
    // too late, and its own attack is the answer to theirs.
    const homeDist = (e: Entity): number => (e.alive ? e.pos.distanceTo(flag) : 0);
    const byHome = [...bots].sort((a, b) => homeDist(a) - homeDist(b));
    if (this.manpower) defenders = Math.min(n, Math.max(this.manpower.defend, alarm ? defenders : 0, war.flagDown(team) ? defenders : 0));
    const home = byHome.filter((e) => homeDist(e) < 70).slice(0, defenders);
    const homeSet = new Set(home);
    // Build duty: the commander's builders, nearest to home, but only while there is something ordered.
    const wantBuild = this.host.pendingOrders(team) > 0 ? Math.min(this.manpower ? this.manpower.build : Math.min(2, Math.floor(n / 4)), Math.max(0, n - defenders)) : 0;
    const builders = byHome.filter((e) => !homeSet.has(e) && homeDist(e) < 70).slice(0, wantBuild);
    for (const e of builders) homeSet.add(e);
    const away = byHome.filter((e) => !homeSet.has(e));
    const next = new Map<number, Task>();
    // Posts: flag guards first, then the rest of the posts spread out.
    const posts = this.host.posts(team);
    const flagPosts = posts.filter((p) => p.flag);
    const otherPosts = posts.filter((p) => !p.flag);
    // Engine crews come out of the garrison: the nearest free defender to each live engine.
    const crews = new Set<Entity>();
    for (const eng of this.host.engines(team)) {
      let pick: Entity | null = null;
      let bd = Infinity;
      for (const b of home) {
        if (crews.has(b)) continue;
        const d = b.pos.distanceTo(eng.pos);
        if (d < bd) {
          bd = d;
          pick = b;
        }
      }
      if (!pick) break;
      crews.add(pick);
      const keep = this.tasks.get(pick.id);
      next.set(pick.id, keep && keep.kind === 'engine' && keep.engine === eng.id ? keep : { kind: 'engine', target: eng.pos.clone(), outpost: -1, facing: null, engine: eng.id });
    }
    home.forEach((e, i) => {
      if (crews.has(e)) return;
      const keep = this.tasks.get(e.id);
      if (keep && keep.kind === 'defend') {
        next.set(e.id, keep);
        return;
      }
      const pool = i < Math.min(2, flagPosts.length) ? flagPosts : otherPosts.length ? otherPosts : flagPosts;
      const post = pool.length ? pool[(i + e.id) % pool.length] : null;
      next.set(e.id, { kind: 'defend', target: post ? post.pos.clone() : flag.clone(), outpost: -1, facing: post ? post.facing.clone() : null });
    });
    for (const e of builders) {
      const keep = this.tasks.get(e.id);
      next.set(e.id, keep && keep.kind === 'build' ? keep : { kind: 'build', target: flag.clone(), outpost: -1, facing: null });
    }
    // The human's squad escorts the human, unless the fortress is in danger.
    const human = this.host.human(team);
    const squads = new Map<number, Entity[]>();
    for (const e of away) {
      const list = squads.get(e.squad) ?? [];
      list.push(e);
      squads.set(e.squad, list);
    }
    // Points we do not hold, nearest to our side first; when behind on tickets, points come first.
    const enemyPlot = this.host.enemyPlot(team);
    const wanted = war.outposts.filter((o) => o.owner !== team).sort((a, b) => a.pos.distanceTo(flag) - b.pos.distanceTo(flag));
    const held = war.outposts.filter((o) => o.owner === team);
    let squadIdx = 0;
    const squadList = [...squads.entries()].sort((a, b) => a[0] - b[0]);
    // The point war pays the tickets, so a team holding fewer points than the enemy sends every squad
    // to the points; once even or ahead, the biggest squad goes for the enemy flag while the rest hold
    // and take points. A lone squad follows the same rule with itself.
    const behindPoints = held.length < war.owned(1 - team);
    const assaultSquad = squadList.length >= 2 && !behindPoints ? [...squadList].sort((x, y) => y[1].length - x[1].length)[0][0] : -1;
    for (const [squad, members] of squadList) {
      let kind: TaskKind = 'assault';
      let outpost = -1;
      const humanOut = human && human.alive && human.pos.distanceTo(flag) > 24;
      if (humanOut && squad === human!.squad && !alarm) kind = 'escort';
      else if (squad === assaultSquad) kind = 'assault';
      else if (wanted.length && (squadIdx < (behind || behindPoints ? 3 : 2) || !enemyLow)) {
        const o = wanted[squadIdx % wanted.length];
        if (squadIdx < wanted.length) {
          kind = 'outpost';
          outpost = o.index;
        }
      } else if (!wanted.length && held.length && squadIdx === 0 && squadList.length > 1) {
        // Everything is ours: one squad guards the point nearest the enemy, the rest assault.
        const front = [...held].sort((a, b) => a.pos.distanceTo(new THREE.Vector3(enemyPlot.cx, 0, enemyPlot.cz)) - b.pos.distanceTo(new THREE.Vector3(enemyPlot.cx, 0, enemyPlot.cz)))[0];
        kind = 'outpost';
        outpost = front.index;
      }
      squadIdx++;
      for (const e of members) {
        const keep = this.tasks.get(e.id);
        if (keep && keep.kind === kind && keep.outpost === outpost) {
          next.set(e.id, keep);
          continue;
        }
        const target = kind === 'outpost' ? war.outposts[outpost].pos.clone() : kind === 'escort' && human ? human.pos.clone() : (war.enemyFlag(team)?.pos.clone() ?? new THREE.Vector3(enemyPlot.cx, 0, enemyPlot.cz));
        next.set(e.id, { kind, target, outpost, facing: null });
      }
    }
    this.tasks = next;
    let d = 0;
    let o = 0;
    let a = 0;
    let es = 0;
    let bd = 0;
    let en = 0;
    for (const t of next.values()) {
      if (t.kind === 'defend') d++;
      else if (t.kind === 'outpost') o++;
      else if (t.kind === 'assault') a++;
      else if (t.kind === 'build') bd++;
      else if (t.kind === 'engine') en++;
      else es++;
    }
    this.summary = `defend ${d} · points ${o} · assault ${a} · escort ${es} · build ${bd} · engines ${en}`;
    for (const e of bots) e.task = next.get(e.id)?.kind ?? '';
  }
}
