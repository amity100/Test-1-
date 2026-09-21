// Portals: one active pair of upright gateways. Both ends are real openings — you see the other
// side through them, bullets and sound pass, and anyone (guards included) can walk through either way.
import * as THREE from 'three';
import { CONFIG } from '../core/config.js';

const P = CONFIG.portal;
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _plane = new THREE.Plane(), _clip = new THREE.Vector4(), _qq = new THREE.Vector4(), _frustum = new THREE.Frustum(), _sphere = new THREE.Sphere(), _size = new THREE.Vector2();

const VIEW_VS = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const VIEW_FS = /* glsl */`
  uniform sampler2D tView; uniform vec2 uRes; uniform float uOpen, uTime, uHasView; uniform vec3 uColor;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    // oval mask in the quad's own UV space, animated open from the centre
    vec2 c = (vUv - 0.5) * vec2(2.0, 2.0);
    float r = length(c * vec2(1.0, 0.72));
    float edge = uOpen;
    if (r > edge) discard;
    vec2 suv = gl_FragCoord.xy / uRes;
    // slight refraction wobble at the rim
    float rim = smoothstep(edge - 0.22, edge, r);
    suv += vec2(sin(uTime * 3.0 + c.y * 6.0), cos(uTime * 2.6 + c.x * 6.0)) * 0.004 * rim;
    vec3 view = texture2D(tView, suv).rgb;
    vec3 energy = uColor * (0.35 + 0.65 * hash(floor(c * 40.0) + floor(uTime * 20.0)));
    vec3 col = mix(view, energy, uHasView > 0.5 ? rim * 0.85 : 1.0);
    col += uColor * pow(rim, 3.0) * 1.6;
    gl_FragColor = vec4(col, 1.0);
  }
`;

class PortalEnd {
  constructor(sys, index) {
    this.sys = sys; this.index = index;
    this.pos = new THREE.Vector3(); this.yaw = 0;
    this.n = new THREE.Vector3(0, 0, 1); this.r = new THREE.Vector3(1, 0, 0);
    this.group = new THREE.Group(); this.group.visible = false;
    const w = P.width, h = P.height;
    // the view surface
    this.viewMat = new THREE.ShaderMaterial({
      uniforms: { tView: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uOpen: { value: 0 }, uTime: { value: 0 }, uHasView: { value: 0 }, uColor: { value: new THREE.Color(0x66e0ff) } },
      vertexShader: VIEW_VS, fragmentShader: VIEW_FS, side: THREE.DoubleSide, transparent: false, depthWrite: true,
    });
    this.view = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.viewMat); this.view.position.y = h / 2; this.view.renderOrder = 3; this.group.add(this.view);
    // the frame: an oval ring that grows open, plus a floor ring
    this.frameMat = new THREE.MeshBasicMaterial({ color: 0x8af0ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.frame = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 10, 64), this.frameMat); this.frame.position.y = h / 2; this.frame.scale.set(w / 2, h / 2, 1); this.frame.renderOrder = 22; this.group.add(this.frame);
    this.frame2 = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 8, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); this.frame2.position.y = h / 2; this.frame2.scale.set(w / 2 + 0.06, h / 2 + 0.06, 1); this.frame2.renderOrder = 22; this.group.add(this.frame2);
    this.floorRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4fd6ff, transparent: true, opacity: 0.5, depthWrite: false })); this.floorRing.position.y = 0.03; this.floorRing.renderOrder = 21; this.group.add(this.floorRing);
    // light (permanent so the shader light count never changes)
    this.light = new THREE.PointLight(0x66d8ff, 0, 9, 2); this.light.position.y = 1.4; this.group.add(this.light);
    sys.game.scene.add(this.group);
    // render target + virtual camera
    this.target = null; this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
    this.visibleNow = false;
  }
  set(x, y, z, yaw) {
    this.pos.set(x, y, z); this.yaw = yaw;
    this.n.set(Math.sin(yaw), 0, Math.cos(yaw)); this.r.set(Math.cos(yaw), 0, -Math.sin(yaw));
    this.group.position.copy(this.pos); this.group.rotation.y = yaw;
  }
  get center() { return _v3.set(this.pos.x, this.pos.y + P.height / 2, this.pos.z); }
  // signed distance of a point from the portal plane (+ = front side)
  side(p) { return (p.x - this.pos.x) * this.n.x + (p.z - this.pos.z) * this.n.z; }
  // does the world point lie within the oval (with margin), given it is on the plane?
  inRect(p, margin = 0) {
    const lx = (p.x - this.pos.x) * this.r.x + (p.z - this.pos.z) * this.r.z, ly = p.y - this.pos.y;
    return Math.abs(lx) <= P.width / 2 + margin && ly >= -0.6 && ly <= P.height - 0.2 + margin;
  }
  // ray vs the portal oval: returns t or -1
  rayHit(origin, dir, maxT) {
    const denom = dir.x * this.n.x + dir.z * this.n.z;
    if (Math.abs(denom) < 1e-6) return -1;
    const t = -((origin.x - this.pos.x) * this.n.x + (origin.z - this.pos.z) * this.n.z) / denom;
    if (t <= 0.01 || t >= maxT) return -1;
    const px = origin.x + dir.x * t, py = origin.y + dir.y * t, pz = origin.z + dir.z * t;
    const lx = (px - this.pos.x) * this.r.x + (pz - this.pos.z) * this.r.z, ly = py - this.pos.y - P.height / 2;
    const rr = (lx / (P.width / 2)) ** 2 + (ly / (P.height / 2)) ** 2;
    return rr <= 1 ? t : -1;
  }
  ensureTarget(renderer, w, h) {
    if (this.target && this.target.width === w && this.target.height === h) return;
    if (this.target) this.target.dispose();
    const floatOK = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    this.target = new THREE.WebGLRenderTarget(w, h, { type: floatOK ? THREE.HalfFloatType : THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
    this.viewMat.uniforms.tView.value = this.target.texture;
  }
  dispose() { if (this.target) this.target.dispose(); }
}

export class PortalSystem {
  constructor(game) {
    this.game = game;
    this.ends = [new PortalEnd(this, 0), new PortalEnd(this, 1)];
    this.state = 'closed';   // closed | opening | open | closing
    this.t = 0; this.openedAt = -100; this.lastOpen = -100; this.lastOpenReal = -100;
    this._buildAimGhost();
    this.stats = { opened: 0, traversals: 0 };
    this.humT = 0;
    this._prevPositions = new WeakMap();
  }

  get open() { return this.state === 'open'; }
  get active() { return this.state === 'opening' || this.state === 'open'; }
  get a() { return this.ends[0]; }
  get b() { return this.ends[1]; }
  other(end) { return end === this.ends[0] ? this.ends[1] : this.ends[0]; }

  // ---- transforms (through the pair, from end `from` to end `to`) ----
  transformPoint(p, from, to, out = new THREE.Vector3()) {
    const dx = p.x - from.pos.x, dz = p.z - from.pos.z;
    const lx = dx * from.r.x + dz * from.r.z, lz = dx * from.n.x + dz * from.n.z, ly = p.y - from.pos.y;
    return out.set(to.pos.x - lx * to.r.x - lz * to.n.x, to.pos.y + ly, to.pos.z - lx * to.r.z - lz * to.n.z);
  }
  transformDir(d, from, to, out = new THREE.Vector3()) {
    const lx = d.x * from.r.x + d.z * from.r.z, lz = d.x * from.n.x + d.z * from.n.z;
    return out.set(-lx * to.r.x - lz * to.n.x, d.y, -lx * to.r.z - lz * to.n.z);
  }
  deltaYaw(from, to) { return to.yaw - from.yaw + Math.PI; }
  // world position of `p` (near `other(end)`) as it appears when looking through `end`
  imageOf(p, end, out = new THREE.Vector3()) { return this.transformPoint(p, this.other(end), end, out); }

  // ---- the marker under the crosshair (ground mode): ring, oval and exit arrow where the far end would open ----
  _buildAimGhost() {
    const g = new THREE.Group(); g.visible = false; g.renderOrder = 30;
    const mk = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.92, 40).rotateX(-Math.PI / 2), mk(0x4fd6ff, 0.85)); ring.position.y = 0.04; g.add(ring);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 48), mk(0x8af0ff, 0.55)); frame.scale.set(P.width / 2, P.height / 2, 1); frame.position.y = P.height / 2; g.add(frame);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 3).rotateX(Math.PI / 2), mk(0xffffff, 0.8)); arrow.position.set(0, 0.06, 1.15); g.add(arrow);
    this.game.scene.add(g);
    this.aimGhost = { group: g, ring, frame, arrow, pulse: 0 };
  }
  showAimGhost(placement, ok = true) {
    const gh = this.aimGhost; if (!gh) return;
    if (!placement) { gh.group.visible = false; return; }
    gh.group.visible = true; gh.group.position.set(placement.x, placement.y, placement.z); gh.group.rotation.y = placement.yaw;
    const col = ok ? 0x4fd6ff : 0xff4a3a; gh.ring.material.color.setHex(col); gh.frame.material.color.setHex(ok ? 0x8af0ff : 0xff6a5a);
    gh.pulse += 0.08; gh.ring.scale.setScalar(1 + 0.06 * Math.sin(gh.pulse));
  }

  // ---- placement ----
  // Spot in front of the player for the near end; the opening faces the player.
  nearPlacement(player, opts = {}) {
    const g = this.game;
    const dists = opts.distances || [2.0, P.nearDistance, 1.3, 1.0];
    // straight ahead first, then swung to either side, then behind: the opening always faces you
    for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.5, -1.5, Math.PI]) {
      const yaw = player.camYaw + off;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      for (const d of dists) {
        const x = player.pos.x + fx * d, z = player.pos.z + fz * d;
        const gy = g.world.groundAt(x, z, player.pos.y + 0.5, 0.3).y;
        if (Math.abs(gy - player.pos.y) > 0.5) continue;
        if (!g.nav.isWalkable(x, gy, z, 0.6)) continue;
        if (!g.world.cylinderFree(x, z, 0.3, gy + 0.3, gy + 2.2)) continue;
        // you must be able to step through: the far side of the plane needs room too
        const bx = x + fx * 0.55, bz = z + fz * 0.55;
        if (!g.nav.isWalkable(bx, gy, bz, 0.6) || !g.world.cylinderFree(bx, bz, 0.34, gy + 0.3, gy + 2.0)) continue;
        if (!this._reachable(player, bx, gy, bz)) continue;
        return { x, y: gy, z, yaw: yaw + Math.PI };
      }
    }
    return null;
  }
  // Can you walk from where you stand to (x, y, z)? Nothing solid (wall, bars, crate, closed door) in between.
  _reachable(player, x, y, z) {
    const g = this.game;
    _v.set(x, y, z);
    if (!g.nav.lineWalkable(player.pos, _v)) return false;
    const dx = x - player.pos.x, dz = z - player.pos.z; const len = Math.hypot(dx, dz);
    if (len < 1e-3) return true;
    _v2.set(dx / len, 0, dz / len);
    for (const h of [0.45, 1.1, 1.8]) {
      _v3.set(player.pos.x, player.pos.y + h, player.pos.z);
      if (g.world.raycast(_v3, _v2, len, (c) => c.blocksMovement)) return false;
    }
    return true;
  }
  // Snap a world point to walkable ground and pick the exit direction: towards a nearby guard if there is one,
  // otherwise the direction with the longest clear run.
  farPlacement(point, opts = {}) {
    const g = this.game, nav = g.nav;
    const node = nav.nearestNode(point, opts.radius ?? 2.5);
    if (node < 0) return null;
    const np = nav.nodePos(node);
    // clearance for the frame: try the node and small offsets
    let best = null;
    for (const [ox, oz] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5], [0.5, 0.5], [-0.5, -0.5]]) {
      const x = np.x + ox, z = np.z + oz;
      if (!nav.isWalkable(x, np.y, z, 0.6)) continue;
      if (g.world.cylinderFree(x, z, 0.5, np.y + 0.3, np.y + 2.2)) { best = { x, z }; break; }
      if (!best) best = { x, z, tight: true };
    }
    if (!best) return null;
    const y = np.y;
    let yaw = null, bestScore = -Infinity;
    let guard = null, gd = Infinity;
    for (const e of g.enemies) { if (!e.alive) continue; const d = Math.hypot(e.pos.x - best.x, e.pos.z - best.z); if (d < 9 && d < gd && Math.abs(e.pos.y - y) < 1.5) { gd = d; guard = e; } }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + (opts.hintYaw || 0);
      const fx = Math.sin(a), fz = Math.cos(a);
      let run = 0;
      for (let s = 0.5; s <= 4; s += 0.5) { if (!nav.isWalkable(best.x + fx * s, y, best.z + fz * s, 0.6)) break; run = s; }
      if (run < 0.9) continue;
      // and nothing solid right in front of the opening at body height (a shelf face, a crate): you step out into open floor
      _v.set(best.x, y + 1.2, best.z); _v2.set(fx, 0, fz);
      if (g.world.raycast(_v, _v2, 1.4, (c) => c.blocksMovement)) continue;
      let score = run;
      if (guard) { const dx = guard.pos.x - best.x, dz = guard.pos.z - best.z; const l = Math.hypot(dx, dz) || 1; score += 6 * ((dx * fx + dz * fz) / l); }
      else if (opts.hintYaw !== undefined) score += 2 * Math.cos(a - opts.hintYaw);
      if (score > bestScore) { bestScore = score; yaw = a; }
    }
    if (yaw === null) return null;
    return { x: best.x, y, z: best.z, yaw, guard };
  }

  // the generator recharges between openings, except inside a focus window: a chain never waits
  // The spot behind a guard's back, the opening facing his back: you come out of it looking at him.
  behindPlacement(e) {
    const g = this.game, nav = g.nav;
    for (const [dist, off] of [[1.6, 0], [1.6, 0.45], [1.6, -0.45], [1.3, 0], [2.0, 0], [1.3, 0.7], [1.3, -0.7], [2.0, 0.6], [2.0, -0.6], [1.6, 1.0], [1.6, -1.0]]) {
      const a = e.yaw + Math.PI + off;
      const x = e.pos.x + Math.sin(a) * dist, z = e.pos.z + Math.cos(a) * dist;
      const gy = g.world.groundAt(x, z, e.pos.y + 0.5, 0.3).y;
      if (Math.abs(gy - e.pos.y) > 0.5) continue;
      if (!nav.isWalkable(x, gy, z, 0.6)) continue;
      if (!g.world.cylinderFree(x, z, 0.4, gy + 0.3, gy + 2.2)) continue;
      // the step from the opening to his back must be clear
      _v2.set(e.pos.x - x, 0, e.pos.z - z); const l = _v2.length(); _v2.divideScalar(l);
      let blocked = false;
      for (const h of [0.5, 1.2]) { _v.set(x, gy + h, z); if (g.world.raycast(_v, _v2, Math.max(0.2, l - 0.3), (c) => c.blocksMovement)) { blocked = true; break; } }
      if (blocked) continue;
      // and room behind the plane for the frame
      if (!g.world.cylinderFree(x - _v2.x * 0.5, z - _v2.z * 0.5, 0.3, gy + 0.3, gy + 2.2)) continue;
      return { x, y: gy, z, yaw: Math.atan2(e.pos.x - x, e.pos.z - z), guard: e };
    }
    return null;
  }
  // Open the pair so that stepping through puts you right behind `e`. Returns { ok, reason, near, far }.
  openBehind(e) {
    const g = this.game, t = g.t;
    if (!this.canOpen()) return { ok: false, reason: t('portal.cooldown') };
    const far = this.behindPlacement(e);
    if (!far) return { ok: false, reason: t('portal.noRoomBehind') };
    const near = this.nearPlacement(g.player, { distances: [1.0, 1.3, 1.7] });
    if (!near) return { ok: false, reason: t('portal.noRoomNear') };
    if (Math.hypot(far.x - near.x, far.z - near.z) < 2.2 && Math.abs(far.y - near.y) < 1) return { ok: false, reason: t('portal.tooClose') };
    this.openPair(near, far);
    return { ok: true, near, far };
  }

  canOpen() { return this.game.focus > 0 || this.game.realTime - this.lastOpenReal >= P.reopenDelay; }

  // Open a pair: A in front of the player, B at the requested point. Returns { ok, reason }.
  openFromPlayer(point, opts = {}) {
    const g = this.game, t = g.t;
    if (!this.canOpen()) return { ok: false, reason: t('portal.cooldown') };
    const near = this.nearPlacement(g.player);
    if (!near) return { ok: false, reason: t('portal.noRoomNear') };
    const far = this.farPlacement(point, { hintYaw: Math.atan2(point.x - g.player.pos.x, point.z - g.player.pos.z), ...opts });
    if (!far) return { ok: false, reason: t('portal.noRoomFar') };
    if (Math.hypot(far.x - near.x, far.z - near.z) < 2.5 && Math.abs(far.y - near.y) < 1) return { ok: false, reason: t('portal.tooClose') };
    this.openPair(near, far);
    return { ok: true, far };
  }
  openPair(near, far) {
    const g = this.game;
    if (this.active) this._finishClose();
    this.ends[0].set(near.x, near.y, near.z, near.yaw);
    this.ends[1].set(far.x, far.y, far.z, far.yaw);
    for (const e of this.ends) { e.group.visible = true; e.viewMat.uniforms.uOpen.value = 0; e.frame.scale.set(0.05, 0.05, 1); e.light.intensity = 0; }
    this.state = 'opening'; this.t = 0; this.lastOpen = g.time; this.lastOpenReal = g.realTime; this.openedAt = g.time; this.stats.opened++;
    this._prevPositions = new WeakMap();
    g.audio.portalOpen(this.ends[0].center.clone()); g.audio.portalOpen(this.ends[1].center.clone());
    for (const e of this.ends) { g.fx.portalBurst(e.center.clone(), 1); g.emitNoise(e.pos, P.humRadius, g.player, 'portal'); }
    g.onPortalOpened && g.onPortalOpened(this);
  }
  close() {
    if (!this.active) return;
    const g = this.game;
    this.state = 'closing'; this.t = 0;
    g.audio.portalClose(this.ends[0].center.clone());
    for (const e of this.ends) g.fx.portalBurst(e.center.clone(), 0.5);
    g.onPortalClosed && g.onPortalClosed(this);
  }
  _finishClose() { this.state = 'closed'; for (const e of this.ends) { e.group.visible = false; e.light.intensity = 0; e.visibleNow = false; } }

  // ---- per frame ----
  update(dt, realDt) {
    const g = this.game;
    if (this.state === 'closed') return;
    this.t += realDt;
    if (this.state === 'opening') { const k = Math.min(1, this.t / P.openTime); this._anim(k); if (k >= 1) { this.state = 'open'; } }
    else if (this.state === 'closing') { const k = 1 - Math.min(1, this.t / P.closeTime); this._anim(k); if (k <= 0) { this._finishClose(); return; } }
    else this._anim(1);
    for (const e of this.ends) { e.viewMat.uniforms.uTime.value = g.realTime; e.floorRing.rotation.y += realDt * 0.6; }
    // hum: a quiet loop while open, audible to guards within a few metres
    this.humT -= dt;
    if (this.state === 'open' && this.humT <= 0) { this.humT = 2.5; for (const e of this.ends) g.emitNoise(e.pos, P.humRadius * 0.6, g.player, 'portalHum'); }
    if (this.state === 'open' || (this.state === 'opening' && this.t >= 0.15)) this._traverseAll();
    else for (const c of g.characters) this._remember(c);
  }
  _anim(k) {
    const e = 1 - Math.pow(1 - k, 3);
    for (const end of this.ends) {
      end.viewMat.uniforms.uOpen.value = e;
      end.frame.scale.set(P.width / 2 * Math.max(0.05, e), P.height / 2 * Math.max(0.05, e), 1);
      end.frame2.scale.set((P.width / 2 + 0.06) * Math.max(0.05, e), (P.height / 2 + 0.06) * Math.max(0.05, e), 1);
      end.frameMat.opacity = 0.6 + 0.4 * e; end.light.intensity = 14 * e; end.floorRing.material.opacity = 0.5 * e;
    }
  }
  _remember(c) { let p = this._prevPositions.get(c); if (!p) { p = new THREE.Vector3(); this._prevPositions.set(c, p); } p.copy(c.pos); }

  _traverseAll() {
    const g = this.game;
    for (const c of g.characters) {
      if (c.carriedBy) { this._remember(c); continue; }   // a carried body moves with its carrier
      let prev = this._prevPositions.get(c);
      if (!prev) { this._remember(c); continue; }
      if (c._portalImmune > 0) { c._portalImmune -= 1; this._remember(c); continue; }
      if (this.state !== 'open' && !(c.isPlayer && c.dash)) { this._remember(c); continue; }
      if (prev.distanceToSquared(c.pos) > 2.5 * 2.5) { this._remember(c); continue; }
      if (!c.isPlayer && c.moveIntent.lengthSq() < 0.05) { this._remember(c); continue; }   // shoved, not walking: no crossing
      let crossed = false;
      for (const end of this.ends) {
        const sp = end.side(prev), sc = end.side(c.pos);
        if (sp === sc || (sp > 0) === (sc > 0)) continue;
        if (Math.abs(sp) > 3 || Math.abs(sc) > 3) continue;
        const k = sp / (sp - sc);
        _v.lerpVectors(prev, c.pos, k);
        if (!end.inRect(_v, c.radius * 0.6)) continue;
        if (Math.abs(_v.y - end.pos.y) > 0.9) continue;
        this._teleport(c, end, this.other(end));
        crossed = true; break;
      }
      if (!crossed) prev.copy(c.pos); else this._remember(c);
    }
  }
  _teleport(c, from, to) {
    const g = this.game;
    const dy = this.deltaYaw(from, to);
    this.transformPoint(c.pos, from, to, _v); c.pos.copy(_v);
    // nudge out along the exit normal so the body clears the plane
    const s = to.side(c.pos); c.pos.addScaledVector(to.n, (s >= 0 ? 1 : -1) * 0.45);
    this.transformDir(c.vel, from, to, _v); c.vel.copy(_v);
    this.transformDir(c.moveIntent, from, to, _v); c.moveIntent.copy(_v);
    c.yaw += dy; c.aimYaw += dy;
    if (c.isPlayer) c.onPortalTraversal && c.onPortalTraversal(this, from, to, dy);
    else c.onPortalTraversal && c.onPortalTraversal(this, from, to, dy);
    c._portalImmune = 4;
    if (c.carrying) { const b = c.carrying; this.transformPoint(b.pos, from, to, _v); b.pos.copy(_v); b.yaw += dy; b._portalImmune = 4; this._remember(b); }
    this.stats.traversals++;
    g.fx.portalBurst(c.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0.35);
    g.audio.portalPass(c.pos.clone());
    g.onPortalTraversal && g.onPortalTraversal(c, from, to);
  }

  // Teleport a free-flying object (grenade / thrown body) if its motion segment crosses an end. Returns true if it did.
  traverseSegment(prev, pos, vel) {
    if (!(this.state === 'open' || (this.state === 'opening' && this.t >= 0.15))) return false;
    for (const end of this.ends) {
      const sp = end.side(prev), sc = end.side(pos);
      if ((sp > 0) === (sc > 0) || Math.abs(sp) > 3 || Math.abs(sc) > 3) continue;
      const k = sp / (sp - sc); _v.lerpVectors(prev, pos, k);
      if (!end.inRect(_v, 0.1) || _v.y - end.pos.y > P.height || _v.y < end.pos.y - 0.2) continue;
      const to = this.other(end);
      this.transformPoint(pos, end, to, _v); pos.copy(_v);
      if (vel) { this.transformDir(vel, end, to, _v); vel.copy(_v); }
      return true;
    }
    return false;
  }

  // ---- line of sight through the pair ----
  // Can a point `eye` see `target` through either end? Returns { end, image, hit } or null.
  seeThrough(eye, target, maxDist = 60) {
    if (this.state !== 'open') return null;
    const g = this.game;
    for (const end of this.ends) {
      const other = this.other(end);
      // eye and target must be on opposite "logical" sides: the image of the target through `end`
      this.transformPoint(target, other, end, _v);
      const d = _v.distanceTo(eye); if (d > maxDist) continue;
      _v2.subVectors(_v, eye).normalize();
      const t = end.rayHit(eye, _v2, d);
      if (t < 0) continue;
      // the target must be behind the plane (on the far side of the image) — it is by construction; check the two legs
      _v3.copy(eye).addScaledVector(_v2, t);
      if (!g.world.lineOfSight(eye, _v3)) continue;
      // second leg in the other end's world: from the exit point to the target
      this.transformPoint(_v3, end, other, _v);
      _v.addScaledVector(other.n, other.side(_v) >= 0 ? 0.03 : -0.03);
      if (!g.world.lineOfSight(_v, target)) continue;
      return { end, image: this.transformPoint(target, other, end, new THREE.Vector3()), hit: _v3.clone(), dist: d };
    }
    return null;
  }
  // Ray through the pair for bullets: returns { end, t, exitOrigin, exitDir } or null.
  rayThrough(origin, dir, maxT) {
    if (this.state !== 'open') return null;
    let best = null;
    for (const end of this.ends) {
      const t = end.rayHit(origin, dir, maxT);
      if (t > 0 && (!best || t < best.t)) best = { end, t };
    }
    if (!best) return null;
    const other = this.other(best.end);
    _v.copy(origin).addScaledVector(dir, best.t);
    const exitOrigin = this.transformPoint(_v, best.end, other, new THREE.Vector3());
    const exitDir = this.transformDir(dir, best.end, other, new THREE.Vector3());
    exitOrigin.addScaledVector(exitDir, 0.02);
    return { end: best.end, t: best.t, exitOrigin, exitDir, entry: _v.clone() };
  }
  // Extra noise sources: a sound near one end is heard near the other.
  mirrorNoise(pos, radius) {
    if (this.state !== 'open') return null;
    for (const end of this.ends) {
      const d = end.center.distanceTo(pos);
      if (d < radius) { const other = this.other(end); return { pos: other.center.clone(), radius: Math.max(0, radius - d) }; }
    }
    return null;
  }

  // ---- rendering: the view through each visible end ----
  render(renderer, scene, camera) {
    if (this.state === 'closed') return;
    const g = this.game;
    const size = renderer.getDrawingBufferSize(_size);
    const low = g.settings && g.settings.quality === 'low';
    const scale = g.isTouch ? (low ? 0.28 : 0.38) : (low ? 0.4 : P.viewScale);
    this._viewFrame = (this._viewFrame || 0) + 1;
    const w = Math.max(64, Math.floor(size.x * scale)), h = Math.max(64, Math.floor(size.y * scale));
    _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _frustum.setFromProjectionMatrix(_m);
    for (const end of this.ends) end.viewMat.uniforms.uRes.value.set(size.x, size.y);
    const savedTarget = renderer.getRenderTarget();
    for (const end of this.ends) {
      const other = this.other(end);
      _sphere.set(end.center, 1.6);
      const dist = camera.position.distanceTo(end.center);
      end.visibleNow = this.state !== 'closing' && dist < (g.isTouch ? 32 : P.viewDistance) && _frustum.intersectsSphere(_sphere) && g.mode === 'ground';
      end.viewMat.uniforms.uHasView.value = end.visibleNow && end.target ? 1 : 0;
      if (!end.visibleNow) continue;
      // phones: one view refreshed per frame (each end at 30 Hz), unless only one end is on screen
      if (g.isTouch && this.ends[0].visibleNow && this.ends[1].visibleNow && ((this._viewFrame + end.index) & 1)) { end.viewMat.uniforms.uHasView.value = end.target ? 1 : 0; continue; }
      end.ensureTarget(renderer, w, h);
      // virtual camera = main camera carried through the portal
      const vc = end.camera;
      vc.fov = camera.fov; vc.aspect = camera.aspect; vc.near = camera.near; vc.far = camera.far; vc.updateProjectionMatrix();
      this.transformPoint(camera.position, end, other, vc.position);
      camera.getWorldDirection(_v); this.transformDir(_v, end, other, _v2);
      vc.up.set(0, 1, 0); vc.lookAt(_v3.copy(vc.position).add(_v2));
      vc.updateMatrixWorld(true); vc.matrixWorldInverse.copy(vc.matrixWorld).invert();
      // oblique near plane on the exit end so nothing behind it leaks into the view
      const camSide = other.side(vc.position);
      _v.copy(other.n).multiplyScalar(camSide >= 0 ? -1 : 1);
      _plane.setFromNormalAndCoplanarPoint(_v, other.pos); _plane.applyMatrix4(vc.matrixWorldInverse);
      _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
      const pm = vc.projectionMatrix;
      _qq.x = (Math.sign(_clip.x) + pm.elements[8]) / pm.elements[0];
      _qq.y = (Math.sign(_clip.y) + pm.elements[9]) / pm.elements[5];
      _qq.z = -1.0; _qq.w = (1.0 + pm.elements[10]) / pm.elements[14];
      _clip.multiplyScalar(2.0 / _clip.dot(_qq));
      pm.elements[2] = _clip.x; pm.elements[6] = _clip.y; pm.elements[10] = _clip.z + 1.0 - 0.0002; pm.elements[14] = _clip.w;
      // render without the portal surfaces showing views (avoid recursion) — they show as flat energy
      for (const e2 of this.ends) e2.view.visible = false;
      renderer.setRenderTarget(end.target); renderer.clear();
      renderer.render(scene, vc);
      for (const e2 of this.ends) e2.view.visible = true;
    }
    renderer.setRenderTarget(savedTarget);
  }

  snapshot() { return this.active ? { a: [this.a.pos.x, this.a.pos.y, this.a.pos.z, this.a.yaw], b: [this.b.pos.x, this.b.pos.y, this.b.pos.z, this.b.yaw] } : null; }
  restore(s) { this._finishClose(); this.lastOpenReal = -100; this.lastOpen = -100; if (s) { const [ax, ay, az, ayaw] = s.a, [bx, by, bz, byaw] = s.b; this.openPair({ x: ax, y: ay, z: az, yaw: ayaw }, { x: bx, y: by, z: bz, yaw: byaw }); }  this.lastOpenReal = -100; this.lastOpen = -100; }
  reset() { this._finishClose(); this.stats = { opened: 0, traversals: 0 }; this.lastOpen = -100; this.lastOpenReal = -100; this.showAimGhost(null); }
}
