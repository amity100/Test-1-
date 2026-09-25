import * as THREE from 'three';
import type { EncounterDef, ZoneDef } from '../../core/contracts';
import { V, addProp, box3, type Ctx } from '../tower/kit';
import { YAW, encounter, spawn } from '../tower/zonekit';
import { BOUNDS, NAV, POD, SEA_Y, START } from './layout';

const Z = 'pier' as const;

/**
 * Mission 1 in Halcyon: the pier's five lessons (door, trapdoor, return to
 * sender, slingshot, arena) in the city. Same zone id and encounter ids as
 * the pier, so its challenges, rules card and lesson flow work unchanged;
 * the three hints that name pier places get the city's own texts.
 */
export function buildMission(ctx: Ctx): ZoneDef {
  // ---------------- props: the airship's cargo pod over the warden, rift-fuel casks, trunks ----------------
  addProp(ctx, 'load', POD.pos, POD.size, { hangFrom: POD.hang, id: 'pier.hang.pod' });
  const cask = V(0.6, 0.9, 0.6);
  for (const [x, y, z] of [[9.2, 0, 41.5], [9.9, 0, 42.2], [15, 0, 26], [-12.5, 0, 40], [-7, 0, 60], [-19, 0, 17.5], [31, 6, 46], [30.3, 6, 46.7]]) addProp(ctx, 'barrel', V(x, y, z), cask, { explosive: true });
  for (const [x, y, z] of [[17.4, 3, 44.4], [-10, 0, 54], [26, 6, 68]]) addProp(ctx, 'crate', V(x, y, z), V(1.2, 1.2, 1.2));

  const encounters: EncounterDef[] = [
    // the bridge is up: a door across the rail cut onto the Terrace
    encounter(Z, 'door', box3(0, 11, -48, 30, 18, -34), [], false),
    // the River Gate: two guards looking out over the river, their backs to you
    encounter(
      Z,
      'trapdoor',
      box3(48, 5, -8, 58, 14, 2),
      [spawn(Z, 'trap.a', 'rifleman', 63.6, 6, 5.8, YAW.E, 'trap'), spawn(Z, 'trap.b', 'rifleman', 63.6, 6, 8.2, YAW.E, 'trap')],
      true,
      { pos: V(52, 6, 4), yaw: YAW.N },
    ),
    // a lone rifleman down the colonnade shoots at you through its arches
    encounter(Z, 'returnToSender', box3(42, 5, 12, 58, 14, 20), [spawn(Z, 'rts.a', 'rifleman', 46, 6, 33, YAW.S, 'rts')], true, { pos: V(50, 6, 26), yaw: YAW.N }),
    // off the Loggia roof, an AIR rift on the way down, out of the Kessler Pavilion's wall
    encounter(
      Z,
      'slingshot',
      box3(40, 13, 40, 58, 22, 72),
      [
        spawn(Z, 'sling.a', 'rifleman', 33.5, 6, 60.4, YAW.N, 'sling'),
        spawn(Z, 'sling.b', 'rifleman', 33.5, 6, 61.7, YAW.S, 'sling'),
        spawn(Z, 'sling.c', 'rifleman', 36.5, 6, 46, YAW.N, 'sling', { state: 'patrol', route: [V(36.5, 6, 46), V(36.5, 6, 68)], wait: [2.5, 2.5] }),
      ],
      true,
      { pos: V(24.5, 6, 47), yaw: YAW.W },
    ),
    // Tomorrow Square: four riflemen and a warden round the statue, the pod over the warden
    encounter(
      Z,
      'arena',
      box3(12, -1, 40, 24, 12, 56),
      [
        spawn(Z, 'arena.w', 'warden', 6, 0, 48, YAW.E, 'arena'),
        spawn(Z, 'arena.a', 'rifleman', 10, 0, 21, YAW.N, 'arena', { state: 'patrol', route: [V(10, 0, 21), V(10, 0, 39)], wait: [3, 3] }),
        spawn(Z, 'arena.b', 'rifleman', -14, 0, 30, YAW.S, 'arena'),
        spawn(Z, 'arena.c', 'rifleman', -8, 0, 64, YAW.S, 'arena'),
        spawn(Z, 'arena.d', 'rifleman', -20, 0, 18, 0.7, 'arena'),
      ],
      true,
      { pos: V(-4, 0, 8), yaw: YAW.S },
    ),
  ];
  // The square is in view from the Belvedere on, and a door or a 6 m drop off
  // the Terrace lands you in it early: its men stand there from the start (so
  // nobody is ever placed in front of you; unengaged, they see little). The
  // café squad is placed while you're still on the walkway (or mid-square),
  // 30 m or more from any of them, behind the Hall or the Loggia House.
  encounters.find((e) => e.lesson === 'arena')!.spawnAhead = Infinity;
  encounters.find((e) => e.lesson === 'slingshot')!.spawnAhead = 40;
  // the pier's hints talk about its channel, sea and stack: these three speak of the city
  for (const e of encounters) if (e.lesson === 'door' || e.lesson === 'trapdoor' || e.lesson === 'slingshot') e.hintKey = `hint.halcyon.${e.lesson}`;

  return {
    id: Z,
    nameKey: 'zone.pier.name',
    subKey: 'zone.pier.sub',
    bounds: new THREE.Box3(BOUNDS.min.clone(), BOUNDS.max.clone()),
    nav: NAV.map((n) => ({ ...n })),
    playerStart: START.pos.clone(),
    startYaw: START.yaw,
    killY: SEA_Y,
    sea: true,
    encounters,
    exit: null,
    challenges: ['pier.1', 'pier.2', 'pier.3'],
  };
}
