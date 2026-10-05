import * as THREE from 'three';
import type { ShotFrame } from '../gameplay/CameraRig';
import { INTRO_SHOTS } from '../content/introScript';
import { armyAt, armySlot, samuelAt, saulAt, TEAR_GRIP, TEAR_INSERT_AT, type GilgalShotName } from './gilgal/gilgalBlocking';
import { ARMY, roadZ, SAMUEL, SAUL_HALT, SUN } from './gilgal/gilgalLayout';

/**
 * THE CAMERAS OF THE OPENING FILM — CUT v3 (docs/intro-script-v3.md: 60 s, six scenes, 13 long takes of 3-6.5 s; cut5
 * on top of cut3 / cut4's compositions). Every take is a motivated move — dolly, push, crane, orbit, lateral track —
 * that runs SLOWLY across its WHOLE shot (the `drift` ease: no move finishes early and holds, none rushes, and the
 * lens is still moving at the cut), with a subtle handheld layer (applied by the player, src/gameplay/Intro.ts, from
 * TAKE_LOOK), per-take exposure and a depth-of-field target. Every timed event of a camera (the shofar, the roar's
 * jolt, G7's rack and whip) is read from the shot's named BEATS in src/content/introScript.ts, never hard-coded. The
 * sets' own camera moves (gilgalShots.ts) stay as fallbacks; the blocking (gilgalBlocking.ts, perf) drives the actors
 * and these cameras follow it.
 *
 *   Gilgal (gilgalCam):  'dustWall' G1 · 'king' G2 · 'spearRaised' G3 · 'silence' G4 · 'tear' G5a · 'tear:insert' G5b
 *                        · 'verdict' G6 · 'saulAlone' G7
 *   Land (landCam):      'flight' P1 · 'threat' P6 · 'elders' P7 — the prologue of CUT v5.2 (141.5 s, cut7); 'glint'
 *                        (CUT v2's P4) kept compiling
 *
 * A take name 'base:variant' is filmed with the blocking of `base` (actors, army) at blocking time t + TAKE_OFFSET:
 * the insert G5b continues the tear of G5a (base shot time = insert time + the length of G5a: 4.0 s in CUT v3).
 * FILM_CAM holds the numbers so the framing can be tuned live in the test harness (window.__filmCams, ?test=1).
 */
export const FILM_CAM = {
  // G1: low beside the front rank as it comes out of the dust, backing away (handheld)
  // (cut5, CUT v3: the picture comes in ON the shofar (beats.shofar 1.5) out of 1.5 s of black — the move runs over the
  //  4 s of picture, the rank gaining on the lens as it backs away; the lens holds its first pose under the black. It
  //  opens tilted up ~10° into the glowing dust — the time card, centred, is carried over the dust, never over the
  //  men's heads (they sit in the lower third) — and tilts down onto the front rank as the card melts)
  // (CUT v6.1, cut7: the cut to G2 hides in a man of the front rank passing close across the lens — G1 `wipe` 3.6. The
  //  lens no longer backs away: it stands (`back` m/s at first, still from `stop`) beside the column's southern file and
  //  the front rank reaches it; from `pan0` it pans with the rank's arrival to look across the march (north), and the
  //  southernmost file's front man walks across the frame ~0.65 m in front of it (host1's walk, w6_notes.md))
  dust: { ahead0: 5.0, back: 0.15, stop: 2.4, side0: 9.4, side1: 8.0, side0At: 0.5, side1At: 3.6, h0: 0.8, h1: 1.1, lookBack: 5, lookSide: 3.4, lookH0: 3.55, lookH1: 1.55, fov0: 44, fov1: 38, pan0: 2.3, pan1: 3.75, panLook: [-0.4, 1.25, -3.0] as [number, number, number] },
  // G2: very low in front of the striding king, tracking back with a slow push (the sun just beside his head)
  // (CUT v3: 6.5 s — the same push and arc, spread over the whole take)
  king: { d0: 4.9, d1: 3.3, lens: 0.3, side0: 1.1, side1: 0.5, lookH0: 1.32, lookH1: 1.52, lookSide: 0.95, fov0: 38, fov1: 33 },
  // G3: a SLOW push-in from low in front of the halting king across the whole shot (CUT v3: 5 s), the lens tilting up
  // with the spear (beats.halt -> spearUp) and the jolt + a small punch of the lens on THE ROAR (beats.roar 1.7)
  spear: { d0: 10.8, d1: 5.2, dirX: 0.9, dirZ: 0.44, h0: 0.82, h1: 0.46, lookH0: 1.65, lookH1: 2.35, lookBack: 0.7, fov0: 42, fov1: 36, punch: 1.6 },
  // G4: between the soldiers' shoulders, pushing toward Samuel in the road; the ranks part
  // (the lane between files 8 and 9 of the formation, the lens just over the men's heads — their heads, shoulders
  //  and spears in the lower frame, never across it; Saul soft at frame left, Samuel clear beyond him)
  // (cut4: the lens starts further back — behind rank ~6 — so the ranks parting fill the near / mid-ground, and the push
  //  continues on a lengthening lens: Samuel >= 35 % of the frame height at the end with his G4 mark nearer the army)
  // (CUT v3: 4 s — the same lane and push (cut4's verified lens positions: between ranks 6 and 7 at the start, clear of
  //  every man), now running to the cut on the drift ease; the lens lengthens a little further (8 -> 7.4°: Samuel
  //  measured 37 % of the picture height at 8.2°) so he ends at ~40 % of the picture height)
  // (cut7, CUT v5.2, 6.5 s — the old man must READ and the space must be G5a's: the lens starts between the shoulders
  //  of the front rank on the lane (files 8 | 9), creeps while the roar ebbs and the heads turn, pushes through the
  //  front rank once it has stepped aside (`part`) and across the gap to the king's right shoulder — Saul's eye-line,
  //  his head and shoulder soft at frame left — while Samuel walks up the road to him (gilgalBlocking.samuelG4): full
  //  figure by the verse, knee-up at the end, his face and hair clear, 1.85 m before the king as in the tear.
  //  Keys: [shot s, x from Saul's halt, lateral from the road's centre (+ = south), height over the ground] — every
  //  channel a monotone cubic (still drifting at the cut); the look on Samuel's face, `lookSide` m to frame right of it)
  silence: {
    // (the lens keeps >= 0.9 m from the front rank until it has stepped aside — Crowd.nearHide never pops a man — and
    //  >= 1.6 m to the king's right, so his back never covers the old man: probed at 640x360, desktop-high)
    keys: [[0, -6.6, 1.575, 1.7], [1.2, -6.48, 1.6, 1.71], [1.75, -5.65, 1.65, 1.74], [3.0, -3.6, 1.7, 1.8], [3.8, -2.85, 1.68, 1.83], [6.5, -2.05, 1.62, 1.85]] as [number, number, number, number][],
    // the lens lengthens from `part` to the cut: Samuel knee-up -> waist-up, the king's shoulder at the frame's left
    lookSide: -0.3, lookH: 1.52, fov0: 31, fov1: 20, clear: 0.6,
  },
  // G5a: a medium-wide two-shot from the south at chest height (bodies ~70 % of the frame), a slow lateral move
  // west -> east with the action (cut4: backlit by the tear's cheated sun, GilgalSet.setSunCheat)
  // (CUT v3: the lateral move runs over the whole 4 s — Samuel's turn-step, Saul's plea, the lunge and the grip)
  tear: { dx0: -1.0, dx1: 0.65, dz0: 6.65, dz1: 6.05, h: 1.25, lookH: 1.02, lookX: 0.25, fov0: 30.5, fov1: 28.5 },
  // G5b (cut4): a LOW CLOSE TWO-SHOT, not a macro — the lens 0.6 m above the ground ~1.9 m SOUTH of the grip (the same
  // side of the action line as G5a: Saul frame left, Samuel frame right), looking a little up into the backlit sky;
  // the look sits between the fist and Saul's face and follows the real hand a little
  // (framed on the fist at the insert's first frame — the blocking's TEAR_GRIP: Saul's head ~0.6 m west of it on the
  //  left third, Samuel walking away ESE on the right third; the look at chest height of the kneeling king)
  // (CUT v3: 5 s of slow motion — a slow drift east and a small push over the whole insert; the look a little higher and
  //  the lens a little wider than cut4's: with perf's CUT v3 knee mark the kneeling king's head touched the top edge)
  // (cut7, CUT v6 — G5b is the payoff of the cold open C0: the push goes further in on the fist and the corner, the
  //  lens tightening, so the rip lands on the image the film opened with — the fist, the dark wool, the sun behind it)
  insert: { dx0: -0.18, dx1: 0.08, dz0: 2.34, dz1: 1.82, h0: 0.6, h1: 0.66, lookX: 0.05, lookH: 0.88, follow: 0.2, fov0: 39, fov1: 32 },
  // G6 (cut4): a medium close-up on Samuel, 3/4 FRONT from the south-west at eye level — the lens on the line from
  // Samuel toward Saul turned `rot` deg toward the lens side (his eyeline ~off-lens left), a slow 6 % push; the look
  // shifted `lookLeft` m to frame left (his face on the right third, the verse in the left negative space)
  // (CUT v3: 6 s — the slow push runs through the speech and the held silence after it, ~9 %)
  verdict: { d0: 2.08, d1: 1.9, rot: 42, eyeH: 1.55, dh0: 0.0, dh1: 0.015, lookLeft: 0.12, lookDown: 0.1, follow: 0.55, fov0: 22, fov1: 20.5 },
  // G7: the fist and his face; a slow push, the focus pull, the whip up into the light at the end
  // (cut4, director-notes-v5 G7: OPEN on the fist with the torn corner and its tzitzit against the coat, then the tilt
  //  up and the rack focus to his face looking down; the lens rises with the tilt)
  //  (the lens on his NORTH side: the fist with the torn corner is held on his south side, so it never covers his face)
  //  (CUT v3, 3 s: the rack fist -> face from just after beats.lookDown (`tilt0` s after it) to `tilt1` s before
  //   beats.tighten; the whip up into the light starts `whipLead` s before beats.flash and runs into the cut)
  // (CUT v6.1, cut7: G7 is WHAT SAMUEL SEES — the eyeline cut on G6 `lookDown`: the lens at his eyes ~1.5 m east of the
  //  king kneeling at his feet, looking down on the fist and the bowed head; it rises past him into the low sun at the
  //  end. Samuel is not in the frame — the performance hides him)
  alone: { dx0: 1.42, dx1: 1.22, dz0: 0.12, dz1: 0.02, h0: 1.52, h1: 1.46, fov0: 26, fov1: 27.5, mix0: 0.04, mix1: 0.8, tilt0: 0.1, tilt1: 0.2, whipLead: 0.05, whip: 6 },
  // P1 'flight' (cut7, CUT v5): ONE slow, majestic flight over the hills of Judah at dawn — 8 s of picture after the
  // black (P1 beats.picture 3.0). Keys in the judah set's metres (Bethlehem at the origin, +x east, +z SOUTH, alt =
  // metres above the sea): [t (shot s), x, alt, z, bearing (compass deg), pitch (deg, - = down), roll (deg, - = banking
  // right), fov]; every channel a C1 monotone cubic (no overshoot), still moving at the cut (the dissolve carries it on).
  //  3.0  over the sea of clouds ~1.1 km east of Bethlehem, looking east into the sunrise over Moab: the deck below,
  //       breaking up eastward over the desert, the Dead Sea's glint and the Moab wall beyond (LandSet: deck 1000-1300 m)
  //  4.6-6.4  gliding east and sinking onto the cloud tops, beginning to bank right (south): the heads slide under the lens
  //  6.4-8.0  through the deck (its broken eastern part; the fastest part of the turn and of the sink inside the cloud)
  //  8.0-11   below it: the hills of Judah in the valley fog, terraces and olives below, banking on round to the west-
  //           north-west until Bethlehem's ridge is ahead (the town ~1.3 km away a little right of centre, the low sun
  //           behind the lens' right shoulder) — cut8's P2 'bethlehem' opens on the same heading (bearing ~300), lower
  //           (85-90 m over the ground): the moving dissolve carries this flight on under it
  // The deck's cover thins from `thinAt` (the morning burning it off) so the end view has broken, under-lit clouds over
  // the ridge, not a ceiling. Speeds: ~60 m/s along the path, the sink ~45 m/s over the clouds, ~160 m/s through them.
  flight: {
    keys: [
      [2.0, 1030, 1468, 228, 97, -6, 0, 50],
      [3.0, 1060, 1455, 230, 98, -6.5, -0.5, 50],
      [4.6, 1150, 1418, 240, 106, -8, -2, 49],
      [6.4, 1250, 1335, 278, 128, -11, -4.5, 47],
      [7.2, 1295, 1200, 318, 160, -21, -6.5, 45.5],
      [8.0, 1312, 1015, 380, 205, -16, -7.5, 44],
      [9.6, 1268, 905, 505, 250, -10, -6, 42.5],
      [11.0, 1170, 850, 598, 282, -8, -3, 41],
      [12.4, 1075, 815, 650, 297, -7.5, -1.2, 40],
    ] as [number, number, number, number, number, number, number, number][],
    minAGL: 60,
    // (cut7, CUT v6 — P1 is 6.5 s: "straight into the most beautiful part of the dawn flight"): the keys are CUT v5's
    // clock; the shot plays them from `t0` at `rate` (flightT): over the cloud sea in the sunrise, the dive through the
    // gap in the deck at 2.7-3.6 s, out under it over the ridges as the land card comes up (3.2)
    t0: 4.0,
    rate: 1.1,
    // (wave 4 — the orchestrator: ~1 s of flat lavender fog inside the deck at 7-8 s) the flight dives through a GAP
    // in the deck ([x, z, x radius, z radius] m, clear within 45 % of the radii), long to the south the way the lens
    // looks on its way down: the gap opens ahead as the lens nears it (the deck breaking up), the lens pitches down
    // into it (keys 7.2-8.0) and sees the hills through it, its walls sliding past the frame's edges
    hole: [1300, 640, 330, 680] as [number, number, number, number],
    thinAt: [7.0, 10.2] as [number, number],
    // the last 1.5 s warmer (grade highlight warmth +warmAdd, FilmStage's judah handle) into P2's warm morning
    warmAt: [9.5, 11.0] as [number, number],
    // (wave 4 — "P1's end still darker and redder than P2": less red, the light opened further below, and the blue-
    //  violet haze away from the sun warmed toward P2's gold over warmAt: measured mean RGB at the cut 122/91/81 vs
    //  P2's 143/112/60 before the haze shift)
    warmAdd: 0.02,
    hazeShift: 0.75,
    thinTo: 0.38,
  },
  // P6 'threat' (cut7, CUT v5.2, 10 s — the user: "clearer from the start and better looking"): ON the host from the
  // first frame. A low lens beside the road ahead of the column on the marching men's right (their sunlit flank; the
  // morning sun behind the lens' left shoulder), looking back WNW down the road toward Ashdod — the direction P5's map
  // was descending in: the elite front ranks (bronze helmets, scale corselets, round shields, spears) and the feather
  // crowns behind them march at the lens out of their own dust, large and clear, the column soft behind them. The lens
  // holds its place while they come on (to the beat `crane`), then ONE slow crane move up and back (every distance log-
  // interpolated on a smoothstep that is still moving at the cut): the column revealed stretching back down the road
  // to Ashdod's tell, the plain hazy, the sea's pale band beyond. The lens stays low enough that the plain is always seen
  // at a grazing angle (no field pattern), the sky's upper third free for the card (right) and 13:19 (left).
  // ahead / side: the lens from the head's position at t = 0 (world: it stands still until `rise`); back / lookSide:
  // the look point behind the head NOW (it marches 1.2 m/s at the lens); h / lookH over the ground.
  // (probed at 640x360, desktop-high: the elite front rank ~9 m off at the first frame, ~70 % of the picture height;
  //  the crane ends ~7 m up, ~33 m ahead of the head: the column from the lower frame back to Ashdod's tell)
  // (CUT v6: 7 s, the crane from `crane` 2.4 over 6.4 s — still rising at the cut)
  // (the crane starts on the contract's beat `crane` (2.0 s; the score thins the near footfall with it) and runs
  //  `riseLen` s on a smoothstep — still moving at the cut)
  threat: { ahead0: 9.5, ahead1: 56, side0: 4.1, side1: 15, h0: 1.15, h1: 10, back0: 6, back1: 130, lookSide0: 1.3, lookSide1: 0, lookH0: 1.42, lookH1: 0, fov0: 20, fov1: 25, riseLen: 6.4, contrast: 1.1, focusBack: 1.0, fStop: 5.6 },
  // P4 (cut4): a long lens AHEAD of the column on the marching men's right, 1.45 m high, looking back down its length:
  // the column comes diagonally toward the lens, its nearest file (the right edge, lat +2.75) large and soft at the
  // frame's right edge, the rest receding into the dust; the lens retreats slower than the march and trucks in
  coast: { ahead0: 11.5, ahead1: 10.5, side0: 4.9, side1: 4.3, h: 1.45, lookBack: 60, lookSide: 0.9, lookH: 1.5, fov0: 11.5, fov1: 10, march: 1.2 },
  // P5 (cut4): a LOW dolly (the elders' eye height) into the gathering toward Samuel in the gateway, in the gate's frame
  // (x along the wall, z out of the gate; Samuel at z 1.4): the near pair (marks 6-7) slide out past the frame edges,
  // the arc and the rising speaker in the mid-ground, Samuel right of centre, the verse high over the wall
  // (cut7, CUT v5 P7 — the CONFRONTATION, 8 s, late afternoon. A low two-shot from Samuel's right side, just outside
  //  the gateway, looking across him at the speaker on the RIGHT bench (landSites mark 0, facing Samuel = facing the
  //  lens ~15 deg off: three-quarter FRONT as he rises at `rise` and throws his arm up at `verse`, lit by the low
  //  west sun he faces); Samuel large at the left of the frame (2.9 -> 2.0 m, 57-62 % of the frame height, his face
  //  three-quarter from his sunlit right) — at `away` he turns his face from the speaker across to his right and down,
  //  toward the lens (RamahPerformance); an elder in profile between them (mark 3, near LOD), another three-quarter at
  //  the right edge (mark 5). One slow push (0.8 m) and a tightening lens; the lens tilted a little up so the place
  //  card and the verse sit over the sunlit wall above every head. Probed: scratchpad/cut7/ramah_comp2.py)
  // (wave 4: the look lower and the lens a little longer — the rising speaker in the middle of the frame, not at its
  //  foot under a wall; the place card over the sky, 8:5 over the gate's dark passage)
  // (cut7, CUT v6: 5 s — a quicker, longer push (ease-out); `snapX/Z`, `samH`, `fovSnap`: the snap onto Samuel's face at
  //  `away`)
  elders: { x0: -2.45, z0: 3.75, x1: -1.62, z1: 2.78, h0: 1.45, h1: 1.5, lookX: 1.9, lookZ: 1.25, lookH: 1.6, fov0: 33, fov1: 27, snapX: 0.15, snapZ: -0.25, samH: 1.55, fovSnap: 16 },
};

/**
 * The light cheat of the tear and the verdict (cut4): the Gilgal sun's azimuth (deg, SkySystem convention: from +Z
 * toward +X; the real sun stands at -95 = west, behind Saul) for these set-ups — NNE, so that from the cameras on the
 * south side of the action line it stands BEHIND the two men (G5a/G5b) and behind Samuel's face side (G6). Takes not
 * listed keep the real sun (G7 looks west at Saul: the real sun is behind HIM).
 * (cut7, CUT v5.2: G4 'silence' takes the same light — it ends on the two men face to face as G5a begins: the low sun
 *  behind the old man, his hair and mantle rimmed, the shadows of both falling the same way across the road)
 */
export const SUN_CHEAT: Record<string, number> = { silence: 150, tear: 150, 'tear:insert': 150, verdict: 150 };

/** blocking time offset (s) of a split take: its base shot has already run this long (the G5b insert continues the
 *  tear at the end of G5a: TEAR_INSERT_AT = the length of G5a in the sheet, 4.0 s in CUT v3).
 *  CUT v5 (cut7): G1 'dustWall' starts ON its shofar — shot time 0 = the old G1's 1.5 s (the black and the time card of
 *  CUT v3/v4 moved to P1): the army's blocking, the horns, the set's beat and the camera run on the old clock, so
 *  G1-G7 are the frames of CUT v4 (Intro pre-rolls the set through the 1.5 s under the end of P7) */
export const TAKE_OFFSET: Record<string, number> = { 'tear:insert': TEAR_INSERT_AT, dustWall: 1.5 };

/** a named beat of a take from the shared timing contract (INTRO_SHOTS), or the fallback */
/** (cut7, CUT v6) P1's shot seconds -> the flight's own clock (its keys, deck, warmth and exposure curve) */
export function flightT(t: number): number {
  return FILM_CAM.flight.t0 + t * FILM_CAM.flight.rate;
}

export function takeBeat(take: string, beat: string, fallback: number): number {
  const b = INTRO_SHOTS.find((s) => s.take === take)?.beats?.[beat];
  return typeof b === 'number' ? b : fallback;
}
/** the length (s) of a take's shot in the sheet, or the fallback */
export function takeDur(take: string, fallback: number): number {
  return INTRO_SHOTS.find((s) => s.take === take)?.dur ?? fallback;
}

/** base Gilgal shot of a take ('tear:insert' -> 'tear') */
export const baseTake = (take: string) => take.split(':')[0] as GilgalShotName;

/**
 * Per take: handheld amplitude (deg, scaled by the lens), exposure multiplier on the set's own exposure, and an
 * impulse (jolt) at shot time `jolt` of `joltAmp` deg (the roar, the shofar). Seeds keep the takes different.
 */
export const TAKE_LOOK: Record<string, { hand: number; freq?: number; exp?: number; expCurve?: [number, number][]; seed: number; jolt?: number; joltAmp?: number; calm?: [number, number] }> = {
  // the sunlit deck blows out at the set's exposure: down over the clouds, back up under them over the ridges
  // (cut7, CUT v5: P1's slow flight — a calm aerial float; the sunlit cloud tops held down, opening up under the deck)
  // (the end opened up further — x1.6 by the cut: the lens turns away from the dawn onto the ridge, and P2's morning
  //  world opens much brighter; the two meet in the dissolve)
  // (wave 4: the end opened to P2's morning — x3.2 by the cut — so the dissolve is one light)
  flight: { hand: 0.14, freq: 0.5, expCurve: [[0, 0.8], [6.0, 0.8], [7.4, 0.98], [8.6, 1.35], [9.6, 1.85], [11.0, 3.2], [12.4, 3.5]], seed: 1 },
  // (cut8, CUT v5) P3 the low dolly on the road's verge (an operator's hand), calming as the crane lifts away
  'rachel-dawn': { hand: 0.2, freq: 0.6, seed: 2, calm: [takeBeat('rachel-dawn', 'rise', 4) + 0.2, takeDur('rachel-dawn', 6)] },
  // (cut8, CUT v5) P2 the aerial drift toward Bethlehem: a helicopter's faint float
  bethlehem: { hand: 0.1, freq: 0.45, seed: 18 },
  glint: { hand: 0.2, freq: 0.8, exp: 0.8, seed: 3 },
  // (cut7, CUT v5) P6 the crane down to the host: a crane's float, calmer as it comes down onto the long lens
  threat: { hand: 0.16, freq: 0.6, exp: 1.0, seed: 3 },
  // (cut7, CUT v5) P7 the low dolly through the elders: an operator's hand, the dolly's sway
  elders: { hand: 0.22, freq: 0.7, seed: 4 },
  // (cut4: a touch more exposure — the backlit road read as dark asphalt; G1 notes)
  // (cut5, CUT v3: the long takes get a calmer hand; the jolts sit on the contract's beats: G1 the shofar blast the
  //  picture comes in on, G3 THE ROAR)
  dustWall: { hand: 0.5, freq: 1.0, exp: 1.07, seed: 5, jolt: takeBeat('dustWall', 'shofar', 1.5), joltAmp: 0.7 },
  king: { hand: 0.28, freq: 0.65, seed: 6 },
  spearRaised: { hand: 0.36, freq: 0.9, seed: 7, jolt: takeBeat('spearRaised', 'roar', 1.7), joltAmp: 1.5 },
  silence: { hand: 0.26, freq: 0.55, seed: 8 },
  tear: { hand: 0.32, freq: 0.8, seed: 9 },
  'tear:insert': { hand: 0.28, freq: 0.65, seed: 10 },
  verdict: { hand: 0.2, freq: 0.55, seed: 11 },
  saulAlone: { hand: 0.26, freq: 0.7, seed: 12 },
  figure: { hand: 0.2, freq: 0.5, seed: 13 },
  face: { hand: 0.16, freq: 0.5, seed: 14 },
  // (cut6, CUT v4) D3 'horizon': the crane's operator — a subtle float, calmer as it rises; it fades out over the glide
  // into the gameplay camera (`calm` = shot seconds) so the last frame is exactly the game's
  // (cut8, CUT v5) D3 'watch' over his shoulder: a calm hand; D4 'horizon' (18 s, one take): the follow lens' operator,
  // settling to nothing over the glide into the gameplay camera (`calm` = shot seconds)
  watch: { hand: 0.15, freq: 0.5, seed: 19 },
  horizon: { hand: 0.15, freq: 0.45, seed: 17, calm: [takeBeat('horizon', 'settle', 14.6), takeDur('horizon', 18) - 0.15] },
  // the bear's hook in gameplay (src/gameplay/BearHook.ts, CUT v3's H1 / H2)
  thicket: { hand: 0.34, freq: 0.8, seed: 15 },
  lamb: { hand: 0.24, freq: 0.6, seed: 16 },
  // (map1, CUT v5) P4 'exodus' / P5 'tribes' — the realistic 3D map (src/film/map): a satellite's calm, only a faint
  // drift of the hand; the SAME entry for both takes so the noise (on the film clock) runs on across the invisible cut
  exodus: { hand: 0.05, freq: 0.32, seed: 18 },
  tribes: { hand: 0.05, freq: 0.32, seed: 18 },
};

/** horizontal direction toward the low western sun of the Gilgal set */
const toSunH = (() => {
  const az = THREE.MathUtils.degToRad(SUN.azimuth);
  return new THREE.Vector3(Math.sin(az), 0, Math.cos(az)).normalize();
})();

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (u: number) => u * u * (3 - 2 * u);
const ss = (a: number, b: number, x: number) => smooth(clamp01((x - a) / (b - a)));
/**
 * The ease of every camera move of CUT v3 (cut5): 60 % smoothstep + 40 % linear over the WHOLE shot. The move starts
 * and ends gently but never stops (the lens still drifts at 40 % of its mean speed at a cut: the cuts fall on motion),
 * its peak is only 1.3x the mean speed (no rush in the middle), and it never finishes early and holds.
 */
export const drift = (u: number) => {
  const x = clamp01(u);
  return 0.4 * x + 0.6 * smooth(x);
};

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

/** Positions the orchestration can read from the cast (null when the cast did not build: blocking estimates). */
export interface GilgalCtx {
  /** Saul's right hand (the grip on the mantle), world */
  saulHand?: (out: THREE.Vector3) => THREE.Vector3 | null;
  saulEyes?: (out: THREE.Vector3) => THREE.Vector3 | null;
  samuelEyes?: (out: THREE.Vector3) => THREE.Vector3 | null;
}

/** where the fist closes on the mantle's corner (the blocking's TEAR_GRIP on Samuel's tear position at blocking time t) */
function gripPoint(t: number, H: (x: number, z: number) => number, _ctx: GilgalCtx | undefined, out: THREE.Vector3) {
  const sm = samuelAt('tear', t).pos;
  out.set(sm.x + TEAR_GRIP.x, H(sm.x, sm.z) + TEAR_GRIP.y, sm.z + TEAR_GRIP.z);
  return out;
}

/**
 * Camera of a Gilgal take at normalised shot time u (0..1, linear) and blocking time t (shot seconds incl.
 * TAKE_OFFSET). Returns false when the take is not one of these (the set's own move is used).
 */
export function gilgalCam(take: string, u: number, t: number, H: (x: number, z: number) => number, out: ShotFrame, ctx?: GilgalCtx): boolean {
  const e = drift(u);
  out.roll = 0;
  switch (take) {
    case 'dustWall': {
      // G1 — the front rank comes out of the dust at the lens: the lens low beside the column's southern files,
      // a few metres ahead of the first rank and backing away slower than the march (the rank gains on us).
      // CUT v3: the shot opens on 1.5 s of black (the time card); the picture comes in ON the shofar — the move runs
      // over the picture only (shofar -> the cut), the lens holding its first pose (relative to the rank) under the black
      const c = FILM_CAM.dust;
      // (CUT v5: `t` is blocking time = shot time + TAKE_OFFSET 1.5 — the move runs from the shofar to the cut)
      const off = TAKE_OFFSET.dustWall ?? 0;
      const t0 = off + takeBeat('dustWall', 'shofar', 0), T = off + takeDur('dustWall', 4);
      const e = drift((t - t0) / Math.max(0.5, T - t0));
      const ts = Math.max(0, t - t0); // shot seconds of picture
      const a = armyAt('dustWall', t);
      const fx = a.frontX - ARMY.leadGap;
      const zr = roadZ(fx);
      // (CUT v6.1) the lens stands: it eases out of a slow backing (`back` m/s) by `stop`; the front rank reaches it
      const fx0 = armyAt('dustWall', t0).frontX - ARMY.leadGap;
      const backed = c.back * (ts < c.stop ? ts - (ts * ts * ts) / (c.stop * c.stop) + (ts * ts * ts * ts) / (2 * c.stop * c.stop * c.stop) : c.stop / 2);
      out.pos.set(fx0 + c.ahead0 + backed, 0, zr + lerp(c.side0, c.side1, ss(c.side0At, c.side1At, ts)));
      out.pos.y = H(out.pos.x, out.pos.z) + lerp(c.h0, c.h1, e);
      out.look.set(fx - c.lookBack, 0, zr + c.lookSide);
      out.look.y = H(out.look.x, out.look.z) + lerp(c.lookH0, c.lookH1, e);
      // the pan with the rank's arrival: across the march at the end (the southern file walks across the frame)
      const pan = ss(c.pan0, c.pan1, ts);
      if (pan > 0) {
        _a.set(out.pos.x + c.panLook[0], out.pos.y - lerp(c.h0, c.h1, e) + c.panLook[1], out.pos.z + c.panLook[2]);
        out.look.lerp(_a, pan);
      }
      out.fov = lerp(c.fov0, c.fov1, e);
      out.roll = (-0.025 + 0.02 * e) * (1 - pan);
      return true;
    }
    case 'king': {
      // G2 — very low in front of him on the line away from the sun (he walks east, the sun low in the west behind
      // him): the sun disc just beside his head, rim light through the dust; tracking back with him, a slow push and
      // a small arc; his figure on the right third, the sky's negative space on the left for the name
      const c = FILM_CAM.king;
      const s = saulAt('king', t).pos;
      const g = H(s.x, s.z);
      const D = lerp(c.d0, c.d1, e);
      out.pos.set(s.x - toSunH.x * D, 0, s.z - toSunH.z * D + lerp(c.side0, c.side1, e));
      out.pos.y = H(out.pos.x, out.pos.z) + c.lens;
      out.look.set(s.x, g + lerp(c.lookH0, c.lookH1, e), s.z + c.lookSide);
      out.fov = lerp(c.fov0, c.fov1, e);
      out.roll = 0.018 * Math.sin(u * 2.2);
      return true;
    }
    case 'spearRaised': {
      // G3 — the halt: a SLOW push-in from low in front of him (east, the sun and the army's dust behind him) across
      // the whole shot (CUT v3: 5 s); the lens tilts up with the spear (halt -> spearUp) and kicks on THE ROAR (the
      // handheld jolt of TAKE_LOOK + a small punch-in of the lens), then keeps pushing through the roar to the cut
      const c = FILM_CAM.spear;
      const s = saulAt('spearRaised', t).pos;
      const g = H(s.x, s.z);
      const halt = takeBeat('spearRaised', 'halt', 0.6), up = takeBeat('spearRaised', 'spearUp', 1.3), roar = takeBeat('spearRaised', 'roar', 1.7);
      const d = lerp(c.d0, c.d1, e);
      _a.set(c.dirX, 0, c.dirZ).normalize();
      out.pos.copy(s).addScaledVector(_a, d);
      out.pos.y = H(out.pos.x, out.pos.z) + lerp(c.h0, c.h1, e);
      out.look.copy(s).addScaledVector(_a, -c.lookBack);
      out.look.y = g + lerp(c.lookH0, c.lookH1, ss(halt - 0.1, up + 0.55, t));
      // a small punch-in of the lens on the roar
      const punch = t > roar ? Math.exp(-(t - roar) / 0.24) : 0;
      out.fov = lerp(c.fov0, c.fov1, e) - c.punch * punch;
      out.roll = 0.026 * (1 - e) - 0.01 * e;
      return true;
    }
    case 'silence': {
      // G4 (cut7, CUT v5.2) — the roar ebbs: from between the front rank's shoulders the lens creeps, then pushes
      // through the parted rank to the king's right shoulder (his eye-line) while the old man walks up the road and
      // stands before him (FILM_CAM.silence). The lens is kept clear of the men (their formation slots).
      const c = FILM_CAM.silence;
      const sam = samuelAt('silence', t).pos;
      // (CUT v6: the keys are timed on CUT v5.2's beats — part 1.0, step 2.8, 6.5 s; they are played on the contract's
      //  beats now: the shot's time mapped piecewise onto that clock)
      const P = takeBeat('silence', 'part', 1.0), S = takeBeat('silence', 'step', 2.8), D = takeDur('silence', 6.5);
      const tk = t <= P ? t * (1.0 / P) : t <= S ? 1.0 + ((t - P) * 1.8) / (S - P) : 2.8 + ((t - S) * 3.7) / Math.max(0.1, D - S);
      const ch = (i: number) => monotone(c.keys.map((k) => [k[0], k[i]] as [number, number]), tk);
      out.pos.set(SAUL_HALT.x + ch(1), 0, roadZ(SAUL_HALT.x) + ch(2));
      clearOfArmy(out.pos, 'silence', t, c.clear);
      out.pos.y = H(out.pos.x, out.pos.z) + ch(3);
      out.look.set(sam.x, H(sam.x, sam.z) + c.lookH, sam.z + c.lookSide);
      // (still lengthening at the cut)
      out.fov = lerp(c.fov0, c.fov1, ss(takeBeat('silence', 'part', 1.0), takeDur('silence', 6.5) + 1.2, t));
      return true;
    }
    case 'tear': {
      // G5a — the wide profile from the south (the sun at frame left behind Saul): Samuel turns to go (east, frame
      // right), Saul lunges after him; the lens drifts with the action and closes in a little
      const c = FILM_CAM.tear;
      const sa = saulAt('tear', t).pos, sm = samuelAt('tear', t).pos;
      _a.copy(sa).lerp(sm, 0.5);
      out.pos.set(_a.x + lerp(c.dx0, c.dx1, e), 0, _a.z + lerp(c.dz0, c.dz1, e));
      out.pos.y = H(out.pos.x, out.pos.z) + c.h;
      out.look.set(_a.x + c.lookX + 0.45 * e, H(_a.x, _a.z) + c.lookH, _a.z);
      out.fov = lerp(c.fov0, c.fov1, e);
      return true;
    }
    case 'tear:insert': {
      // G5b — the low close two-shot (slow motion): the lens 0.6 m above the sand ~1.9 m south of the grip, looking a
      // little up so the backlit sky sits behind the two men — Saul kneeling in profile at frame left, the fist in the
      // dark wool in the middle near the horizon line, Samuel's legs and the lower me'il walking away at frame right;
      // a slow lateral drift east and a small push. The look follows the real fist only a little (no jitter).
      const c = FILM_CAM.insert;
      gripPoint(TEAR_INSERT_AT, H, ctx, _b);
      out.pos.set(_b.x + lerp(c.dx0, c.dx1, e), 0, _b.z + lerp(c.dz0, c.dz1, e));
      out.pos.y = H(out.pos.x, out.pos.z) + lerp(c.h0, c.h1, e);
      const gy = H(_b.x, _b.z);
      out.look.set(_b.x + c.lookX, gy + c.lookH, _b.z);
      const hand = ctx?.saulHand?.(_c);
      if (hand && hand.distanceTo(_b) < 1.2) out.look.x += (hand.x - _b.x) * c.follow;
      out.fov = lerp(c.fov0, c.fov1, e);
      out.roll = 0.012;
      return true;
    }
    case 'verdict': {
      // G6 — a medium close-up on Samuel, 3/4 front at eye level from the lens side of the action line (south-west of
      // him): the lens on the line Samuel -> Saul turned `rot` deg south, so his eyes on Saul read just off-lens LEFT;
      // the tear's cheated sun stands behind him on that side (rim through the hair and beard); Saul at most a dark soft
      // edge at frame left. A slow 6 % push; the look follows his head a little (an operator, not a lock).
      const c = FILM_CAM.verdict;
      const sa = saulAt('verdict', t).pos, sm = samuelAt('verdict', t).pos;
      const g = H(sm.x, sm.z);
      _a.set(sa.x - sm.x, 0, sa.z - sm.z).normalize().applyAxisAngle(_up, THREE.MathUtils.degToRad(c.rot)); // Samuel -> lens
      const d = lerp(c.d0, c.d1, e);
      out.pos.set(sm.x + _a.x * d, g + c.eyeH + lerp(c.dh0, c.dh1, e), sm.z + _a.z * d);
      _b.set(sm.x, g + c.eyeH, sm.z);
      const eyes = ctx?.samuelEyes?.(_c);
      if (eyes && eyes.distanceTo(_b) < 0.8) _b.lerp(eyes, c.follow);
      // the lens' right = (-f.z, f.x) with f = -_a; shift the look to frame left, and a little down (the eyes on the
      // upper third, the beard and the hands' gesture in the lower frame)
      out.look.copy(_b).add(_c.set(-_a.z, 0, _a.x).multiplyScalar(c.lookLeft));
      out.look.y -= c.lookDown;
      out.fov = lerp(c.fov0, c.fov1, e);
      out.roll = 0;
      return true;
    }
    case 'saulAlone': {
      // G7 — nearly frontal, the army soft behind him in the dust and the low sun: it opens ON the fist with the torn
      // corner, tilts and racks up to his face as he looks down (beats.lookDown -> tighten), holds on the face through
      // the breath and the tighten, and at the end whips up into the light (the whip under way at beats.flash, where
      // the light-flash into David's hills begins; it runs into the cut)
      const c = FILM_CAM.alone;
      const s = saulAt('saulAlone', t).pos;
      const g = H(s.x, s.z);
      const w0 = alonePhases();
      out.pos.set(s.x + lerp(c.dx0, c.dx1, e), g + lerp(c.h0, c.h1, e), s.z + lerp(c.dz0, c.dz1, e));
      _a.set(s.x + 0.3, g + 0.72, s.z + 0.25); // the fist (he kneels)
      const hand = ctx?.saulHand?.(_c);
      if (hand) _a.lerp(hand, 0.7);
      _b.set(s.x + 0.08, g + 1.3, s.z);
      const eyes = ctx?.saulEyes?.(_c);
      if (eyes) _b.copy(eyes);
      out.look.copy(_a).lerp(_b, lerp(c.mix0, c.mix1, ss(w0.tilt0, w0.tilt1, t)));
      const w = ss(w0.whip0, w0.whip1, t);
      out.look.y += c.whip * w * w;
      out.fov = lerp(c.fov0, c.fov1, e) + 6 * w;
      out.roll = -0.05 * w;
      return true;
    }
  }
  return false;
}

/** G7's timing from the contract: the tilt / rack fist -> face and the whip into the light (shot seconds) */
function alonePhases() {
  const c = FILM_CAM.alone;
  const look = takeBeat('saulAlone', 'lookDown', 0.4), tighten = takeBeat('saulAlone', 'tighten', 1.8);
  const flash = takeBeat('saulAlone', 'flash', 2.75), T = takeDur('saulAlone', 3);
  return { tilt0: look + c.tilt0, tilt1: Math.max(look + c.tilt0 + 0.4, tighten - c.tilt1), whip0: flash - c.whipLead, whip1: T + 0.08 };
}

/** push a lens position out of the soldiers' formation slots (front ranks) so it never enters a man */
function clearOfArmy(p: THREE.Vector3, shot: GilgalShotName, t: number, clear: number) {
  const a = armyAt(shot, t);
  for (let it = 0; it < 3; it++) {
    for (let rank = 0; rank < 7; rank++) {
      for (let file = 0; file < ARMY.files; file++) {
        armySlot(file, rank, a.frontX, a.part, 0.18, _c);
        const dx = p.x - _c.x, dz = p.z - _c.z;
        const d = Math.hypot(dx, dz);
        if (d < clear && d > 1e-4) {
          const k = (clear - d) / d;
          p.x += dx * k * 0.5;
          p.z += dz * k * 0.5;
        }
      }
    }
  }
}

/**
 * Depth-of-field target of a Gilgal take (the actors' eyes / hands where the cast exists). null = the set's own.
 */
export function gilgalFocus(take: string, t: number, H: (x: number, z: number) => number, ctx: GilgalCtx | undefined, out: THREE.Vector3): { point: THREE.Vector3; fStop: number } | null {
  switch (take) {
    case 'dustWall': {
      const a = armyAt('dustWall', t);
      const fx = a.frontX - ARMY.leadGap;
      return { point: out.set(fx + 0.5, H(fx, 3) + 1.6, roadZ(fx) + 4.5), fStop: 5.6 };
    }
    case 'king': {
      const eyes = ctx?.saulEyes?.(out);
      if (eyes) return { point: eyes, fStop: 2.8 };
      const s = saulAt('king', t).pos;
      return { point: out.set(s.x, H(s.x, s.z) + 1.85, s.z), fStop: 2.8 };
    }
    case 'spearRaised': {
      const eyes = ctx?.saulEyes?.(out);
      if (eyes) return { point: eyes, fStop: 4 };
      const s = saulAt('spearRaised', t).pos;
      return { point: out.set(s.x, H(s.x, s.z) + 1.85, s.z), fStop: 4 };
    }
    case 'silence': {
      // (cut7, CUT v5.2) on the old man's eyes the whole take: the front rank's shoulders and the king soft
      const eyes = ctx?.samuelEyes?.(out);
      if (eyes) return { point: eyes, fStop: 3.2 };
      const sam = samuelAt('silence', t).pos;
      return { point: out.set(sam.x, H(sam.x, sam.z) + 1.5, sam.z), fStop: 3.2 };
    }
    case 'tear': {
      const sm = samuelAt('tear', t).pos;
      return { point: out.set(sm.x - 0.6, H(sm.x, sm.z) + 1.35, sm.z), fStop: 4 };
    }
    case 'tear:insert': {
      const hand = ctx?.saulHand?.(out);
      if (hand) return { point: hand, fStop: 2.2 };
      return { point: gripPoint(t, H, ctx, out), fStop: 2.2 };
    }
    case 'verdict': {
      const eyes = ctx?.samuelEyes?.(out);
      if (eyes) return { point: eyes, fStop: 2.0 };
      return { point: out.copy(SAMUEL.pos).setY(H(SAMUEL.pos.x, SAMUEL.pos.z) + 1.55), fStop: 2.0 };
    }
    case 'saulAlone': {
      const s = saulAt('saulAlone', t).pos;
      const g = H(s.x, s.z);
      _a.set(s.x + 0.3, g + 0.72, s.z + 0.25);
      const hand = ctx?.saulHand?.(_c);
      if (hand) _a.copy(hand);
      const eyes = ctx?.saulEyes?.(_b) ?? _b.set(s.x + 0.08, g + 1.3, s.z);
      // the rack runs with the tilt (alonePhases), a little ahead of it
      const w0 = alonePhases();
      return { point: out.copy(_a).lerp(eyes, ss(w0.tilt0 + 0.05, w0.tilt1 - 0.1, t)), fStop: 2.0 };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------- land
/** What the land takes need from their set (kept structural: no import of the land modules here). */
export interface LandCamCtx {
  /** the set's own shot at its raw parameter e (the Judah flight curve) */
  shotAt?: (name: string, e: number) => { pos: THREE.Vector3; look: THREE.Vector3; fov?: number } | null;
  height: (x: number, z: number) => number;
  coast?: { heading: THREE.Vector3; columnHead: THREE.Vector3 };
  ramah?: { samuel: THREE.Vector3; gate: THREE.Vector3; gateYaw: number };
}

/** monotone cubic through (t, v) keys (Fritsch-Carlson) — the flight's speed ramp */
function monotone(keys: readonly [number, number][], t: number): number {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) {
    // keep drifting past the last key with the last slope (never a dead stop)
    const [t0, v0] = keys[n - 2], [t1, v1] = keys[n - 1];
    return v1 + ((v1 - v0) / (t1 - t0)) * 0.35 * (t - t1);
  }
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2] * 0.55);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
  const h = t1 - t0, s = (t - t0) / h;
  const h00 = 2 * s * s * s - 3 * s * s + 1, h10 = s * s * s - 2 * s * s + s, h01 = -2 * s * s * s + 3 * s * s, h11 = s * s * s - s * s;
  return h00 * v0 + h10 * h * m[i] + h01 * v1 + h11 * h * m[i + 1];
}

/**
 * Camera of a land take (u = normalised shot time, t = shot seconds). Returns false when the take is not one of
 * these (the set's own shot is used).
 */
export function landCam(take: string, u: number, t: number, ctx: LandCamCtx, out: ShotFrame): boolean {
  const e = smooth(u);
  out.roll = 0;
  if (take === 'flight') {
    // P1 (cut7, CUT v5) — ONE slow flight on its keys (FILM_CAM.flight): over the clouds into the sunrise, through the
    // deck, banking round to Bethlehem's ridge; each channel a monotone cubic of shot seconds
    const K = FILM_CAM.flight.keys;
    const tf = flightT(t);
    const ch = (i: number) => monotone(K.map((k) => [k[0], k[i]] as [number, number]), tf);
    out.pos.set(ch(1), ch(2), ch(3));
    out.pos.y = Math.max(out.pos.y, ctx.height(out.pos.x, out.pos.z) + FILM_CAM.flight.minAGL);
    const b = THREE.MathUtils.degToRad(ch(4)), p = THREE.MathUtils.degToRad(ch(5));
    out.look.set(out.pos.x + Math.sin(b) * Math.cos(p) * 1000, out.pos.y + Math.sin(p) * 1000, out.pos.z - Math.cos(b) * Math.cos(p) * 1000);
    out.roll = THREE.MathUtils.degToRad(ch(6));
    out.fov = ch(7);
    return true;
  }
  if (take === 'threat' && ctx.coast) {
    // P6 (cut7, CUT v5.2) — on the front ranks from the first frame, then the crane up and back (FILM_CAM.threat):
    // the lens holds still while the column marches at it, then every distance is log-interpolated on one smoothstep
    // (a constant apparent rate; still moving at the cut)
    const c = FILM_CAM.threat;
    const hd = ctx.coast.heading;
    const r0 = takeBeat('threat', 'crane', 2.0);
    // (CUT v6.1: the crane EASES OUT and has arrived by `settle` — the hard cut to P7 lands on the drum hit after it,
    //  never in the middle of the move; the look stops following the marching head there too)
    const settle = takeBeat('threat', 'settle', r0 + c.riseLen);
    const k = ss(r0, settle, t);
    const tm = Math.min(t, settle);
    const L = (a: number, b: number) => a * Math.pow(b / a, k);
    _a.set(-hd.z, 0, hd.x); // the marching men's right: the sunlit flank of the main column
    out.pos.copy(ctx.coast.columnHead).addScaledVector(hd, L(c.ahead0, c.ahead1)).addScaledVector(_a, L(c.side0, c.side1));
    out.pos.y = ctx.height(out.pos.x, out.pos.z) + L(c.h0, c.h1);
    _b.copy(ctx.coast.columnHead).addScaledVector(hd, FILM_CAM.coast.march * tm); // the head now (held from `settle`)
    out.look.copy(_b).addScaledVector(hd, -L(c.back0, c.back1)).addScaledVector(_a, lerp(c.lookSide0, c.lookSide1, k));
    out.look.y = ctx.height(out.look.x, out.look.z) + lerp(c.lookH0, c.lookH1, k);
    out.fov = lerp(c.fov0, c.fov1, k);
    out.roll = 0.01 * k * Math.sin(u * 2.4);
    return true;
  }
  if (take === 'glint' && ctx.coast) {
    // P4 — a long lens (fov 11.5 -> 10) AHEAD of the column on the marching men's right, 1.45 m high, looking back
    // down its length: the column comes diagonally toward the lens, the front ranks of its nearest file large and soft
    // at the frame's right edge, the rest receding into the dust and haze; the lens retreats slower than the march
    // (the ranks gain on it) and trucks in toward the column; the morning sun behind the lens' left shoulder
    const c = FILM_CAM.coast;
    const hd = ctx.coast.heading;
    _a.set(-hd.z, 0, hd.x); // the marching men's right (the side of the host's flank columns)
    _b.copy(ctx.coast.columnHead).addScaledVector(hd, c.march * t); // the head now
    out.pos.copy(_b).addScaledVector(hd, lerp(c.ahead0, c.ahead1, e)).addScaledVector(_a, lerp(c.side0, c.side1, e));
    out.pos.y = ctx.height(out.pos.x, out.pos.z) + c.h;
    out.look.copy(_b).addScaledVector(hd, -c.lookBack).addScaledVector(_a, c.lookSide);
    out.look.y = ctx.height(out.look.x, out.look.z) + c.lookH;
    out.fov = lerp(c.fov0, c.fov1, e);
    out.roll = 0.006 * Math.sin(u * 2.6);
    return true;
  }
  if (take === 'elders' && ctx.ramah) {
    // P7 — a low dolly into the gathering toward Samuel in the gateway (gate frame: x along the wall, z out of it),
    // running across the whole 8 s on the drift ease (still moving at the hard cut into Gilgal)
    // (cut7, CUT v6, 5 s — "fast and dynamic"): a QUICK push that starts at speed (ease-out) on the rising elder and
    // his thrust-out arm; at `away` a sharp move onto Samuel's face — the look snaps across to him and the lens
    // tightens (a snap push on the long lens) as his eyes close and he turns away (8:6); still drifting at the cut
    const c = FILM_CAM.elders;
    const R = ctx.ramah;
    const ed = (1 - Math.pow(1 - 0.92 * Math.min(1, u), 2.3)) / (1 - Math.pow(0.08, 2.3));
    const cy = Math.cos(R.gateYaw), sy = Math.sin(R.gateYaw);
    const W = (lx: number, lz: number, o: THREE.Vector3) => o.set(R.gate.x + lx * cy + lz * sy, 0, R.gate.z - lx * sy + lz * cy);
    const away = takeBeat('elders', 'away', 3.4);
    const snap = ss(away - 0.1, away + 0.32, t);
    W(lerp(c.x0, c.x1, ed) + c.snapX * snap, lerp(c.z0, c.z1, ed) + c.snapZ * snap, out.pos);
    out.pos.y = ctx.height(out.pos.x, out.pos.z) + lerp(c.h0, c.h1, ed);
    W(c.lookX, c.lookZ, out.look);
    out.look.y = ctx.height(R.samuel.x, R.samuel.z) + c.lookH;
    // onto Samuel's face (his eyes ~1.58 m over his mark)
    _c.set(R.samuel.x, ctx.height(R.samuel.x, R.samuel.z) + c.samH, R.samuel.z);
    out.look.lerp(_c, snap);
    // (his face on the right third: 8:5 is still up in the left of the frame as the lens arrives)
    _b.subVectors(out.look, out.pos).cross(_a.set(0, 1, 0)).normalize();
    out.look.addScaledVector(_b, -0.13 * snap);
    out.fov = lerp(lerp(c.fov0, c.fov1, ed), c.fovSnap - 1.5 * ss(away + 0.3, takeDur('elders', 5) + 0.5, t), snap);
    out.roll = 0.008 * Math.sin(u * 3);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------- handheld
/**
 * The handheld layer: smooth, deterministic noise of film time (seek-safe) — yaw / pitch / roll within about ±1,
 * dominant frequencies ~0.5-1.2 Hz (× `freq`).
 */
function shake(t: number, seed: number, freq = 1) {
  const s = seed * 1.713;
  const w = 2 * Math.PI * freq;
  const n = (f: number, p: number) => Math.sin(t * f * w + p);
  return {
    yaw: 0.55 * n(0.53, s) + 0.3 * n(1.17, s * 1.7 + 1) + 0.15 * n(2.31, s * 2.9 + 2),
    pitch: 0.5 * n(0.71, s * 1.3 + 3) + 0.32 * n(1.05, s * 2.1 + 4) + 0.18 * n(2.13, s * 0.7 + 5),
    roll: 0.6 * n(0.41, s * 0.9 + 6) + 0.4 * n(0.93, s * 1.9 + 7),
  };
}

/**
 * Apply a take's handheld layer (TAKE_LOOK) to a frame: `t` = shot seconds, `ft` = film seconds (the noise clock).
 * Long lenses get less angular noise (it is magnified by the lens).
 */
export function applyHandheld(take: string, t: number, ft: number, f: ShotFrame) {
  const L = TAKE_LOOK[take];
  if (!L) return;
  const lens = Math.max(0.3, Math.min(1.2, (f.fov ?? 40) / 34));
  // `calm`: the hand settles to nothing between these shot seconds (D3 lands exactly on the gameplay camera)
  const still = L.calm ? 1 - ss(L.calm[0], L.calm[1], t) : 1;
  if (still <= 0) return;
  let amp = THREE.MathUtils.degToRad(L.hand) * lens * still;
  const n = shake(ft, L.seed, L.freq ?? 1);
  let yaw = n.yaw * amp, pitch = n.pitch * amp, roll = n.roll * amp * 0.6;
  if (L.jolt !== undefined && t >= L.jolt) {
    // an impulse: a sharp kick decaying in ~0.4 s, with a fast wobble
    const dt = t - L.jolt;
    const k = Math.exp(-dt / 0.16) * THREE.MathUtils.degToRad(L.joltAmp ?? 1) * lens;
    pitch += k * (0.9 * Math.cos(dt * 38) + 0.3);
    yaw += k * 0.6 * Math.sin(dt * 31 + 0.5);
    roll += k * 0.5 * Math.sin(dt * 27);
    amp += k;
  }
  _a.copy(f.look).sub(f.pos);
  const dist = _a.length();
  if (dist < 1e-6) return;
  _a.multiplyScalar(1 / dist);
  // yaw about the world up, pitch about the lens' right axis
  _q.setFromAxisAngle(_up, yaw);
  _a.applyQuaternion(_q);
  _b.crossVectors(_a, _up);
  if (_b.lengthSq() > 1e-8) {
    _b.normalize();
    _q.setFromAxisAngle(_b, pitch);
    _a.applyQuaternion(_q);
  }
  f.look.copy(f.pos).addScaledVector(_a, dist);
  f.roll = (f.roll ?? 0) + roll;
}

/**
 * Phones in portrait (Intro.portrait; FilmWorld stages the flock in the same lens): the shots are composed for a 2.39
 * frame and the lens keeps its vertical angle, so a tall screen would show only the middle of the composition. The lens
 * widens to keep ~45 % of the horizontal coverage and turns toward the shot's subject (horizontally, the tilt kept).
 * `keep` 0..1 scales the whole correction (D3 lets go of it over the glide into the game's camera).
 */
export function portraitLens(f: ShotFrame, subject: THREE.Vector3 | null, aspect: number, keep = 1) {
  if (!(aspect < 0.95) || keep <= 0) return;
  const fov = f.fov ?? 40;
  const k = 1 + (Math.min(2.6, Math.max(1, (0.45 * 2.39) / aspect)) - 1) * keep;
  const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * k);
  f.fov = Math.min(78, THREE.MathUtils.radToDeg(2 * half));
  if (!subject) return;
  const d = _a.copy(f.look).sub(f.pos);
  const dist = d.length();
  const s = _b.copy(subject).sub(f.pos);
  const sd = s.length();
  if (dist > 1e-4 && sd > 0.3) {
    d.multiplyScalar(1 / dist);
    s.multiplyScalar(1 / sd);
    d.lerp(s, 0.6 * keep).normalize();
    f.look.copy(f.pos).addScaledVector(d, dist);
  }
}

/** exposure multiplier of a take at shot second t (on top of the set's own) */
export function takeExposure(take: string, t = 0): number {
  const L = TAKE_LOOK[take];
  if (!L) return 1;
  const c = L.expCurve;
  if (!c || !c.length) return L.exp ?? 1;
  if (t <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (t <= c[i][0]) {
      const [t0, v0] = c[i - 1], [t1, v1] = c[i];
      return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
    }
  }
  return c[c.length - 1][1];
}

/** DoF focus of an orchestration take: which actor's eyes (kept for API compatibility with cut pass 2) */
export function gilgalCamFocusActor(take: string): 'saul' | 'samuel' | null {
  if (take === 'king' || take === 'spearRaised') return 'saul';
  if (take === 'verdict') return 'samuel';
  return null;
}
