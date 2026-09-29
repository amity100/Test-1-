import * as THREE from 'three';
import type { Shot } from '../../gameplay/CameraRig';
import type { IntroBeat } from '../../content/introScript';
import { makeShield } from '../../characters/wardrobe/props';
import { texPair } from '../../characters/wardrobe/materials';
import { gibeahHeight, HALL, type PalaceSet } from '../PalaceSet';
import { CastActor, type ActorSpec, type Tier } from './CastActor';
import { CastLights, type LightRig } from './castLights';
import { loadPropKit, makeBow, makeBowl, makeHangingSling, makeJug, makeQuiver, makeRobeCorner, type CastPropKit } from './castProps';
import { buildCastShots, type CastProbe, type CastShots } from './castShots';

/*
 * PalaceCast — King Saul and his court on the set of his house at Gibeah (src/palace), for the chapter-1 intro
 * (src/content/introScript.ts, docs/sources.md 3-5).
 *
 *   const cast = await PalaceCast.create(palace, { quality: engine.quality.name, msaa: engine.quality.msaa });
 *   engine.enforceTextureBudget(cast.root);
 *   cast.setBeat('saul-court');                    // on each intro cue (t = seconds into the beat, optional)
 *   each frame: cast.update(dt, camera, drawingBufferHeight); then palace.update(...) / post.render
 *   cast.focus('saulFace')                         // camera targets; cast.beatShots(beat) ready-made shots
 *   cast.dispose() BEFORE palace.dispose()
 *
 * Staging (all on the set's anchors):
 *   gibeah        guards at the gate (the men at arms), the court already under the tamarisk on the height
 *   saul-court    Saul enthroned on the stone seat under the tamarisk, spear upright in his right hand (22:6),
 *                 servants with jug and bowl and the young armour-bearer (14:1) at his shoulders, two runners /
 *                 guards (22:17) flanking in front, Abner a little apart at his left
 *   saul-portrait Saul standing before the seat among his men — a head and shoulders above all (9:2, 10:23)
 *   warriors      Abner (14:50) walks the line of men at arms 9 m in front of the seat: Benjaminite archers and
 *                 slingers (1 Chr 12:2, Judg 20:16), spearmen with oiled leather shields (2 Sam 1:21); Saul
 *                 watches from his seat, the armour-bearer beside him (14:52)
 *   saul-hall     evening in the hall: the king alone on his seat by the wall (20:25), his spear leaning by him
 *                 (the set's spear), brooding — the weight of 15:28 / 15:35, NOT the later evil spirit (16:14)
 *   hinge         the same; in his left hand the torn corner of a robe — the memory of Gilgal (15:27: by the
 *                 plain sense Saul took hold of the corner of SAMUEL's robe and it tore): undyed dark wool with
 *                 its tzitzit and tekhelet thread
 */

export type CastFocus = 'saul' | 'saulFace' | 'saulHand' | 'spear' | 'abner' | 'robeCorner' | 'saulEyeL' | 'saulEyeR' | 'saulHead';

export interface PalaceCastOptions {
  quality: Tier;
  /** engine.quality.msaa (hair coverage mode); default 4 (0 on low) */
  msaa?: number;
  /** beats that will be played (default: every palace beat); actors only needed by other beats are not built */
  beats?: readonly IntroBeat[];
  onProgress?: (f: number, label: string) => void;
  /** switch the set's time of day with the beat (evening for 'saul-hall' / 'hinge'), default true */
  autoTimeOfDay?: boolean;
}

const PALACE_BEATS: IntroBeat[] = ['gibeah', 'saul-court', 'saul-portrait', 'warriors', 'saul-hall', 'hinge'];

interface Staging {
  actor: CastActor;
  mode: 'stand' | 'sit' | 'hidden';
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

export class PalaceCast {
  /** everything the cast adds to set.scene (actors + character lights) */
  readonly root = new THREE.Group();
  readonly actors: { saul: CastActor; abner?: CastActor; others: CastActor[] };
  readonly lights: CastLights;
  shots!: CastShots;
  beat: IntroBeat | null = null;
  readonly tier: Tier;
  /** seconds into the current beat */
  beatTime = 0;
  /** world wind outdoors (m/s) — the tamarisk's fine foliage moves with the shared wind */
  readonly wind = new THREE.Vector3(1.3, 0, 0.6);
  readonly loadMs: number;
  private readonly set: PalaceSet;
  private readonly kit: CastPropKit;
  private readonly all: CastActor[];
  private autoTod: boolean;
  private readonly robe: { group: THREE.Group; corner: THREE.Object3D };
  private readonly layout: ReturnType<PalaceCast['makeLayout']>;
  private readonly zero = new THREE.Vector3();
  private abnerWalk: { from: THREE.Vector3; to: THREE.Vector3; yaw: number; dur: number } | null = null;

  static async create(set: PalaceSet, opts: PalaceCastOptions): Promise<PalaceCast> {
    const t0 = performance.now();
    const tier = opts.quality;
    const msaa = opts.msaa ?? (tier === 'low' ? 0 : 4);
    const beats = opts.beats ?? PALACE_BEATS;
    const prog = opts.onProgress ?? (() => {});
    const needWarriors = beats.includes('warriors');
    const needCourt = beats.some((b) => b === 'gibeah' || b === 'saul-court' || b === 'saul-portrait' || b === 'warriors');
    // --- who is in the cast (seeds chosen for varied, credible faces; ages / beards vary)
    // the court's hair at the low strand tier everywhere (they are never in a close-up); the king's at the full tier
    const menHair: Tier = 'low';
    const bg = 'base' as const;
    const specs: ActorSpec[] = [];
    if (needCourt || needWarriors) specs.push({ name: 'abner', role: 'abner', seed: 11, beard: 'full', hairQuality: menHair });
    if (needCourt) {
      specs.push({ name: 'bearer', role: 'bearer', seed: 4, beard: 'none', hairQuality: menHair, geometry: bg });
      specs.push({ name: 'servantJug', role: 'servant', seed: 2, beard: 'short', hairQuality: menHair, geometry: bg, hairDensity: 0.7 });
      if (tier !== 'low') specs.push({ name: 'servantBowl', role: 'servant', seed: 7, beard: 'full', hairQuality: menHair, geometry: bg, hairDensity: 0.7 });
      specs.push({ name: 'guardA', role: 'guard', seed: 3, beard: 'short', hairQuality: menHair, geometry: 'base', hairDensity: 0.6 });
      specs.push({ name: 'guardB', role: 'guard', seed: 9, beard: 'full', hairQuality: menHair, geometry: 'base', hairDensity: 0.6 });
    }
    if (needWarriors) {
      specs.push({ name: 'archerA', role: 'archer', seed: 5, beard: 'short', hairQuality: menHair, geometry: 'base', hairDensity: 0.55 });
      specs.push({ name: 'slingerA', role: 'slinger', seed: 8, beard: 'none', hairQuality: menHair, geometry: 'base', hairDensity: 0.55 });
      if (tier !== 'low') specs.push({ name: 'archerB', role: 'archer', seed: 12, beard: 'full', hairQuality: menHair, geometry: 'base', hairDensity: 0.55 });
      if (tier === 'high') specs.push({ name: 'spearman', role: 'guard', seed: 14, beard: 'short', hairQuality: menHair, geometry: 'base', hairDensity: 0.55 });
    }
    const n = specs.length + 1;
    prog(0.02, 'שָׁאוּל');
    const kitP = loadPropKit(tier);
    const saul = await CastActor.create({ name: 'saul', role: 'saul', seed: 1, hairDensity: tier === 'high' ? 0.8 : 1 }, tier, msaa);
    const others: CastActor[] = [];
    let abner: CastActor | undefined;
    for (let i = 0; i < specs.length; i++) {
      prog((i + 1) / n, specs[i].name);
      // yield between actors so a loading screen can repaint
      await new Promise((r) => setTimeout(r, 0));
      const a = await CastActor.create(specs[i], tier, msaa);
      if (specs[i].role === 'abner') abner = a;
      else others.push(a);
    }
    const kit = await kitP;
    const cast = new PalaceCast(set, tier, { saul, abner, others }, kit, opts.autoTimeOfDay ?? true, performance.now() - t0);
    await cast.equip();
    cast.probe(beats);
    cast.setBeat(null);
    prog(1, 'שָׁאוּל');
    return cast;
  }

  private constructor(set: PalaceSet, tier: Tier, actors: { saul: CastActor; abner?: CastActor; others: CastActor[] }, kit: CastPropKit, autoTod: boolean, loadMs: number) {
    this.set = set;
    this.tier = tier;
    this.actors = actors;
    this.kit = kit;
    this.autoTod = autoTod;
    this.loadMs = loadMs;
    this.root.name = 'palace:cast';
    this.all = [actors.saul, ...(actors.abner ? [actors.abner] : []), ...actors.others];
    for (const a of this.all) this.root.add(a.root);
    this.lights = new CastLights(tier);
    this.root.add(this.lights.group);
    set.scene.add(this.root);
    this.robe = makeRobeCorner(kit);
    this.layout = this.makeLayout();
    // Saul: brooding weight, not madness — heavy lids, a faint downward pull of the mouth, brows a little lowered
    const saul = actors.saul;
    saul.human.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !/meil|sash/i.test(m.name)) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = -2;
        mat.polygonOffsetUnits = -24;
      }
    });
    saul.human.rig.lipSeal = 0.55;
    saul.headFollow = 0.55;
    if (saul.groom) saul.groom.shadowFraction = tier === 'high' ? 0.3 : 0.25;
    for (const a of this.all) if (a !== saul && a.groom) {
      a.groom.shadowFraction = 0.2;
      a.groom.lodFullPx = 420;
    }
    // phones: the court casts no shadows (halves its draw calls) and drops the tiny face parts
    if (tier === 'low') {
      for (const a of this.all) {
        if (a === saul) continue;
        a.root.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) o.castShadow = false;
        });
        for (const m of [a.human.tearLines, a.human.teeth]) if (m) m.visible = false;
        a.shadowMeshes.length = 0;
        if (a.groom) a.groom.shadowFraction = 0;
      }
    }
  }

  /** Hand props (jug, bowl, bow, quiver, sling, shields) and the robe corner. */
  private async equip() {
    const kit = this.kit;
    const metal = await texPair('metal', this.tier);
    for (const a of this.all) {
      const s = a.human.sockets;
      if (a.name === 'servantJug') {
        const jug = makeJug(kit, 2);
        s.palmR.add(jug);
        jug.position.set(0.0, -0.02, 0.03);
        jug.rotation.set(0, 0, Math.PI / 2);
        a.props.jug = jug;
        a.setFingers('R', 'grip');
        a.setFingers('L', 'cup');
        a.hideSpear();
      } else if (a.name === 'servantBowl') {
        const bowl = makeBowl(kit, 'figs');
        s.palmL.add(bowl);
        bowl.position.set(-0.03, -0.1, 0.02);
        bowl.rotation.set(0, 0, -Math.PI / 2);
        a.props.bowl = bowl;
        a.setFingers('both', 'cup');
        a.hideSpear();
      } else if (a.role === 'servant') a.hideSpear();
      if (a.role === 'servant') {
        const ring = s.crownAnchor.children.find((c) => c.name === 'headRing');
        if (ring) ring.visible = false;
      }
      if (a.role === 'archer') {
        const bow = makeBow(kit);
        s.handGripL.add(bow);
        bow.rotation.set(0, Math.PI / 2, 0);
        // the bow held upright at the side, the upper limb tilted a little forward
        a.leftAim = new THREE.Vector3(0, 1, 0);
        a.props.bow = bow;
        a.setFingers('L', 'grip');
        const quiver = makeQuiver(kit);
        s.spineUpper.add(quiver);
        quiver.position.set(0.1, 0.08, -0.16);
        quiver.rotation.set(-0.12, 0, -0.35);
        a.props.quiver = quiver;
        a.hideSpear();
        a.setFingers('R', 'relaxed');
      }
      if (a.role === 'slinger') {
        const sling = makeHangingSling(kit, 0.46);
        s.handGripR.add(sling);
        sling.position.set(0, 0.0, 0);
        a.props.sling = sling;
        a.hideSpear();
        a.setFingers('R', 'fist');
        a.setFingers('L', 'cup');
      }
      if (a.role === 'guard' || a.role === 'bearer') {
        const shield = a.outfit.props.shield ?? makeShield(this.tier, kit.leather, metal, kit.wood, { radius: 0.3, oval: 1, boss: 'bronze', seed: 21 });
        s.palmL.add(shield);
        shield.position.set(0.02, 0, 0.08);
        shield.rotation.set(0, -Math.PI / 2, 0);
        a.props.shield = shield;
        a.setFingers('L', 'fist');
      }
      if (a.role === 'bearer') a.hideSpear();
    }
    // the robe corner in the king's left hand (shown in the hall beats)
    const saul = this.actors.saul;
    saul.human.sockets.palmL.add(this.robe.group);
    this.robe.group.position.set(0.018, 0.01, 0.0);
    this.robe.group.visible = false;
    saul.props.robeCorner = this.robe.group;
  }

  /** Marks for every beat (palace-scene coordinates). */
  private makeLayout() {
    const a = this.set.anchors;
    const ts = a.tamariskSeat.pos.clone();
    const yaw = a.tamariskSeat.yaw;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const left = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const P = (f: number, l: number, dy = 0) => {
      const p = ts.clone().addScaledVector(fwd, f).addScaledVector(left, l);
      p.y = gibeahHeight(p.x, p.z) + dy;
      return p;
    };
    const faceTo = (from: THREE.Vector3, to: THREE.Vector3) => Math.atan2(to.x - from.x, to.z - from.z);
    // the seat is a long limestone block: find its front edge and the sitting height there (raycast the rocks),
    // so the king sits on the front of the stone with his shins free in front of it
    const rocks: THREE.Object3D[] = [];
    this.set.vegetation.group.traverse((o) => {
      if (/^palace:rocks/.test(o.name)) rocks.push(o);
    });
    const ray = new THREE.Raycaster();
    let front = 0.55, sitY = ts.y;
    for (let d = 0; d <= 1.6; d += 0.04) {
      const o = ts.clone().addScaledVector(fwd, d).add(new THREE.Vector3(0, 0.6, 0));
      ray.set(o, new THREE.Vector3(0, -1, 0));
      ray.far = 1.2;
      const hit = ray.intersectObjects(rocks, false)[0];
      if (!hit || hit.point.y < ts.y - 0.1) {
        front = d;
        break;
      }
    }
    const sitD = Math.max(0, front - 0.2);
    {
      const o = ts.clone().addScaledVector(fwd, sitD).add(new THREE.Vector3(0, 0.6, 0));
      ray.set(o, new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObjects(rocks, false)[0];
      if (hit && Math.abs(hit.point.y - ts.y) < 0.15) sitY = hit.point.y;
    }
    const sit = ts.clone().addScaledVector(fwd, sitD).setY(sitY);
    const kingFeetY = gibeahHeight(sit.x + fwd.x * 0.55, sit.z + fwd.z * 0.55);
    const line = { f: 9.0, spacing: 1.25 };
    return { ts, yaw, fwd, left, P, faceTo, kingFeetY, line, sit, front };
  }

  // ---------------------------------------------------------------------------------------------- staging
  /**
   * Stage the cast for an intro beat (poses, places, props, looks, expressions, lights, time of day). Beats outside
   * the palace ('judea', 'bethlehem', ...) or null hide the whole cast. `t` = seconds into the beat (performances
   * with motion, e.g. Abner walking the line, start from there).
   */
  setBeat(beat: IntroBeat | null, t = 0) {
    const inPalace = beat !== null && PALACE_BEATS.includes(beat);
    this.beat = inPalace ? beat : null;
    this.beatTime = t;
    // cast.root (and its lights) always stay in the scene: the light count must never change, or three.js
    // recompiles every program of the palace scene; hidden actors and zero-intensity lights instead
    this.lights.apply(null);
    this.abnerWalk = null;
    if (!inPalace || !beat) {
      for (const x of this.all) x.setVisible(false);
      this.robe.group.visible = false;
      return;
    }
    const set = this.set;
    if (this.autoTod && typeof set.setTimeOfDay === 'function') {
      const want = beat === 'saul-hall' || beat === 'hinge' ? 'evening' : 'morning';
      if (set.timeOfDay !== want) set.setTimeOfDay(want);
    }
    const L = this.layout;
    const saul = this.actors.saul;
    const abner = this.actors.abner;
    const by = (n: string) => this.all.find((x) => x.name === n);
    for (const x of this.all) {
      x.setVisible(false);
      x.walkSpeed = 0;
      x.glances.length = 0;
      x.lookTarget = null;
      x.idle = 1;
      for (const k in x.offsets) delete x.offsets[k];
    }
    this.robe.group.visible = false;
    set.anchors.spearRest.object.visible = true;
    const exterior = beat !== 'saul-hall' && beat !== 'hinge';
    const wind = exterior ? this.wind : this.zero;
    for (const x of this.all) x.wind.copy(wind);
    const kingEyes = new THREE.Vector3();
    const saulSeatedLook = L.P(9, 0, 1.6);

    if (exterior) {
      // the king's own spear is in his hand outside: the set's spear (inside the hall) is hidden for consistency
      set.anchors.spearRest.object.visible = false;
      saul.setVisible(true);
      saul.spear!.object.visible = true;
      saul.setFingers('R', 'fist');
      saul.setFingers('L', 'relaxed');
      if (beat === 'saul-portrait') {
        const feet = L.P(L.front + 0.45, -0.05);
        saul.stand(feet, L.yaw + 0.12);
        saul.setPose('kingStandSpear');
        const r = _v.set(Math.sin(L.yaw + 0.12), 0, Math.cos(L.yaw + 0.12));
        const right = _v2.set(-r.z, 0, r.x);
        saul.plantSpear(feet.clone().addScaledVector(right, 0.36).addScaledVector(r, 0.14).add(new THREE.Vector3(0, -0.06, 0)));
        saul.lookTarget = L.P(14, 2.5, 2.1);
      } else {
        saul.sitOn(L.sit, L.kingFeetY, L.yaw);
        saul.setPose('kingSeatedSpear');
        const r = L.fwd, right = _v2.set(-L.left.x, 0, -L.left.z);
        const plant = L.sit.clone().addScaledVector(r, 0.42).addScaledVector(right, 0.4);
        plant.y = gibeahHeight(plant.x, plant.z) - 0.06;
        saul.plantSpear(plant);
        saul.lookTarget = saulSeatedLook;
      }
      this.saulFace(beat === 'saul-portrait' ? 'portrait' : 'court');
      // the court about the king
      const place = (n: string, f: number, l: number, pose: Parameters<CastActor['setPose']>[0], look?: THREE.Vector3, yawOff = 0) => {
        const x = by(n);
        if (!x) return null;
        const p = L.P(f, l);
        x.stand(p, L.faceTo(p, look ?? L.P(5, 0)) + yawOff);
        x.setPose(pose);
        x.setVisible(true);
        x.lookTarget = look ?? null;
        return x;
      };
      const kingHead = L.sit.clone().add(new THREE.Vector3(0, 0.95, 0));
      const plantAt = (x: CastActor | null, f: number, l: number) => {
        if (!x || x.spearMode === 'hidden') return;
        const yawv = x.root.rotation.y;
        const fw = _v.set(Math.sin(yawv), 0, Math.cos(yawv));
        const rt = _v2.set(-fw.z, 0, fw.x);
        const b = x.root.position.clone().addScaledVector(rt, 0.3).addScaledVector(fw, 0.12);
        b.y = gibeahHeight(b.x, b.z) - 0.06;
        x.plantSpear(b);
        void f; void l;
      };
      const courtBeat = beat === 'gibeah' || beat === 'saul-court' || beat === 'saul-portrait' || beat === 'warriors';
      if (courtBeat) {
        const portrait = beat === 'saul-portrait';
        const bearer = place('bearer', portrait ? 0.1 : -0.35, portrait ? -1.05 : -0.95, 'bearer', kingHead.clone().add(new THREE.Vector3(0, 0.2, 0)), 0.9);
        if (bearer) bearer.glances.push(L.P(8, 1, 1.6));
        const sj = place('servantJug', portrait ? 0.5 : 0.25, -1.6, 'servantJug', kingHead, 0.5);
        if (sj) sj.idle = 0.8;
        const sb = place('servantBowl', portrait ? 0.9 : 0.45, 1.45, 'servantBowl', kingHead, -0.5);
        if (sb) sb.idle = 0.8;
        const ga = place('guardA', 2.4, -2.5, 'guardSpearShield', L.P(9, -1.5, 1.6));
        const gb = place('guardB', 2.6, 2.4, 'guardSpearShield', L.P(9, 1.5, 1.6));
        plantAt(ga, 0, 0);
        plantAt(gb, 0, 0);
        if (ga) ga.glances.push(kingHead);
        if (gb) gb.glances.push(kingHead);
        if (abner && beat !== 'warriors') {
          const p = L.P(portrait ? 1.9 : 1.8, 3.4);
          abner.stand(p, L.faceTo(p, L.P(1.2, 0)));
          abner.setPose('abnerStand');
          abner.setVisible(true);
          abner.lookTarget = kingHead.clone().add(new THREE.Vector3(0, 0.1, 0));
          abner.glances.push(L.P(12, 3, 1.6));
          plantAt(abner, 0, 0);
          abner.setFingers('R', 'grip');
          abner.setFingers('L', 'grip');
        }
      }
      // men at arms: at the gate for 'gibeah', in a line before the king for 'warriors'
      const warriors = this.all.filter((x) => x.role === 'archer' || x.role === 'slinger' || x.name === 'spearman');
      if (beat === 'gibeah') {
        const marks = set.anchors.gateGuardMarks;
        warriors.forEach((x, i) => {
          const m = marks[i % marks.length];
          x.stand(m.pos.clone().setY(gibeahHeight(m.pos.x, m.pos.z)), m.yaw);
          x.setPose(x.role === 'archer' ? 'archer' : x.role === 'slinger' ? 'slinger' : 'guardSpearShield');
          x.setVisible(true);
          if (x.leftAim) x.leftAim.set(Math.sin(m.yaw) * 0.25, 1, Math.cos(m.yaw) * 0.25);
          if (x.name === 'spearman') plantAt(x, 0, 0);
        });
      } else if (beat === 'warriors') {
        const nW = warriors.length;
        const lineDir = L.left;
        warriors.forEach((x, i) => {
          const l = (i - (nW - 1) / 2) * L.line.spacing;
          const p = L.P(L.line.f + (i % 2) * 0.15, l);
          x.stand(p, L.faceTo(p, L.ts) + (i % 2 ? 0.05 : -0.04));
          x.setPose(x.role === 'archer' ? 'archer' : x.role === 'slinger' ? 'slinger' : 'guardSpearShield');
          x.setVisible(true);
          x.lookTarget = null;
          if (x.leftAim) x.leftAim.set(Math.sin(x.root.rotation.y) * 0.25, 1, Math.cos(x.root.rotation.y) * 0.25);
          if (x.name === 'spearman') plantAt(x, 0, 0);
        });
        // guards close the line at both ends
        const ga = by('guardA'), gb = by('guardB');
        const endL = -((nW + 1) / 2) * L.line.spacing, endR = ((nW + 1) / 2) * L.line.spacing;
        for (const [g, l] of [[ga, endL], [gb, endR]] as const) {
          if (!g) continue;
          const p = L.P(L.line.f + 0.1, l);
          g.stand(p, L.faceTo(p, L.ts));
          g.setPose('guardSpearShield');
          plantAt(g, 0, 0);
          g.lookTarget = null;
        }
        // Abner walks the line (in front of it, facing along it), looking the men over
        if (abner) {
          const f = L.line.f - 1.1;
          const from = L.P(f, endL - 0.2), to = L.P(f, endR * 0.35);
          const yawW = L.faceTo(from, to);
          this.abnerWalk = { from, to, yaw: yawW, dur: 5 };
          abner.setVisible(true);
          abner.stand(from, yawW);
          abner.setPose('abnerStand');
          abner.walkSpeed = 0.62;
          abner.hideSpear();
          abner.lookTarget = L.P(L.line.f, 0, 1.55);
          abner.setFingers('L', 'grip');
          abner.setFingers('R', 'relaxed');
          this.placeAbner(t);
        }
        saul.lookTarget = abner ? abner.root.position : L.P(L.line.f, 0, 1.6);
      }
      // wind in the hair / cloth, the low morning sun
      this.lightExterior(beat);
    } else {
      // ---- evening in the hall: the king alone on his seat by the wall
      saul.setVisible(true);
      saul.sitOn(set.anchors.thronePos, set.anchors.throneFootstool.y, set.anchors.throneFacing);
      saul.setPose('kingSeatedBrood');
      saul.hideSpear();
      set.anchors.spearRest.object.visible = true;
      saul.setFingers('R', 'relaxed');
      saul.setFingers('L', 'cup');
      this.robe.group.visible = true;
      this.hangRobe();
      saul.lookTarget = this.robeWorld(new THREE.Vector3()).add(new THREE.Vector3(0, 0.1, 0));
      saul.idle = 0.6;
      this.saulFace('hall');
      this.lightHall(beat);
    }
    for (const x of this.all) if (x.visible) x.settle(beat === 'hinge' || beat === 'saul-hall' ? 16 : 12);
    if (!exterior) {
      this.hangRobe();
      saul.lookTarget = this.robeWorld(new THREE.Vector3()).add(new THREE.Vector3(0, 0.12, 0));
      saul.settle(10);
      this.hangRobe();
    }
    void kingEyes;
  }

  /** Saul's face per mood: regal gravity outside, brooding in the hall (never mad: no wide eyes, no snarl). */
  private saulFace(mood: 'court' | 'portrait' | 'hall') {
    const rig = this.actors.saul.human.rig;
    rig.setExpression('neutral', 1);
    for (const k in rig.faceUnits) delete rig.faceUnits[k];
    const U = rig.faceUnits;
    if (mood === 'hall') {
      U.LeftBrowDown = U.RightBrowDown = 0.32;
      U.LeftInnerBrowUp = U.RightInnerBrowUp = 0.34;
      U.LeftUpperLidClosed = U.RightUpperLidClosed = 0.22;
      U.MouthLeftPullDown = U.MouthRightPullDown = 0.22;
      U.lowerLipUp = 0.12;
      U.NasolabialDeepener = 0.15;
    } else {
      // gravity and authority: brows set low and level, steady lids, lips closed and firm
      U.LeftBrowDown = U.RightBrowDown = mood === 'portrait' ? 0.34 : 0.26;
      U.LeftInnerBrowUp = U.RightInnerBrowUp = 0.1;
      U.LeftUpperLidClosed = U.RightUpperLidClosed = 0.1;
      U.LeftLowerLidUp = U.RightLowerLidUp = 0.12;
      U.lowerLipUp = 0.1;
      U.MouthLeftPullDown = U.MouthRightPullDown = 0.1;
      U.NasolabialDeepener = 0.12;
      U.ChinForward = 0.05;
    }
  }

  private placeAbner(t: number) {
    const w = this.abnerWalk, abner = this.actors.abner;
    if (!w || !abner) return;
    const len = w.from.distanceTo(w.to);
    const u = Math.min(1, (t * abner.walkSpeed) / len);
    const p = _v.copy(w.from).lerp(w.to, u);
    p.y = gibeahHeight(p.x, p.z);
    abner.root.position.copy(p);
    if (u >= 1) abner.walkSpeed = 0;
  }

  private robeWorld(out: THREE.Vector3) {
    this.actors.saul.root.updateMatrixWorld(true);
    return this.robe.corner.getWorldPosition(out);
  }

  // ---------------------------------------------------------------------------------------------- lights
  private lightExterior(beat: IntroBeat) {
    const saul = this.actors.saul;
    saul.root.updateMatrixWorld(true);
    const L = this.layout;
    const eyes = beat === 'saul-portrait' ? L.P(0.62, -0.05, 1.83) : L.sit.clone().add(new THREE.Vector3(0, 0.88, 0));
    // key: a soft warm reflector from the sun side, in front-left (the tamarisk canopy shades the seat)
    const sunDir = new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(100)), 0.22, Math.cos(THREE.MathUtils.degToRad(100))).normalize();
    const portrait = beat === 'saul-portrait';
    const keyPos = portrait
      ? eyes.clone().addScaledVector(L.fwd, 1.9).addScaledVector(L.left, -1.1).add(new THREE.Vector3(0, 0.55, 0))
      : eyes.clone().addScaledVector(L.fwd, 2.2).addScaledVector(L.left, 1.4).add(new THREE.Vector3(0, 0.35, 0)).addScaledVector(sunDir, 0.6);
    const rimPos = portrait
      ? eyes.clone().addScaledVector(L.fwd, -1.6).addScaledVector(L.left, 1.3).add(new THREE.Vector3(0, 0.9, 0))
      : eyes.clone().addScaledVector(L.fwd, -2.2).addScaledVector(L.left, -1.6).add(new THREE.Vector3(0, 1.0, 0));
    const r: LightRig = {
      key: { pos: keyPos, target: eyes.clone().add(new THREE.Vector3(0, -0.25, 0)), color: 0xffd8a8, intensity: beat === 'warriors' ? 7 : 10, angle: 0.42, distance: 9 },
      rim: { pos: rimPos, target: eyes.clone().add(new THREE.Vector3(0, -0.3, 0)), color: 0xffc890, intensity: portrait ? 14 : 9, angle: 0.4, distance: 8 },
      fill: { pos: eyes.clone().addScaledVector(L.fwd, 1.3).add(new THREE.Vector3(0, -0.9, 0)), color: 0xffe0bc, intensity: 1.2, distance: 3.5 },
    };
    this.lights.flicker = 0;
    this.lights.apply(r);
  }

  private lightHall(beat: IntroBeat) {
    const a = this.set.anchors;
    const seat = a.thronePos;
    const eyes = seat.clone().add(new THREE.Vector3(0, 0.84, 0.1));
    // the nearest niche lamp at the king's left (+x) is the motivation for the key
    const lampSide = new THREE.Vector3(HALL.cx + 1.25, seat.y + 0.55, seat.z + 1.1);
    const r: LightRig = {
      key: { pos: lampSide, target: beat === 'hinge' ? this.robeWorld(new THREE.Vector3()) : eyes.clone().add(new THREE.Vector3(0, -0.15, 0.05)), color: 0xffa860, intensity: beat === 'hinge' ? 2.4 : 3.2, angle: 0.6, distance: 7 },
      // cool dusk from the west window (the king's right, high)
      rim: { pos: new THREE.Vector3(HALL.x0 + 0.9, HALL.y0 + 3.6, seat.z + 1.6), target: eyes.clone().add(new THREE.Vector3(0, -0.2, 0)), color: 0x8fa6d8, intensity: 2.2, angle: 0.5, distance: 7 },
      fill: { pos: seat.clone().add(new THREE.Vector3(-0.4, -0.2, 1.4)), color: 0xff9a52, intensity: 0.35, distance: 3 },
    };
    this.lights.flicker = 1;
    this.lights.apply(r);
  }

  // ---------------------------------------------------------------------------------------------- per frame
  /** Per frame (before palace.update / post.render). camera + drawing-buffer height drive hair LOD. */
  update(dt: number, camera?: THREE.Camera, viewportHeight?: number) {
    if (!this.beat) return;
    this.beatTime += dt;
    if (this.abnerWalk) this.placeAbner(this.beatTime);
    if (camera) {
      // distance LOD (with 10 % hysteresis): tiny figures on the walls / at the gate in the aerial shots
      for (const a of this.all) {
        if (!a.visible) continue;
        const d = camera.position.distanceTo(a.root.position);
        const cur = a.detailLevel;
        const far1 = cur >= 2 ? 30 : 27, far0 = cur >= 1 ? 75 : 68;
        a.setDetail(a === this.actors.saul ? Math.max(1, d > far1 ? 1 : 2) : d > far0 ? 0 : d > far1 ? 1 : 2);
      }
    }
    for (const a of this.all) a.update(dt, camera, viewportHeight);
    if (this.robe.group.visible) this.hangRobe();
    this.lights.update(dt);
  }

  /** The torn corner hangs from the fingers: keep it upright in world space, facing the king's forward. */
  private hangRobe() {
    const g = this.robe.group;
    const parent = g.parent!;
    parent.updateWorldMatrix(true, false);
    parent.getWorldQuaternion(_q).invert();
    _q2.setFromAxisAngle(_up, this.actors.saul.root.rotation.y + 0.35);
    g.quaternion.copy(_q).multiply(_q2);
    g.updateMatrixWorld(true);
  }

  // ---------------------------------------------------------------------------------------------- camera helpers
  /** World position of a camera target (a new vector unless `out` is given). */
  focus(name: CastFocus, out = new THREE.Vector3()): THREE.Vector3 {
    const saul = this.actors.saul;
    saul.root.updateMatrixWorld(true);
    switch (name) {
      case 'saul': return saul.human.sockets.spineUpper.getWorldPosition(out);
      case 'saulFace': return saul.eyesWorld(out);
      case 'saulEyeL': return saul.human.sockets.eyeL.getWorldPosition(out);
      case 'saulEyeR': return saul.human.sockets.eyeR.getWorldPosition(out);
      case 'saulHead': return saul.human.sockets.headTop.getWorldPosition(out);
      case 'saulHand': return saul.human.sockets.handGripR.getWorldPosition(out);
      case 'spear': {
        if (saul.spearMode === 'hand' && saul.spear?.object.visible) return saul.spear.tip.getWorldPosition(out);
        return out.copy(this.set.anchors.spearRest.tip);
      }
      case 'abner': {
        const ab = this.actors.abner;
        if (!ab) return saul.eyesWorld(out);
        ab.root.updateMatrixWorld(true);
        return ab.eyesWorld(out);
      }
      case 'robeCorner': return this.robeWorld(out);
    }
    return out;
  }

  /** Probe every beat once (settled poses) and build the cast shots. */
  private probe(beats: readonly IntroBeat[]) {
    const L = this.layout;
    const saul = this.actors.saul;
    const v = () => new THREE.Vector3();
    const p: CastProbe = {
      court: { saulEyes: v(), saulHand: v(), fwd: L.fwd.clone(), left: L.left.clone(), seat: L.sit.clone() },
      portrait: { saulEyes: v(), saulChest: v(), fwd: L.fwd.clone(), left: L.left.clone(), spearTip: v() },
      warriors: { lineCentre: L.P(L.line.f, 0), lineDir: L.left.clone(), facing: L.fwd.clone().negate(), abnerStart: v(), abnerEnd: v(), saulEyes: v(), heads: 0 },
      hall: { saulEyes: v(), saulChest: v(), corner: v(), pinch: v(), hand: v(), fwd: new THREE.Vector3(0, 0, 1), left: new THREE.Vector3(1, 0, 0) },
    };
    const tod = this.autoTod;
    this.autoTod = false; // probing must not rebuild the set's sky
    this.setBeat('saul-court');
    this.focus('saulFace', p.court.saulEyes);
    this.focus('saulHand', p.court.saulHand);
    p.warriors.saulEyes.copy(p.court.saulEyes);
    this.setBeat('saul-portrait');
    this.focus('saulFace', p.portrait.saulEyes);
    this.focus('saul', p.portrait.saulChest);
    this.focus('spear', p.portrait.spearTip);
    this.setBeat('hinge');
    this.focus('saulFace', p.hall.saulEyes);
    this.focus('saul', p.hall.saulChest);
    this.focus('robeCorner', p.hall.corner);
    this.robe.group.getWorldPosition(p.hall.pinch);
    saul.human.sockets.palmL.getWorldPosition(p.hall.hand);
    this.autoTod = tod;
    this.shots = buildCastShots(p);
    void beats;
  }

  /** Ready-made shots for a beat, in intro order: the set's shots where they fit, the cast's for the people. */
  beatShots(beat: IntroBeat): Shot[] {
    const s = this.set.shots, c = this.shots;
    switch (beat) {
      case 'gibeah': return [s.establishingExterior, s.tamariskAndWalls];
      case 'saul-court': return [s.tamariskCourt, c.court];
      case 'saul-portrait': return [c.portrait];
      case 'warriors': return [c.warriorsLine, c.warriorsSaul];
      case 'saul-hall': return [s.throneReveal, c.hall];
      case 'hinge': return [c.robeCorner];
      default: return [];
    }
  }

  /** Content totals (upper bounds: hair LOD draws fewer strands at a distance). */
  stats() {
    const per = this.all.map((a) => a.stats());
    const sum = (k: 'bodyTris' | 'outfitTris' | 'hairTris' | 'outfitCalls') => per.reduce((s, x) => s + x[k], 0);
    return { actors: per.length, bodyTris: sum('bodyTris'), outfitTris: sum('outfitTris'), hairTrisFull: sum('hairTris'), outfitCalls: sum('outfitCalls'), loadMs: Math.round(this.loadMs), per };
  }

  dispose() {
    for (const a of this.all) a.dispose();
    this.robe.group.removeFromParent();
    this.robe.group.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh || (c as THREE.LineSegments).isLineSegments) m.geometry.dispose();
    });
    for (const d of this.kit.disposables) d.dispose();
    this.kit.disposables.clear();
    this.lights.dispose();
    this.root.removeFromParent();
    this.set.anchors.spearRest.object.visible = true;
  }
}
