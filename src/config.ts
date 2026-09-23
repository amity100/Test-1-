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
