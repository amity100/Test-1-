// A storyboard of the meeting scene (the story's s2), for the owner to approve before anything is animated: one picture a shot -
// who stands where and how, the lens, the light - taken in the game itself as a phone draws it. The scene is opened by the
// story's own test pilot (tools/perf/lib.mjs open), its script held still, and each shot set up by hand from the table below:
// the two of them put and posed, the shot cut to, a second let pass for the poses to settle, the picture taken.
//   node tools/storyboard.mjs <outDir>      ONLY=03,07 (which shots)   also writes lily-drawing.png (her own drawing of the wheel)
import fs from 'node:fs';
import path from 'node:path';
import { open } from './perf/lib.mjs';

const OUT = process.argv[2] || 'storyboard-out';
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const t0 = Date.now();
const { pg, close } = await open({ where: 's2', query: process.env.EXTRA || '', cond: 'P.sceneT > 0.3', dsf: 1, frames: 1 });

// the stage and the helpers, in the page
await pg.evaluate(async () => {
  const g = window.__game;
  const P = g.prologue;
  const D = g.player;
  const L = P.cast.lily;
  const v3 = (x, y, z) => g.camera.position.clone().set(x, y, z);
  // (the script held where it is: the table sets every shot)
  P.co = (function* () { for (;;) yield 1e9; })();
  P.wait = 1e9;
  for (const id of ['hud', 'touch']) {
    const el = document.getElementById(id);
    if (el) el.style.visibility = 'hidden';
  }
  // The stage (measured from above and looked round from it, eight ways): her stool at the stand's east table; his mark on the open
  // promenade, eight metres south of it and clear of the pier's gate. From the mark: north the sea and the low sun, east the pier and
  // the giant wheel, south her uncle's board, west the hotels' lights - each of the scene's pictures has its own way to look.
  // u: from his mark to her stool (he faces it, the sun on his face; she, come to him, has it behind her); w: the west of that line
  const S = { x: 40.2, z: 233.0 };
  const M = { x: 38.4, z: 240.6 };
  const ul = Math.hypot(S.x - M.x, S.z - M.z);
  const u = [(S.x - M.x) / ul, (S.z - M.z) / ul];
  const w = [u[1], -u[0]];
  const at = (f, sd = 0, y = 0) => v3(M.x + u[0] * f + w[0] * sd, y, M.z + u[1] * f + w[1] * sd);
  const head = (c) => P.headJ(c) || v3(c.pos.x, 1.3, c.pos.z);
  const yawTo = (x, z) => Math.atan2(x, z);
  const sb = {
    g, P, D, L, v3, S, M, u, w, at, head, yawTo,
    B: P.lilyBoard(),
    WHEEL: { x: 128, z: 243 },
    reset() {
      // (nobody but the story's own people near: a passer-by a step from the lens was a giant's leg across the picture)
      const cast = new Set(Object.values(P.cast));
      for (const c of g.civilians.list) if (!cast.has(c) && Math.hypot(c.pos.x - M.x, c.pos.z - M.z) < 45) c.gone = true;
      P.walkTo = null;
      P.auto = null;
      P.dropHolds();
      P.kneel(0);
      D.fig.crouch = 0;
      for (const f of [D.fig, L.fig]) {
        f.lookAt = null;
        f.feel = null;
        f.reachR = f.reachL = null;
      }
      L.fig.sit = 0;
      L.baseY = 0;
      L.pl.follow = false;
      L.pl.speed = 0;
      if (P.castMod) {
        P.castMod.giveIceCream(L.fig, false);
        P.castMod.giveSketchbook(L.fig, false);
      }
    },
    feel(fig, mood) {
      fig.feel = mood ? { mood, until: 1e12 } : null;
    },
    shot(spec) {
      P.shot({ dur: 900, hand: 0, ...spec });
    },
    step(n = 30) {
      window.__frame(n, 1 / 30);
    },
    // Lily on her stool at the stand, turned to (x, z)
    seat(x, z) {
      P.put(L, S.x, S.z, yawTo(x - S.x, z - S.z));
      L.fig.sit = 1;
      L.baseY = 0.32;
    },
    // him down on his left knee at his mark, facing her; she at f along the way to her stool
    kneel(f = 0.86, sd = 0.1) {
      P.putDanny(M.x, M.z, yawTo(u[0], u[1]));
      P.kneel(1, true);
      const q = at(f, sd);
      P.put(L, q.x, q.z, yawTo(-u[0], -u[1]));
    },
    // his hand (side 'L' / 'R') on her upper arm (hers: 'L' / 'R'), a little out from it: an arm's length, holding her to look at her
    onArm(side, hers) {
      P.hold(D.fig, side, () => {
        const sh = L.fig.j['shoulder' + hers];
        const el = L.fig.j['elbow' + hers];
        const c = L.fig.j.neck;
        const mx = sh.x * 0.62 + el.x * 0.38;
        const my = sh.y * 0.62 + el.y * 0.38;
        const mz = sh.z * 0.62 + el.z * 0.38;
        const ox = mx - c.x;
        const oz = mz - c.z;
        const ol = Math.hypot(ox, oz) || 1;
        // (the wrist short of it on his side: the hand itself goes on from the wrist)
        return v3(mx + (ox / ol) * 0.05 - u[0] * 0.1, my + 0.02, mz + (oz / ol) * 0.05 - u[1] * 0.1);
      });
    },
    // his hand laid on her shoulder from beside her (the two of them side by side)
    onShoulder(side, hers) {
      P.hold(D.fig, side, () => {
        const sh = L.fig.j['shoulder' + hers];
        const o = D.fig.j['shoulder' + side];
        const dx = o.x - sh.x;
        const dy = o.y - sh.y;
        const dz = o.z - sh.z;
        const dl = Math.hypot(dx, dy, dz) || 1;
        return v3(sh.x + (dx / dl) * 0.15, sh.y + 0.05 + (dy / dl) * 0.15, sh.z + (dz / dl) * 0.15);
      });
    },
    hug(side = 1) {
      sb.kneel(side === 2 ? 0.34 : 0.37, side === 2 ? -0.17 : 0.1);
      D.fig.lookAt = side === 2 ? at(2.2, 0.75, 0.75) : side > 0 ? at(2.0, 0.3, 0.55) : at(1.6, -0.7, 0.45);
      const nk = (f) => f.j.neck;
      P.hold(L.fig, 'L', () => v3(nk(D.fig).x - u[0] * 0.1 - w[0] * 0.04, nk(D.fig).y + 0.03, nk(D.fig).z - u[1] * 0.1 - w[1] * 0.04));
      P.hold(L.fig, 'R', () => v3(nk(D.fig).x - u[0] * 0.1 + w[0] * 0.14, nk(D.fig).y - 0.02, nk(D.fig).z - u[1] * 0.1 + w[1] * 0.14));
      P.hold(D.fig, 'L', () => v3(nk(L.fig).x + u[0] * 0.11 + w[0] * 0.06, nk(L.fig).y - 0.12, nk(L.fig).z + u[1] * 0.11 + w[1] * 0.06));
      P.hold(D.fig, 'R', () => v3(nk(L.fig).x + u[0] * 0.1 - w[0] * 0.06, nk(L.fig).y - 0.22, nk(L.fig).z + u[1] * 0.1 - w[1] * 0.06));
      const ls = side === 2 ? -1 : 1;
      L.fig.lookAt = v3(L.pos.x + w[0] * 2.2 * ls - u[0] * 1.2, 1.2, L.pos.z + w[1] * 2.2 * ls - u[1] * 1.2);
    },
  };
  // ---- (ROADMAP 23) the scene's contacts, each hand turned as a hand is: tried here, close up from two sides (HANDS=1), before
  // the scene itself is written from them
  const dir = (a, b, y = 0) => v3(u[0] * a + w[0] * b, y, u[1] * a + w[1] * b);
  const nk = (f) => f.j.neck;
  Object.assign(sb, {
    dir,
    // the embrace: him down on his left knee, bent to her; her arms round his neck, his round her back
    poseHug() {
      sb.kneel(0.36, 0.12);
      P.pose(D.fig, { fLean: 0.22, fHipY: -0.05, fSide: 0.1, headTilt: 0.18 }, 0.01);
      P.pose(L.fig, { fLean: 0.1, fSide: 0.02, headTilt: 0.14 }, 0.01);
      D.fig.lookAt = at(2.2, 0.5, 0.75);
      L.fig.lookAt = v3(L.pos.x + w[0] * 2.2 - u[0] * 1.2, 1.15, L.pos.z + w[1] * 2.2 - u[1] * 1.2);
      // (his right hand on the back of her head, in her curls - her bag is on her back; his left arm round her under it, at her
      // waist: the palm on her back, the fingers across it)
      P.hold(D.fig, 'R', () => { const q = L.fig.j.headC; const hs = (L.fig.headScale || 1) * (L.fig.scale || 1); return v3(q.x + u[0] * 0.105 * hs, q.y + 0.0, q.z + u[1] * 0.105 * hs); }, { on: true, palm: dir(-1, 0), fingers: dir(0.1, 0.55, 0.8), pole: dir(-0.2, -0.9, -0.3), ease: 0.01 });
      P.hold(D.fig, 'L', () => v3(L.fig.j.hip.x + u[0] * 0.085 - w[0] * 0.03, L.fig.j.hip.y + 0.07, L.fig.j.hip.z + u[1] * 0.085 - w[1] * 0.03), { on: true, palm: dir(-1, 0), fingers: dir(0, -0.95, 0.12), pole: dir(-0.2, 0.8, -0.6), ease: 0.01 });
      // (her hands behind his neck, one over the other)
      P.hold(L.fig, 'R', () => v3(nk(D.fig).x - u[0] * 0.1 - w[0] * 0.0, nk(D.fig).y + 0.045, nk(D.fig).z - u[1] * 0.1 - w[1] * 0.0), { on: true, palm: dir(1, 0), fingers: dir(0, -0.9, -0.2), pole: dir(0.2, 0.6, -0.8), ease: 0.01 });
      P.hold(L.fig, 'L', () => v3(nk(D.fig).x - u[0] * 0.1 + w[0] * 0.0, nk(D.fig).y - 0.02, nk(D.fig).z - u[1] * 0.1 + w[1] * 0.0), { on: true, palm: dir(1, 0), fingers: dir(0, 0.9, -0.1), pole: dir(0.2, -0.6, -0.8), ease: 0.01 });
    },
    // at arm's length: his hands round her upper arms, thumbs in front
    poseArms() {
      sb.kneel(0.62, 0.06);
      P.pose(D.fig, { fLean: 0.12, fHipY: -0.03 }, 0.01);
      const arm = (hers) => () => {
        const sh = L.fig.j['shoulder' + hers];
        const el = L.fig.j['elbow' + hers];
        const sg = hers === 'L' ? -1 : 1;
        // (the outside of her arm, a third of the way down it)
        return v3(sh.x * 0.6 + el.x * 0.4 + w[0] * sg * 0.045, sh.y * 0.6 + el.y * 0.4, sh.z * 0.6 + el.z * 0.4 + w[1] * sg * 0.045);
      };
      P.hold(D.fig, 'R', arm('L'), { on: true, palm: dir(0, 1), fingers: dir(0.9, 0, 0.35), grip: true, pole: dir(-0.2, -0.7, -0.7), ease: 0.01 });
      P.hold(D.fig, 'L', arm('R'), { on: true, palm: dir(0, -1), fingers: dir(0.9, 0, 0.35), grip: true, pole: dir(-0.2, 0.7, -0.7), ease: 0.01 });
      L.fig.lookAt = D.fig.j.headC;
      D.fig.lookAt = L.fig.j.headC;
    },
    // a hand through her hair: his right hand on top of her head, the fingers back over it
    poseRuffle() {
      sb.poseArms();
      P.hold(D.fig, 'R', () => { const q = L.fig.j.headC; const hs = (L.fig.headScale || 1) * (L.fig.scale || 1); return v3(q.x - u[0] * 0.02, q.y + 0.125 * hs, q.z - u[1] * 0.02); }, { on: true, palm: v3(0, -1, 0), fingers: dir(0.95, 0.1, -0.1), pole: dir(-0.3, -0.9, -0.2), ease: 0.01 });
    },
    // his arms open for her
    poseOpen() {
      P.putDanny(M.x, M.z, yawTo(u[0], u[1]));
      P.kneel(1, true);
      P.pose(D.fig, { fLean: 0.1 }, 0.01);
      const a = at(5);
      P.put(L, a.x, a.z, yawTo(-u[0], -u[1]));
      D.fig.lookAt = v3(a.x, 1.0, a.z);
      P.hold(D.fig, 'R', () => at(0.4, -0.44, 0.98), { palm: dir(0.55, 0.6, 0.45), pole: dir(-0.3, -0.6, -0.7), ease: 0.01 });
      P.hold(D.fig, 'L', () => at(0.4, 0.44, 0.98), { palm: dir(0.55, -0.6, 0.45), pole: dir(-0.3, 0.6, -0.7), ease: 0.01 });
    },
    // hand in hand: her left hand in his right, the two of them the way e looks
    poseWalk(F, ex, ez) {
      const rx = -ez;
      const rz = ex;
      const yaw = yawTo(ex, ez);
      P.putDanny(F.x, F.z, yaw);
      P.put(L, F.x + rx * 0.62, F.z + rz * 0.62, yaw);
      // (the ground they stand on: the pier's deck is a step above the promenade)
      const hands = () => v3(D.pos.x + rx * 0.31, D.pos.y + 0.79, D.pos.z + rz * 0.31);
      // (his hand round hers: his palm to her and a little back, his fingers down; hers up into it, her palm to him)
      P.hold(D.fig, 'R', () => { const q = hands(); return v3(q.x - rx * 0.015, q.y + 0.065, q.z - rz * 0.015); }, { palm: v3(rx * 0.9 - ex * 0.3, 0, rz * 0.9 - ez * 0.3), fingers: v3(rx * 0.2, -1, rz * 0.2), grip: true, ease: 0.01 });
      P.hold(L.fig, 'L', () => { const q = hands(); return v3(q.x + rx * 0.035, q.y + 0.0, q.z + rz * 0.035); }, { palm: v3(-rx * 0.9 - ex * 0.2, 0.1, -rz * 0.9 - ez * 0.2), fingers: v3(-rx * 0.75, -0.6, -rz * 0.75), pole: v3(-ex * 0.5 + rx * 0.3, -0.8, -ez * 0.5 + rz * 0.3), ease: 0.01 });
    },
    // under the board: she at his left, his left hand on her shoulder; her right arm up at it
    poseBoard() {
      const B = sb.B;
      const p = { x: B.x + B.nx * 8.2, z: B.z + B.nz * 8.2 };
      P.putDanny(p.x, p.z, B.face);
      P.put(L, p.x - B.rx * 0.5, p.z - B.rz * 0.5, B.face);
      L.fig.lookAt = v3(B.x, B.cy, B.z);
      D.fig.lookAt = v3(B.x, B.cy, B.z);
      // (his hand laid on her near shoulder from above: the palm down, the fingers over it to its front)
      P.hold(D.fig, 'L', () => { const sh = L.fig.j.shoulderR; return v3(sh.x + B.rx * 0.01, sh.y + 0.05, sh.z + B.rz * 0.01); }, { on: true, palm: v3(0, -1, 0), fingers: v3(-B.rx * 0.75 - B.nx * 0.6, -0.25, -B.rz * 0.75 - B.nz * 0.6), pole: v3(B.rx * 0.2 + B.nx * 0.5, -0.8, B.rz * 0.2 + B.nz * 0.5), ease: 0.01 });
      // (her arm up at the board: the hand open, its palm down)
      P.hold(L.fig, 'L', () => { const sh = L.fig.j.shoulderL; return v3(sh.x - B.nx * 0.3 - B.rx * 0.04, sh.y + 0.26, sh.z - B.nz * 0.3 - B.rz * 0.04); }, { palm: v3(-B.rx * 0.5, -0.85, -B.rz * 0.5), ease: 0.01 });
      return p;
    },
  });
  window.__sb = sb;
  // her own drawing of the wheel, as the game draws it (game/prologue/ui.js lilyDrawing)
  const ui = await import('./js/game/prologue/ui.js');
  window.__lilyPng = ui.lilyDrawing(1).toDataURL('image/png');
});
fs.writeFileSync(path.join(OUT, 'lily-drawing.png'), Buffer.from((await pg.evaluate(() => window.__lilyPng)).split(',')[1], 'base64'));

// the shots: [name, set up (run in the page, with the helpers above in reach), frames to let pass]
const SHOTS = [
  // 1. the evening: her at her table with her ice cream, small; the pier and the giant wheel beyond her
  ['01-evening', () => {
    seat(WHEEL.x, WHEEL.z);
    P.castMod.giveIceCream(L.fig, true);
    L.fig.lookAt = v3(WHEEL.x, 14, WHEEL.z);
    P.putDanny(M.x - 40, M.z + 40, 0);
    shot({ from: v3(37.2, 1.0, 233.9), look: v3(57.1, 3.1, 232.2), fov: 40, key: 0.5, keySide: -1, rim: 1 });
  }],
  // 3. he comes: across the promenade from the hotels, the long lens from by her table
  ['03-danny-comes', () => {
    seat(WHEEL.x, WHEEL.z);
    const q = at(-3.8, 0.8);
    P.putDanny(q.x, q.z, yawTo(u[0], u[1]));
    P.walkTo = { x: M.x, z: M.z, speed: 0.4 };
    D.fig.lookAt = v3(S.x, 1.0, S.z);
    feel(D.fig, 'smirk');
    shot({ from: at(5.4, -0.9, 1.05), look: () => v3(D.pos.x, 1.12, D.pos.z), fov: 16, keySide: -1, dof: 1 });
  }, 26],
  // 4. she sees him: off her stool and a step out from under the stand's poles - her face, the sea and the low sun behind her
  ['04-lily-sees', () => {
    P.putDanny(M.x, M.z, yawTo(u[0], u[1]));
    const a = at(5.4);
    P.put(L, a.x, a.z, yawTo(-u[0], -u[1]));
    L.fig.lookAt = D.fig.j.headC;
    feel(L.fig, 'joy');
    shot({ from: () => { const h = head(L); return v3(h.x - 0.98, h.y + 0.0, h.z + 0.92); }, look: () => { const h = head(L); return v3(h.x + 0.13, h.y - 0.01, h.z); }, fov: 17, key: 0.6, keySide: -1, rim: 1.2, dof: 1 });
  }],
  // 5a. she runs: from the west of her way, low, the wheel behind her
  ['05a-lily-runs', () => {
    const dq = at(-3.2);
    P.putDanny(dq.x, dq.z, yawTo(u[0], u[1]));
    const a = at(3.3);
    P.put(L, a.x, a.z, yawTo(-u[0], -u[1]));
    feel(L.fig, 'joy');
    L.fig.lookAt = D.fig.j.headC;
    const q = at(-1.5);
    P.go(L, q.x, q.z, 3.6);
    shot({ from: () => v3(L.pos.x + w[0] * 3.8 - u[0] * 0.7, 0.62, L.pos.z + w[1] * 3.8 - u[1] * 0.7), look: () => v3(L.pos.x - u[0] * 0.95, 0.84, L.pos.z - u[1] * 0.95), fov: 26, key: 0.6, keySide: -1, rim: 1 });
  }, 14],
  // 5b. he goes down on a knee, his arms open: the same side, the same height
  ['05b-danny-kneels', () => {
    P.putDanny(M.x, M.z, yawTo(u[0], u[1]));
    const a = at(6.6);
    P.put(L, a.x, a.z, yawTo(-u[0], -u[1]));
    P.kneel(1, true);
    feel(D.fig, 'joy');
    D.fig.lookAt = v3(a.x, 0.95, a.z);
    P.hold(D.fig, 'L', () => at(0.42, 0.42, 0.9));
    P.hold(D.fig, 'R', () => at(0.42, -0.42, 0.9));
    shot({ from: at(0.45, 3.1, 0.62), look: at(0.2, 0, 0.92), fov: 34, key: 0.9, keySide: -1, rim: 0.8 });
  }],
  // 6. the embrace: from the west, at a child's height - the two of them and the wheel
  ['06-hug', () => {
    hug();
    feel(L.fig, 'bliss');
    feel(D.fig, 'bliss');
    shot({ from: at(0.3, 3.4, 0.7), look: at(0.24, 0, 1.0), fov: 30, key: 0.8, keySide: -1, rim: 1.1 });
  }],
  // 7. her face over his shoulder: eyes shut, the sun and the sea behind her
  ['07-lily-face', () => {
    hug(-1);
    feel(L.fig, 'bliss');
    feel(D.fig, 'bliss');
    shot({ from: () => { const l = head(L); return v3(l.x - u[0] * 0.95 + w[0] * 0.7, l.y + 0.1, l.z - u[1] * 0.95 + w[1] * 0.7); }, look: () => { const l = head(L); return v3(l.x + w[0] * 0.15, l.y - 0.0, l.z + w[1] * 0.15); }, fov: 22, key: 0.5, keySide: -1, rim: 1.3, dof: 1 });
  }, 80],
  // 8. his face over her curls: eyes shut - and far behind him, soft, her uncle's board
  ['08-danny-face', () => {
    hug(2);
    feel(L.fig, 'bliss');
    feel(D.fig, 'bliss');
    shot({ from: () => { const h = head(D); return v3(h.x + u[0] * 1.05 + w[0] * 0.66, h.y - 0.22, h.z + u[1] * 1.05 + w[1] * 0.66); }, look: () => { const h = head(D); return v3(h.x - w[0] * 0.09, h.y - 0.02, h.z - w[1] * 0.09); }, fov: 24, key: 1, keySide: 1, dof: 1 });
  }, 80],
  // 9. at arm's length: his hands on her arms, looking at her - the wheel between them
  ['09-two-shot', () => {
    kneel(0.6);
    onArm('L', 'R');
    onArm('R', 'L');
    L.fig.lookAt = D.fig.j.headC;
    D.fig.lookAt = L.fig.j.headC;
    feel(D.fig, 'smirk');
    feel(L.fig, 'joy');
    shot({ from: at(0.0, 2.6, 0.92), look: at(0.32, 0, 1.0), fov: 30, key: 0.8, keySide: -1, rim: 1 });
  }],
  // 10. she laughs: over his shoulder, his hand in her curls
  ['10-giggle', () => {
    kneel(0.72);
    onArm('L', 'R');
    P.hold(D.fig, 'R', () => { const q = L.fig.j.headC; return v3(q.x - u[0] * 0.07 - w[0] * 0.05, q.y + 0.1, q.z - u[1] * 0.07 - w[1] * 0.05); });
    L.fig.lookAt = D.fig.j.headC;
    D.fig.lookAt = L.fig.j.headC;
    feel(L.fig, 'laugh');
    feel(D.fig, 'joy');
    shot({ from: () => { const l = head(L); return v3(l.x - u[0] * 1.3 + w[0] * 0.78, l.y + 0.08, l.z - u[1] * 1.3 + w[1] * 0.78); }, look: () => { const l = head(L); return v3(l.x + w[0] * 0.1, l.y + 0.02, l.z + w[1] * 0.1); }, fov: 26, key: 0.5, keySide: -1, rim: 1.2, dof: 1 });
  }],
  // 11. she has seen it over his shoulder: the board
  ['11-the-board', () => {
    kneel(0.72);
    onArm('L', 'R');
    onArm('R', 'L');
    L.fig.lookAt = v3(B.x, B.cy, B.z);
    D.fig.lookAt = L.fig.j.headC;
    feel(L.fig, 'surprised');
    shot({ from: () => { const l = head(L); return v3(l.x + u[0] * 0.75 + w[0] * 0.42, l.y + 0.12, l.z + u[1] * 0.75 + w[1] * 0.42); }, look: v3(B.x, B.cy - 0.6, B.z), fov: 17, focus: 22, keySide: 1 });
  }],
  // 12. the two of them under it, small
  ['12-under-board', () => {
    const p = { x: B.x + B.nx * 8.2, z: B.z + B.nz * 8.2 };
    P.putDanny(p.x, p.z, B.face);
    P.put(L, p.x - B.rx * 0.62, p.z - B.rz * 0.62, B.face);
    L.fig.lookAt = v3(B.x, B.cy, B.z);
    D.fig.lookAt = v3(B.x, B.cy, B.z);
    P.hold(L.fig, 'R', () => { const sh = L.fig.j.shoulderR; return v3(sh.x - B.nx * 0.34 - B.rx * 0.06, sh.y + 0.3, sh.z - B.nz * 0.34 - B.rz * 0.06); });
    onShoulder('L', 'R');
    shot({ from: v3(p.x + B.nx * 5.2 + B.rx * 0.9, 0.45, p.z + B.nz * 5.2 + B.rz * 0.9), look: v3(B.x, B.cy - 1.9, B.z), fov: 30, key: 0.5, keySide: 1 });
  }],
  // 13. him, looking up at it: dry
  ['13-danny-up', () => {
    const p = { x: B.x + B.nx * 8.2, z: B.z + B.nz * 8.2 };
    P.putDanny(p.x, p.z, B.face);
    P.put(L, p.x - B.rx * 0.62, p.z - B.rz * 0.62, B.face);
    D.fig.lookAt = v3(B.x, B.cy + 0.4, B.z);
    feel(D.fig, 'smirk');
    shot({ from: () => { const h = head(D); return v3(h.x + 1.42, h.y - 0.18, h.z + 0.62); }, look: () => { const h = head(D); return v3(h.x, h.y - 0.01, h.z); }, fov: 22, keySide: 1, dof: 1 });
  }],
  // 14. her, up at him: teasing - at her own height
  ['14-lily-up', () => {
    const p = { x: B.x + B.nx * 8.2, z: B.z + B.nz * 8.2 };
    P.putDanny(p.x, p.z, B.face);
    P.put(L, p.x - B.rx * 0.62, p.z - B.rz * 0.62, yawTo(-0.4, 0.9));
    L.fig.lookAt = D.fig.j.headC;
    feel(L.fig, 'tease');
    shot({ from: () => { const l = head(L); return v3(l.x - 0.3, l.y + 0.24, l.z + 1.22); }, look: () => { const l = head(L); return v3(l.x - 0.03, l.y, l.z); }, fov: 23, key: 0.6, keySide: -1, rim: 1.2, dof: 1 });
  }],
  // 16. the two of them laughing: from in front, the board's light on them
  ['16-laugh', () => {
    const p = { x: B.x + B.nx * 8.2, z: B.z + B.nz * 8.2 };
    P.putDanny(p.x, p.z, B.face - 0.5);
    P.put(L, p.x - B.rx * 0.62, p.z - B.rz * 0.62, yawTo(-0.3, 0.95));
    L.fig.lookAt = D.fig.j.headC;
    D.fig.lookAt = L.fig.j.headC;
    feel(L.fig, 'laugh');
    feel(D.fig, 'joy');
    shot({ from: v3(p.x - B.nx * 2.9 - B.rx * 0.3, 1.02, p.z - B.nz * 2.9 - B.rz * 0.3), look: v3(p.x - B.rx * 0.3, 1.2, p.z - B.rz * 0.3), fov: 30, keySide: -1 });
  }],
  // 17. on, hand in hand, onto the pier: the wheel open ahead of them
  ['17-to-the-wheel', () => {
    const F = { x: 56.5, z: 239.6 };
    const fx = WHEEL.x - F.x;
    const fz = WHEEL.z - F.z;
    const fd = Math.hypot(fx, fz);
    const ex = fx / fd;
    const ez = fz / fd;
    const rx = -ez;
    const rz = ex;
    const yaw = yawTo(ex, ez);
    P.putDanny(F.x, F.z, yaw);
    P.put(L, F.x + rx * 0.6, F.z + rz * 0.6, yaw);
    const hands = () => v3(D.pos.x + rx * 0.34 + ex * 0.03, 0.8, D.pos.z + rz * 0.34 + ez * 0.03);
    P.hold(D.fig, 'R', hands);
    P.hold(L.fig, 'L', hands);
    L.fig.lookAt = v3(WHEEL.x, 30, WHEEL.z);
    D.fig.lookAt = v3(WHEEL.x, 30, WHEEL.z);
    shot({ from: v3(F.x - ex * 3.4 - rx * 0.1, 0.7, F.z - ez * 3.4 - rz * 0.1), look: v3(F.x + ex * 30, 10.5, F.z + ez * 30), fov: 42, key: 0.4, keySide: -1, rim: 1 });
  }],
];
// (HANDS=1) every contact of the scene, close up from two sides: is each hand the right way round?
const HANDS = [
  ['h1-hug-her-back', () => { poseHug(); shot({ from: at(1.5, 0.75, 1.2), look: at(0.42, 0.02, 1.1), fov: 20, key: 0.8, keySide: 1 }); }],
  ['h2-hug-his-neck', () => { poseHug(); shot({ from: at(-1.0, 0.3, 1.5), look: at(0.1, 0.02, 1.25), fov: 17, key: 0.8, keySide: -1 }); }],
  ['h3-hug-side', () => { poseHug(); shot({ from: at(0.25, 1.9, 1.05), look: at(0.22, 0, 1.08), fov: 26, key: 0.8, keySide: -1 }); }],
  ['h4-arms-side', () => { poseArms(); shot({ from: at(0.32, 1.7, 1.02), look: at(0.36, 0, 1.02), fov: 26, key: 0.8, keySide: -1 }); }],
  ['h5-arms-high', () => { poseArms(); shot({ from: at(1.25, -0.75, 1.75), look: at(0.5, 0, 1.0), fov: 26, key: 0.8, keySide: 1 }); }],
  ['h6-ruffle-side', () => { poseRuffle(); shot({ from: at(0.5, 1.5, 1.2), look: at(0.5, 0, 1.2), fov: 24, key: 0.8, keySide: -1 }); }],
  ['h7-ruffle-front', () => { poseRuffle(); shot({ from: at(1.75, -0.5, 1.45), look: at(0.5, 0, 1.2), fov: 22, key: 0.8, keySide: 1 }); }],
  ['h8-open-front', () => { poseOpen(); shot({ from: at(2.2, 0.35, 0.95), look: at(0.1, 0, 1.0), fov: 26, key: 0.9, keySide: 1 }); }],
  ['h9-open-side', () => { poseOpen(); shot({ from: at(0.3, 2.0, 1.0), look: at(0.25, 0, 1.0), fov: 26, key: 0.9, keySide: -1 }); }],
  ['h10-walk-back', () => { const F = { x: 56.5, z: 239.6 }; const fd = Math.hypot(WHEEL.x - F.x, WHEEL.z - F.z); const ex = (WHEEL.x - F.x) / fd; const ez = (WHEEL.z - F.z) / fd; poseWalk(F, ex, ez); shot({ from: v3(F.x - ex * 1.3 - ez * 0.31, 1.2, F.z - ez * 1.3 + ex * 0.31), look: v3(F.x - ez * 0.31, 1.16, F.z + ex * 0.31), fov: 22, key: 0.7, keySide: -1 }); }],
  ['h11-walk-front', () => { const F = { x: 56.5, z: 239.6 }; const fd = Math.hypot(WHEEL.x - F.x, WHEEL.z - F.z); const ex = (WHEEL.x - F.x) / fd; const ez = (WHEEL.z - F.z) / fd; poseWalk(F, ex, ez); shot({ from: v3(F.x + ex * 1.3 - ez * 0.31, 1.2, F.z + ez * 1.3 + ex * 0.31), look: v3(F.x - ez * 0.31, 1.16, F.z + ex * 0.31), fov: 22, key: 0.9, keySide: 1 }); }],
  ['h12-board-back', () => { const p = poseBoard(); shot({ from: v3(p.x + B.nx * 1.6 - B.rx * 0.3, 1.25, p.z + B.nz * 1.6 - B.rz * 0.3), look: v3(p.x - B.rx * 0.3, 1.2, p.z - B.rz * 0.3), fov: 30, key: 0.7, keySide: 1 }); }],
  ['h13-board-front', () => { const p = poseBoard(); shot({ from: v3(p.x - B.nx * 1.7 - B.rx * 0.3, 1.25, p.z - B.nz * 1.7 - B.rz * 0.3), look: v3(p.x - B.rx * 0.3, 1.2, p.z - B.rz * 0.3), fov: 30, key: 0.9, keySide: -1 }); }],
];
for (const [name, setup, frames] of process.env.HANDS ? HANDS : SHOTS) {
  if (only && !only.some((o) => name.startsWith(o))) continue;
  const err = await pg.evaluate(([code, n]) => {
    const sb = window.__sb;
    try {
      sb.reset();
      new Function('sb', `with (sb) { (${code})(); }`)(sb);
      sb.step(n);
      return null;
    } catch (e) {
      return String(e && e.stack ? e.stack : e).slice(0, 400);
    }
  }, [setup.toString(), frames || 34]);
  if (err) {
    console.log(`${name}: ${err}`);
    continue;
  }
  await pg.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 180000 });
  console.log(`${name}  (${Math.round((Date.now() - t0) / 1000)} s)`);
  // (DBG=1: where their heads are, along the scene's own line and across it - to place a lens by)
  if (process.env.DBG) {
    console.log(await pg.evaluate(() => {
      const { D, L, M, u, w, head } = window.__sb;
      const uw = (p) => [((p.x - M.x) * u[0] + (p.z - M.z) * u[1]).toFixed(2), ((p.x - M.x) * w[0] + (p.z - M.z) * w[1]).toFixed(2), p.y.toFixed(2)].join(' ');
      const f3 = (p) => (p ? [p.x - D.pos.x, p.y, p.z - D.pos.z].map((x) => x.toFixed(2)).join(' ') : 'none');
      const P = window.__sb.P;
      return `   heads (along, west, up): his ${uw(head(D))} | hers ${uw(head(L))}\n   from his feet: his R wrist ${f3(D.fig.j.handR)} (asked ${f3(D.fig.reachR)}) | her L wrist ${f3(L.fig.j.handL)} (asked ${f3(L.fig.reachL)}) her L shoulder ${f3(L.fig.j.shoulderL)} | ground: his pos.y ${D.pos.y.toFixed(2)} feet ${D.fig.j.footL.y.toFixed(2)} ${D.fig.j.footR.y.toFixed(2)} hers pos.y ${L.pos.y.toFixed(2)} baseY ${L.baseY} | holds ${(P.holds || []).map((h) => h.side + (h.fig === D.fig ? 'D' : 'L')).join(',')}`;
    }));
  }
}
await close();
