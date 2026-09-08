import * as THREE from 'three';
import { BotBrain, type Intent } from './BotBrain';
import type { NavSystem } from './NavSystem';
import type { Entity } from '../sim/Entities';
import type { TeamCommander } from './Commander';
import { WAR } from '../sim/War';
import type { DamagedCell } from '../sim/Repair';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

/**
 * A soldier in Fortress War: the shared perception, aim, cover and movement of the classic brain,
 * with the commander's task deciding where it goes. Defenders man posts and watch the approaches,
 * point squads take and hold capture points, assault squads rally outside the enemy walls and go in
 * together for the flag, blowing a wall open when the way is barred; escorts stay with the human.
 */
export class WarBrain extends BotBrain {
  private rallied = false;
  private rallyTimer = 0;
  private holdTimer = 0;
  private breachCooldown = 0;
  private blockedTimer = 0;
  private lastFlagDist = Infinity;
  private releaseSlot = -1;
  private holdPhase = Math.random() * 10;
  private repairTarget: DamagedCell | null = null;
  private repairWork = 0;
  private repairWalk = 0;
  private skipHoles = new Set<DamagedCell>();

  private get commander(): TeamCommander | null {
    return (this.ctx.commander?.(this.entity.team) as TeamCommander | null) ?? null;
  }

  override reset(): void {
    super.reset();
    this.rallied = false;
    this.rallyTimer = 0;
    this.holdTimer = 0;
    this.blockedTimer = 0;
    this.lastFlagDist = Infinity;
    this.repairTarget = null;
    this.repairWork = 0;
    this.repairWalk = 0;
    this.ctx.repair?.release(this.entity.id);
  }

  protected override decide(dt: number, now: number, threat: Entity | null, nav: NavSystem | null): Intent {
    const e = this.entity;
    const cmd = this.commander;
    const war = cmd?.host.war ?? null;
    // Release a gadget button pressed last frame.
    if (this.releaseSlot >= 0 && this.ctx.gadgets) {
      this.ctx.gadgets.input(e, this.releaseSlot, false, false, true, now);
      this.releaseSlot = -1;
    }
    this.breachCooldown -= dt;
    this.coverLogic(dt, threat, nav);
    if (this.state === 'cover') return { goal: this.coverGoal, sprint: true, crouch: false };
    if (this.state === 'retreat') return { goal: null, sprint: false, crouch: false };
    const task = cmd?.taskFor(e) ?? null;
    // A fight in view comes first, except that someone on the enemy flag keeps taking it unless the
    // enemy is right on top of them.
    if (threat && (this.seesTarget || e.pos.distanceTo(this.lastSeen) < 20)) {
      const onFlag = e.captureProgress > 0.1;
      if (!onFlag || threat.pos.distanceTo(e.pos) < 10) {
        this.state = 'engage';
        return { goal: null, sprint: false, crouch: false };
      }
    }
    if (!task || !war || !cmd) {
      this.state = 'idle';
      return { goal: null, sprint: false, crouch: false };
    }
    let goal: THREE.Vector3 | null = null;
    let sprint = true;
    let crouch = false;
    switch (task.kind) {
      case 'defend': {
        // The alarm at home: straight to whoever is on our flag. Otherwise man the post and watch.
        const capturer = war.capturer[e.team];
        if (capturer && capturer.alive) {
          this.state = 'return';
          goal = capturer.pos.clone();
          break;
        }
        // Quiet at home: put the walls back where a blast opened them, if the team can afford it.
        const fixing = this.repairing(dt, cmd.host.teamPlot(e.team).index, war.supplies[e.team]);
        if (fixing) {
          if (fixing.goal) {
            this.state = 'approach';
            goal = fixing.goal;
            sprint = true;
          }
          break;
        }
        const d = e.pos.distanceTo(task.target);
        if (d > 1.4) {
          this.state = 'approach';
          goal = task.target;
          sprint = d > 8;
        } else {
          this.hold(dt, now, task.facing);
        }
        break;
      }
      case 'outpost': {
        const o = war.outposts[task.outpost];
        const d = Math.hypot(e.pos.x - o.pos.x, e.pos.z - o.pos.z);
        if (d > WAR.outpostRadius - 1.8) {
          this.state = 'approach';
          // Spread around the point so a squad does not stack on one spot.
          const a = (e.id * 2.4) % (Math.PI * 2);
          goal = new THREE.Vector3(o.pos.x + Math.cos(a) * 3, o.pos.y, o.pos.z + Math.sin(a) * 3);
        } else {
          const enemy = cmd.host.enemyPlot(e.team);
          this.hold(dt, now, tmp.set(enemy.cx - e.pos.x, 0, enemy.cz - e.pos.z).normalize().clone());
        }
        break;
      }
      case 'assault': {
        const flag = war.enemyFlag(e.team);
        const enemy = cmd.host.enemyPlot(e.team);
        if (!flag) break;
        const dPlot = Math.hypot(e.pos.x - enemy.cx, e.pos.z - enemy.cz);
        const inside = dPlot < 30;
        if (!inside && !this.rallied) {
          // Gather the squad outside the walls, then go in together.
          const rally = cmd.rallyPoint(e.squad);
          const dr = Math.hypot(e.pos.x - rally.x, e.pos.z - rally.z);
          if (dr > 5) {
            this.state = 'approach';
            goal = rally;
          } else {
            this.state = 'rally';
            this.clearPath();
            this.rallyTimer += dt;
            crouch = true;
            this.face(tmp.set(enemy.cx - e.pos.x, 0, enemy.cz - e.pos.z), Math.sin(now * 0.7 + this.holdPhase) * 0.4);
            if (cmd.squadNear(e, 12) >= 1 || this.rallyTimer > 9) {
              this.rallied = true;
              this.rallyTimer = 0;
            }
          }
          break;
        }
        if (war.flagDown(1 - e.team)) {
          // Their flag is down after a loot: hold ground near it and hunt.
          this.state = 'hold';
          const d = e.pos.distanceTo(flag.pos);
          if (d > 10) {
            this.state = 'approach';
            goal = flag.pos.clone();
          } else this.clearPath();
          break;
        }
        this.state = 'capture';
        goal = flag.pos.clone();
        sprint = !inside;
        this.maybeBreach(dt, now, flag.pos);
        break;
      }
      case 'engine': {
        // Crew an engine: stand at its controls facing the enemy; the engine does the shooting.
        const spot = (task.engine !== undefined ? cmd.host.engineSpot(task.engine) : null) ?? task.target;
        const d = Math.hypot(e.pos.x - spot.x, e.pos.z - spot.z);
        if (d > 1.1) {
          this.state = 'approach';
          goal = new THREE.Vector3(spot.x, spot.y, spot.z);
          sprint = d > 10;
        } else {
          const enemy = cmd.host.enemyPlot(e.team);
          this.hold(dt, now, tmp.set(enemy.cx - e.pos.x, 0, enemy.cz - e.pos.z).normalize().clone());
        }
        break;
      }
      case 'build': {
        // On build duty: walk to the ordered room and work there; without a site, stand guard like a defender.
        const site = cmd.host.buildSite(e);
        const target = site ?? task.target;
        const d = Math.hypot(e.pos.x - target.x, e.pos.z - target.z);
        if (d > 5) {
          this.state = 'approach';
          goal = new THREE.Vector3(target.x, target.y, target.z);
          sprint = d > 12;
        } else {
          this.state = 'build';
          this.clearPath();
          this.face(tmp.set(target.x - e.pos.x, 0, target.z - e.pos.z), Math.sin(now * 1.3 + this.holdPhase) * 0.3);
        }
        break;
      }
      case 'escort': {
        const human = cmd.host.human(e.team);
        if (!human || !human.alive) {
          this.state = 'approach';
          goal = war.enemyFlag(e.team)?.pos.clone() ?? null;
          break;
        }
        const d = e.pos.distanceTo(human.pos);
        if (d > 6) {
          this.state = 'approach';
          const a = (e.id * 1.7) % (Math.PI * 2);
          goal = new THREE.Vector3(human.pos.x + Math.cos(a) * 2.5, human.pos.y, human.pos.z + Math.sin(a) * 2.5);
          sprint = d > 12;
        } else {
          this.state = 'hold';
          this.clearPath();
          // Watch where the human watches, a little to the side.
          this.face(human.forwardFlat(tmp), (e.id % 2 ? 0.6 : -0.6));
        }
        break;
      }
    }
    return { goal, sprint, crouch };
  }

  /**
   * Live repair for a defender: claim the nearest hole in the home fortress, walk to it, stand by it
   * for a few seconds and put the blocks back, spending supplies. Returns null when there is nothing
   * to fix; otherwise where to walk (or null for "stay and work").
   */
  private repairing(dt: number, plotIndex: number, supplies: number): { goal: THREE.Vector3 | null } | null {
    const repair = this.ctx.repair;
    const e = this.entity;
    const war = this.commander?.host.war;
    if (!repair || !war) return null;
    if (this.repairTarget && !repair.has(this.repairTarget)) {
      // Somebody else closed it.
      this.repairTarget = null;
      repair.release(e.id);
    }
    if (!this.repairTarget) {
      if (supplies < WAR.repairCost) return null;
      const c = repair.nearest(e.pos, plotIndex, e.id, this.skipHoles);
      if (!c) return null;
      this.repairTarget = c;
      this.repairWork = 0;
      this.repairWalk = 0;
      repair.claim(e.id, c);
    }
    const c = this.repairTarget;
    // Its own vector: face() below reuses tmp.
    const centre = tmp2.set(c.x + 0.5, c.y + 0.5, c.z + 0.5);
    const d = Math.hypot(centre.x - e.pos.x, centre.z - e.pos.z);
    const dy = centre.y - (e.pos.y + 0.9);
    if (d > 3.2 || Math.abs(dy) > 3.5) {
      this.repairWalk += dt;
      if (this.repairWalk > 25) {
        // Cannot get there (a hole high in an outer wall): leave it to someone else.
        this.skipHoles.add(c);
        this.repairTarget = null;
        repair.release(e.id);
        return null;
      }
      return { goal: new THREE.Vector3(c.x + 0.5, c.y - 0.5, c.z + 0.5) };
    }
    this.state = 'hold';
    this.clearPath();
    this.face(tmp.set(centre.x - e.pos.x, 0, centre.z - e.pos.z));
    this.desiredPitch = Math.atan2(dy, Math.max(0.5, d)) * 0.8;
    this.repairWork += dt;
    if (this.repairWork >= WAR.repairTime) {
      const n = repair.repair(centre, WAR.repairRange + 1, WAR.repairCells, plotIndex);
      if (n > 0) war.spend(e.team, WAR.repairCost);
      else this.skipHoles.add(c);
      this.repairTarget = null;
      this.repairWork = 0;
      repair.release(e.id);
    }
    return { goal: null };
  }

  /** At a post: crouch now and then, sweep the watched direction. */
  private hold(dt: number, now: number, facing: THREE.Vector3 | null): void {
    this.state = 'hold';
    this.clearPath();
    this.holdTimer += dt;
    if (facing) this.face(facing, Math.sin(now * 0.5 + this.holdPhase) * 0.55);
  }

  private face(dir: THREE.Vector3, extraYaw = 0): void {
    if (dir.lengthSq() < 1e-4) return;
    this.desiredYaw = Math.atan2(-dir.x, -dir.z) + extraYaw;
    this.desiredPitch = 0;
  }

  /**
   * Barred by walls close to the flag: throw a breach charge at the wall in the flag's direction.
   * Only when progress towards the flag has stalled for a while and the bot carries charges.
   */
  private maybeBreach(dt: number, now: number, flag: THREE.Vector3): void {
    const e = this.entity;
    const d = Math.hypot(e.pos.x - flag.x, e.pos.z - flag.z);
    if (d < this.lastFlagDist - 0.4) {
      this.lastFlagDist = d;
      this.blockedTimer = 0;
    } else this.blockedTimer += dt;
    if (this.blockedTimer < 3 || this.breachCooldown > 0 || d > 16 || !this.ctx.gadgets) return;
    const slot = e.gadgets.indexOf('breach');
    if (slot < 0 || e.gadgetCharges[slot] <= 0 || e.gadgetCooldown[slot] > 0) return;
    const eye = e.eyePos;
    const dir = tmp.set(flag.x - eye.x, flag.y + 1 - eye.y, flag.z - eye.z);
    const len = dir.length();
    const hit = this.ctx.world.raycast(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, Math.min(len, 7));
    if (!hit || hit.dist < 1.5) return;
    // Face the wall and throw.
    this.desiredYaw = Math.atan2(-dir.x, -dir.z);
    this.desiredPitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) * 0.5;
    e.yaw = this.desiredYaw;
    e.pitch = this.desiredPitch;
    this.ctx.gadgets.input(e, slot, true, true, false, now);
    this.releaseSlot = slot;
    this.breachCooldown = 9;
    this.blockedTimer = 0;
    this.lastFlagDist = Infinity;
  }
}
