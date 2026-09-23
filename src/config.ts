// Every value that shapes how the game *feels* lives here, so tuning never
// means hunting through systems.

export const FEEL = {
  // Player movement (m/s)
  walkSpeed: 3.1,
  crouchSpeed: 1.9,
  sprintSpeed: 6.0,
  carrySpeed: 2.1,
  accel: 14,
  airControl: 0.35,
  gravity: 22,
  jumpSpeed: 6.6,
  stepUp: 0.45,
  playerRadius: 0.34,
  playerHeight: 1.8,
  crouchHeight: 1.15,
  mantleMax: 2.75,
  mantleTime: 0.5,
  maxHealth: 100,

  // Camera
  camDistance: 3.1,
  camShoulder: 0.62,
  camHeight: 1.55,
  camCrouchHeight: 1.05,
  aimDistance: 1.75,
  aimShoulder: 0.72,
  fov: 62,
  aimFov: 50,
  lookSensitivity: 0.0022,
  touchLookSensitivity: 0.0052,
  padLookSpeed: 3.2,

  // Rift (portal) system
  portalWidth: 1.25,
  portalHeight: 2.25,
  riftRange: 60,
  riftMinDistance: 2.2,
  riftCharges: 3,
  riftRechargeTime: 6,
  nearPortalDistance: 1.45,
  portalOpenTime: 0.32,
  portalCloseTime: 0.22,
  autoCloseAfterPass: 1.6,
  focusTimeScale: 0.33,
  focusDuration: 5.0,
  focusRegen: 0.55,
  snapRadius: 3.2,
  snapRadiusTouch: 4.4,
  takedownSnapBehind: 1.25,
  wheelStep: 1.5,
  rotateStep: Math.PI / 4,
  anchorHoldTime: 0.55,
  snatchRange: 2.4,

  // Rift kills ("the rift is the blade")
  strikeReach: 24, // lock-on distance for STRIKE / DROP (travel rifts still reach riftRange)
  edgeTime: 1.5, // seconds after leaving a rift in which a takedown is possible
  strikeDash: 10, // m/s dash through a strike rift
  dropMaxAbove: 6.0, // sky rift centre above the victim's feet
  dropMinAbove: 3.9,
  chainBase: 1.5, // real seconds of "beat" after a kill
  chainStep: 0.15,
  chainMin: 0.8,
  chainTimeScale: 0.4,
  witnessTime: 1.2, // real seconds before a startled witness raises his squad
  witnessTimeNoSlow: 1.9,
  squadAlertRadius: 15,
  mateMissingTime: 8,
  hurlSpeed: 5,
  aimWarnTime: 0.45,

  // Stealth
  takedownRange: 1.9,
  guardViewDistance: 27,
  guardFovHalf: 0.95, // radians, ~54 degrees each side
  guardPeripheralHalf: 1.5,
  detectBaseRate: 0.85,
  suspicionThreshold: 0.3,
  suspicionDecay: 0.12,
  radioCheckDelay: 32,
  bodySightDistance: 17,
  portalSightDistance: 19,
  guardWalk: 1.45,
  guardRun: 4.2,
  guardFireInterval: 0.95,
  guardDamage: 34,

  // Rift action (CORE)
  entranceOpenTime: 0.12, // entrances / boss blinks open fast (crossable at once anyway)
  airDefault: 10, // air exit distance along the aim ray when nothing is hit (m past the player)
  hatchSnap: 1.6, // aim ray passing this close over a target snaps a sky hatch above it
  hatchSnapTouch: 2.2,
  hatchMaxAbove: 8, // hatch centre above the target's head, at most
  perchBand: 0.9, // aiming this close below the top of a thing perches on top of it
  floorPopSpeed: 6.5, // minimum speed out of an up-facing end (so slow things clear the hole)
  floorPopNudge: 2.2, // ...plus a sideways nudge so they land beside it
  chargedAirControl: 0.08, // flying out of a rift: momentum is honest
  slideDecel: 9, // m/s^2: a charged landing skids (rift slide) instead of stopping dead
  slideSteer: 1.5, // how fast input bends a slide (1/s)
  unengagedSight: 0.6, // enemies of a fight you haven't reached yet see this much of their calm range
  returnAssistRange: 45, // bolts out of a rift bend onto Kessler within this range...
  returnAssistCone: 0.978, // ...within ~12 deg of their path (cos)
  returnAssistSender: 0.77, // ...or ~40 deg when it's the man who fired it (Return to Sender)
  shoveTime: 0.25,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
};

export type QualityName = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityPreset {
  pixelRatio: number;
  portalViews: number;
  shadowMap: number;
  bloom: boolean;
  bloomScale: number;
  portalScale: number;
  lampLights: number;
  rainDrops: number;
  antialias: boolean;
  scryWindow: boolean;
}

export const QUALITY: Record<QualityName, QualityPreset> = {
  low: { portalViews: 1, pixelRatio: 0.75, shadowMap: 1024, bloom: false, bloomScale: 0.5, portalScale: 0.4, lampLights: 4, rainDrops: 1400, antialias: false, scryWindow: true },
  medium: { portalViews: 2, pixelRatio: 1.0, shadowMap: 1024, bloom: true, bloomScale: 0.5, portalScale: 0.5, lampLights: 6, rainDrops: 2600, antialias: false, scryWindow: true },
  high: { portalViews: 3, pixelRatio: 1.5, shadowMap: 2048, bloom: true, bloomScale: 0.5, portalScale: 0.75, lampLights: 10, rainDrops: 4200, antialias: true, scryWindow: true },
  ultra: { portalViews: 4, pixelRatio: 2.0, shadowMap: 4096, bloom: true, bloomScale: 0.5, portalScale: 1.0, lampLights: 14, rainDrops: 6500, antialias: true, scryWindow: true },
};

export const IS_TOUCH =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window) &&
  !window.matchMedia?.('(pointer: fine)').matches;

export function defaultQuality(): QualityName {
  if (IS_TOUCH) return 'medium';
  return 'high';
}
