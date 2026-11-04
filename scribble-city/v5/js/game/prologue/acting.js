import * as THREE from 'three';
import { gestureAt } from '../civilians.js';

// (v5, ROADMAP 18) How the prologue's people act their lines: for each line, what the speaker's hands
// do beat by beat as the words come (a point at the wheel, palms open at a question, a shrug, hands
// together begging, a hand up - okay, okay - a finger beating out the words), what their face does
// (a laugh, a smirk, teasing, worry, a shout) and when it changes, a nod or a shake of the head - and
// how the one they are talking to takes it (a smile, a frown) as it lands.
//
// A beat: [from, to, gesture, mood] - from and to as fractions of the line (0 its first word, 1 its
// last), the gesture by name (render-free: body space, as game/civilians.js gestureAt has them, plus
// the ones here), a mood from that moment on (render/people.js MOODS). The whole line's mood: mood.
// nod / shake: the head with the words. hear: the listener's face once it lands.

export const ACTS = {
  // ---- 2. Lily
  L01: { mood: 'joy', beats: [[0, 1, 'wave']] },
  D01: { mood: 'surprised', beats: [[0.08, 0.55, 'open'], [0.55, 1, 'beat', 'smirk']], shake: true, hear: 'tease' },
  LG1: { mood: 'laugh', beats: [[0, 1, 'laugh']] },
  L02: { mood: 'tease', beats: [[0, 1, 'hip']], nod: true, hear: 'smirk' },
  L03: { mood: 'surprised', beats: [[0, 0.75, 'pointUp']] },
  D02: { mood: 'smirk', beats: [[0.05, 0.45, 'weigh'], [0.5, 1, 'open']], nod: true, hear: 'surprised' },
  L04: { mood: 'surprised', beats: [[0.15, 0.9, 'shrug']] },
  D03: { mood: 'smirk', beats: [[0.25, 0.85, 'beat']], nod: true, hear: 'laugh' },
  L05: { mood: 'laugh', beats: [[0, 1, 'laugh']] },
  // ---- 3. the wheel
  L19: { mood: 'surprised', beats: [[0, 1, 'pointUp']] },
  L20: { mood: 'joy', beats: [[0, 1, 'explain']] },
  L21: { mood: 'pleading', beats: [[0.1, 1, 'plead']], nod: true, hear: 'tender' },
  D27: { mood: 'tender', beats: [[0.15, 0.85, 'open']], nod: true, hear: 'joy' },
  L06: { mood: 'joy' },
  D04: { mood: 'smirk', beats: [[0.2, 0.8, 'weigh']], hear: 'surprised' },
  L07: { mood: 'surprised', beats: [[0, 1, 'hip']], shake: true, hear: 'laugh' },
  D05: { mood: 'laugh', beats: [[0, 0.45, 'surrender'], [0.5, 1, 'open', 'joy']], hear: 'joy' },
  L08: { mood: 'shock' },
  L22: { mood: 'shock', beats: [[0.1, 1, 'point']] },
  D29: { mood: 'shock', beats: [[0, 0.35, 'open'], [0.4, 1, 'point']], shake: true },
  // ---- 4. nobody remembers
  D06: { mood: 'shout', beats: [[0, 0.45, 'wave'], [0.45, 1, 'point']] },
  G01: { mood: 'surprised', beats: [[0, 1, 'shrug']] },
  D07: { mood: 'shout', beats: [[0, 0.55, 'point'], [0.55, 1, 'open']] },
  G02: { mood: 'smirk', beats: [[0.15, 0.75, 'shrug']] },
  D08: { mood: 'shout', beats: [[0, 0.5, 'point'], [0.5, 1, 'beat']] },
  // (ROADMAP 18.9: no hands going round and round - 'explain' is a loop, and over a whole line it
  // looked foolish: palms open at the question, a shrug at 'man', a hand out at 'here')
  G03: { mood: 'joy', beats: [[0.05, 0.4, 'open'], [0.45, 0.62, 'shrug'], [0.7, 1, 'point']] },
  D09: { mood: 'shock', beats: [[0.1, 1, 'open']] },
  G04: { mood: 'worried', beats: [[0.1, 0.6, 'open']] },
  D10: { mood: 'worried', beats: [[0, 0.5, 'plead'], [0.5, 1, 'point']] },
  // (still as a post as he says it, flat: the stillness is what is wrong with him)
  M01: { mood: 'neutral' },
  L09: { mood: 'worried' },
  D11: { mood: 'tender', nod: true },
  L10: { mood: 'worried' },
  D12: { mood: 'worried', shake: true },
  D13: { mood: 'tender' },
  L11: { mood: 'worried' },
  D14: { mood: 'worried' },
  D15: { mood: 'angry', beats: [[0.2, 1, 'open']] },
  // ---- 5. the phone; the two men
  D16: { mood: 'angry' },
  D17: { mood: 'angry', beats: [[0.2, 1, 'beat']] },
  T01: { mood: 'smirk', beats: [[0, 1, 'open']] },
  D18: { mood: 'angry', shake: true },
  T02: { mood: 'smirk', beats: [[0.2, 1, 'beat']] },
  D19: { mood: 'angry', beats: [[0.1, 1, 'beat']] },
  T03: { mood: 'angry', beats: [[0, 1, 'explain']], shake: true, hear: 'angry' },
  T05: { mood: 'angry' },
  D28: { mood: 'shout' },
  T06: { mood: 'shout', beats: [[0, 1, 'point']] },
  T04: { mood: 'shout', beats: [[0, 1, 'point']] },
  // ---- 6-9. in the car (no hands from the wheel: faces only)
  L12: { mood: 'shout' },
  D20: { mood: 'angry' },
  L13: { mood: 'shout' },
  D21: { mood: 'angry' },
  D22: { mood: 'shout' },
  L14: { mood: 'worried' },
  L15: { mood: 'shock' },
  D23: { mood: 'angry', nod: true },
  L16: { mood: 'worried' },
  D24: { mood: 'worried' },
  L17: { mood: 'worried' },
  D25: { mood: 'worried', shake: true },
  L18: { mood: 'pleading' },
  D26: { mood: 'tender', nod: true },
};

// (the prologue's own gestures, on top of the city's: body space - x to their right, y up from their
// feet, z ahead - for a grown-up's body; t seconds into it, ph their own phase)
function gestureX(kind, side, t, ph, out) {
  switch (kind) {
    // (an arm up at something high: the wheel, the board)
    case 'pointUp':
      if (side < 0) return false;
      out.set(0.2, 1.9, 0.38);
      return true;
    // (hands together under the chin, bouncing a little: please)
    case 'plead': {
      const k = Math.sin(t * 9 + ph) * 0.025;
      out.set(side * 0.05, 1.3 + k, 0.24);
      return true;
    }
    // (both palms up and out: okay, okay)
    case 'surrender': {
      const k = Math.min(1, t * 4);
      out.set(side * (0.22 + 0.06 * k), 1.22 + 0.24 * k, 0.26);
      return true;
    }
    // (ROADMAP 18.9: weighing it up - one palm up and out at the waist, tipping; not a hand to the
    // chin, which from the front reads as a hand over the face)
    case 'weigh': {
      if (side < 0) return false;
      const k = Math.sin(t * 4 + ph);
      out.set(0.25 + 0.03 * k, 1.07 + 0.04 * k, 0.32);
      return true;
    }
    // (a hand on the heart)
    case 'heart':
      if (side < 0) return false;
      out.set(-0.06, 1.28, 0.16);
      return true;
    default:
      return gestureAt(kind, side, t, ph, out);
  }
}

const _o = new THREE.Vector3();
const _r = new THREE.Vector3();

export class Acting {
  constructor(game) {
    this.game = game;
    this.on = [];
  }

  // a line begins: fig says it (dur seconds); listeners: the figures it is said to (they take it as it
  // lands - ACTS hear)
  play(fig, id, dur, listeners = null) {
    const A = ACTS[id];
    if (!fig || !A) return;
    // (one line at a time each: a new one takes over from the last)
    this.stop(fig);
    const p = { fig, A, dur: Math.max(0.4, dur), t: 0, ph: (fig.seed || 0.3) * 5.1, hR: new THREE.Vector3(), hL: new THREE.Vector3(), look: null, lookV: new THREE.Vector3(), listeners, heard: false, mood: A.mood || null };
    if (p.mood) this.feel(fig, p.mood, p.dur + 0.6);
    this.on.push(p);
  }

  stop(fig) {
    const i = this.on.findIndex((p) => p.fig === fig);
    if (i < 0) return;
    this.release(this.on[i]);
    this.on.splice(i, 1);
  }

  feel(fig, mood, s) {
    fig.feel = { mood, until: this.game.time + s };
  }

  // the hands back to whatever had them before (only what this took)
  release(p) {
    const f = p.fig;
    if (f.reachR === p.hR) f.reachR = null;
    if (f.reachL === p.hL) f.reachL = null;
    if (f.lookAt === p.lookV) f.lookAt = p.look;
  }

  update(dt) {
    for (let i = this.on.length - 1; i >= 0; i--) {
      const p = this.on[i];
      const f = p.fig;
      p.t += dt;
      const k = p.t / p.dur;
      if (k > 1.08 || !f.j) {
        this.release(p);
        this.on.splice(i, 1);
        continue;
      }
      const A = p.A;
      // ---- the hands: the beat on now
      let beat = null;
      for (const b of A.beats || []) if (k >= b[0] && k < b[1]) beat = b;
      if (beat && beat[3] && p.mood !== beat[3]) {
        p.mood = beat[3];
        this.feel(f, p.mood, p.dur * (1.08 - k) + 0.6);
      }
      // (hands that something else holds - a page, a car's wheel, a gun - are left to it)
      const freeR = !f.reachR || f.reachR === p.hR;
      const freeL = !f.reachL || f.reachL === p.hL;
      if (beat && f.toWorld) {
        const bt = (k - beat[0]) * p.dur;
        // (in and out of each gesture smoothly: a beat's first and last tenth of a second)
        if (freeR && gestureX(beat[2], 1, bt, p.ph, _o)) {
          f.toWorld(_o.x, _o.y, _o.z, p.hR);
          f.reachR = p.hR;
        } else if (f.reachR === p.hR) f.reachR = null;
        if (freeL && gestureX(beat[2], -1, bt, p.ph, _o)) {
          f.toWorld(_o.x, _o.y, _o.z, p.hL);
          f.reachL = p.hL;
        } else if (f.reachL === p.hL) f.reachL = null;
      } else {
        if (f.reachR === p.hR) f.reachR = null;
        if (f.reachL === p.hL) f.reachL = null;
      }
      // ---- the head: a nod with the words, or a shake (round whatever they are looking at)
      if (A.nod || A.shake) {
        if (f.lookAt !== p.lookV) p.look = f.lookAt;
        const L = p.look;
        if (L && L.isVector3) {
          const env = Math.sin(Math.min(1, k) * Math.PI);
          p.lookV.copy(L);
          if (A.nod) p.lookV.y += Math.sin(p.t * 2 * Math.PI * 1.9) * 0.09 * env;
          if (A.shake) {
            _r.set(L.x - f.pos.x, 0, L.z - f.pos.z);
            const d = _r.length() || 1;
            p.lookV.x += (-_r.z / d) * Math.sin(p.t * 2 * Math.PI * 2.3) * 0.13 * env;
            p.lookV.z += (_r.x / d) * Math.sin(p.t * 2 * Math.PI * 2.3) * 0.13 * env;
          }
          f.lookAt = p.lookV;
        }
      }
      // ---- the one they talk to: it lands
      if (A.hear && !p.heard && k > 0.62 && p.listeners) {
        p.heard = true;
        for (const L of p.listeners) if (L && L !== f) this.feel(L, A.hear, 2.4);
      }
    }
  }

  clear() {
    for (const p of this.on) this.release(p);
    this.on = [];
  }
}
