import * as THREE from 'three';
import { makeSurface, canvasTexture, flashLight } from '../render/materials.js';
import { blockAt } from '../world/layout.js';

// (v5, ROADMAP 16.6) An electronics shop's life beyond its people's (game/shoplife.js, the flow
// 'tech'): the city's news on all the televisions of the wall at once - what is really happening:
// the police after you and where you were last seen, a hold-up, the weather, the hour; the demo
// phones' coiled cords stretched from their pucks to the hands that hold them; the seller's selfie
// with a customer, its flash, and the picture up on every screen a moment.
//
// The news is one picture (a canvas) drawn again a few times a second while you are near, the same
// on every screen (one mesh: a quad on each set's glass, world/techstore.js marks tv.0, tv.1 ...).

// (the island's districts, as the news says them - world/layout.js DISTRICT_NAMES are Hebrew)
const PLACE = { gang: 'THE ALLEYS', towers: 'DOWNTOWN', hotels: 'HOTEL ROW', motel: 'THE STAR MOTEL', plaza: 'FOUNTAIN SQUARE', shops: 'THE SHOPPING QUARTER', park: 'PALM PARK', first: 'OCEAN DRIVE', market: 'THE MARKET', west: 'THE WEST END' };
const TEAMS = ['BAY SHARKS', 'HARBOR HAWKS', 'PALM CITY SUNS', 'NORTH END NIBS', 'INKWELL OWLS', 'COAST COMETS'];
const SCREEN_W = 0.94;
const SCREEN_H = 0.545;

// something the news should say: a hold-up, a shoplifter (game/shopper.js, game/events.js); kept a few
// minutes of the game's time
export function newsFlash(game, item) {
  const feed = game.news || (game.news = []);
  feed.unshift({ t: game.time, ...item });
  if (feed.length > 8) feed.length = 8;
}

function where(p) {
  const b = blockAt(p.x, p.z);
  return b ? PLACE[b.type] || 'TOWN' : 'THE MAINLAND';
}

export class TechLife {
  static for(life) {
    // (an electronics shop; ROADMAP 16.7: or any shop with a television marked - the barber's)
    const tv = Object.keys(life.marks || {}).some((k) => k.startsWith('tv.'));
    if (!life.prof || (life.prof.flow !== 'tech' && !tv)) return null;
    return new TechLife(life);
  }

  constructor(life) {
    this.life = life;
    this.game = life.game;
    this.M = life.marks;
    this.tvs = Object.keys(this.M)
      .filter((k) => k.startsWith('tv.'))
      .map((k) => this.M[k]);
    this.screen = null;
    this.drawT = 0;
    this.story = 0;
    this.storyT = 0;
    this.stories = [];
    // the seller's selfie: when it was taken (the screens show it a while)
    this.photo = null;
  }

  // ---------------------------------------------------------------- the wall of televisions
  makeScreen() {
    if (!this.tvs.length) return;
    const phone = !!this.game.touch;
    const cv = document.createElement('canvas');
    cv.width = phone ? 256 : 384;
    cv.height = phone ? 144 : 216;
    const tex = canvasTexture(cv, { mips: false });
    const mat = makeSurface({ kind: 'uv', indoor: true, noShadow: true, map: tex, emMap: tex, emissive: new THREE.Color(1.05, 1.05, 1.05), wash: 0.95, density: 0.2, line: 0.5 });
    // a quad on each set's glass, a hair out from it
    const n = this.tvs.length;
    const P = new Float32Array(n * 12);
    const N = new Float32Array(n * 12);
    const U = new Float32Array(n * 8);
    const X = [];
    this.tvs.forEach((m, k) => {
      const fx = Math.sin(m.yaw);
      const fz = Math.cos(m.yaw);
      const rx = Math.cos(m.yaw);
      const rz = -Math.sin(m.yaw);
      const cx = m.x + fx * 0.002;
      const cz = m.z + fz * 0.002;
      const corners = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
      corners.forEach(([sx, sy, u, v], j) => {
        const q = (k * 4 + j) * 3;
        P[q] = cx + rx * sx * SCREEN_W * 0.5;
        P[q + 1] = m.y + sy * SCREEN_H * 0.5;
        P[q + 2] = cz + rz * sx * SCREEN_W * 0.5;
        N[q] = fx;
        N[q + 1] = 0;
        N[q + 2] = fz;
        U[(k * 4 + j) * 2] = u;
        U[(k * 4 + j) * 2 + 1] = v;
      });
      const b = k * 4;
      X.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    g.setIndex(X);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'tv news';
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.userData.indoor = true;
    this.game.scene.add(mesh);
    this.screen = { cv, tex, mesh, ctx: cv.getContext('2d') };
  }

  // what the news is about now: the police after you first, then what happened, then the rest
  gather() {
    const g = this.game;
    const out = [];
    const pol = g.police;
    if (pol && pol.level > 0) {
      out.push({ kind: 'police', hot: true, head: 'POLICE HUNT SUSPECT', sub: `${'★'.repeat(pol.level)}  LAST SEEN NEAR ${where(g.player.pos)}` });
    }
    for (const n of g.news || []) if (g.time - n.t < 300) out.push(n);
    const w = g.weather && g.weather.cur;
    const hr = g.daynight ? g.daynight.hour : 12;
    const temp = Math.round(19 + 7 * Math.sin(((hr - 9) / 24) * Math.PI * 2) - (w ? w.rain * 5 : 0));
    if (w && w.rain > 0.2) out.push({ kind: 'rain', head: 'RAIN OVER THE BAY', sub: `${temp}°  TAKE AN UMBRELLA` });
    else out.push({ kind: 'sun', head: hr > 19 || hr < 6 ? 'A CLEAR NIGHT IN THE CITY' : 'SUNNY SKIES OVER THE BAY', sub: `${temp}°  LIGHT WIND FROM THE SEA` });
    // (the day's game: the same score all day)
    const day = g.calendar && g.calendar.day !== undefined ? g.calendar.day : Math.floor((g.time || 0) / 1440);
    const a = TEAMS[day % TEAMS.length];
    const b = TEAMS[(day * 3 + 1) % TEAMS.length] === a ? TEAMS[(day + 2) % TEAMS.length] : TEAMS[(day * 3 + 1) % TEAMS.length];
    out.push({ kind: 'sports', head: `${a} WIN AT HOME`, sub: `${a} ${2 + (day % 3)} - ${day % 2} ${b}` });
    if (g.artnight && g.artnight.on) out.push({ kind: 'art', head: 'ART NIGHT IN PAINTWOOD', sub: 'LIVE PAINTERS  MUSIC  FOOD TRUCKS' });
    else out.push({ kind: 'traffic', head: 'SLOW TRAFFIC ON OCEAN DRIVE', sub: 'ROADWORKS UNTIL FRIDAY' });
    out.push({ kind: 'casino', head: 'BIG WIN AT THE PALACE OF INK', sub: 'LUCKY PLAYER TAKES THE JACKPOT' });
    return out;
  }

  drawNews() {
    const D = this.screen;
    const g = D.ctx;
    const W = D.cv.width;
    const H = D.cv.height;
    const k = W / 384;
    const G = this.game;
    const t = G.time;
    // (a new story every 7 seconds; the police at once when they are after you)
    if (t > this.storyT || !this.stories.length) {
      this.stories = this.gather();
      this.story = (this.story + 1) % this.stories.length;
      if (this.stories[0].hot) this.story = this.story % 2 ? 0 : this.story;
      this.storyT = t + 7;
    }
    const st = this.stories[Math.min(this.story, this.stories.length - 1)];
    // the studio: deep blue, a light from above
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, st.hot ? '#3a0f1c' : '#10264a');
    bg.addColorStop(1, st.hot ? '#12060c' : '#060d1c');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 6; i++) g.fillRect((i * 70 + ((t * 8) % 70)) * k, 0, 18 * k, H * 0.7);
    // the picture of the story, on the right
    const px = 196 * k;
    const py = 30 * k;
    const pw = 170 * k;
    const ph = 96 * k;
    this.picture(g, st, px, py, pw, ph, t, k);
    // the anchor at the desk, on the left: talking
    this.anchor(g, 70 * k, 120 * k, k, t);
    // the channel's mark, the hour, LIVE
    g.fillStyle = '#d8232a';
    g.fillRect(8 * k, 8 * k, 46 * k, 18 * k);
    g.fillStyle = '#ffffff';
    g.font = `900 ${13 * k}px Rubik, Arial, sans-serif`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('INK 7', 12 * k, 17.5 * k);
    g.font = `700 ${12 * k}px Rubik, Arial, sans-serif`;
    g.fillText('NEWS', 58 * k, 17.5 * k);
    const hr = G.daynight ? G.daynight.hour : 12;
    const hh = Math.floor(hr);
    const mm = Math.floor((hr - hh) * 60);
    g.textAlign = 'right';
    g.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, W - 10 * k, 17.5 * k);
    if (Math.floor(t * 2) % 2) {
      g.fillStyle = '#ff3b3b';
      g.beginPath();
      g.arc(W - 62 * k, 17.5 * k, 4 * k, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffffff';
    g.font = `700 ${10 * k}px Rubik, Arial, sans-serif`;
    g.fillText('LIVE', W - 46 * k, 17.5 * k);
    // the lower third: the headline, the line under it
    const ly = 138 * k;
    g.fillStyle = st.hot ? '#d8232a' : '#f2f2ee';
    g.fillRect(0, ly, W, 30 * k);
    g.fillStyle = st.hot ? '#ffffff' : '#10182a';
    g.textAlign = 'left';
    g.font = `900 ${17 * k}px Rubik, Arial, sans-serif`;
    g.fillText(fit(g, st.head, W - 20 * k), 10 * k, ly + 15.5 * k);
    g.fillStyle = '#10182a';
    g.fillRect(0, ly + 30 * k, W, 20 * k);
    g.fillStyle = '#ffd23f';
    g.font = `700 ${11 * k}px Rubik, Arial, sans-serif`;
    g.fillText(fit(g, st.sub, W - 20 * k), 10 * k, ly + 40.5 * k);
    // the ticker: the other stories, running by
    const ty = H - 18 * k;
    g.fillStyle = '#d8232a';
    g.fillRect(0, ty, W, 18 * k);
    const line = this.stories.map((s) => s.head).join('   ●   ') + '   ●   ';
    g.font = `700 ${11 * k}px Rubik, Arial, sans-serif`;
    const lw = g.measureText(line).width;
    const x0 = -((t * 46 * k) % lw);
    g.fillStyle = '#ffffff';
    for (let x = x0; x < W; x += lw) g.fillText(line, x, ty + 9.5 * k);
    // the seller's selfie: the picture up on the screens a while
    if (this.photo && t - this.photo.t < 6) this.polaroid(g, W, H, k, t - this.photo.t);
    D.tex.needsUpdate = true;
  }

  // the story's picture, drawn: a police car's lights, a shop's door, the sun, the rain, a ball
  picture(g, st, x, y, w, h, t, k) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    const sky = { police: '#1b2338', rob: '#2a1e2e', steal: '#2a1e2e', sun: '#7cc4f2', rain: '#5d6f84', sports: '#3f8a4a', art: '#2b1d4a', traffic: '#8fb4d6', casino: '#3b1450' }[st.kind] || '#40506a';
    g.fillStyle = sky;
    g.fillRect(x, y, w, h);
    const cx = x + w / 2;
    const cy = y + h / 2;
    g.lineWidth = 2.5 * k;
    g.strokeStyle = '#141418';
    if (st.kind === 'police' || st.kind === 'rob' || st.kind === 'steal') {
      // a street at night: the shop's lit door, a police car before it, its lights going
      g.fillStyle = '#3a3346';
      g.fillRect(x, y + h * 0.15, w, h * 0.55);
      g.fillStyle = '#ffd98a';
      g.fillRect(cx - 18 * k, y + h * 0.32, 36 * k, h * 0.38);
      g.fillStyle = '#26232e';
      g.fillRect(x, y + h * 0.7, w, h * 0.3);
      const on = Math.floor(t * 6) % 2;
      g.fillStyle = '#f4f4f4';
      g.fillRect(cx - 52 * k, y + h * 0.62, 104 * k, 22 * k);
      g.fillStyle = '#16233a';
      g.fillRect(cx - 52 * k, y + h * 0.62, 104 * k, 8 * k);
      g.fillStyle = on ? '#ff3040' : '#5a1620';
      g.fillRect(cx - 14 * k, y + h * 0.55, 12 * k, 6 * k);
      g.fillStyle = on ? '#28307a' : '#4a7cff';
      g.fillRect(cx + 2 * k, y + h * 0.55, 12 * k, 6 * k);
      g.fillStyle = '#141418';
      for (const s of [-34, 34]) {
        g.beginPath();
        g.arc(cx + s * k, y + h * 0.62 + 23 * k, 7 * k, 0, Math.PI * 2);
        g.fill();
      }
      // (their lights on the walls)
      g.fillStyle = on ? 'rgba(255,48,64,0.18)' : 'rgba(74,124,255,0.18)';
      g.fillRect(x, y, w, h);
    } else if (st.kind === 'sun' || st.kind === 'rain') {
      // the bay: the sea, the hills, the sun or the clouds and the rain
      g.fillStyle = st.kind === 'sun' ? '#2f7fbf' : '#46596e';
      g.fillRect(x, y + h * 0.62, w, h * 0.38);
      g.fillStyle = st.kind === 'sun' ? '#4f8f52' : '#3e5446';
      g.beginPath();
      g.moveTo(x, y + h * 0.66);
      g.quadraticCurveTo(x + w * 0.3, y + h * 0.38, x + w * 0.6, y + h * 0.64);
      g.quadraticCurveTo(x + w * 0.8, y + h * 0.5, x + w, y + h * 0.62);
      g.lineTo(x + w, y + h * 0.7);
      g.lineTo(x, y + h * 0.7);
      g.fill();
      if (st.kind === 'sun') {
        g.fillStyle = '#ffd23f';
        g.beginPath();
        g.arc(x + w * 0.74, y + h * 0.3, 14 * k, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#ffd23f';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + t * 0.5;
          g.beginPath();
          g.moveTo(x + w * 0.74 + Math.cos(a) * 18 * k, y + h * 0.3 + Math.sin(a) * 18 * k);
          g.lineTo(x + w * 0.74 + Math.cos(a) * 25 * k, y + h * 0.3 + Math.sin(a) * 25 * k);
          g.stroke();
        }
      } else {
        g.fillStyle = '#c9d2dc';
        for (const [ox, oy, r] of [[0.3, 0.25, 16], [0.42, 0.2, 20], [0.55, 0.27, 15]]) {
          g.beginPath();
          g.arc(x + w * ox, y + h * oy, r * k, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = '#9fd0ff';
        g.lineWidth = 1.5 * k;
        for (let i = 0; i < 16; i++) {
          const rx = x + ((i * 37 + t * 40) % w);
          const ry = y + h * 0.35 + ((i * 23 + t * 90) % (h * 0.6));
          g.beginPath();
          g.moveTo(rx, ry);
          g.lineTo(rx - 3 * k, ry + 8 * k);
          g.stroke();
        }
      }
    } else if (st.kind === 'sports') {
      // the pitch, its lines, the ball flying
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.strokeRect(x + 8 * k, y + 8 * k, w - 16 * k, h - 16 * k);
      g.beginPath();
      g.moveTo(cx, y + 8 * k);
      g.lineTo(cx, y + h - 8 * k);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy, 14 * k, 0, Math.PI * 2);
      g.stroke();
      const bx = cx + Math.sin(t * 1.3) * w * 0.3;
      const by = cy - Math.abs(Math.sin(t * 2.6)) * h * 0.25;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(bx, by, 6 * k, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#141418';
      g.stroke();
    } else if (st.kind === 'casino') {
      g.fillStyle = '#ffd23f';
      g.font = `900 ${30 * k}px Rubik, Arial, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('7 7 7', cx, cy - 6 * k);
      g.font = `700 ${12 * k}px Rubik, Arial, sans-serif`;
      g.fillText('JACKPOT', cx, cy + 22 * k);
      for (let i = 0; i < 10; i++) {
        g.fillStyle = i % 2 ? '#ffd23f' : '#ff6fb1';
        g.fillRect(x + ((i * 41 + t * 30) % w), y + ((i * 17 + t * 50) % h), 4 * k, 4 * k);
      }
    } else if (st.kind === 'art') {
      for (let i = 0; i < 5; i++) {
        g.fillStyle = ['#e2335f', '#ffd23f', '#3a6ad6', '#3fbf7f', '#ff9a3c'][i];
        g.beginPath();
        g.arc(x + w * (0.2 + i * 0.15), cy + Math.sin(t * 2 + i) * 10 * k, 12 * k, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      // a road from above, cars nose to tail
      g.fillStyle = '#4a4a52';
      g.fillRect(x, cy - 16 * k, w, 32 * k);
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) g.fillRect(x + i * 24 * k, cy - 1 * k, 12 * k, 2 * k);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = ['#e2335f', '#3a6ad6', '#ffd23f', '#f4f4f4', '#3fbf7f', '#ff9a3c'][i];
        g.fillRect(x + ((i * 30 + t * 6) % w), cy - 12 * k, 20 * k, 9 * k);
      }
    }
    g.restore();
    g.strokeStyle = '#f2f2ee';
    g.lineWidth = 2 * k;
    g.strokeRect(x, y, w, h);
  }

  // the anchor: head and shoulders at the desk, the mouth going
  anchor(g, x, y, k, t) {
    g.fillStyle = '#1d2c4a';
    g.beginPath();
    g.moveTo(x - 44 * k, y);
    g.quadraticCurveTo(x, y - 46 * k, x + 44 * k, y);
    g.fill();
    g.fillStyle = '#f2f2ee';
    g.beginPath();
    g.moveTo(x - 8 * k, y - 34 * k);
    g.lineTo(x, y - 18 * k);
    g.lineTo(x + 8 * k, y - 34 * k);
    g.fill();
    g.fillStyle = '#c8232a';
    g.fillRect(x - 2.5 * k, y - 30 * k, 5 * k, 14 * k);
    g.fillStyle = '#d9a37e';
    g.beginPath();
    g.ellipse(x, y - 58 * k, 17 * k, 21 * k, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a2418';
    g.beginPath();
    g.ellipse(x, y - 72 * k, 19 * k, 11 * k, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.fillStyle = '#141418';
    for (const s of [-6, 6]) g.fillRect(x + s * k - 1.5 * k, y - 62 * k, 3 * k, Math.floor(t * 0.7) % 7 ? 3 * k : 1 * k);
    const o = Math.abs(Math.sin(t * 9)) * 3;
    g.fillStyle = '#7a2a2a';
    g.fillRect(x - 5 * k, y - 50 * k, 10 * k, (1.5 + o) * k);
    // the desk
    g.fillStyle = '#d6dbe6';
    g.fillRect(x - 60 * k, y - 4 * k, 120 * k, 14 * k);
    g.fillStyle = '#d8232a';
    g.fillRect(x - 60 * k, y + 2 * k, 120 * k, 3 * k);
  }

  // the selfie, as a picture held up on the screens: a white frame, the two of them smiling
  polaroid(g, W, H, k, a) {
    const s = Math.min(1, a * 3);
    const w = 150 * k * s;
    const h = 130 * k * s;
    const x = W / 2 - w / 2;
    const y = H * 0.42 - h / 2;
    g.save();
    g.translate(W / 2, H * 0.42);
    g.rotate(-0.06);
    g.translate(-W / 2, -H * 0.42);
    g.fillStyle = '#fbfaf5';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#9fc8e8';
    g.fillRect(x + 8 * k * s, y + 8 * k * s, w - 16 * k * s, h - 34 * k * s);
    // (two faces, close together, smiling)
    for (const [ox, col, hair] of [[-0.18, '#d9a37e', '#3a2418'], [0.16, '#b07a56', '#141418']]) {
      const fx = x + w * (0.5 + ox);
      const fy = y + h * 0.45;
      g.fillStyle = col;
      g.beginPath();
      g.arc(fx, fy, 20 * k * s, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = hair;
      g.beginPath();
      g.arc(fx, fy - 6 * k * s, 21 * k * s, Math.PI * 1.05, Math.PI * 1.95);
      g.fill();
      g.strokeStyle = '#141418';
      g.lineWidth = 2 * k * s;
      g.beginPath();
      g.arc(fx, fy + 3 * k * s, 9 * k * s, 0.2, Math.PI - 0.2);
      g.stroke();
      g.fillStyle = '#141418';
      for (const e of [-7, 7]) g.fillRect(fx + e * k * s - 1.5 * k * s, fy - 6 * k * s, 3 * k * s, 3 * k * s);
    }
    g.fillStyle = '#10182a';
    g.font = `700 ${10 * k * s}px Rubik, Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('SHOT ON NIB 12  ·  LIVE DEMO', x + w / 2, y + h - 13 * k * s);
    g.restore();
  }

  // ---------------------------------------------------------------- the seller's selfie
  // (game/shoplife.js explain) the flash, the shutter; the picture up on the screens
  snap(x, y, z) {
    this.photo = { t: this.game.time, x, y, z };
    this.life.open.sound('shutter', 0.8, 14);
  }

  // ---------------------------------------------------------------- every frame
  update(dt) {
    const g = this.game;
    const P = g.player.pos;
    const c = this.life.room.center;
    const d = Math.hypot(P.x - c.x, P.z - c.z);
    // (the screens made when you come near, drawn a few times a second while you are)
    if (d > 40) return;
    if (!this.screen) this.makeScreen();
    if (!this.screen) return;
    this.drawT -= dt;
    if (this.drawT <= 0) {
      this.drawT = d > 18 ? 0.5 : g.touch ? 0.25 : 0.12;
      this.drawNews();
    }
    // the selfie's flash: a moment of white light at the phone
    const ph = this.photo;
    if (ph && g.time - ph.t < 0.14) flashLight(ph.x, ph.y, ph.z, 4, [1, 1, 1], 2.4);
  }

  // the demo phones' cords: from the puck on the table to the phone in the hand that holds it,
  // sagging a little, coiled (game/streetlife.js OpenShop.draw)
  draw(fr) {
    if (!fr) return;
    const P = this.game.camera ? this.game.camera.position : this.game.player.pos;
    for (const it of this.life.movers.items) {
      const s = it.slot;
      if (!s || s.what !== 'phone' || !it.at || !it.at.c) continue;
      if (Math.abs(s.x - P.x) > 16 || Math.abs(s.z - P.z) > 16) continue;
      // (the cord comes out of the puck's back, under where the phone stood)
      const ax = s.x;
      const ay = s.y - 0.074;
      const az = s.z;
      const bx = it.pos.x;
      const by = it.pos.y - 0.02;
      const bz = it.pos.z;
      const n = 10;
      let px = ax;
      let py = ay;
      let pz = az;
      const len = Math.hypot(bx - ax, by - ay, bz - az);
      const sag = Math.max(0, 0.12 - len * 0.12);
      for (let i = 1; i <= n; i++) {
        const u = i / n;
        // (a coil: a little wobble round the line, and the sag)
        const w = Math.sin(u * Math.PI * 9) * 0.006;
        const x = ax + (bx - ax) * u + w;
        const y = ay + (by - ay) * u - Math.sin(u * Math.PI) * sag + Math.cos(u * Math.PI * 9) * 0.006;
        const z = az + (bz - az) * u;
        fr.lineXYZ(px, py, pz, x, y, z, [0.12, 0.12, 0.14], 2.2, 7100 + i, 1, 0.002, 0);
        px = x;
        py = y;
        pz = z;
      }
    }
  }

  dispose() {
    const D = this.screen;
    if (D) {
      this.game.scene.remove(D.mesh);
      D.mesh.geometry.dispose();
      D.mesh.material.dispose();
      D.tex.dispose();
      this.screen = null;
    }
  }
}

// a line cut to fit a width, with an ellipsis
function fit(g, text, w) {
  if (g.measureText(text).width <= w) return text;
  let s = text;
  while (s.length > 3 && g.measureText(`${s}…`).width > w) s = s.slice(0, -1);
  return `${s}…`;
}
