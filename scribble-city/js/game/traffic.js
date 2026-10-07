import * as THREE from 'three';
import { MeshBuilder } from '../render/MeshBuilder.js';
import { StrokeList } from '../render/LineBatch.js';
import { carShape } from '../world/props.js';
import { blockRect } from '../world/layout.js';
import { COL } from '../world/buildings.js';
import { damp, dampAngle } from '../core/util.js';

const LANE = 3.6;
const VARIANTS = [
  { color: COL.yellow, taxi: true },
  { color: COL.yellow, taxi: true },
  { color: COL.blue, taxi: false },
  { color: COL.red, taxi: false },
  { color: COL.gray, taxi: false },
  { color: COL.green, taxi: false },
];

/**
 * Ambient traffic: taxis and cars circling blocks clockwise in the right-hand lane.
 * They brake for anything in front of them and honk at the player.
 */
export class Traffic {
  constructor(game) {
    this.game = game;
    this.models = VARIANTS.map((v) => {
      const ch = { mb: new MeshBuilder(), sl: new StrokeList() };
      carShape(null, ch, 0, 0, true, v.color, v.taxi, false);
      return { geo: ch.mb.build(), lines: ch.sl.toBatch(game.mats.line) };
    });
    this.list = [];
    this.t = 0;
  }

  reset() {
    for (const c of this.list) this.game.scene.remove(c.group);
    this.list = [];
  }

  route(bx, bz) {
    const r = blockRect(bx, bz);
    return [
      [r.x0 - LANE, r.z1 + LANE],
      [r.x0 - LANE, r.z0 - LANE],
      [r.x1 + LANE, r.z0 - LANE],
      [r.x1 + LANE, r.z1 + LANE],
    ];
  }

  spawn(bx, bz) {
    const game = this.game;
    const route = this.route(bx, bz);
    const leg = Math.floor(Math.random() * 4);
    const a = route[leg];
    const b = route[(leg + 1) % 4];
    const t = 0.15 + Math.random() * 0.7;
    const x = a[0] + (b[0] - a[0]) * t;
    const z = a[1] + (b[1] - a[1]) * t;
    // don't spawn on top of another car
    for (const c of this.list) if (Math.hypot(c.pos.x - x, c.pos.z - z) < 9) return null;
    const m = this.models[Math.floor(Math.random() * this.models.length)];
    const group = new THREE.Group();
    group.add(new THREE.Mesh(m.geo, game.mats.surface));
    const lm = new THREE.Mesh(m.lines.geometry, game.mats.line);
    lm.frustumCulled = false;
    lm.renderOrder = 10;
    group.add(lm);
    game.scene.add(group);
    const car = {
      group,
      route,
      target: (leg + 1) % 4,
      pos: new THREE.Vector3(x, 0, z),
      yaw: Math.atan2(b[0] - a[0], b[1] - a[1]),
      speed: 0,
      maxSpeed: 9 + Math.random() * 4,
      blockedT: 0,
      wrecked: false,
      halfLen: 2.2,
      halfWid: 0.95,
    };
    this.list.push(car);
    return car;
  }

  update(dt) {
    const game = this.game;
    const p = game.player.inVehicle ? game.player.inVehicle.pos : game.player.pos;
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 1.2;
      for (const c of this.list) {
        if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) > 150) {
          game.scene.remove(c.group);
          c.gone = true;
        }
      }
      this.list = this.list.filter((c) => !c.gone);
      const max = game.touch ? 7 : 11;
      let tries = 4;
      while (this.list.length < max && tries-- > 0) {
        const bx = Math.floor(Math.random() * 5);
        const bz = Math.floor(Math.random() * 5);
        const r = blockRect(bx, bz);
        const d = Math.hypot((r.x0 + r.x1) / 2 - p.x, (r.z0 + r.z1) / 2 - p.z);
        if (d > 110) continue;
        const c = this.spawn(bx, bz);
        if (c && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 25) {
          game.scene.remove(c.group);
          this.list.pop();
        }
      }
    }
    for (const c of this.list) this.updateCar(c, dt);
  }

  blocked(c) {
    const game = this.game;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const test = (x, z, r) => {
      const dx = x - c.pos.x;
      const dz = z - c.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      return along > 0.5 && along < 8.5 && side < 1.6 + r;
    };
    const pl = game.player;
    if (!pl.inVehicle && pl.mode !== 'dead' && test(pl.pos.x, pl.pos.z, 0.3)) return 'player';
    for (const v of game.vehicles.list) if (!v.dead && test(v.pos.x, v.pos.z, v.radius * 0.6)) return v.driver ? 'player' : 'car';
    for (const o of this.list) if (o !== c && test(o.pos.x, o.pos.z, 0.8)) return 'car';
    for (const e of game.enemies.list) if (e.alive && test(e.pos.x, e.pos.z, 0.4)) return 'other';
    for (const h of game.civilians.list) if (test(h.pos.x, h.pos.z, 0.3)) return 'other';
    return null;
  }

  updateCar(c, dt) {
    if (c.wrecked) {
      c.speed = damp(c.speed, 0, 3, dt);
      if (Math.random() < dt * 2) this.game.fx.smoke(c.pos.x, 1.6, c.pos.z, 1.2);
    } else {
      const t = c.route[c.target];
      const dx = t[0] - c.pos.x;
      const dz = t[1] - c.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 5) c.target = (c.target + 1) % 4;
      c.yaw = dampAngle(c.yaw, Math.atan2(dx, dz), d < 9 ? 3.2 : 6, dt);
      const why = this.blocked(c);
      const want = why ? 0 : c.maxSpeed * (d < 9 ? 0.55 : 1);
      c.speed = damp(c.speed, want, why ? 5 : 1.2, dt);
      if (why === 'player') {
        c.blockedT += dt;
        if (c.blockedT > 1.2) {
          c.blockedT = -2.5;
          this.game.audio.play('honk', 0.6);
        }
      } else c.blockedT = Math.min(c.blockedT, 0);
    }
    c.pos.x += Math.sin(c.yaw) * c.speed * dt;
    c.pos.z += Math.cos(c.yaw) * c.speed * dt;
    c.group.position.copy(c.pos);
    c.group.rotation.set(0, c.yaw - Math.PI / 2, 0);
  }

  // keep the player's vehicles out of traffic cars
  collideVehicle(v) {
    for (const c of this.list) {
      const dx = v.pos.x - c.pos.x;
      const dz = v.pos.z - c.pos.z;
      const d = Math.hypot(dx, dz);
      const r = v.radius + 1.5;
      if (d < r && d > 1e-3) {
        const push = r - d;
        v.pos.x += (dx / d) * push * 0.7;
        v.pos.z += (dz / d) * push * 0.7;
        c.pos.x -= (dx / d) * push * 0.3;
        c.pos.z -= (dz / d) * push * 0.3;
        if (Math.abs(v.speed) > 6) {
          if (v.kind === 'tank' && !c.wrecked) {
            c.wrecked = true;
            this.game.fx.sprite('fx_crash', c.pos.x, 1.2, c.pos.z, { size: 2.4, life: 0.4 });
            this.game.audio.play('crash', 0.8);
          } else {
            this.game.audio.play('crash', 0.5);
            v.hurt(Math.abs(v.speed) * 0.8);
          }
          v.speed *= 0.4;
        }
      }
    }
  }

  // walkers bump into traffic like into parked cars
  pushOut(p, r) {
    for (const c of this.list) {
      const dx = p.x - c.pos.x;
      const dz = p.z - c.pos.z;
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      const along = dx * fx + dz * fz;
      const side = dx * fz - dz * fx;
      const hl = c.halfLen + r;
      const hw = c.halfWid + r;
      if (Math.abs(along) < hl && Math.abs(side) < hw && p.y < 1.5) {
        const pa = hl - Math.abs(along);
        const ps = hw - Math.abs(side);
        if (pa < ps) {
          const s = Math.sign(along) || 1;
          p.x += fx * pa * s;
          p.z += fz * pa * s;
        } else {
          const s = Math.sign(side) || 1;
          p.x += fz * ps * s;
          p.z -= fx * ps * s;
        }
      }
    }
  }

  explosion(x, z, radius) {
    for (const c of this.list) {
      if (Math.hypot(c.pos.x - x, c.pos.z - z) < radius + 1.5) c.wrecked = true;
    }
  }
}
