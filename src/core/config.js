// Central tuning table. Everything gameplay-related that a designer would want to tweak lives here.
export const CONFIG = {
  version: '0.1.0',

  // World / physics
  gravity: 22,
  stepHeight: 0.42,          // ledges lower than this are stepped over
  vaultHeight: 1.35,         // ledges lower than this can be vaulted with Space
  fixedDt: 1 / 60,
  maxSubSteps: 4,

  // Time
  architectTimeScale: 0.12,
  hitStopScale: 0.35,

  // Player
  player: {
    walkSpeed: 3.2,
    runSpeed: 6.2,
    crouchSpeed: 1.8,
    aimSpeedMul: 0.7,
    accel: 28,
    friction: 18,
    jumpVelocity: 6.5,
    radius: 0.38,
    height: 1.8,
    crouchHeight: 1.25,
    eyeHeight: 1.62,
    maxHealth: 100,
    healthRegenDelay: 6,
    healthRegenRate: 12,
    grenades: 3,
    interactTime: 1.4,
  },

  camera: {
    fov: 62,
    aimFov: 42,
    distance: 3.0,
    aimDistance: 1.7,
    shoulder: 0.65,
    height: 1.55,
    lag: 14,
    sensitivity: 0.0022,
  },

  // Weapons
  weapons: {
    rifle: {
      name: 'M4 Carbine',
      damage: 26,
      headMul: 2.4,
      rpm: 650,
      magSize: 30,
      reserve: 180,
      reloadTime: 2.1,
      spreadHip: 0.035,
      spreadAim: 0.008,
      spreadMove: 0.03,
      spreadPerShot: 0.012,
      spreadRecover: 0.12,
      recoil: 0.018,
      range: 120,
      tracerSpeed: 260,
    },
    enemyRifle: {
      name: 'AK-103',
      damage: 9,
      headMul: 2.0,
      rpm: 480,
      magSize: 30,
      reloadTime: 2.6,
      spread: 0.05,
      range: 90,
      burst: [2, 5],
      burstPause: [0.5, 1.3],
    },
    squadRifle: {
      name: 'HK416',
      damage: 22,
      headMul: 2.0,
      rpm: 560,
      magSize: 30,
      reloadTime: 2.2,
      spread: 0.03,
      range: 100,
      burst: [3, 6],
      burstPause: [0.35, 0.9],
    },
    grenade: {
      fuse: 3.2,
      radius: 6.5,
      damage: 140,
      throwSpeed: 15,
      bounce: 0.35,
    },
  },

  // Enemy AI
  enemy: {
    maxHealth: 100,
    visionRange: 34,        // target standing in light
    visionRangeDark: 13,    // target in darkness
    fovDeg: 115,
    hearGunshot: 45,
    hearFootsteps: 9,
    hearModule: 16,
    reactionTime: 1.1,
    memoryTime: 6,
    searchTime: 12,
    walkSpeed: 2.4,
    runSpeed: 5.0,
    radius: 0.38,
    height: 1.8,
    coverSearchRadius: 14,
    preferredRange: [8, 22],
    grenadeCooldown: 14,
    grenadeMinRange: 7,
    grenadeMaxRange: 26,
    hiddenBeforeGrenade: 5,
    flankAfterSuppressed: 7,
    alertRadioDelay: 1.2,
    alertRadioRange: 40,
    accuracyBase: 0.62,    // hit probability at close range, standing target
    accuracyFalloff: 22,   // meters at which accuracy halves
  },

  squad: {
    maxHealth: 120,
    downedTime: 40,
    reviveTime: 3,
    walkSpeed: 3.4,
    runSpeed: 5.8,
    followDistance: 3.2,
    visionRange: 40,
    fovDeg: 160,
  },

  hostage: {
    maxHealth: 110,
    walkSpeed: 2.6,
    runSpeed: 4.6,
    followDistance: 2.4,
  },

  // Architect
  architect: {
    energyMax: 100,
    energyRegen: 3.5,          // per real-time second while NOT in architect mode
    energyRegenInArchitect: 1.0,
    reachRadius: 20,           // must be within this of a squad member / player
    cameraHeight: 26,
    cameraTilt: 58,            // degrees below horizon
    minZoom: 12,
    maxZoom: 46,
    panSpeed: 22,
    enemyMemory: 4,            // seconds a spotted enemy stays on the map
    moduleNoiseRadius: 16,
  },

  // Rendering
  render: {
    shadowMapSize: 2048,
    spotShadowMapSize: 1024,
    maxPixelRatio: 1.75,
    bloomStrength: 0.42,
    bloomRadius: 0.55,
    bloomThreshold: 0.86,
    exposure: 1.18,
    rainCount: 6000,
    fogDensity: 0.016,
  },
};

export const MODULE_TYPES = {
  barrier:   { cost: 12, w: 2.0,  h: 1.05, d: 0.5,  mass: 1, cover: 'low',  climb: true,  label: 'module.barrier' },
  panel:     { cost: 22, w: 3.0,  h: 2.6,  d: 0.25, mass: 2, cover: 'high', climb: false, label: 'module.panel' },
  container: { cost: 38, w: 6.0,  h: 2.6,  d: 2.45, mass: 4, cover: 'high', climb: true,  label: 'module.container' },
  crate:     { cost: 8,  w: 1.2,  h: 1.0,  d: 1.2,  mass: 1, cover: 'low',  climb: true,  label: 'module.crate' },
  ramp:      { cost: 26, w: 2.4,  h: 2.6,  d: 4.8,  mass: 3, cover: 'none', climb: true,  label: 'module.ramp', wedge: true },
  catwalk:   { cost: 30, w: 1.6,  h: 0.25, d: 5.0,  mass: 2, cover: 'none', climb: true,  label: 'module.catwalk', elevated: true },
  stairs:    { cost: 24, w: 1.6,  h: 2.6,  d: 3.6,  mass: 3, cover: 'none', climb: true,  label: 'module.stairs', wedge: true },
};
