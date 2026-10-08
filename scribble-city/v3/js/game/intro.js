import * as THREE from 'three';
import { shared } from '../render/materials.js';

// The way in: a real desk under a warm lamp, an open spiral notebook with the city sketched on
// its page, pencils, an eraser and its crumbs, a cup of coffee going cold. Press start and the
// camera dives into the page; the page becomes the sky, and the city draws itself out from where
// you stand: the pen lines run out first, the colour floods in behind them, and the camera comes
// down into the street. (The magic world only; the original title is kept as it was.)

const PAGE_W = 3.2;
const PAGE_H = 4.5;
const GAP = 0.34; // the spiral between the pages

const rnd = (() => {
  let s = 977;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
})();

// material colours are given in sRGB (colour management is off in this game)
const srgb = (r, g, b) => new THREE.Color(r, g, b).convertSRGBToLinear();
const hex = (h) => srgb(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t) => t * t * t;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------------ textures
function woodCanvas() {
  const c = canvas(1024, 1024);
  const g = c.getContext('2d');
  const boards = 4;
  for (let b = 0; b < boards; b++) {
    const y0 = (b / boards) * 1024;
    const tone = 0.9 + rnd() * 0.2;
    g.fillStyle = `rgb(${Math.round(150 * tone)}, ${Math.round(100 * tone)}, ${Math.round(62 * tone)})`;
    g.fillRect(0, y0, 1024, 1024 / boards);
    // grain: long wavy lines along the board
    for (let i = 0; i < 70; i++) {
      const yy = y0 + rnd() * (1024 / boards);
      const amp = 2 + rnd() * 7;
      const fr = 0.004 + rnd() * 0.01;
      const ph = rnd() * 6.28;
      g.strokeStyle = `rgba(${60 + rnd() * 30}, ${35 + rnd() * 20}, ${18 + rnd() * 12}, ${0.08 + rnd() * 0.22})`;
      g.lineWidth = 0.6 + rnd() * 2.2;
      g.beginPath();
      for (let x = -8; x <= 1032; x += 8) {
        const y = yy + Math.sin(x * fr + ph) * amp + Math.sin(x * fr * 3.1 + ph * 2) * amp * 0.3;
        if (x < 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    // a knot or two
    if (rnd() < 0.7) {
      const kx = rnd() * 1024;
      const ky = y0 + 40 + rnd() * (1024 / boards - 80);
      for (let r = 4; r < 46; r += 4 + rnd() * 3) {
        g.strokeStyle = `rgba(70, 40, 20, ${0.35 - r * 0.006})`;
        g.lineWidth = 1.2;
        g.beginPath();
        g.ellipse(kx, ky, r * 2.4, r * 0.75, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
    // the seam between boards
    g.fillStyle = 'rgba(40, 22, 10, 0.55)';
    g.fillRect(0, y0, 1024, 2);
  }
  // fine speckle
  const img = g.getImageData(0, 0, 1024, 1024);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 14;
    img.data[i] += n;
    img.data[i + 1] += n * 0.8;
    img.data[i + 2] += n * 0.6;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function paperBase(g, w, h, holesOn) {
  g.fillStyle = '#f8f5ec';
  g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 7;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  // blue rules, the red margin on the right (a Hebrew notebook)
  g.strokeStyle = 'rgba(120, 160, 215, 0.55)';
  g.lineWidth = 2;
  for (let y = 170; y < h - 20; y += 46) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(220, 90, 90, 0.7)';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(w - 120, 0);
  g.lineTo(w - 120, h);
  g.stroke();
  // the punched holes along the spiral
  if (holesOn) {
    for (let i = 0; i < 22; i++) {
      const y = 50 + (i / 21) * (h - 100);
      const x = holesOn === 'right' ? w - 26 : 26;
      g.fillStyle = 'rgba(60, 40, 30, 0.85)';
      g.beginPath();
      g.ellipse(x, y, 11, 13, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
}

// a ballpoint line: a few overlapping passes with a little wobble
function pen(g, pts, w = 3, col = 'rgba(28, 45, 120, 0.9)', passes = 2) {
  for (let p = 0; p < passes; p++) {
    g.strokeStyle = col;
    g.lineWidth = w * (p ? 0.7 : 1);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = x + (rnd() - 0.5) * 2.4;
      const jy = y + (rnd() - 0.5) * 2.4;
      if (i === 0) g.moveTo(jx, jy);
      else g.lineTo(jx, jy);
    });
    g.stroke();
  }
}

function sketchPage() {
  const w = 1024;
  const h = 1440;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  paperBase(g, w, h, 'right');
  // the title, handwritten
  g.fillStyle = 'rgba(28, 45, 120, 0.92)';
  g.font = '96px "Gveret Levin", "Rubik", sans-serif';
  g.textAlign = 'center';
  g.direction = 'rtl';
  g.fillText('עיר השרבוטים', w / 2 - 40, 150);
  pen(g, [[180, 175], [380, 182], [600, 172], [820, 178]], 4, 'rgba(210, 70, 60, 0.85)', 1);
  // a skyline sketched in blue ballpoint
  const base = 1010;
  let x = 90;
  const towers = [];
  while (x < w - 170) {
    const bw = 60 + rnd() * 90;
    const bh = 140 + rnd() * 380;
    towers.push([x, bw, bh]);
    x += bw + 8 + rnd() * 18;
  }
  for (const [tx, bw, bh] of towers) {
    const top = base - bh;
    pen(g, [[tx, base], [tx, top], [tx + bw, top], [tx + bw, base]], 3.2);
    // windows
    for (let wy = top + 22; wy < base - 30; wy += 34) {
      for (let wx = tx + 12; wx < tx + bw - 18; wx += 24) {
        if (rnd() < 0.82) pen(g, [[wx, wy], [wx + 12, wy], [wx + 12, wy + 18], [wx, wy + 18], [wx, wy]], 1.8, 'rgba(28, 45, 120, 0.75)', 1);
        if (rnd() < 0.25) {
          g.fillStyle = 'rgba(245, 190, 60, 0.75)';
          g.fillRect(wx + 1, wy + 1, 10, 16);
        }
      }
    }
    if (bh > 330 && rnd() < 0.6) pen(g, [[tx + bw / 2, top], [tx + bw / 2, top - 70]], 2.6);
    if (bh < 260 && rnd() < 0.6) {
      // a water tower on the roof
      const cx = tx + bw * 0.5;
      pen(g, [[cx - 20, top], [cx - 16, top - 30], [cx + 16, top - 30], [cx + 20, top]], 2.2);
      pen(g, [[cx - 22, top - 30], [cx - 22, top - 66], [cx, top - 84], [cx + 22, top - 66], [cx + 22, top - 30]], 2.4);
    }
  }
  // street, a taxi, a tree, our hero with a pencil as tall as he is
  pen(g, [[40, base], [w - 140, base]], 3.6);
  pen(g, [[80, base + 70], [w - 150, base + 70]], 2.2);
  for (let dx = 110; dx < w - 180; dx += 70) pen(g, [[dx, base + 36], [dx + 34, base + 36]], 2.4);
  g.fillStyle = 'rgba(250, 200, 50, 0.85)';
  g.fillRect(560, base + 82, 150, 44);
  pen(g, [[555, base + 128], [555, base + 90], [590, base + 66], [680, base + 66], [712, base + 90], [716, base + 128], [555, base + 128]], 3);
  pen(g, [[600, base + 128], [600, base + 140]], 8, 'rgba(28, 28, 40, 0.95)', 1);
  pen(g, [[675, base + 128], [675, base + 140]], 8, 'rgba(28, 28, 40, 0.95)', 1);
  g.fillStyle = 'rgba(120, 180, 100, 0.55)';
  g.beginPath();
  g.arc(250, base - 70, 54, 0, Math.PI * 2);
  g.fill();
  pen(g, [[200, base - 60], [215, base - 120], [260, base - 128], [300, base - 90], [295, base - 40], [250, base - 22], [205, base - 40], [200, base - 60]], 2.6);
  pen(g, [[250, base - 22], [250, base]], 4);
  const hx = 420;
  const hy = base + 60;
  g.strokeStyle = 'rgba(20, 20, 30, 0.95)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(hx, hy - 118, 16, 0, Math.PI * 2);
  g.stroke();
  pen(g, [[hx, hy - 102], [hx, hy - 50]], 4, 'rgba(20, 20, 30, 0.95)', 1);
  pen(g, [[hx, hy - 50], [hx - 16, hy]], 4, 'rgba(20, 20, 30, 0.95)', 1);
  pen(g, [[hx, hy - 50], [hx + 16, hy]], 4, 'rgba(20, 20, 30, 0.95)', 1);
  pen(g, [[hx, hy - 90], [hx + 26, hy - 70]], 4, 'rgba(20, 20, 30, 0.95)', 1);
  pen(g, [[hx, hy - 90], [hx - 24, hy - 72]], 4, 'rgba(20, 20, 30, 0.95)', 1);
  // the pencil
  g.save();
  g.translate(hx + 30, hy - 64);
  g.rotate(-0.45);
  g.fillStyle = 'rgba(245, 200, 40, 0.95)';
  g.fillRect(0, -7, 110, 14);
  g.fillStyle = 'rgba(235, 150, 150, 0.95)';
  g.fillRect(110, -7, 16, 14);
  g.fillStyle = 'rgba(225, 190, 140, 1)';
  g.beginPath();
  g.moveTo(0, -7);
  g.lineTo(-22, 0);
  g.lineTo(0, 7);
  g.fill();
  g.restore();
  // a signature scribble at the bottom
  pen(g, [[160, 1300], [190, 1270], [220, 1310], [250, 1268], [290, 1305], [330, 1280]], 2.4, 'rgba(28, 45, 120, 0.8)', 1);
  return c;
}

function plainPage() {
  const w = 1024;
  const h = 1440;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  paperBase(g, w, h, 'left');
  // a few things planned in pencil: a car, an arrow, a tank
  const grey = 'rgba(80, 80, 90, 0.55)';
  pen(g, [[300, 700], [300, 640], [360, 600], [520, 600], [580, 640], [600, 700], [300, 700]], 3, grey);
  pen(g, [[340, 700], [340, 730]], 6, grey, 1);
  pen(g, [[540, 700], [540, 730]], 6, grey, 1);
  pen(g, [[640, 660], [760, 640], [740, 620], [760, 640], [742, 664]], 3, grey, 1);
  g.save();
  g.translate(520, 1060);
  g.rotate(0.12);
  pen(g, [[-200, 60], [-200, 0], [200, 0], [200, 60], [-200, 60]], 3, grey);
  pen(g, [[-120, 0], [-100, -60], [80, -60], [100, 0]], 3, grey);
  pen(g, [[60, -36], [260, -60]], 5, grey, 1);
  for (let i = -160; i <= 160; i += 64) {
    g.strokeStyle = grey;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(i, 64, 26, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
  return c;
}

function rulerCanvas() {
  const c = canvas(1024, 96);
  const g = c.getContext('2d');
  g.fillStyle = '#d9b67a';
  g.fillRect(0, 0, 1024, 96);
  g.strokeStyle = 'rgba(40, 30, 20, 0.85)';
  for (let i = 0; i <= 300; i++) {
    const x = 12 + i * 3.33;
    const L = i % 10 === 0 ? 34 : i % 5 === 0 ? 24 : 14;
    g.lineWidth = i % 10 === 0 ? 2 : 1.2;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, L);
    g.stroke();
    if (i % 10 === 0) {
      g.fillStyle = 'rgba(40, 30, 20, 0.85)';
      g.font = '18px sans-serif';
      g.fillText(String(i / 10), x - 4, 56);
    }
  }
  return c;
}

// ------------------------------------------------------------------ the desk
export class Intro {
  constructor(game) {
    this.game = game;
    this.phase = 'off'; // off | desk | dive | reveal
    this.t = 0;
    this.built = false;
    this.flash = document.getElementById('intro-flash');
    // a key or a tap while the city draws itself: straight into the game
    const skip = () => {
      if (this.phase === 'reveal' && this.t > 0.3) this.skip();
    };
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
  }

  build() {
    if (this.built) return;
    this.built = true;
    const renderer = this.game.renderer;
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = hex(0x120c08);
    this.cam = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 80);
    this.deskPos = new THREE.Vector3(0.9, 10.2, 7.2);
    this.deskLook = new THREE.Vector3(0.35, 0, 0.55);
    // a soft room for reflections: warm walls, a window, the lamp
    const pm = new THREE.PMREMGenerator(renderer);
    const room = new THREE.Scene();
    const box = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.24, 0.18), side: THREE.BackSide }));
    box.position.y = 6;
    room.add(box);
    const panel = (w, h, col, x, y, z, ry = 0, rx = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, 0);
      room.add(m);
    };
    panel(8, 5, new THREE.Color(3.2, 3.4, 3.8), 0, 7, -14.5);
    panel(3, 3, new THREE.Color(9, 7, 4.5), -6, 11, -3, 0, Math.PI / 2);
    this.envRT = pm.fromScene(room, 0.04);
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = 0.55;
    pm.dispose();
    // lights: the desk lamp (warm, soft shadows) and the cool room
    scene.add(new THREE.HemisphereLight(0xfff1dc, 0x4a3020, 0.45));
    const spot = new THREE.SpotLight(0xffd9a0, 420, 40, 0.62, 0.65, 2);
    spot.position.set(-5.5, 13, -2.5);
    spot.target.position.set(0.6, 0, 0.8);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.02;
    spot.shadow.camera.near = 4;
    spot.shadow.camera.far = 30;
    scene.add(spot, spot.target);
    const fill = new THREE.DirectionalLight(0xbfd4ff, 0.35);
    fill.position.set(6, 8, 7);
    scene.add(fill);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const add = (mesh, cast = true, recv = true) => {
      mesh.castShadow = cast;
      mesh.receiveShadow = recv;
      scene.add(mesh);
      return mesh;
    };
    // the desk
    const wood = tex(woodCanvas());
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
    wood.repeat.set(2.2, 2.2);
    add(new THREE.Mesh(new THREE.PlaneGeometry(40, 28).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.35 })), false, true);
    // the notebook: a dark cover, a stack of pages, the two open pages bending up to the spiral
    const nb = new THREE.Group();
    nb.rotation.y = -0.05;
    scene.add(nb);
    this.nb = nb;
    const cover = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W * 2 + GAP + 0.24, 0.05, PAGE_H + 0.2), new THREE.MeshStandardMaterial({ color: srgb(0.1, 0.16, 0.32), roughness: 0.7 }));
    cover.position.y = 0.025;
    cover.castShadow = true;
    cover.receiveShadow = true;
    nb.add(cover);
    const stackMat = new THREE.MeshStandardMaterial({ color: srgb(0.93, 0.91, 0.86), roughness: 0.9 });
    for (const s of [-1, 1]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W, 0.07, PAGE_H), stackMat);
      st.position.set(s * (PAGE_W / 2 + GAP / 2), 0.085, 0);
      st.castShadow = true;
      st.receiveShadow = true;
      nb.add(st);
    }
    const pageGeo = (side) => {
      const g = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 40, 1).rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        // distance from the spiral edge of this page
        const d = side < 0 ? PAGE_W / 2 - x : x + PAGE_W / 2;
        const lift = 0.16 * Math.exp(-d * 3.2) + 0.02 * Math.sin((d / PAGE_W) * Math.PI);
        p.setY(i, lift);
      }
      g.computeVertexNormals();
      return g;
    };
    this.sketchTex = tex(sketchPage());
    const pageL = new THREE.Mesh(pageGeo(-1), new THREE.MeshStandardMaterial({ map: this.sketchTex, roughness: 0.92 }));
    pageL.position.set(-(PAGE_W / 2 + GAP / 2), 0.125, 0);
    pageL.receiveShadow = true;
    pageL.castShadow = true;
    nb.add(pageL);
    const pageR = new THREE.Mesh(pageGeo(1), new THREE.MeshStandardMaterial({ map: tex(plainPage()), roughness: 0.92 }));
    pageR.position.set(PAGE_W / 2 + GAP / 2, 0.125, 0);
    pageR.receiveShadow = true;
    pageR.castShadow = true;
    nb.add(pageR);
    this.pageL = pageL;
    // the spiral: a coil through each pair of holes
    const coilMat = new THREE.MeshStandardMaterial({ color: srgb(0.85, 0.86, 0.9), metalness: 1, roughness: 0.28 });
    const coilGeo = new THREE.TorusGeometry(0.2, 0.022, 8, 20);
    for (let i = 0; i < 22; i++) {
      const z = -PAGE_H / 2 + 0.2 + (i / 21) * (PAGE_H - 0.4);
      const m = new THREE.Mesh(coilGeo, coilMat);
      m.position.set(0, 0.2, z);
      m.rotation.set(0, 0.18, 0);
      m.castShadow = true;
      nb.add(m);
    }
    // two pencils
    const pencil = (len, colA, x, z, ry, worn = 0) => {
      const grp = new THREE.Group();
      const r = 0.085;
      const paint = new THREE.MeshPhysicalMaterial({ color: colA, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.2 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), paint);
      body.rotation.z = Math.PI / 2;
      grp.add(body);
      const woodC = new THREE.Mesh(new THREE.ConeGeometry(r, 0.32, 6, 1, true), new THREE.MeshStandardMaterial({ color: srgb(0.92, 0.78, 0.6), roughness: 0.8, side: THREE.DoubleSide }));
      woodC.rotation.z = Math.PI / 2;
      woodC.position.x = len / 2 + 0.16;
      grp.add(woodC);
      const lead = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, 0.1, 8), new THREE.MeshStandardMaterial({ color: hex(0x2a2a2e), roughness: 0.35, metalness: 0.3 }));
      lead.rotation.z = -Math.PI / 2;
      lead.position.x = len / 2 + 0.34;
      grp.add(lead);
      const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.04, 0.2, 14), new THREE.MeshStandardMaterial({ color: srgb(0.88, 0.8, 0.55), metalness: 1, roughness: 0.3 }));
      ferrule.rotation.z = Math.PI / 2;
      ferrule.position.x = -len / 2 - 0.1;
      grp.add(ferrule);
      const eraser = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.98, r * 0.98, 0.18 - worn, 14), new THREE.MeshStandardMaterial({ color: srgb(0.95, 0.62, 0.64), roughness: 0.85 }));
      eraser.rotation.z = Math.PI / 2;
      eraser.position.x = -len / 2 - 0.29 + worn / 2;
      grp.add(eraser);
      grp.traverse((o) => {
        o.castShadow = true;
        o.receiveShadow = true;
      });
      grp.position.set(x, r, z);
      grp.rotation.y = ry;
      scene.add(grp);
      return grp;
    };
    pencil(3.0, srgb(0.98, 0.78, 0.12), 5.0, 1.8, 0.35);
    pencil(2.2, srgb(0.2, 0.38, 0.72), 4.6, 2.55, -0.18, 0.06);
    // the eraser and its crumbs
    const eras = add(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.32, 0.5), new THREE.MeshStandardMaterial({ color: srgb(0.97, 0.72, 0.74), roughness: 0.9 })));
    eras.position.set(-4.8, 0.16, 2.4);
    eras.rotation.y = 0.5;
    const sleeve = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.52), new THREE.MeshStandardMaterial({ color: srgb(0.25, 0.42, 0.78), roughness: 0.6 })));
    sleeve.position.copy(eras.position);
    sleeve.position.x += Math.cos(0.5) * 0.25;
    sleeve.position.z -= Math.sin(0.5) * 0.25;
    sleeve.rotation.y = 0.5;
    const crumbMat = new THREE.MeshStandardMaterial({ color: srgb(0.88, 0.7, 0.72), roughness: 1 });
    for (let i = 0; i < 26; i++) {
      const cm = add(new THREE.Mesh(new THREE.SphereGeometry(0.03 + rnd() * 0.035, 5, 4), crumbMat), true, true);
      cm.scale.set(1.6, 0.6, 0.8);
      cm.position.set(-3.6 + (rnd() - 0.5) * 2.2, 0.025, 1.6 + (rnd() - 0.5) * 1.6);
      cm.rotation.y = rnd() * 6;
    }
    // a ruler along the top
    const ruler = add(new THREE.Mesh(new THREE.BoxGeometry(7, 0.06, 0.62), [
      new THREE.MeshStandardMaterial({ color: hex(0xc9a46a), roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: hex(0xc9a46a), roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ map: tex(rulerCanvas()), roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: hex(0xc9a46a), roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: hex(0xc9a46a), roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: hex(0xc9a46a), roughness: 0.6 }),
    ]));
    ruler.position.set(-0.6, 0.03, -3.25);
    ruler.rotation.y = 0.06;
    // a mug of coffee
    const prof = [[0, 0], [0.62, 0], [0.7, 0.04], [0.72, 1.45], [0.66, 1.5], [0.6, 1.45], [0.6, 0.12], [0, 0.12]].map(([x, y]) => new THREE.Vector2(x, y));
    const mugMat = new THREE.MeshPhysicalMaterial({ color: srgb(0.95, 0.94, 0.91), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
    const mug = new THREE.Group();
    const mm = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), mugMat);
    mug.add(mm);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.725, 0.722, 0.22, 40, 1, true), new THREE.MeshPhysicalMaterial({ color: srgb(0.2, 0.35, 0.68), roughness: 0.3, clearcoat: 1 }));
    band.position.y = 1.05;
    mug.add(band);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 12, 24, Math.PI * 1.1), mugMat);
    handle.position.set(0.7, 0.78, 0);
    handle.rotation.z = -Math.PI * 0.55;
    mug.add(handle);
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.6, 32).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: srgb(0.24, 0.13, 0.07), roughness: 0.12, clearcoat: 1 }));
    coffee.position.y = 1.3;
    mug.add(coffee);
    mug.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    mug.position.set(5.6, 0, -1.8);
    mug.rotation.y = -0.7;
    scene.add(mug);
    // a coffee ring on the desk
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: srgb(0.42, 0.27, 0.16), transparent: true, opacity: 0.3, depthWrite: false }));
    ring.position.set(4.4, 0.004, -0.4);
    scene.add(ring);
    // a sharpener and a few shavings
    const sharp = add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.3), new THREE.MeshStandardMaterial({ color: srgb(0.82, 0.84, 0.88), metalness: 1, roughness: 0.32 })));
    sharp.position.set(5.4, 0.14, 3.6);
    sharp.rotation.y = 0.7;
    const shavMat = new THREE.MeshStandardMaterial({ color: srgb(0.92, 0.78, 0.6), roughness: 0.9, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const sv = add(new THREE.Mesh(new THREE.TorusGeometry(0.16 + rnd() * 0.06, 0.02, 4, 16, Math.PI * (1.2 + rnd())), shavMat));
      sv.position.set(4.7 + rnd() * 1.2, 0.05, 3.9 + rnd() * 0.8);
      sv.rotation.set(Math.PI / 2 + (rnd() - 0.5) * 0.6, rnd() * 6, rnd() * 6);
    }
  }

  get active() {
    return this.phase !== 'off';
  }

  // the title screen: the desk under the lamp, breathing slowly
  showDesk() {
    this.build();
    this.phase = 'desk';
    this.t = 0;
    document.getElementById('title').classList.add('desk');
    // the city is not drawn while the desk is on screen: get its shaders ready meanwhile, so
    // the dive does not stall on the first frame of the city
    const game = this.game;
    if (game.renderer.compileAsync) game.renderer.compileAsync(game.scene, game.camera).catch(() => {});
  }

  // start: the camera dives into the page
  dive() {
    if (this.phase === 'dive' || this.phase === 'reveal') return;
    if (this.phase !== 'desk') this.showDesk();
    this.phase = 'dive';
    this.t = 0;
    this.from = this.cam.position.clone();
    this.fromLook = this.lookNow ? this.lookNow.clone() : this.deskLook.clone();
    // the middle of the left page, over the drawing of the city
    const c = new THREE.Vector3();
    this.pageL.getWorldPosition(c);
    this.target = c.add(new THREE.Vector3(0.05, 0.12, -1.05));
    if (this.game.audio.ctx) this.game.audio.hiss(1.2, 0.08, 500, 0.6, 'bandpass', 0, 2400);
  }

  // the page becomes the sky: the city draws itself out from where you stand
  reveal() {
    this.phase = 'reveal';
    this.t = 0;
    const game = this.game;
    const p = game.player.pos;
    this.center = new THREE.Vector2(p.x, p.z);
    shared.uReveal.value.set(p.x, p.z, 0, 1);
    this.camFrom = new THREE.Vector3(p.x - 10, 165, p.z + 34);
    this.qFrom = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(this.camFrom, new THREE.Vector3(p.x, 0, p.z), new THREE.Vector3(0, 0, -1)));
    if (this.flash) {
      this.flash.classList.remove('hidden');
      this.flash.style.opacity = '1';
    }
    if (game.audio.ctx) game.audio.scratchStart();
  }

  finish() {
    if (this.phase === 'off') return;
    this.phase = 'off';
    shared.uReveal.value.set(0, 0, 1e5, 0);
    document.getElementById('title').classList.remove('desk');
    if (this.flash) this.flash.classList.add('hidden');
    const game = this.game;
    if (game.audio.ctx) game.audio.scratchStop();
    if (this.onDone) this.onDone();
  }

  skip() {
    if (this.phase === 'dive' || this.phase === 'reveal') this.finish();
  }

  update(dt) {
    // the opening runs on the wall clock, so it keeps its pace on a slow device too
    const now = performance.now();
    const real = this.last ? Math.min(0.1, (now - this.last) / 1000) : dt;
    this.last = now;
    if (this.phase === 'off') return;
    this.t += this.game.params.has('test') ? dt : real;
    const cam = this.cam;
    if (this.phase === 'desk') {
      // a slow breath of the camera over the desk
      const s = Math.sin(this.t * 0.25);
      cam.position.copy(this.deskPos).add(new THREE.Vector3(s * 0.25, Math.sin(this.t * 0.17) * 0.12, Math.cos(this.t * 0.21) * 0.15));
      this.lookNow = (this.lookNow || new THREE.Vector3()).copy(this.deskLook);
      cam.lookAt(this.lookNow);
      cam.fov = 38;
    } else if (this.phase === 'dive') {
      const k = Math.min(1, this.t / 1.45);
      const e = easeIn(k) * 0.7 + ease(k) * 0.3;
      const above = this.target.clone().add(new THREE.Vector3(0, 1.5, 0.0001));
      cam.position.lerpVectors(this.from, above, e);
      const look = this.fromLook.clone().lerp(this.target, Math.min(1, e * 1.25));
      cam.up.set(0, 1, 0).lerp(new THREE.Vector3(0, 0, -1), e).normalize();
      cam.lookAt(look);
      cam.fov = 38 - 8 * e;
      if (k >= 1) {
        cam.up.set(0, 1, 0);
        this.reveal();
      }
    } else if (this.phase === 'reveal') {
      const T = 5.2;
      const k = Math.min(1, this.t / T);
      shared.uReveal.value.z = 4 + 430 * Math.pow(k, 1.6);
      if (this.flash) this.flash.style.opacity = String(Math.max(0, 1 - this.t / 0.5));
      if (this.game.audio.ctx) this.game.audio.scratch(4 + Math.sin(this.t * 9) * 3);
      if (k >= 1) this.finish();
    }
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
  }

  // during the reveal the game camera comes down from above the page into the street
  applyCamera(camera) {
    if (this.phase !== 'reveal') return;
    const k = Math.min(1, (this.t / 5.2) * 1.04);
    // over you first, then straight down between the roofs, tilting up to the street at the end
    const exz = 1 - Math.pow(1 - k, 3);
    const ey = ease(k);
    const er = Math.pow(ease(k), 1.7);
    const toPos = camera.position.clone();
    const toQ = camera.quaternion.clone();
    camera.position.set(
      this.camFrom.x + (toPos.x - this.camFrom.x) * exz,
      this.camFrom.y + (toPos.y - this.camFrom.y) * ey,
      this.camFrom.z + (toPos.z - this.camFrom.z) * exz,
    );
    camera.quaternion.slerpQuaternions(this.qFrom, toQ, er);
    camera.updateMatrixWorld();
  }

  // the desk and the dive are rendered on their own, in real colour
  render(renderer) {
    const out = renderer.outputColorSpace;
    const tm = renderer.toneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.cam);
    renderer.outputColorSpace = out;
    renderer.toneMapping = tm;
  }

  get drawsDesk() {
    return this.phase === 'desk' || this.phase === 'dive';
  }
}
