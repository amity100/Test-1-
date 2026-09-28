/** Static circular colliders on the XZ plane (tree trunks, boulders, house walls) in a spatial hash. */
export interface Circle { x: number; z: number; r: number; tag?: string }

export class Colliders {
  private cell = 8;
  private map = new Map<number, Circle[]>();
  readonly all: Circle[] = [];

  private key(ix: number, iz: number) {
    return ((ix + 4096) << 13) ^ (iz + 4096);
  }

  add(c: Circle) {
    this.all.push(c);
    const x0 = Math.floor((c.x - c.r) / this.cell), x1 = Math.floor((c.x + c.r) / this.cell);
    const z0 = Math.floor((c.z - c.r) / this.cell), z1 = Math.floor((c.z + c.r) / this.cell);
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const k = this.key(ix, iz);
        let arr = this.map.get(k);
        if (!arr) this.map.set(k, (arr = []));
        arr.push(c);
      }
  }

  /** Is the point free of colliders (with extra radius)? */
  free(x: number, z: number, r: number) {
    const arr = this.map.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell)));
    if (!arr) return true;
    for (const c of arr) if ((c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + r) ** 2) return false;
    return true;
  }

  /** Push a moving circle out of static colliders. Mutates and returns p. */
  resolve(p: { x: number; z: number }, r: number) {
    for (let iter = 0; iter < 2; iter++) {
      const ix = Math.floor(p.x / this.cell), iz = Math.floor(p.z / this.cell);
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          const arr = this.map.get(this.key(ix + dx, iz + dz));
          if (!arr) continue;
          for (const c of arr) {
            const vx = p.x - c.x, vz = p.z - c.z;
            const d2 = vx * vx + vz * vz;
            const rr = c.r + r;
            if (d2 < rr * rr && d2 > 1e-8) {
              const d = Math.sqrt(d2);
              p.x = c.x + (vx / d) * rr;
              p.z = c.z + (vz / d) * rr;
            }
          }
        }
    }
    return p;
  }
}
