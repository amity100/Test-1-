import type * as THREE from 'three';

/**
 * Effect lights (the rift glows, the blast flashes) sit at intensity 0 most of
 * the time, and while a rift is open usually only two of them are lit, yet
 * every lit pixel on screen runs the full lighting maths for every light in
 * the scene, zero or not. A light at intensity 0 adds exactly 0, so leaving
 * idle lights out of the light set gives the same picture for less work.
 *
 * The light set takes only a few sizes (`sizes`, e.g. 0, 2 or all), because
 * every size is another program for every lit material: the smallest size that
 * holds every lit light is used, filled up with idle lights in list order. All
 * sizes are compiled at load (`setSize()` around the warm-up), so switching
 * never compiles mid-game.
 */
export class LightGate {
  /** How many of the lights are in the light set now. */
  size: number;
  /** The allowed set sizes, ascending, ending with every light. */
  readonly sizes: readonly number[];

  constructor(
    readonly lights: readonly THREE.Light[],
    sizes: readonly number[] = [0, lights.length],
  ) {
    const s = [...new Set([...sizes.filter((n) => n >= 0 && n < lights.length), lights.length])].sort((a, b) => a - b);
    this.sizes = s;
    this.size = lights.length;
  }

  /** Any light of the group lit? */
  static anyLit(lights: readonly THREE.Light[]): boolean {
    for (const l of lights) if (l.intensity !== 0) return true;
    return false;
  }

  /** Whether any of the group is in the light set now. */
  get on(): boolean {
    return this.size > 0;
  }

  /** The smallest allowed size that holds `lit` lights. */
  sizeFor(lit: number): number {
    for (const s of this.sizes) if (s >= lit) return s;
    return this.lights.length;
  }

  /** Before a frame renders: every lit light in the light set, in the smallest allowed set. Returns the size. */
  update(): number {
    let lit = 0;
    for (const l of this.lights) if (l.intensity !== 0) lit++;
    this.apply(this.sizeFor(lit));
    return this.size;
  }

  /** A set of `size` lights (for the warm-up): the lit ones first, then idle ones in list order. */
  setSize(size: number) {
    this.apply(this.sizeFor(size));
  }

  private apply(size: number) {
    this.size = size;
    let room = size;
    for (const l of this.lights) {
      l.visible = l.intensity !== 0 && room > 0;
      if (l.visible) room--;
    }
    for (const l of this.lights) {
      if (l.visible || l.intensity !== 0 || room === 0) continue;
      l.visible = true;
      room--;
    }
  }
}
