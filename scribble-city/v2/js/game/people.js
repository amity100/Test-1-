import * as THREE from 'three';
import { makeSurface, srgb } from '../render/materials.js';
import { clothTexture } from '../world/paint.js';

// People on the boulevard, drawn like everything else: a body of rounded parts under their
// clothes, a walk that swings the arms and bobs the head. Everyone is dressed for an evening
// walk: long skirts and sleeves, a headscarf here, a cap or a hat there.

const matCache = new Map();
function mat(kind, color, partR = 0.08, extra = {}) {
  const key = `${kind}|${color.getHexString()}|${partR}|${JSON.stringify(extra)}`;
  if (!matCache.has(key)) matCache.set(key, makeSurface({ kind, color, partR, ...extra }));
  return matCache.get(key);
}
// a garment: its colour painted on cloth with folds and seams
const clothCache = new Map();
function cloth(color, kind, partR) {
  const key = `${color.getHexString()}|${kind}|${partR}`;
  if (!clothCache.has(key)) {
    const css = '#' + color.getHexString(THREE.SRGBColorSpace);
    clothCache.set(key, makeSurface({ kind: 'cyl', map: clothTexture(css, kind), partR }));
  }
  return clothCache.get(key);
}

const cap = (r, len, segs = 10) => {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, segs);
  g.translate(0, -len / 2, 0); // hangs down from its joint
  return g;
};

// a body part that tapers (thighs, forearms): a lathe from the joint downwards, rounded at
// both ends like a capsule, so two of them meet smoothly at the joint
function limb(r0, r1, len, segs = 10) {
  const pts = [];
  for (let i = 0; i <= 4; i++) {
    const a = (Math.PI / 2) * (1 - i / 4);
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * r0), Math.sin(a) * r0));
  }
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2(r0 + (r1 - r0) * t, -t * len));
  }
  for (let i = 0; i <= 4; i++) {
    const a = (Math.PI / 2) * (i / 4);
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * r1), -len - Math.sin(a) * r1));
  }
  return new THREE.LatheGeometry(pts, segs);
}

function torsoGeo(waist, chest, shoulders, len, hem = 0, boxy = false) {
  // from the hem (y = -hem) up to the neck at y = len; shoulders slope down to the arms
  const pts = boxy
    ? [
        new THREE.Vector2(0.0001, -hem - 0.01),
        new THREE.Vector2(chest * 1.02, -hem),
        new THREE.Vector2(chest * 1.04, -hem + 0.03),
        new THREE.Vector2(chest * 1.02, len * 0.4),
        new THREE.Vector2(chest * 1.03, len * 0.72),
        new THREE.Vector2(shoulders, len * 0.86),
        new THREE.Vector2(shoulders * 0.8, len * 0.95),
        new THREE.Vector2(shoulders * 0.42, len * 1.0),
        new THREE.Vector2(0.0001, len * 1.01),
      ]
    : [
        new THREE.Vector2(0.0001, -hem - 0.01),
        new THREE.Vector2(waist * 1.04, -hem),
        new THREE.Vector2(waist, len * 0.2),
        new THREE.Vector2(chest * 0.96, len * 0.55),
        new THREE.Vector2(chest, len * 0.72),
        new THREE.Vector2(shoulders, len * 0.86),
        new THREE.Vector2(shoulders * 0.78, len * 0.95),
        new THREE.Vector2(shoulders * 0.4, len * 1.0),
        new THREE.Vector2(0.0001, len * 1.01),
      ];
  const g = new THREE.LatheGeometry(pts, 18);
  g.scale(1, 1, 0.66); // flatter front to back
  return g;
}

function skirtGeo(top, bottom, len) {
  const pts = [new THREE.Vector2(top, 0.02), new THREE.Vector2(top * 1.05, -len * 0.15), new THREE.Vector2(bottom * 0.92, -len * 0.75), new THREE.Vector2(bottom, -len)];
  const g = new THREE.LatheGeometry(pts, 16);
  g.scale(1, 1, 0.8);
  return g;
}

const SKIN = [srgb(0.45, 0.3, 0.22), srgb(0.78, 0.58, 0.45), srgb(0.62, 0.42, 0.3), srgb(0.9, 0.72, 0.6), srgb(0.32, 0.22, 0.17)];

export class Person {
  constructor(scene, look) {
    this.look = look;
    this.root = new THREE.Group();
    this.phase = Math.random() * 6.28;
    this.speed = 0;
    this.heading = 0;
    const L = look;
    const h = L.height || 1.78;
    const k = h / 1.78;
    const skin = mat('skin', L.skin, 0.06);
    const shirt = cloth(L.shirt, L.tee ? 'tee' : 'shirt', 0.16);
    const pants = L.cargo ? cloth(L.pants, 'cargo', 0.09) : mat('cyl', L.pants || L.skirt || srgb(0.3, 0.3, 0.35), 0.09);
    const shoes = mat('box', L.shoes || srgb(0.95, 0.95, 0.95));
    const hipY = 0.95 * k;
    this.hips = new THREE.Group();
    this.hips.position.y = hipY;
    this.root.add(this.hips);
    // pelvis (trousers) and the torso (the shirt)
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.17 * k, 12, 8), L.skirt ? mat('cyl', L.skirt, 0.2) : pants);
    pelvis.scale.set(1.05, 0.72, 0.78);
    pelvis.position.y = 0.02;
    this.hips.add(pelvis);
    this.spine = new THREE.Group();
    this.spine.position.y = 0.04;
    this.hips.add(this.spine);
    const br = L.broad || 1;
    const torso = new THREE.Mesh(torsoGeo(0.15 * k, 0.19 * k * br, 0.205 * k * br, 0.54 * k, L.tee ? 0.14 * k : 0.04 * k, !!L.tee), shirt);
    this.spine.add(torso);
    // neck and head
    this.neck = new THREE.Group();
    this.neck.position.y = 0.5 * k;
    this.spine.add(this.neck);
    const neckM = new THREE.Mesh(cap(0.05 * k, 0.13 * k), L.scarf ? mat('cyl', L.scarf, 0.1) : skin);
    neckM.position.y = 0.12 * k;
    this.neck.add(neckM);
    this.head = new THREE.Group();
    this.head.position.y = 0.1 * k;
    this.neck.add(this.head);
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.1 * k, 18, 14), skin);
    headM.scale.set(0.9, 1.14, 1.0);
    headM.position.y = 0.1 * k;
    this.head.add(headM);
    // the jaw and the ears make it a head and not a ball
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.075 * k, 12, 8), skin);
    jaw.scale.set(1, 0.8, 1.05);
    jaw.position.set(0, 0.035 * k, 0.025 * k);
    this.head.add(jaw);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025 * k, 8, 6), skin);
      ear.scale.set(0.5, 1, 0.8);
      ear.position.set(sx * 0.09 * k, 0.1 * k, -0.005 * k);
      this.head.add(ear);
    }
    // a face: two eyes and a nose, very simple (most of the time we see their backs)
    const dark = mat('box', srgb(0.08, 0.06, 0.1));
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012 * k, 6, 4), dark);
      eye.position.set(sx * 0.035 * k, 0.12 * k, 0.095 * k);
      this.head.add(eye);
    }
    if (L.shades) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.17 * k, 0.04 * k, 0.03 * k), mat('paint', srgb(0.06, 0.06, 0.1), 0.05, { gloss: 0.8 }));
      sh.position.set(0, 0.12 * k, 0.1 * k);
      this.head.add(sh);
    }
    if (L.scarf) {
      // a headscarf over the hair and around the neck
      const sc = new THREE.Mesh(new THREE.SphereGeometry(0.122 * k, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), mat('cyl', L.scarf, 0.12));
      sc.scale.set(0.98, 1.15, 1.05);
      sc.position.set(0, 0.11 * k, -0.012 * k);
      sc.rotation.x = -0.35;
      this.head.add(sc);
      const drape = new THREE.Mesh(skirtGeo(0.1 * k, 0.2 * k, 0.24 * k), mat('cyl', L.scarf, 0.15));
      drape.position.y = 0.06 * k;
      this.head.add(drape);
    } else if (L.hair) {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.112 * k, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat('cyl', L.hair, 0.1));
      hair.position.set(0, 0.115 * k, -0.01 * k);
      hair.rotation.x = -0.25;
      this.head.add(hair);
      if (L.longHair) {
        // hair falling down the back to the shoulder blades
        const back = new THREE.Mesh(new THREE.SphereGeometry(0.1 * k, 14, 12), mat('cyl', L.hair, 0.1));
        back.scale.set(1.12, 1.9, 0.55);
        back.position.set(0, 0.0, -0.075 * k);
        this.head.add(back);
      }
    }
    if (L.cap) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.112 * k, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), mat('cyl', L.cap, 0.1));
      c.scale.set(1, 0.95, 1.08);
      c.position.set(0, 0.125 * k, 0);
      this.head.add(c);
      const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * k, 0.1 * k, 0.012 * k, 16, 1, false, -Math.PI * 0.5, Math.PI), mat('box', L.cap));
      visor.scale.set(1, 1, 0.85);
      visor.position.set(0, 0.13 * k, 0.07 * k);
      visor.rotation.x = 0.1;
      this.head.add(visor);
      // the snapback's strap opening at the back
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06 * k, 0.012 * k, 0.012 * k), mat('box', srgb(0.85, 0.85, 0.85)));
      strap.position.set(0, 0.155 * k, -0.11 * k);
      this.head.add(strap);
    }
    if (L.hat) {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * k, 0.2 * k, 0.012 * k, 18), mat('box', L.hat));
      brim.position.y = 0.17 * k;
      this.head.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * k, 0.115 * k, 0.11 * k, 14), mat('cyl', L.hat, 0.1));
      crown.position.y = 0.225 * k;
      this.head.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.117 * k, 0.117 * k, 0.025 * k, 14), mat('cyl', srgb(0.15, 0.12, 0.2), 0.1));
      band.position.y = 0.19 * k;
      this.head.add(band);
    }
    // arms: sleeves of the shirt (long, or a T-shirt's short ones over bare arms)
    this.arms = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(sx * 0.19 * k * br, 0.44 * k, 0);
      this.spine.add(sh);
      // the shoulder: a ball the arm turns in, so the arm grows out of the body
      if (L.tee) {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07 * k * br, 12, 8), shirt);
        sh.add(ball);
      }
      const upper = new THREE.Mesh(limb(0.056 * k, 0.045 * k, 0.29 * k), L.tee ? skin : shirt);
      sh.add(upper);
      if (L.tee) {
        // a loose sleeve down to the elbow
        const sleeve = new THREE.Mesh(limb(0.085 * k, 0.078 * k, 0.21 * k), shirt);
        sleeve.position.y = 0.02 * k;
        sh.add(sleeve);
      }
      const elbow = new THREE.Group();
      elbow.position.y = -0.29 * k;
      sh.add(elbow);
      const fore = new THREE.Mesh(limb(0.045 * k, 0.034 * k, 0.26 * k), L.tee || L.rolled ? skin : shirt);
      elbow.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05 * k, 10, 8), skin);
      hand.scale.set(0.75, 1.3, 0.6);
      hand.position.y = -0.3 * k;
      elbow.add(hand);
      this.arms.push({ sh, elbow, sx });
    }
    // legs (under a long skirt only the shoes show)
    this.legs = [];
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.095 * k, 0, 0);
      this.hips.add(hip);
      const thigh = new THREE.Mesh(limb(L.cargo ? 0.1 * k : 0.082 * k, L.cargo ? 0.082 * k : 0.064 * k, 0.45 * k), L.skirt ? skin : pants);
      thigh.visible = !L.skirt;
      hip.add(thigh);
      if (L.cargo) {
        const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.06 * k, 0.12 * k, 0.1 * k), pants);
        pocket.position.set(sx * 0.085 * k, -0.25 * k, 0.01);
        hip.add(pocket);
      }
      const knee = new THREE.Group();
      knee.position.y = -0.45 * k;
      hip.add(knee);
      const shin = new THREE.Mesh(limb(L.cargo ? 0.082 * k : 0.062 * k, L.cargo ? 0.078 * k : 0.05 * k, 0.43 * k), L.skirt ? skin : pants);
      shin.visible = !L.skirt;
      knee.add(shin);
      const foot = new THREE.Group();
      foot.position.y = -0.44 * k;
      knee.add(foot);
      // a sneaker: a rounded sole and a toe
      const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.052 * k, 0.15 * k, 4, 10).rotateX(Math.PI / 2), shoes);
      shoe.scale.set(1, 0.72, 1);
      shoe.position.set(0, -0.02 * k, 0.05 * k);
      foot.add(shoe);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.105 * k, 0.025 * k, 0.26 * k), mat('box', srgb(0.95, 0.95, 0.93)));
      sole.position.set(0, -0.052 * k, 0.05 * k);
      foot.add(sole);
      this.legs.push({ hip, knee, foot, sx });
    }
    if (L.skirt) {
      // a long skirt from the waist to the ankles, swinging a little as she walks
      this.skirt = new THREE.Mesh(skirtGeo(0.17 * k, 0.3 * k, 0.86 * k), cloth(L.skirt, 'skirt', 0.25));
      this.skirt.position.y = 0.05 * k;
      this.hips.add(this.skirt);
    }
    if (L.bag) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.08 * k, 0.24 * k, 0.3 * k), mat('box', L.bag));
      bag.position.set(-0.24 * k, 0.12 * k, 0);
      this.spine.add(bag);
    }
    if (L.backpack) {
      const bp = new THREE.Mesh(new THREE.BoxGeometry(0.3 * k, 0.38 * k, 0.15 * k), mat('box', L.backpack));
      bp.position.set(0, 0.3 * k, -0.15 * k);
      this.spine.add(bp);
    }
    this.root.traverse((o) => {
      if (o.isMesh) o.userData.person = true;
    });
    scene.add(this.root);
  }

  // speed in m/s drives the stride; 0 stands, breathing
  animate(dt, speed) {
    const run = Math.min(1, Math.max(0, (speed - 2.2) / 2.5));
    this.phase += dt * (speed > 0.05 ? 2.2 + speed * 1.35 : 0);
    const p = this.phase;
    const amp = Math.min(1, speed / 1.4);
    const s = Math.sin(p);
    const c = Math.cos(p);
    for (const lg of this.legs) {
      const ph = lg.sx > 0 ? s : -s;
      const phc = lg.sx > 0 ? c : -c;
      lg.hip.rotation.x = -ph * (0.42 + run * 0.35) * amp;
      lg.knee.rotation.x = Math.max(0, phc) * (0.75 + run * 0.6) * amp + 0.05;
      lg.foot.rotation.x = -lg.knee.rotation.x * 0.3 + ph * 0.15 * amp;
    }
    for (const a of this.arms) {
      const ph = a.sx > 0 ? -s : s;
      a.sh.rotation.x = -ph * (0.35 + run * 0.5) * amp;
      a.sh.rotation.z = a.sx * (0.04 + run * 0.08);
      a.elbow.rotation.x = -(0.25 + run * 0.9) * (0.4 + 0.6 * amp) - Math.max(0, ph) * 0.2 * amp;
    }
    this.hips.position.y = (this.look.height || 1.78) / 1.78 * 0.95 + Math.abs(c) * 0.035 * amp * (1 + run) - run * 0.04;
    this.hips.rotation.y = s * 0.08 * amp;
    this.spine.rotation.y = -s * 0.14 * amp;
    this.spine.rotation.x = 0.04 + run * 0.18;
    this.head.rotation.y = s * 0.05 * amp;
    if (this.skirt) this.skirt.rotation.x = s * 0.05 * amp;
    if (speed < 0.05) {
      // standing: a slow breath
      const b = Math.sin(performance.now() * 0.0015 + this.phase) * 0.01;
      this.spine.rotation.x = 0.02 + b;
    }
  }
}

export const LOOKS = {
  hero: { skin: SKIN[0], shirt: srgb(0.97, 0.97, 0.95), tee: true, pants: srgb(0.34, 0.34, 0.36), cargo: true, shoes: srgb(0.96, 0.96, 0.96), cap: srgb(0.08, 0.08, 0.1), broad: 1.1, height: 1.84 },
  crowd: [
    { skin: SKIN[2], shirt: srgb(0.18, 0.62, 0.62), pants: srgb(0.82, 0.74, 0.58), shoes: srgb(0.95, 0.95, 0.95), hair: srgb(0.08, 0.06, 0.05), height: 1.76 },
    { skin: SKIN[1], shirt: srgb(0.98, 0.55, 0.5), skirt: srgb(0.96, 0.46, 0.44), scarf: srgb(0.96, 0.9, 0.8), shoes: srgb(0.85, 0.7, 0.55), height: 1.66, bag: srgb(0.95, 0.85, 0.55) },
    { skin: SKIN[3], shirt: srgb(0.99, 0.84, 0.3), skirt: srgb(0.16, 0.2, 0.42), hair: srgb(0.3, 0.18, 0.1), longHair: true, shades: true, shoes: srgb(0.2, 0.15, 0.12), height: 1.68 },
    { skin: SKIN[1], shirt: srgb(0.97, 0.95, 0.9), pants: srgb(0.16, 0.18, 0.32), shades: true, hat: srgb(0.92, 0.85, 0.66), shoes: srgb(0.45, 0.3, 0.2), height: 1.8 },
    { skin: SKIN[4], shirt: srgb(0.98, 0.92, 0.62), pants: srgb(0.55, 0.55, 0.58), cap: srgb(0.85, 0.2, 0.25), hair: srgb(0.85, 0.85, 0.85), shoes: srgb(0.25, 0.2, 0.2), height: 1.72 },
    { skin: SKIN[2], shirt: srgb(0.72, 0.6, 0.9), skirt: srgb(0.66, 0.52, 0.86), scarf: srgb(0.55, 0.3, 0.5), shoes: srgb(0.95, 0.95, 0.95), height: 1.64 },
    { skin: SKIN[3], shirt: srgb(0.9, 0.25, 0.3), pants: srgb(0.25, 0.35, 0.6), hair: srgb(0.15, 0.1, 0.05), shoes: srgb(0.95, 0.95, 0.95), height: 1.3, backpack: srgb(0.2, 0.6, 0.9) },
    { skin: SKIN[0], shirt: srgb(0.2, 0.22, 0.3), pants: srgb(0.15, 0.15, 0.18), hair: srgb(0.05, 0.05, 0.05), rolled: true, shoes: srgb(0.95, 0.4, 0.2), height: 1.82, backpack: srgb(0.95, 0.4, 0.3) },
    { skin: SKIN[1], shirt: srgb(0.4, 0.75, 0.55), skirt: srgb(0.95, 0.75, 0.4), hair: srgb(0.2, 0.12, 0.06), longHair: true, shoes: srgb(0.4, 0.25, 0.2), height: 1.7 },
  ],
};
