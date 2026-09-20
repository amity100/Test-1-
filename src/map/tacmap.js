// Tactical map: a slow-motion view from above. Click anywhere to open a gateway there
// (the near end opens in front of you). Shows what you know: guards you have seen, who is on the radio,
// bodies, the gateway ends and the rooms of the site.
import * as THREE from 'three';
import { CONFIG } from '../core/config.js';

const M = CONFIG.map;
const _v = new THREE.Vector3(), _plane = new THREE.Plane(), _ndc = new THREE.Vector2();

export class TacMap {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 500);
    this.focus = new THREE.Vector3();
    this.orbit = 0; this.zoom = M.defaultZoom; this.tilt = M.cameraTilt * Math.PI / 180;
    this.cursor = new THREE.Vector2(0.5, 0.5);   // virtual cursor in [0,1]
    this.raycaster = new THREE.Raycaster();
    this.transition = 0;
    this.enemyIntel = new Map(); // enemy → { pos, time, ghost, cone }
    this.markers = new THREE.Group(); this.markers.visible = false; game.scene.add(this.markers);
    this.hoverPoint = null; this.hoverOK = false; this.hoverPlacement = null;
    this.suggestion = null;
    this.touch = false; this.preview = null; this.pendingTap = null;
    this._buildMarkers();
    this.pulse = 0;
  }
  // ---- touch gestures ----
  tapAt(nx, ny) { this.pendingTap = { nx, ny }; }
  confirm() { if (this.preview) this._place(this.preview.point); }
  panScreen(dx, dy) {
    const g = this.game; const k = this.zoom / g.height * 1.35;
    const fx = Math.sin(this.orbit), fz = Math.cos(this.orbit), rx = Math.cos(this.orbit), rz = -Math.sin(this.orbit);
    this.focus.x += (rx * dx + fx * dy) * k; this.focus.z += (rz * dx + fz * dy) * k;
  }
  setZoom(z) { this.zoom = THREE.MathUtils.clamp(z, M.minZoom, M.maxZoom); }
  // Tutorial: a pulsing ring where the first gateway should go.
  suggest(p) {
    this.clearSuggestion();
    const y = this.game.world.groundAt(p.x, p.z, (p.y || 0) + 0.5).y;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }));
    ring.position.set(p.x, y + 0.06, p.z); ring.renderOrder = 42; this.markers.add(ring);
    this.suggestion = { x: p.x, y, z: p.z, mesh: ring };
  }
  clearSuggestion() { if (this.suggestion) { this.markers.remove(this.suggestion.mesh); this.suggestion = null; } }

  _buildMarkers() {
    // gateway ghost under the cursor: ring + exit arrow
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4fd6ff, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }));
    ring.position.y = 0.05; g.add(ring);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 3).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false }));
    arrow.position.set(0, 0.08, 1.2); g.add(arrow);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color: 0x8af0ff, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false }));
    frame.scale.set(CONFIG.portal.width / 2, CONFIG.portal.height / 2, 1); frame.position.y = CONFIG.portal.height / 2; g.add(frame);
    g.visible = false; g.renderOrder = 40; this.markers.add(g);
    this.ghost = { group: g, ring, arrow, frame };
    // enemy ghost marker geometry
    this.ghostGeo = new THREE.OctahedronGeometry(0.35, 0);
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.55, depthWrite: false, depthTest: false });
    this.coneGeo = new THREE.CircleGeometry(1, 24, -Math.PI * 0.32, Math.PI * 0.64).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2);
    this.coneMat = new THREE.MeshBasicMaterial({ color: 0xff5a40, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    this.coneMatReport = new THREE.MeshBasicMaterial({ color: 0xff2a10, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    // grid floor overlay
    const grid = new THREE.GridHelper(200, 200, 0x2a6a8a, 0x1a3a4a); grid.material.transparent = true; grid.material.opacity = 0.16; grid.material.depthWrite = false; grid.position.y = 0.03; this.markers.add(grid);
    // player marker
    this.playerRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }));
    this.playerRing.renderOrder = 41; this.markers.add(this.playerRing);
  }

  enter() {
    if (this.active) return;
    const g = this.game;
    this.active = true; g.mode = 'map';
    this.zoom = M.defaultZoom * (g.height > g.width ? 1.35 : 1);
    this.focus.copy(g.player.pos);
    if (this.suggestion) { this.focus.x = (g.player.pos.x + this.suggestion.x) / 2; this.focus.z = (g.player.pos.z + this.suggestion.z) / 2; }
    this.orbit = g.player.camYaw;   // camera behind you: the way you face is up
    this.cursor.set(0.5, 0.5);
    this.markers.visible = true;
    for (const m of g.level.roofs || []) m.visible = false;   // look into the rooms
    // the map reads better with less haze
    this._fog = g.scene.fog.density; g.scene.fog.density = 0.004;
    g.audio.mapEnter(); g.audio.setSlowMotion(true);
    g.hud.setMap(true);
    if (g.script && g.script.onMapEnter) g.script.onMapEnter();
  }
  exit() {
    if (!this.active) return;
    const g = this.game;
    this.active = false; g.mode = 'ground';
    this.markers.visible = false; this.ghost.group.visible = false; this.preview = null; this.pendingTap = null;
    for (const m of g.level.roofs || []) m.visible = true;
    if (this._fog !== undefined) { g.scene.fog.density = this._fog; this._fog = undefined; }
    this._hideIntel();
    g.audio.mapExit(); g.audio.setSlowMotion(g.focus > 0);
    g.hud.setMap(false);
    if (g.script && g.script.onMapExit) g.script.onMapExit();
  }
  toggle() { if (this.active) this.exit(); else this.enter(); }

  // ---- per frame (realDt: unscaled) ----
  update(realDt, dt) {
    const g = this.game;
    const target = this.active ? 1 : 0;
    this.transition += (target - this.transition) * Math.min(1, realDt * 5);
    if (Math.abs(this.transition - target) < 0.002) this.transition = target;
    g.postfx.state.architect = this.transition;
    this._updateIntel(dt);
    if (!this.active) return;
    const inp = g.input;
    const W = g.width, H = g.height;
    if (this.touch) { if (this.pendingTap) { this.cursor.set(this.pendingTap.nx, this.pendingTap.ny); } }
    else if (inp.softLook) { this.cursor.x = THREE.MathUtils.clamp(inp.mouse.x / W, 0, 1); this.cursor.y = THREE.MathUtils.clamp(inp.mouse.y / H, 0, 1); }
    else { this.cursor.x = THREE.MathUtils.clamp(this.cursor.x + inp.mouse.dx / W, 0, 1); this.cursor.y = THREE.MathUtils.clamp(this.cursor.y + inp.mouse.dy / H, 0, 1); }
    // camera controls
    const pan = M.panSpeed * realDt * (this.zoom / 30);
    const fx = Math.sin(this.orbit), fz = Math.cos(this.orbit), rx = Math.cos(this.orbit), rz = -Math.sin(this.orbit);
    const mz = inp.axis('KeyS', 'KeyW'), mx = inp.axis('KeyA', 'KeyD');
    this.focus.x += (fx * mz - rx * mx) * pan; this.focus.z += (fz * mz - rz * mx) * pan;
    const edge = inp.softLook || this.touch ? -1 : 0.02;
    if (this.cursor.x < edge) { this.focus.x += rx * pan; this.focus.z += rz * pan; }
    if (this.cursor.x > 1 - edge) { this.focus.x -= rx * pan; this.focus.z -= rz * pan; }
    if (this.cursor.y < edge) { this.focus.x += fx * pan; this.focus.z += fz * pan; }
    if (this.cursor.y > 1 - edge) { this.focus.x -= fx * pan; this.focus.z -= fz * pan; }
    if (inp.down('KeyQ')) this.orbit += realDt * 1.6;
    if (inp.down('KeyE')) this.orbit -= realDt * 1.6;
    if (inp.mouse.middle && !this.touch) this.orbit -= inp.mouse.dx * 0.004;
    if (!this.touch) this.zoom = THREE.MathUtils.clamp(this.zoom + inp.mouse.wheel * 2.5, M.minZoom, M.maxZoom);
    const b = g.world.bounds; this.focus.x = THREE.MathUtils.clamp(this.focus.x, b.minX + 10, b.maxX - 10); this.focus.z = THREE.MathUtils.clamp(this.focus.z, b.minZ + 10, b.maxZ - 10);
    if (inp.justPressed('KeyF')) this.focus.copy(g.player.pos);
    this._placeCamera();
    this.pulse = 0.5 + 0.5 * Math.sin(g.realTime * 5);
    this.playerRing.position.set(g.player.pos.x, g.player.pos.y + 0.06, g.player.pos.z); this.playerRing.scale.setScalar(1 + 0.15 * this.pulse);
    if (this.suggestion) { this.suggestion.mesh.scale.setScalar(1 + 0.25 * this.pulse); this.suggestion.mesh.material.opacity = 0.5 + 0.5 * this.pulse; }
    this._updatePicking();
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
  // world point under the cursor: the highest walkable surface hit, else the ground plane
  groundPoint(ray) {
    const g = this.game;
    const wh = g.world.raycast(ray.origin, ray.direction, 400, (c) => c.blocksMovement && c.tag !== 'door' && c.tag !== 'roof');
    if (wh && wh.normal.y > 0.5) return wh.point.clone();
    _plane.set(new THREE.Vector3(0, 1, 0), -g.world.groundY);
    const gp = ray.intersectPlane(_plane, _v);
    return gp ? gp.clone() : null;
  }

  _updatePicking() {
    const g = this.game, inp = g.input;
    const ray = this._cursorRay();
    const p = this.groundPoint(ray);
    this.hoverPoint = p;
    this.hoverPlacement = p ? g.portals.farPlacement(p, { hintYaw: Math.atan2(p.x - g.player.pos.x, p.z - g.player.pos.z) }) : null;
    const ok = !!this.hoverPlacement && g.portals.canOpen();
    this.hoverOK = ok;
    const gh = this.ghost;
    if (this.hoverPlacement) {
      const hp = this.hoverPlacement;
      gh.group.visible = true; gh.group.position.set(hp.x, hp.y, hp.z); gh.group.rotation.y = hp.yaw;
      const col = ok ? 0x4fd6ff : 0xff4a3a;
      gh.ring.material.color.setHex(col); gh.frame.material.color.setHex(ok ? 0x8af0ff : 0xff6a5a);
      gh.ring.scale.setScalar(1 + 0.12 * this.pulse);
    } else gh.group.visible = false;
    if (this.touch) {
      // tap once to preview, tap again near it (or OPEN) to open
      if (this.pendingTap && p) {
        if (this.preview && Math.hypot(this.preview.point.x - p.x, this.preview.point.z - p.z) < 2.0) this._place(this.preview.point);
        else if (this.hoverPlacement) { this.preview = { point: p.clone(), x: this.hoverPlacement.x, y: this.hoverPlacement.y, z: this.hoverPlacement.z }; g.audio.ui('hover'); }
        else { this.preview = null; g.audio.moduleInvalid(); }
      }
      this.pendingTap = null;
      if (!this.hoverPlacement) gh.group.visible = false;
      return;
    }
    for (const c of inp.clicks) {
      if (c.button === 0 && p) this._place(p);
      else if (c.button === 2) { if (g.portals.active) { g.portals.close(); g.hud.toast(g.t('portal.closed')); } }
    }
  }
  _place(p) {
    const g = this.game;
    const res = g.openPortalAt(p);
    this.preview = null;
    if (res.ok) { if (M.closeOnPlace) this.exit(); }
    else { g.hud.toast(res.reason); g.audio.moduleInvalid(); }
  }

  // ---- intel / fog of war ----
  _updateIntel(dt) {
    const g = this.game;
    for (const e of g.enemies) {
      let rec = this.enemyIntel.get(e);
      if (!rec) { rec = { pos: new THREE.Vector3(), time: -100, ghost: null, cone: null }; this.enemyIntel.set(e, rec); }
      // seen by you, or on the radio (you hear the transmission), or shooting
      const known = e.seenByFriendly || (e.report && e.report.active) || e.state === 'combat';
      if (known) { rec.pos.copy(e.pos); rec.time = g.time; }
      if (!e.alive) rec.time = -100;
    }
    if (!this.active) return;
    for (const [e, rec] of this.enemyIntel) {
      const live = e.seenByFriendly || (e.report && e.report.active) || e.state === 'combat';
      const known = g.time - rec.time < M.enemyMemory;
      e.setVisible(live || !e.alive);
      if (known && !live && e.alive) {
        if (!rec.ghost) { rec.ghost = new THREE.Mesh(this.ghostGeo, this.ghostMat); rec.ghost.renderOrder = 40; this.markers.add(rec.ghost); }
        rec.ghost.visible = true; rec.ghost.position.set(rec.pos.x, rec.pos.y + 1.2, rec.pos.z); rec.ghost.rotation.y += dt * 2;
      } else if (rec.ghost) rec.ghost.visible = false;
      if (live && e.alive) {
        if (!rec.cone) { rec.cone = new THREE.Mesh(this.coneGeo, this.coneMat); rec.cone.renderOrder = 24; this.markers.add(rec.cone); }
        rec.cone.material = e.report && e.report.active ? this.coneMatReport : this.coneMat;
        rec.cone.visible = true; rec.cone.position.set(e.pos.x, e.pos.y + 0.08, e.pos.z); rec.cone.rotation.y = e.aimYaw; rec.cone.scale.setScalar(Math.min(14, e.visionRange() * 0.45));
      } else if (rec.cone) rec.cone.visible = false;
    }
  }
  _hideIntel() {
    for (const [e, rec] of this.enemyIntel) { e.setVisible(true); if (rec.ghost) rec.ghost.visible = false; if (rec.cone) rec.cone.visible = false; }
  }
  // is this enemy currently shown on the map (live or remembered)?
  knows(e) { const rec = this.enemyIntel.get(e); return !!rec && this.game.time - rec.time < M.enemyMemory; }
  reset() { this.enemyIntel.clear(); this.clearSuggestion(); }
}
