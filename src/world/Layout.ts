/** World layout constants (metres = blocks). */
export const WORLD_HALF = 176;
export const ISLAND_RADIUS = 150;
export const WATER_LEVEL = 0;
export const PLOT_SIZE = 40;
export const PLOT_HALF = 20;
/** Y of the walkable plot floor (top face of the ground block layer). */
export const PLOT_Y = 12;
export const PLOT_MAX_HEIGHT = 40;
export const PLOT_RING_RADIUS = 92;
export const MAX_PLAYERS = 8;
export const ATTACK_SPAWN_RADIUS = 34;
export const ZONE_RADIUS = 46;
export const PLAYABLE_RADIUS = 126;

export interface Plot {
  index: number;
  /** Centre in world units. */
  cx: number;
  cz: number;
  /** Inclusive block bounds. */
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  /** Angle from island centre (radians). */
  angle: number;
}

export function makePlots(count: number): Plot[] {
  const plots: Plot[] = [];
  const n = Math.max(2, Math.min(MAX_PLAYERS, count));
  for (let i = 0; i < n; i++) {
    // Always use the 8-slot ring so plot positions stay stable for any player count.
    const slot = Math.round((i * MAX_PLAYERS) / n);
    const angle = -Math.PI / 2 + (slot / MAX_PLAYERS) * Math.PI * 2;
    const cx = Math.round(Math.cos(angle) * PLOT_RING_RADIUS);
    const cz = Math.round(Math.sin(angle) * PLOT_RING_RADIUS);
    plots.push({
      index: i,
      cx,
      cz,
      minX: cx - PLOT_HALF,
      minZ: cz - PLOT_HALF,
      maxX: cx + PLOT_HALF - 1,
      maxZ: cz + PLOT_HALF - 1,
      angle,
    });
  }
  return plots;
}

export function plotContains(p: Plot, x: number, z: number): boolean {
  return x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ;
}

/** Chebyshev distance from the plot's square footprint (0 inside). */
export function plotDistance(p: Plot, x: number, z: number): number {
  const dx = Math.max(p.minX - x, 0, x - (p.maxX + 1));
  const dz = Math.max(p.minZ - z, 0, z - (p.maxZ + 1));
  return Math.max(dx, dz);
}
