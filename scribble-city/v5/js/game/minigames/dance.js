// (v5, ROADMAP 12.2) Ink Beat: the dance floor at the festival, the club and the parties. The band
// in the computer (core/music.js) plays a song, and its own beat - the kick, the snare, the open
// hats, the melody - falls down four lanes as arrows: pressed as each one reaches the line (the
// arrows, or D F J K; on a phone, a tap in its lane), judged against the sound's own clock, not the
// frame's. A held note on the long chords. A row of good ones fills the crowd's hype; full, the
// floor goes wild (double points). The dancer on the stage moves the way you press.

import { Band, makeSong } from '../../core/music.js';
import { INK, PENS, MARKER, box, figure, line, text, cash } from './ink2d.js';

const TRACKS = [
  { name: 'Neon Nights', style: 'disco', n: 41, he: 'דיסקו' },
  { name: 'City Lights', style: 'synth', n: 7, he: 'סינת׳' },
  { name: 'Ink Riot', style: 'rock', n: 23, he: 'רוק' },
];
const DIFFS = [
  { he: 'קל', bars: 16, speed: 360, gap: 4, mult: 1 },
  { he: 'רגיל', bars: 24, speed: 450, gap: 2, mult: 1.6 },
  { he: 'קשה', bars: 32, speed: 540, gap: 1, mult: 2.4 },
];
// the windows, in seconds either side of the beat
const WIN = [
  { t: 0.05, he: 'מושלם!', pts: 300, hype: 0.035, col: PENS.yellow },
  { t: 0.09, he: 'יפה!', pts: 200, hype: 0.022, col: PENS.cyan },
  { t: 0.135, he: 'טוב', pts: 100, hype: 0.01, col: PENS.green },
];
const LANE_COL = [PENS.pink, PENS.cyan, PENS.yellow, PENS.green];
// the keys of each lane: the arrows, or D F J K
const LANE_CODES = [['ArrowLeft', 'KeyD'], ['ArrowDown', 'KeyF'], ['ArrowUp', 'KeyJ'], ['ArrowRight', 'KeyK']];
const STORE = 'scribble-city-v5-dance';

// the song's own beat, as notes: [{ t (s from the start), lane, hold (s), hit }]
export function chartOf(song, diff, bars, rng) {
  const S = song.S;
  const spb = 60 / song.bpm / 4;
  const at = (i) => i * spb + (i % 2 ? S.swing * spb : 0);
  const D = DIFFS[diff];
  const notes = [];
  let lane = 1;
  let last = -99;
  const busy = [0, 0, 0, 0];
  const holdBeats = Math.min(3, S.chordLen || 0);
  for (let bar = 1; bar <= bars; bar++) {
    for (let k = 0; k < 16; k++) {
      const i = bar * 16 + k;
      const kick = S.kick[k] !== '.';
      const snare = S.snare[k] !== '.';
      const hat = S.hat[k];
      let want = k % 4 === 0 && (kick || snare);
      let hint = -1;
      if (diff >= 1) {
        if (k % 4 === 2 && (hat === 'o' || snare || (S.chordHits.includes(k) && bar % 2))) want = true;
        if (S.lead === 'melody' && bar % 4 >= 2 && k % 2 === 0) {
          const d = song.melody[(((bar >> 2) & 1) * 16 + ((bar % 4) - 2) * 8 + k / 2) % 32];
          if (d !== null && d !== undefined) {
            want = true;
            hint = d % 4;
          }
        }
      }
      if (diff >= 2) {
        if (bar % 4 === 3 && k >= 8 && k % 2 === 0) want = true;
        if (k % 2 === 1 && kick && bar % 2) want = true;
      }
      if (!want || i - last < D.gap) continue;
      // the lane: the melody's own step where it has one, else on round the floor, never the same
      // lane twice in a row on the quick ones
      const t = at(i);
      if (hint >= 0 && hint !== lane) lane = hint;
      else lane = (lane + 1 + Math.floor(rng() * 3)) % 4;
      for (let tries = 0; tries < 4 && busy[lane] > t; tries++) lane = (lane + 1) % 4;
      if (busy[lane] > t) continue;
      const n = { t, lane, hold: 0, hit: 0 };
      // a long chord on the bar's first beat: held (not on the easy floor)
      if (diff >= 1 && k === 0 && bar % 2 === 0 && holdBeats >= 1.5 && S.chordHits.includes(0)) n.hold = (holdBeats * 60) / song.bpm - spb;
      notes.push(n);
      busy[lane] = t + n.hold + spb * 0.9;
      last = i;
      // two at once on the phrase's first beat, on the hard floor
      if (diff >= 2 && k === 0 && bar % 4 === 0) {
        const l2 = (lane + 2) % 4;
        if (busy[l2] <= t) {
          notes.push({ t, lane: l2, hold: 0, hit: 0 });
          busy[l2] = t + spb;
        }
      }
    }
  }
  return notes;
}

export class DanceGame {
  // o: { venue (the name on the screen, in the world's English), style, tips (the crowd pays),
  //      pick (choose the song and the floor first, default true) }
  constructor(o = {}) {
    this.o = o;
    this.title = 'Ink Beat · ריקוד';
    this.help = 'חצים (או D F J K) כשהחץ מגיע לקו · חץ ארוך: להחזיק · Enter להתחיל · Esc לצאת';
    this.helpTouch = 'נוגעים בנתיב כשהחץ מגיע לקו';
    this.pad = 'tap';
  }

  start(api, o = {}) {
    this.api = api;
    this.o = { ...this.o, ...o };
    this.touch = !!api.game.touch;
    // (ROADMAP 12.6: on a screen in the world - the floor's own dancer is you, not one drawn)
    this.inWorld = !!api.world;
    this.scene = 'menu';
    this.track = Math.max(0, TRACKS.findIndex((t) => t.style === this.o.style));
    this.diff = 1;
    this.row = 0;
    this.best = {};
    try {
      this.best = JSON.parse(localStorage.getItem(STORE) || '{}') || {};
    } catch (e) {
      this.best = {};
    }
    this.ctx = api.audio && api.audio.ctx;
    this.t = 0;
    this.layout();
    if (this.o.pick === false) this.begin();
  }

  layout() {
    // (a phone: the lanes wide, for thumbs; the dancer smaller beside them)
    const L = this.inWorld ? { x0: 330, w: 110, dancer: 0, feet: 0, size: 0 } : this.touch ? { x0: 330, w: 150, dancer: 165, feet: 548, size: 100 } : { x0: 560, w: 88, dancer: 380, feet: 500, size: 150 };
    this.lx = (l) => L.x0 + L.w * (l + 0.5);
    this.lw = L.w;
    this.L = L;
    this.hitY = 515;
  }

  now() {
    const c = this.ctx;
    if (c && c.state === 'running') return c.currentTime - (c.outputLatency || c.baseLatency || 0);
    return performance.now() / 1000;
  }

  // the moment a key went down, on the sound's clock
  when(at) {
    return at ? this.now() - (performance.now() - at) / 1000 : this.now();
  }

  begin() {
    const tr = TRACKS[this.track];
    const D = DIFFS[this.diff];
    this.song = makeSong(tr.style, tr.n + this.diff * 3);
    this.spb = 60 / this.song.bpm / 4;
    this.notes = chartOf(this.song, this.diff, D.bars, this.api.rng);
    this.next = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hype = 0.25;
    this.fever = 0;
    this.counts = [0, 0, 0, 0];
    this.pops = [];
    this.flash = [0, 0, 0, 0];
    this.holding = [null, null, null, null];
    this.pose = null;
    this.poseT = 0;
    this.confetti = [];
    const c = this.ctx;
    // the song starts after a bar of counting in
    this.t0 = this.now() + this.spb * 16 + 0.3;
    this.end = this.t0 + (D.bars + 1) * 16 * this.spb + 0.6;
    if (c && c.state === 'running') {
      this.out = c.createGain();
      this.out.gain.value = 0.95;
      this.out.connect(this.api.audio.musicBus || this.api.audio.fx);
      this.band = new Band(c, this.out, this.api.audio.noise);
      this.band.play(this.song, this.t0 + (c.outputLatency || c.baseLatency || 0), 0);
    }
    this.scene = 'play';
    this.api.status(`${tr.name} · ${D.he}`);
  }

  // (left with Esc: what was danced counts, if the song was danced to the end)
  result() {
    return this.scene === 'results' ? this.res : null;
  }

  stop() {
    if (this.inWorld) this.api.game.player.fig.armsUp = 0;
    if (this.band) this.band.stop();
    if (this.out) {
      const c = this.ctx;
      this.out.gain.setTargetAtTime(0, c.currentTime, 0.05);
      const o = this.out;
      setTimeout(() => o.disconnect(), 400);
    }
    this.band = null;
    this.out = null;
  }

  update(dt, inp) {
    this.t += dt;
    if (this.scene === 'menu') return this.menu(inp);
    if (this.scene === 'results') return this.resultsInput(inp);
    const now = this.now();
    if (this.band) this.band.update(now + (this.ctx.outputLatency || this.ctx.baseLatency || 0));
    // the presses: keys (and their moments), taps in a lane
    const presses = [];
    for (let l = 0; l < 4; l++) for (const c of LANE_CODES[l]) if (inp.codes.has(c)) presses.push([l, this.when(inp.codes.get(c))]);
    for (const [x, y, at] of inp.taps) {
      if (y < 160) continue;
      const l = Math.floor((x - this.L.x0) / this.lw);
      if (l >= 0 && l < 4) presses.push([l, this.when(at)]);
    }
    for (const [l, t] of presses) this.press(l, t);
    // held notes: let go too soon, or held to the end
    for (let l = 0; l < 4; l++) {
      const h = this.holding[l];
      if (!h) continue;
      const down = LANE_CODES[l].some((c) => inp.down.has(c)) || (this.touch && inp.drag && inp.drag.down);
      if (now >= this.t0 + h.t + h.hold) {
        this.holding[l] = null;
        h.done = true;
        this.gain(0, true);
      } else if (!down) {
        this.holding[l] = null;
        h.done = true;
        h.broke = true;
        this.combo = 0;
      }
    }
    // the misses: past the line and not pressed
    for (const n of this.notes) {
      if (n.hit || n.t + this.t0 > now - WIN[2].t) continue;
      if (n.t + this.t0 < now - WIN[2].t) {
        n.hit = -1;
        this.miss(n.lane);
      }
    }
    if (this.fever > 0) this.fever = Math.max(0, this.fever - dt);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 0.6);
    for (let l = 0; l < 4; l++) this.flash[l] = Math.max(0, this.flash[l] - dt * 5);
    this.poseT = Math.max(0, this.poseT - dt);
    for (const c of this.confetti) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 260 * dt;
      c.a += c.va * dt;
    }
    this.confetti = this.confetti.filter((c) => c.y < 640);
    // (counting in: a click on each beat of the bar before the song)
    const left = this.t0 - now;
    if (left > 0) {
      const b = Math.ceil(left / (this.spb * 4));
      if (b !== this.lastCount) {
        this.lastCount = b;
        if (b <= 4) this.api.audio.play('click', 0.5);
      }
    }
    if (now > this.end) this.finish();
  }

  press(l, t) {
    this.flash[l] = 1;
    // the nearest note in this lane not yet taken
    let best = null;
    let bd = Infinity;
    for (const n of this.notes) {
      if (n.hit || n.lane !== l) continue;
      const d = Math.abs(n.t + this.t0 - t);
      if (d < bd) {
        bd = d;
        best = n;
      }
      if (n.t + this.t0 > t + 0.3) break;
    }
    if (!best || bd > WIN[2].t) return;
    const w = WIN.findIndex((x) => bd <= x.t);
    best.hit = 1 + w;
    this.counts[w]++;
    this.gain(w, false);
    if (best.hold > 0) this.holding[l] = best;
    this.pose = l;
    this.poseT = 0.32;
    this.pops.push({ he: WIN[w].he, col: WIN[w].col, t: 0, x: this.lx(l) });
  }

  gain(w, holdEnd) {
    const W = WIN[w];
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const mult = Math.min(4, 1 + Math.floor(this.combo / 10) * 0.5) * (this.fever > 0 ? 2 : 1);
    this.score += Math.round((holdEnd ? 150 : W.pts) * mult);
    this.hype = Math.min(1, this.hype + (holdEnd ? 0.02 : W.hype));
    if (this.hype >= 1 && this.fever <= 0) {
      this.fever = 8;
      this.hype = 0.55;
      this.api.audio.play('cheer', 0.7);
      for (let i = 0; i < 70; i++) this.confetti.push({ x: 500 + (Math.random() - 0.5) * 900, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 120, vy: 40 + Math.random() * 120, a: Math.random() * 6, va: (Math.random() - 0.5) * 8, c: LANE_COL[i % 4] });
    }
    if (this.combo % 50 === 0) this.api.audio.play('cheer', 0.5);
  }

  miss(l) {
    this.counts[3]++;
    this.combo = 0;
    this.hype = Math.max(0, this.hype - 0.06);
    this.pose = -1;
    this.poseT = 0.4;
    this.pops.push({ he: 'פספוס', col: '#9a9aa8', t: 0, x: this.lx(l) });
  }

  finish() {
    this.stop();
    const total = this.notes.length || 1;
    const acc = (this.counts[0] + this.counts[1] * 0.75 + this.counts[2] * 0.4) / total;
    const grade = acc >= 0.95 ? 'S' : acc >= 0.88 ? 'A' : acc >= 0.78 ? 'B' : acc >= 0.65 ? 'C' : 'D';
    const D = DIFFS[this.diff];
    // (the crowd's tips: a few dollars a good song, more on the harder floors - the city's prices)
    const tips = this.o.tips ? Math.round(Math.min(90, (this.score / 1000) * 0.6 * D.mult) * (grade === 'S' ? 1.5 : grade === 'D' ? 0.3 : 1)) : 0;
    const key = TRACKS[this.track].style + this.diff;
    const best = this.best[key] || 0;
    if (this.score > best) {
      this.best[key] = this.score;
      try {
        localStorage.setItem(STORE, JSON.stringify(this.best));
      } catch (e) {
        // (no room: the record is only for now)
      }
    }
    this.res = { score: this.score, grade, acc, combo: this.maxCombo, tips, record: this.score > best, diff: this.diff, track: this.track };
    this.scene = 'results';
    this.t = 0;
    if (tips && this.api.money) this.api.money.earn(tips, `טיפים: ${this.o.venue || 'Ink Beat'}`);
    this.api.audio.play(grade === 'D' ? 'buzzer' : 'cheer', 0.6);
  }

  menu(inp) {
    if (inp.hit.has('up')) this.row = 0;
    if (inp.hit.has('down')) this.row = 1;
    const dx = (inp.hit.has('right') ? 1 : 0) - (inp.hit.has('left') ? 1 : 0);
    if (dx && this.row === 0) this.track = (this.track + TRACKS.length - dx) % TRACKS.length;
    if (dx && this.row === 1) this.diff = Math.max(0, Math.min(2, this.diff - dx));
    for (const [x, y] of inp.taps) {
      if (y > 170 && y < 330) {
        const i = Math.floor((x - 110) / 270);
        if (i >= 0 && i < 3) this.track = 2 - i;
      } else if (y > 360 && y < 440) {
        const i = Math.floor((x - 230) / 180);
        if (i >= 0 && i < 3) this.diff = 2 - i;
      } else if (y > 470 && y < 560 && x > 380 && x < 620) {
        this.begin();
        return;
      }
    }
    if (inp.hit.has('enter') || inp.hit.has('a')) this.begin();
  }

  resultsInput(inp) {
    if (this.t < 0.8) return;
    if (inp.hit.has('enter') || inp.hit.has('a')) {
      this.scene = 'menu';
      return;
    }
    for (const [x, y] of inp.taps) {
      if (y > 470 && y < 560) {
        if (x < 500) this.api.finish(this.res);
        else this.scene = 'menu';
        return;
      }
    }
    if (inp.hit.has('b')) this.api.finish(this.res);
  }

  // ------------------------------------------------------------------ drawing
  draw(g, W, H) {
    this.stage(g, W, H);
    if (this.scene === 'menu') return this.drawMenu(g, W, H);
    if (this.scene === 'results') return this.drawResults(g, W, H);
    this.drawLanes(g);
    this.drawHud(g, W);
  }

  // the stage at night: its screen, the lights sweeping to the beat, the crowd's heads and hands
  stage(g, W, H) {
    const now = this.now();
    const beat = this.spb && this.t0 ? (now - this.t0) / (this.spb * 4) : this.t * 2;
    const pulse = Math.pow(1 - (beat - Math.floor(beat)), 3);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#120c2c');
    sky.addColorStop(0.6, '#2a1650');
    sky.addColorStop(1, '#3a1d4a');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    // the lights: beams from the truss, sweeping, brighter on the beat
    const hype = this.scene === 'play' ? this.hype : 0.4;
    for (let i = 0; i < 6; i++) {
      const x = 90 + i * 165;
      const a = Math.sin(this.t * (0.6 + i * 0.13) + i * 1.7) * 0.5;
      const col = LANE_COL[i % 4];
      g.save();
      g.globalAlpha = 0.07 + 0.12 * pulse * (0.4 + hype) + (this.fever > 0 ? 0.08 : 0);
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x, 40);
      g.lineTo(x + Math.sin(a) * 700 - 90, H);
      g.lineTo(x + Math.sin(a) * 700 + 90, H);
      g.closePath();
      g.fill();
      g.restore();
    }
    // the truss and the screen with the event's name (the world's English)
    line(g, 20, 40, W - 20, 40, { w: 5, color: '#0a0818', seed: 3 });
    for (let x = 40; x < W; x += 60) line(g, x, 34, x + 30, 46, { w: 2, color: '#0a0818', seed: x });
    box(g, W / 2 - 170, 52, 340, 62, { fill: '#0a0818', color: '#000', r: 6, seed: 9 });
    text(g, this.o.venue || 'INK FEST', W / 2, 84, { font: MARKER, size: 34, color: LANE_COL[Math.floor(beat) % 4] || PENS.pink, outline: '#0a0818' });
    // the crowd: heads and hands, jumping on the beat (higher with the hype) - not on a screen in
    // the world, where the crowd is the one round you
    const jump = (0.3 + hype) * 14 * pulse + (this.fever > 0 ? 8 : 0);
    for (let i = 0; i < (this.inWorld ? 0 : 26); i++) {
      const x = i * 40 + (i % 2) * 14 - 10;
      const y = H - 16 - (i % 3) * 7 - jump * (0.6 + ((i * 7) % 5) / 8);
      g.fillStyle = '#07050f';
      g.beginPath();
      g.arc(x, y, 15, 0, Math.PI * 2);
      g.fill();
      g.fillRect(x - 17, y + 10, 34, 40);
      if ((i + Math.floor(beat)) % 3 === 0 || this.fever > 0) {
        g.strokeStyle = '#07050f';
        g.lineWidth = 7;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x - 12, y + 12);
        g.lineTo(x - 22, y - 26 - jump);
        g.moveTo(x + 12, y + 12);
        g.lineTo(x + 20, y - 24 - jump);
        g.stroke();
      }
    }
    for (const c of this.confetti || []) {
      g.save();
      g.translate(c.x, c.y);
      g.rotate(c.a);
      g.fillStyle = c.c;
      g.fillRect(-5, -3, 10, 6);
      g.restore();
    }
  }

  drawLanes(g) {
    const now = this.now();
    const L = this.L;
    // the lanes, their line, the arrows waiting on it
    g.save();
    g.globalAlpha = 0.5;
    g.fillStyle = '#0a0818';
    g.fillRect(L.x0, 125, L.w * 4, 470);
    g.restore();
    for (let l = 0; l < 4; l++) {
      const x = this.lx(l);
      if (this.flash[l] > 0) {
        g.save();
        g.globalAlpha = 0.25 * this.flash[l];
        g.fillStyle = LANE_COL[l];
        g.fillRect(x - this.lw / 2, 125, this.lw, 470);
        g.restore();
      }
      this.arrow(g, x, this.hitY, l, null, 1 + this.flash[l] * 0.15);
    }
    line(g, L.x0, this.hitY + 32, L.x0 + L.w * 4, this.hitY + 32, { w: 2, color: 'rgba(255,253,246,0.35)', seed: 4 });
    // the notes coming down
    const D = DIFFS[this.diff];
    for (const n of this.notes) {
      const dt = n.t + this.t0 - now;
      if (dt > 1.3) break;
      if (n.hit > 0 && !(n.hold > 0 && !n.done)) continue;
      if (n.hit < 0 && dt < -0.25) continue;
      const y = this.hitY - dt * D.speed;
      const x = this.lx(n.lane);
      if (n.hold > 0) {
        const y1 = this.hitY - (dt + n.hold) * D.speed;
        const y0 = n.hit > 0 ? this.hitY : y;
        g.save();
        g.globalAlpha = n.broke ? 0.25 : 0.75;
        g.fillStyle = LANE_COL[n.lane];
        g.fillRect(x - this.lw * 0.16, Math.max(125, y1), this.lw * 0.32, Math.max(0, y0 - Math.max(125, y1)));
        g.restore();
      }
      if (y < 110 || (n.hit > 0 && n.hold > 0)) continue;
      g.save();
      if (n.hit < 0) g.globalAlpha = 0.35;
      this.arrow(g, x, y, n.lane, LANE_COL[n.lane], 1);
      g.restore();
    }
    // what each press was
    for (const p of this.pops) text(g, p.he, p.x, this.hitY - 70 - p.t * 60, { size: 30, color: p.col, outline: '#0a0818', ow: 6 });
    // count in: 3, 2, 1
    const left = this.t0 - now;
    if (left > 0) {
      const beats = Math.ceil(left / (this.spb * 4));
      text(g, beats > 3 ? 'מוכנים?' : String(beats), this.L.x0 + this.L.w * 2, 300, { size: beats > 3 ? 48 : 90, color: PENS.white, outline: '#0a0818', ow: 8 });
    }
  }

  // an arrow pointing its lane's way: outlined on the line, filled coming down
  arrow(g, x, y, l, fill, k) {
    const r = this.lw * 0.36 * k;
    const rot = [Math.PI / 2, Math.PI, 0, -Math.PI / 2][l];
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.beginPath();
    g.moveTo(0, -r);
    g.lineTo(r, 0);
    g.lineTo(r * 0.42, 0);
    g.lineTo(r * 0.42, r);
    g.lineTo(-r * 0.42, r);
    g.lineTo(-r * 0.42, 0);
    g.lineTo(-r, 0);
    g.closePath();
    if (fill) {
      g.fillStyle = fill;
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = INK;
    } else {
      g.lineWidth = 4;
      g.strokeStyle = LANE_COL[l];
      g.setLineDash([]);
    }
    g.stroke();
    g.restore();
  }

  drawHud(g, W) {
    // the dancer: on the beat, posed the way you pressed
    const now = this.now();
    const beat = (now - this.t0) / (this.spb * 4);
    const bob = Math.abs(Math.sin(beat * Math.PI)) * 0.12;
    const poses = [
      { la: 1.9, ra: -0.5, ll: 0.5, rl: -0.15, lean: -0.15 },
      { la: 0.9, ra: -0.9, ll: 0.6, rl: -0.6, hop: -0.12, lb: -0.9, rb: 0.9 },
      { la: 2.8, ra: -2.8, ll: 0.12, rl: -0.12, hop: 0.25 },
      { la: 0.5, ra: -1.9, ll: 0.15, rl: -0.5, lean: 0.15 },
    ];
    let pose = { la: 0.4 + bob * 3, ra: -0.4 - bob * 3, ll: 0.15, rl: -0.15, hop: bob };
    if (this.poseT > 0 && this.pose >= 0) pose = poses[this.pose];
    else if (this.poseT > 0 && this.pose < 0) pose = { la: 0.9, ra: 1.4, ll: 0.6, rl: 0.1, lean: 0.35 };
    if (this.inWorld) {
      // (the dancer is you, on the floor: your arms up on the strong moves and in the fever)
      const f = this.api.game.player.fig;
      f.dance = 1;
      f.armsUp = (this.poseT > 0 && this.pose === 2) || this.fever > 0 ? 1 : 0;
    } else figure(g, this.L.dancer, this.L.feet, this.L.size, pose, { shirt: this.fever > 0 ? PENS.yellow : PENS.pink, legs: '#2b2f55', hair: '#2a1a12' });
    // the score, the row, the hype
    text(g, `ניקוד ${this.score.toLocaleString('en-US')}`, 170, 150, { size: 28, color: PENS.white, outline: '#0a0818', ow: 6 });
    if (this.combo >= 5) text(g, `רצף ${this.combo}`, 170, 186, { size: 24, color: PENS.yellow, outline: '#0a0818', ow: 6 });
    const hx = 40;
    const hy = 210;
    box(g, hx, hy, 260, 18, { fill: '#0a0818', color: PENS.white, w: 2, r: 8, seed: 21 });
    g.fillStyle = this.fever > 0 ? PENS.yellow : PENS.pink;
    g.fillRect(hx + 3, hy + 3, 254 * this.hype, 12);
    text(g, this.fever > 0 ? 'הקהל משתולל! ×2' : 'ההייפ של הקהל', hx + 130, hy + 34, { size: 18, color: PENS.white, outline: '#0a0818', ow: 4 });
  }

  drawMenu(g, W) {
    text(g, 'Ink Beat', W / 2, 150, { font: MARKER, size: 52, color: PENS.yellow, outline: '#0a0818', ow: 8 });
    // the songs, right to left
    TRACKS.forEach((tr, i) => {
      const x = 110 + (2 - i) * 270;
      const sel = i === this.track;
      box(g, x, 180, 240, 140, { fill: sel ? 'rgba(255,95,162,0.35)' : 'rgba(10,8,24,0.6)', color: sel ? PENS.yellow : PENS.white, w: sel ? 5 : 2, r: 14, seed: 30 + i });
      text(g, tr.name, x + 120, 230, { font: MARKER, size: 30, color: PENS.white, outline: '#0a0818', ow: 5 });
      text(g, tr.he, x + 120, 268, { size: 22, color: PENS.cyan, outline: '#0a0818', ow: 4 });
      const b = Math.max(this.best[tr.style + this.diff] || 0, 0);
      if (b) text(g, `שיא ${b.toLocaleString('en-US')}`, x + 120, 298, { size: 18, color: PENS.yellow, outline: '#0a0818', ow: 4 });
    });
    DIFFS.forEach((d, i) => {
      const x = 230 + (2 - i) * 180;
      const sel = i === this.diff;
      box(g, x, 370, 160, 60, { fill: sel ? 'rgba(47,212,228,0.35)' : 'rgba(10,8,24,0.6)', color: sel ? PENS.yellow : PENS.white, w: sel ? 5 : 2, r: 12, seed: 40 + i });
      text(g, d.he, x + 80, 401, { size: 28, color: PENS.white, outline: '#0a0818', ow: 5 });
    });
    box(g, 380, 470, 240, 80, { fill: PENS.pink, color: INK, w: 4, r: 16, seed: 50 });
    text(g, 'יאללה!', 500, 511, { size: 40, color: INK, outline: PENS.white, ow: 5 });
    if (this.row === 0 && !this.touch) text(g, '◀ ▶ שיר · ▼ רמה', W / 2, 455, { size: 18, color: PENS.white, outline: '#0a0818', ow: 4 });
  }

  drawResults(g, W) {
    const r = this.res;
    text(g, r.grade, W / 2, 175, { font: MARKER, size: 120, color: r.grade === 'S' ? PENS.yellow : r.grade === 'D' ? '#9a9aa8' : PENS.pink, outline: '#0a0818', ow: 10 });
    if (r.record) text(g, 'שיא חדש!', W / 2, 262, { size: 32, color: PENS.yellow, outline: '#0a0818', ow: 6 });
    const rows = [
      `ניקוד ${r.score.toLocaleString('en-US')}`,
      `דיוק ${Math.round(r.acc * 100)}% · רצף הכי ארוך ${r.combo}`,
      `מושלם ${this.counts[0]} · יפה ${this.counts[1]} · טוב ${this.counts[2]} · פספוס ${this.counts[3]}`,
    ];
    rows.forEach((s, i) => text(g, s, W / 2, 310 + i * 40, { size: 26, color: PENS.white, outline: '#0a0818', ow: 5 }));
    if (r.tips) text(g, `הקהל זרק לכם ${cash(r.tips)} בטיפים`, W / 2, 432, { size: 26, color: PENS.green, outline: '#0a0818', ow: 5 });
    box(g, 520, 480, 220, 70, { fill: PENS.cyan, color: INK, w: 4, r: 14, seed: 60 });
    text(g, 'עוד שיר', 630, 516, { size: 30, color: INK, outline: PENS.white, ow: 4 });
    box(g, 260, 480, 220, 70, { fill: 'rgba(255,253,246,0.85)', color: INK, w: 4, r: 14, seed: 61 });
    text(g, 'יציאה', 370, 516, { size: 30, color: INK, outline: PENS.white, ow: 4 });
  }
}

