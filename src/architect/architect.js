// Architect view: slow-motion tactical camera, module drag/rotate/place with structural rules,
// squad orders, and fog-of-war enemy intel.
import * as THREE from 'three';
import { CONFIG, MODULE_TYPES } from '../core/config.js';
import { Collider, rayCharacter } from '../core/collision.js';

const A = CONFIG.architect;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _ray = new THREE.Ray(), _plane = new THREE.Plane(), _ndc = new THREE.Vector2();
const GRID = 0.5;

export class Architect {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.energy = A.energyMax;
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 500);
    this.focus = new THREE.Vector3();
    this.orbit = 0; this.zoom = 28; this.tilt = A.cameraTilt * Math.PI / 180;
    this.cursor = new THREE.Vector2(0.5, 0.5);   // virtual cursor in [0,1]
    this.hover = null; this.selected = null; this.dragging = false;
    this.drag = { offset: new THREE.Vector3(), yaw: 0, x: 0, z: 0, y: 0, valid: false, reason: null, origin: null };
    this.raycaster = new THREE.Raycaster();
    this.transition = 0; // 0 ground .. 1 architect
    this.enemyIntel = new Map(); // enemy → { pos, time, seen }
    this.markers = new THREE.Group(); this.markers.visible = false; game.scene.add(this.markers);
    this.cones = new Map();
    this.orderMarker = null;
    this._buildMarkers();
    this.stats = { placed: 0 };
    this.lastPlaceTime = -10;
    this.reachRings = [];
  }

  _buildMarkers() {
    const g = this.game;
    // order marker: ring on the ground
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4fd6ff, transparent: true, opacity: 0.8, depthWrite: false }));
    ring.visible = false; ring.renderOrder = 30; this.markers.add(ring); this.orderMarker = { mesh: ring, t: 0 };
    // enemy ghost marker geometry
    this.ghostGeo = new THREE.OctahedronGeometry(0.35, 0);
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.55, depthWrite: false, depthTest: false });
    this.coneGeo = new THREE.CircleGeometry(1, 24, -Math.PI * 0.32, Math.PI * 0.64).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2);
    this.coneMat = new THREE.MeshBasicMaterial({ color: 0xff5a40, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    // reach rings around squad members
    this.reachGeo = new THREE.RingGeometry(A.reachRadius - 0.15, A.reachRadius, 96).rotateX(-Math.PI / 2);
    this.reachMat = new THREE.MeshBasicMaterial({ color: 0x4fd6ff, transparent: true, opacity: 0.22, depthWrite: false });
    // grid floor overlay
    const grid = new THREE.GridHelper(200, 200, 0x2a6a8a, 0x1a3a4a); grid.material.transparent = true; grid.material.opacity = 0.18; grid.material.depthWrite = false; grid.position.y = 0.03; this.markers.add(grid);
    // selection ring under selected module
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4fd6ff, transparent: true, opacity: 0.9, depthWrite: false }));
    this.selRing.visible = false; this.markers.add(this.selRing);
  }

  enter() {
    if (this.active) return;
    const g = this.game;
    this.active = true; g.mode = 'architect';
    this.focus.copy(g.player.pos);
    this.orbit = g.player.camYaw + Math.PI; // look from behind the player's facing
    this.cursor.set(0.5, 0.5);
    this.markers.visible = true;
    g.audio.architectEnter(); g.audio.setSlowMotion(true);
    g.hud.setArchitect(true);
    this._ensureReachRings();
    g.hint('archDrag');
  }
  exit() {
    if (!this.active) return;
    const g = this.game;
    if (this.dragging) this._cancelDrag();
    this.active = false; g.mode = 'ground';
    this.markers.visible = false; this.selRing.visible = false;
    for (const m of g.level.modules) m.setHighlight(null);
    this._hideIntel();
    g.audio.architectExit(); g.audio.setSlowMotion(false);
    g.hud.setArchitect(false);
    this.selected = null; this.hover = null;
  }
  toggle() { if (this.active) this.exit(); else this.enter(); }

  _ensureReachRings() {
    const g = this.game;
    const members = [g.player, ...g.squad];
    while (this.reachRings.length < members.length) { const m = new THREE.Mesh(this.reachGeo, this.reachMat); m.renderOrder = 25; this.markers.add(m); this.reachRings.push(m); }
  }

  // ---- energy ----
  addEnergy(v) { this.energy = Math.min(A.energyMax, this.energy + v); }

  // ---- per frame (realDt: unscaled) ----
  update(realDt, dt) {
    const g = this.game;
    // transition blend for camera/postfx
    const target = this.active ? 1 : 0;
    this.transition += (target - this.transition) * Math.min(1, realDt * 5);
    if (Math.abs(this.transition - target) < 0.002) this.transition = target;
    g.postfx.state.architect = this.transition;
    // energy regen
    this.energy = Math.min(A.energyMax, this.energy + (this.active ? A.energyRegenInArchitect : A.energyRegen) * realDt);
    // intel: remember enemies seen by friendlies
    this._updateIntel(dt);
    if (!this.active) return;
    const inp = g.input;
    // virtual cursor
    const W = g.width, H = g.height;
    if (inp.softLook) { this.cursor.x = THREE.MathUtils.clamp(inp.mouse.x / W, 0, 1); this.cursor.y = THREE.MathUtils.clamp(inp.mouse.y / H, 0, 1); }
    else { this.cursor.x = THREE.MathUtils.clamp(this.cursor.x + inp.mouse.dx / W, 0, 1); this.cursor.y = THREE.MathUtils.clamp(this.cursor.y + inp.mouse.dy / H, 0, 1); }
    // camera controls
    const pan = A.panSpeed * realDt * (this.zoom / 28);
    const fx = Math.sin(this.orbit), fz = Math.cos(this.orbit), rx = Math.cos(this.orbit), rz = -Math.sin(this.orbit);
    const mz = inp.axis('KeyS', 'KeyW'), mx = inp.axis('KeyA', 'KeyD');
    this.focus.x += (fx * mz + rx * mx) * pan; this.focus.z += (fz * mz + rz * mx) * pan;
    // edge pan with cursor (not in soft-look mode, where the cursor sits at the edge to turn)
    const edge = inp.softLook ? -1 : 0.02;
    if (this.cursor.x < edge) { this.focus.x -= rx * pan; this.focus.z -= rz * pan; }
    if (this.cursor.x > 1 - edge) { this.focus.x += rx * pan; this.focus.z += rz * pan; }
    if (this.cursor.y < edge) { this.focus.x += fx * pan; this.focus.z += fz * pan; }
    if (this.cursor.y > 1 - edge) { this.focus.x -= fx * pan; this.focus.z -= fz * pan; }
    if (inp.down('KeyQ')) this.orbit += realDt * 1.6;
    if (inp.down('KeyE')) this.orbit -= realDt * 1.6;
    if (inp.mouse.middle) this.orbit -= inp.mouse.dx * 0.004;
    this.zoom = THREE.MathUtils.clamp(this.zoom + inp.mouse.wheel * 2.5, A.minZoom, A.maxZoom);
    const b = g.world.bounds; this.focus.x = THREE.MathUtils.clamp(this.focus.x, b.minX + 10, b.maxX - 10); this.focus.z = THREE.MathUtils.clamp(this.focus.z, b.minZ + 10, b.maxZ - 10);
    if (inp.justPressed('KeyF')) this.focus.copy(g.player.pos);
    this._placeCamera();
    // picking
    this._updatePicking();
    // reach rings
    const members = [g.player, ...g.squad];
    this.reachRings.forEach((m, i) => { const c = members[i]; if (c && c.alive) { m.visible = true; m.position.set(c.pos.x, c.pos.y + 0.05, c.pos.z); } else m.visible = false; });
    if (this.orderMarker.mesh.visible) { this.orderMarker.t += realDt; const s = 1 + Math.sin(this.orderMarker.t * 6) * 0.15; this.orderMarker.mesh.scale.setScalar(s); if (this.orderMarker.t > 2.5) this.orderMarker.mesh.visible = false; }
    // rotate selected
    if (inp.justPressed('KeyR') && this.dragging) { this.drag.yaw += Math.PI / 2; g.audio.ui('click'); }
    if (inp.justPressed('Escape') && this.dragging) this._cancelDrag();
  }

  _placeCamera() {
    const d = this.zoom, t = this.tilt;
    const x = this.focus.x - Math.sin(this.orbit) * d * Math.cos(t), z = this.focus.z - Math.cos(this.orbit) * d * Math.cos(t);
    const y = this.focus.y + d * Math.sin(t);
    this.camera.position.set(x, Math.max(y, 6), z);
    this.camera.lookAt(this.focus.x, this.focus.y, this.focus.z);
  }

  _cursorRay() {
    _ndc.set(this.cursor.x * 2 - 1, -(this.cursor.y * 2 - 1));
    this.raycaster.setFromCamera(_ndc, this.camera);
    return this.raycaster.ray;
  }

  _updatePicking() {
    const g = this.game, inp = g.input;
    const ray = this._cursorRay();
    if (this.dragging) { this._updateDrag(ray); if (inp.mouseUps.some((m) => m.button === 0)) this._commitDrag(); return; }
    // hover module
    const hits = this.raycaster.intersectObjects(g.level.modules.map((m) => m.group), true);
    const hovered = hits.length ? hits[0].object.userData.module || hits[0].object.parent.userData?.module || this._moduleOf(hits[0].object) : null;
    if (hovered !== this.hover) { for (const m of g.level.modules) m.setHighlight(m === this.selected ? 'selected' : null); if (hovered) hovered.setHighlight('hover'); this.hover = hovered; if (hovered) g.audio.ui('hover'); }
    g.hud.setModuleTooltip(hovered, hovered ? this._reachOK(hovered.x, hovered.z) : true, hovered ? this.energy >= hovered.cfg.cost : true);
    // clicks
    for (const c of inp.clicks) {
      if (c.button === 0 && hovered) this._startDrag(hovered, ray, hits[0].point);
      else if (c.button === 0) { this.selected = null; this.selRing.visible = false; for (const m of g.level.modules) m.setHighlight(m === this.hover ? 'hover' : null); }
      else if (c.button === 2) this._order(ray);
    }
    if (this.selected) { this.selRing.visible = true; this.selRing.position.set(this.selected.x, this.selected.y + 0.05, this.selected.z); const s = Math.max(this.selected.cfg.w, this.selected.cfg.d) * 0.6; this.selRing.scale.setScalar(s); }
  }
  _moduleOf(obj) { let o = obj; while (o) { if (o.userData && o.userData.module) return o.userData.module; o = o.parent; } return null; }

  _reachOK(x, z) {
    const g = this.game;
    for (const c of [g.player, ...g.squad]) { if (!c.alive) continue; if (Math.hypot(c.pos.x - x, c.pos.z - z) <= A.reachRadius) return true; }
    return false;
  }

  _startDrag(mod, ray, hitPoint) {
    const g = this.game;
    if (!this._reachOK(mod.x, mod.z)) { g.hud.toast(g.t('hud.invalid.reach')); g.audio.moduleInvalid(); return; }
    if (this.energy < mod.cfg.cost) { g.hud.toast(g.t('hud.invalid.energy')); g.audio.moduleInvalid(); return; }
    this.selected = mod; this.dragging = true;
    mod.setHighlight('selected'); mod.setGhost(true);
    const d = this.drag; d.origin = { x: mod.x, y: mod.y, z: mod.z, yaw: mod.yaw };
    d.yaw = mod.yaw; d.x = mod.x; d.z = mod.z; d.y = mod.y;
    // drag plane at the module's base height; offset from hit point
    _plane.set(new THREE.Vector3(0, 1, 0), -mod.y);
    const p = ray.intersectPlane(_plane, _v) || hitPoint;
    d.offset.set(mod.x - p.x, 0, mod.z - p.z);
    g.audio.moduleGrab();
  }

  _updateDrag(ray) {
    const g = this.game, d = this.drag, mod = this.selected;
    _plane.set(new THREE.Vector3(0, 1, 0), -d.origin.y);
    const p = ray.intersectPlane(_plane, _v);
    if (p) {
      d.x = Math.round((p.x + d.offset.x) / GRID) * GRID;
      d.z = Math.round((p.z + d.offset.z) / GRID) * GRID;
    }
    const b = g.world.bounds; d.x = THREE.MathUtils.clamp(d.x, b.minX + 4, b.maxX - 4); d.z = THREE.MathUtils.clamp(d.z, b.minZ + 4, b.maxZ - 4);
    // support height: highest surface under the footprint (excluding self)
    d.y = this._supportHeight(mod, d.x, d.z, d.yaw);
    const v = this._validate(mod, d.x, d.y, d.z, d.yaw);
    d.valid = v.ok; d.reason = v.reason;
    mod.group.position.set(d.x, d.y, d.z); mod.group.rotation.y = d.yaw;
    mod.setHighlight(v.ok ? 'selected' : 'invalid');
    g.hud.setDragStatus(v.ok, v.reason, mod);
    this.selRing.visible = true; this.selRing.position.set(d.x, d.y + 0.05, d.z);
  }

  _supportHeight(mod, x, z, yaw) {
    const g = this.game; const fp = mod.footprint;
    const test = new Collider({ x, y: 0, z, hx: fp.hx, hy: 1, hz: fp.hz, yaw });
    let best = g.world.groundY;
    g.world.query(test.minX, test.minZ, test.maxX, test.maxZ, (c) => {
      if (c.owner === mod || !c.blocksMovement || c.tag === 'door' || !c.climbable) return;
      if (c.maxY > 12) return;
      // does the footprint overlap this collider's top?
      const cc = new Collider({ x: c.x, y: c.y, z: c.z, hx: c.hx, hy: c.hy, hz: c.hz, yaw: c.yaw });
      if (overlap2D(test, cc)) best = Math.max(best, c.wedge ? c.minY + c.hy : c.maxY);
    });
    return best;
  }

  _validate(mod, x, y, z, yaw) {
    const g = this.game, fp = mod.footprint, t = g.t;
    if (!this._reachOK(x, z)) return { ok: false, reason: t('hud.invalid.reach') };
    if (this.energy < mod.cfg.cost) return { ok: false, reason: t('hud.invalid.energy') };
    // overlap with world (tolerance so pieces can sit flush)
    const hit = g.world.boxOverlap(x, y + fp.h / 2, z, fp.hx - 0.02, fp.h / 2 - 0.02, fp.hz - 0.02, yaw, mod.mainCollider, 0.05);
    if (hit) return { ok: false, reason: t('hud.invalid.overlap') };
    // characters inside the footprint
    const test = new Collider({ x, y: y + fp.h / 2, z, hx: fp.hx + 0.35, hy: fp.h / 2, hz: fp.hz + 0.35, yaw });
    for (const c of g.characters) {
      if (!c.alive && !c.downed) continue;
      if (c.pos.y + 1.7 < y || c.pos.y > y + fp.h) continue;
      if (test.containsXZ(c.pos.x, c.pos.z)) return { ok: false, reason: t('hud.invalid.occupied') };
    }
    // elevated pieces must have most of their footprint supported
    if (y > g.world.groundY + 0.05) {
      let supported = 0, total = 0;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { total++; const [wx, wz] = test.toWorld(i * fp.hx * 0.8, j * fp.hz * 0.8); const gy = g.world.groundAt(wx, wz, y + 0.05).y; if (gy > y - 0.1) supported++; }
      if (supported < (mod.type === 'catwalk' ? 3 : 4)) return { ok: false, reason: t('hud.invalid.support') };
    }
    return { ok: true, reason: null };
  }

  _commitDrag() {
    const g = this.game, d = this.drag, mod = this.selected;
    this.dragging = false;
    mod.setGhost(false);
    const moved = Math.abs(d.x - d.origin.x) > 0.01 || Math.abs(d.z - d.origin.z) > 0.01 || Math.abs(d.yaw - d.origin.yaw) > 0.01;
    if (d.valid && moved) {
      mod.setTransform(d.x, d.y, d.z, d.yaw);
      this.energy -= mod.cfg.cost; this.stats.placed++; this.lastPlaceTime = g.time;
      g.audio.modulePlace(mod.group.position, mod.cfg.mass >= 3);
      g.fx.moduleLand(mod.mainCollider);
      g.emitNoise(mod.group.position, A.moduleNoiseRadius, g.player, 'module');
      g.onModulePlaced && g.onModulePlaced(mod);
      g.hud.toast(g.t('hud.placed'));
    } else {
      mod.group.position.set(d.origin.x, d.origin.y, d.origin.z); mod.group.rotation.y = d.origin.yaw;
      if (moved) g.audio.moduleInvalid();
    }
    mod.setHighlight(this.active ? 'selected' : null);
    g.hud.setDragStatus(null);
  }
  _cancelDrag() {
    const d = this.drag, mod = this.selected; this.dragging = false;
    mod.setGhost(false); mod.group.position.set(d.origin.x, d.origin.y, d.origin.z); mod.group.rotation.y = d.origin.yaw; mod.setHighlight(null);
    this.game.hud.setDragStatus(null);
  }

  // ---- orders ----
  _order(ray) {
    const g = this.game;
    // enemy under cursor?
    let target = null, bestT = Infinity;
    for (const e of g.enemies) { if (!e.alive || !e.visible) continue; const h = rayCharacter(ray.origin, ray.direction, e.pos, e.radius + 0.4, e.currentHeight + 0.3, 400); if (h && h.t < bestT) { bestT = h.t; target = e; } }
    if (target) { for (const s of g.squad) if (s.alive) s.setOrder('attack', { target }); g.hud.toast(g.t('order.attack')); g.audio.ui('click'); this._showOrderMarker(target.pos); return; }
    // hostage under cursor → escort
    for (const h of g.hostages) { if (!h.alive || h.state !== 'freed') continue; const hit = rayCharacter(ray.origin, ray.direction, h.pos, h.radius + 0.4, h.currentHeight + 0.3, 400); if (hit) { for (const s of g.squad) if (s.alive) s.setOrder('escort', { target: h }); g.hud.toast(g.t('order.escort')); g.audio.ui('click'); this._showOrderMarker(h.pos); return; } }
    // player → follow
    { const hit = rayCharacter(ray.origin, ray.direction, g.player.pos, g.player.radius + 0.4, g.player.currentHeight + 0.3, 400); if (hit) { for (const s of g.squad) if (s.alive) s.setOrder('follow'); g.hud.toast(g.t('order.follow')); g.audio.ui('click'); this._showOrderMarker(g.player.pos); return; } }
    // ground → move (find the walkable surface under the cursor: try elevated surfaces first)
    const wh = g.world.raycast(ray.origin, ray.direction, 400, (c) => c.blocksMovement && c.tag !== 'door');
    let p = null;
    if (wh && wh.normal.y > 0.5) p = wh.point.clone();
    else { _plane.set(new THREE.Vector3(0, 1, 0), -g.world.groundY); const gp = ray.intersectPlane(_plane, _v); if (gp) p = gp.clone(); }
    if (!p) return;
    const node = g.nav.nearestNode(p, 2.5);
    if (node < 0) { g.audio.moduleInvalid(); return; }
    const np = g.nav.nodePos(node);
    let i = 0;
    for (const s of g.squad) { if (!s.alive) continue; const off = i++ === 0 ? -0.9 : 0.9; const pos = np.clone(); pos.x += Math.cos(this.orbit) * off; pos.z -= Math.sin(this.orbit) * off; s.setOrder('move', { pos }); s.order.yaw = Math.atan2(np.x - s.pos.x, np.z - s.pos.z); }
    g.squadMode = 'move';
    g.hud.toast(g.t('order.move')); g.audio.ui('click'); this._showOrderMarker(np);
  }
  _showOrderMarker(pos) { const m = this.orderMarker; m.mesh.visible = true; m.t = 0; m.mesh.position.set(pos.x, pos.y + 0.06, pos.z); }

  // ---- intel / fog of war ----
  _updateIntel(dt) {
    const g = this.game;
    for (const e of g.enemies) {
      let rec = this.enemyIntel.get(e);
      if (!rec) { rec = { pos: new THREE.Vector3(), time: -100, ghost: null, cone: null }; this.enemyIntel.set(e, rec); }
      if (e.seenByFriendly) { rec.pos.copy(e.pos); rec.time = g.time; }
      if (!e.alive) { rec.time = -100; }
    }
    if (!this.active) return;
    for (const [e, rec] of this.enemyIntel) {
      const known = g.time - rec.time < A.enemyMemory;
      const live = e.seenByFriendly;
      e.setVisible(live || !e.alive);
      // ghost at last known position when not live
      if (known && !live && e.alive) {
        if (!rec.ghost) { rec.ghost = new THREE.Mesh(this.ghostGeo, this.ghostMat); rec.ghost.renderOrder = 40; this.markers.add(rec.ghost); }
        rec.ghost.visible = true; rec.ghost.position.set(rec.pos.x, rec.pos.y + 1.2, rec.pos.z); rec.ghost.rotation.y += dt * 2;
      } else if (rec.ghost) rec.ghost.visible = false;
      // vision cone for live enemies
      if (live && e.alive) {
        if (!rec.cone) { rec.cone = new THREE.Mesh(this.coneGeo, this.coneMat); rec.cone.renderOrder = 24; this.markers.add(rec.cone); }
        rec.cone.visible = true; rec.cone.position.set(e.pos.x, e.pos.y + 0.08, e.pos.z); rec.cone.rotation.y = e.aimYaw; rec.cone.scale.setScalar(Math.min(14, e.visionRange() * 0.45));
      } else if (rec.cone) rec.cone.visible = false;
    }
  }
  _hideIntel() {
    for (const [e, rec] of this.enemyIntel) { e.setVisible(true); if (rec.ghost) rec.ghost.visible = false; if (rec.cone) rec.cone.visible = false; }
  }

  snapshot() { return { energy: this.energy }; }
  restore(s) { this.energy = Math.max(s.energy, 40); }
}

function overlap2D(a, b) {
  const axes = [[a.cos, a.sin], [-a.sin, a.cos], [b.cos, b.sin], [-b.sin, b.cos]];
  for (const [ax, az] of axes) {
    const ra = Math.abs(ax * a.cos + az * a.sin) * a.hx + Math.abs(-ax * a.sin + az * a.cos) * a.hz;
    const rb = Math.abs(ax * b.cos + az * b.sin) * b.hx + Math.abs(-ax * b.sin + az * b.cos) * b.hz;
    const d = Math.abs((b.x - a.x) * ax + (b.z - a.z) * az);
    if (d > ra + rb - 0.05) return false;
  }
  return true;
}
