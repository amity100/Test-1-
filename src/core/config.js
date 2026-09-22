// Central tuning table. Everything gameplay-related that a designer would want to tweak lives here.
export const CONFIG = {
  version: '0.2.0',

  // World / physics
  gravity: 22,
  stepHeight: 0.42,          // ledges lower than this are stepped over
  vaultHeight: 1.35,         // ledges lower than this can be vaulted with Space
  fixedDt: 1 / 60,
  maxSubSteps: 4,

  // Time: the world slows while the map is open and briefly after every gateway crossing.
  mapTimeScale: 0.15,
  focus: {
    worldScale: 0.3,         // world clock while focused
    playerScale: 0.8,        // the operator's own clock while focused (so you outrun the world)
    onTraversal: 1.5,        // seconds of focus granted by stepping through a gateway
    perKill: 1.5,            // each kill inside the window extends it
    max: 5,
  },

  // Gateways
  portal: {
    width: 1.7,
    height: 2.4,
    openTime: 0.5,
    closeTime: 0.3,
    nearDistance: 1.7,       // the near end opens this far in front of you
    reopenDelay: 0.6,        // generator recharge between openings
    humRadius: 2.5,          // guards this close hear the opening / hum
    sightRange: 26,          // guards this far can notice an open gateway
    suspicionTime: 4,        // seconds of looking at it before they call it in
    reportTime: 5,
    viewScale: 0.6,          // render scale of the view through a gateway
    viewDistance: 45,
  },

  // Witness chain
  witness: {
    reportTime: 3.5,         // saw a kill or you
    bodyReportTime: 4.5,     // found a body
    gunshotReportTime: 5,    // heard an unsuppressed shot
    bodySightRange: 22,
    alarmSearchTime: 60,     // how long the hunt lasts after the last contact
    reinforcements: 4,
  },

  // Player
  player: {
    walkSpeed: 3.4,
    runSpeed: 6.4,
    crouchSpeed: 1.9,
    carrySpeedMul: 0.6,
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
    healthRegenRate: 14,
    grenades: 0,
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
    pistol: {
      id: 'pistol',
      name: 'hud.weapon.pistol',
      damage: 45,
      headMul: 2.6,
      rpm: 330,
      semi: true,
      magSize: 12,
      reserve: 72,
      reloadTime: 1.5,
      spreadHip: 0.018,
      spreadAim: 0.005,
      spreadMove: 0.02,
      spreadPerShot: 0.012,
      spreadRecover: 0.16,
      recoil: 0.011,
      range: 60,
      tracerSpeed: 220,
      noise: 8,              // radius in which guards hear it
      quiet: true,
    },
    rifle: {
      id: 'rifle',
      name: 'hud.weapon.rifle',
      damage: 26,
      headMul: 2.4,
      rpm: 650,
      magSize: 30,
      reserve: 150,
      reloadTime: 2.1,
      spreadHip: 0.035,
      spreadAim: 0.008,
      spreadMove: 0.03,
      spreadPerShot: 0.012,
      spreadRecover: 0.12,
      recoil: 0.018,
      range: 120,
      tracerSpeed: 260,
      noise: 45,
      quiet: false,
    },
    knife: {
      range: 1.9,            // reach from the operator's centre
      arcDeg: 80,            // the guard must be roughly in front
      alertDamage: 55,       // a guard already fighting you takes this instead of an instant kill
      noise: 3,
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
    visionRange: 28,        // target standing in floodlight
    visionRangeDark: 12,    // target in darkness
    fovDeg: 100,
    hearGunshot: 45,
    hearFootsteps: 9,
    hearModule: 16,
    reactionTime: 1.0,      // global divisor on how fast a guard makes you out
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

  hostage: {
    maxHealth: 110,
    walkSpeed: 2.8,
    runSpeed: 4.8,
    followDistance: 2.4,
  },

  // Tactical map camera
  map: {
    cameraTilt: 62,            // degrees below horizon
    minZoom: 14,
    maxZoom: 72,
    defaultZoom: 42,
    panSpeed: 26,
    enemyMemory: 5,            // seconds a spotted enemy stays on the map
    closeOnPlace: true,        // leave the map as soon as a gateway is placed
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

// Static structure kits (containers, ramps, decks…) used by the level builder.
export const MODULE_TYPES = {
  barrier:   { cost: 12, w: 2.0,  h: 1.05, d: 0.5,  mass: 1, cover: 'low',  climb: true,  label: 'module.barrier' },
  panel:     { cost: 22, w: 3.0,  h: 2.6,  d: 0.25, mass: 2, cover: 'high', climb: false, label: 'module.panel' },
  container: { cost: 38, w: 6.0,  h: 2.6,  d: 2.45, mass: 4, cover: 'high', climb: true,  label: 'module.container' },
  crate:     { cost: 8,  w: 1.2,  h: 1.0,  d: 1.2,  mass: 1, cover: 'low',  climb: true,  label: 'module.crate' },
  ramp:      { cost: 26, w: 2.4,  h: 2.6,  d: 4.8,  mass: 3, cover: 'none', climb: true,  label: 'module.ramp', wedge: true },
  catwalk:   { cost: 30, w: 1.6,  h: 0.25, d: 5.0,  mass: 2, cover: 'none', climb: true,  label: 'module.catwalk', elevated: true },
  stairs:    { cost: 24, w: 1.6,  h: 2.6,  d: 3.6,  mass: 3, cover: 'none', climb: true,  label: 'module.stairs', wedge: true },
};
