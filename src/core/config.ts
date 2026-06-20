export const GAME_CONFIG = {
  physicsHz: 60,
  gravity: { x: 0, y: -9.81, z: 0 },
  arenaRadius: 5.2,
  postureKoHeight: 0.72,
  postureKoSeconds: 2.2,
  puppet: { jointStiffness: 0.72, jointDamping: 0.18, anchorPull: 22, strikePull: 38, snapImpulse: 6.8 },
  stamina: { max: 100, regenPerSecond: 16, anchorCostPerSecond: 1.4, strikeCostPerSecond: 26, slackThreshold: 1, slackSeconds: 1.1 },
  replaySeconds: 8,
  seed: 1337,
} as const;
