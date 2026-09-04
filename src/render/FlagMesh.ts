import * as THREE from 'three';

/** Flag on a pole with vertex-animated cloth and a soft glow, coloured per owner. */
export class FlagMesh {
  readonly group = new THREE.Group();
  private cloth: THREE.Mesh;
  private clothGeo: THREE.PlaneGeometry;
  private base: Float32Array;
  private glow: THREE.PointLight;
  private beacon: THREE.Mesh;
  private time = 0;
  color: THREE.Color;

  constructor(color: THREE.Color) {
    this.color = color.clone();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 10), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.9, roughness: 0.3 }));
    pole.position.y = 1.3;
    pole.castShadow = true;
    this.group.add(pole);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffd36a, metalness: 1, roughness: 0.25 }));
    finial.position.y = 2.68;
    this.group.add(finial);
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.14, 16), new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.6, roughness: 0.5 }));
    baseMesh.position.y = 0.07;
    baseMesh.castShadow = true;
    this.group.add(baseMesh);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 8, 32), new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 2 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    this.group.add(ring);

    this.clothGeo = new THREE.PlaneGeometry(1.3, 0.8, 16, 8);
    this.clothGeo.translate(0.65, 0, 0);
    this.base = (this.clothGeo.attributes.position.array as Float32Array).slice();
    const clothMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, side: THREE.DoubleSide, roughness: 0.7 });
    this.cloth = new THREE.Mesh(this.clothGeo, clothMat);
    this.cloth.position.set(0.05, 2.15, 0);
    this.cloth.castShadow = true;
    this.group.add(this.cloth);

    this.glow = new THREE.PointLight(color, 6, 7, 2);
    this.glow.position.y = 2.2;
    this.group.add(this.glow);

    const beaconMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 60, 16, 1, true), beaconMat);
    this.beacon.position.y = 30;
    this.group.add(this.beacon);
    this.group.name = 'flag';
  }

  setColor(c: THREE.Color): void {
    this.color.copy(c);
    (this.cloth.material as THREE.MeshStandardMaterial).color.copy(c);
    (this.cloth.material as THREE.MeshStandardMaterial).emissive.copy(c);
    this.glow.color.copy(c);
    (this.beacon.material as THREE.MeshBasicMaterial).color.copy(c);
  }

  /** Beacon visibility 0..1 (used when a captured flag or reveal is shown). */
  setBeacon(strength: number): void {
    (this.beacon.material as THREE.MeshBasicMaterial).opacity = strength * 0.35;
    this.beacon.visible = strength > 0.01;
  }

  update(dt: number): void {
    this.time += dt;
    const pos = this.clothGeo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const t = this.time;
    for (let i = 0; i < pos.count; i++) {
      const bx = this.base[i * 3];
      const by = this.base[i * 3 + 1];
      const k = bx / 1.3; // 0 at pole, 1 at tip
      const wave = Math.sin(t * 5 + bx * 4.5) * 0.12 * k + Math.sin(t * 8.5 + by * 6 + bx * 2) * 0.04 * k;
      arr[i * 3] = bx;
      arr[i * 3 + 1] = by + Math.sin(t * 3.7 + bx * 3) * 0.03 * k;
      arr[i * 3 + 2] = wave;
    }
    pos.needsUpdate = true;
    this.clothGeo.computeVertexNormals();
    this.glow.intensity = 5 + Math.sin(t * 3) * 1.2;
  }
}
