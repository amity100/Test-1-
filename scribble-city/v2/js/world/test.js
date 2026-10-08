import * as THREE from 'three';
import { makeSurface, makeSky, srgb, addLight } from '../render/materials.js';

// A few shapes to tune the pens on (?scene=test).
export function buildTestScene(scene) {
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), makeSky()));
  const sky = scene.children[scene.children.length - 1];
  sky.renderOrder = 100;
  sky.frustumCulled = false;
  const street = new THREE.Mesh(new THREE.PlaneGeometry(16, 300).rotateX(-Math.PI / 2), makeSurface({ kind: 'street', color: srgb(0.32, 0.28, 0.36), refl: true, wet: 0.85 }));
  street.position.set(5, 0, -120);
  scene.add(street);
  const walk = new THREE.Mesh(new THREE.BoxGeometry(6, 0.15, 300), makeSurface({ kind: 'ground', color: srgb(0.86, 0.72, 0.68) }));
  walk.position.set(-6, 0.075, -120);
  scene.add(walk);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), makeSurface({ kind: 'water', color: srgb(0.2, 0.25, 0.45), refl: true, wet: 1 }));
  water.position.set(820, -0.8, -400);
  scene.add(water);
  const cols = [srgb(0.98, 0.7, 0.72), srgb(0.55, 0.85, 0.82), srgb(0.98, 0.84, 0.62), srgb(0.8, 0.72, 0.95)];
  for (let i = 0; i < 4; i++) {
    const h = 9 + i * 4;
    const b = new THREE.Mesh(new THREE.BoxGeometry(14, h, 18), makeSurface({ kind: 'wall', color: cols[i] }));
    b.position.set(-16, h / 2, -10 - i * 22);
    scene.add(b);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(10, h - 4).rotateY(Math.PI / 2), makeSurface({ kind: 'glass', color: srgb(0.2, 0.22, 0.4), gloss: 0.7, lit: 0.4 }));
    g.position.set(-8.95, h / 2 + 1, -10 - i * 22);
    scene.add(g);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 16), makeSurface({ kind: 'cyl', color: srgb(0.96, 0.96, 0.95), partR: 1.2 }));
  ball.position.set(-5, 1.35, -8);
  scene.add(ball);
  const car = new THREE.Mesh(new THREE.BoxGeometry(2, 1.1, 4.4), makeSurface({ kind: 'paint', color: srgb(0.45, 0.2, 0.75), gloss: 0.6 }));
  car.position.set(7, 0.75, -14);
  scene.add(car);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 9, 12), makeSurface({ kind: 'cyl', color: srgb(0.62, 0.48, 0.38), partR: 0.3 }));
  trunk.position.set(-3.8, 4.5, -20);
  scene.add(trunk);
  const neon = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 5), makeSurface({ kind: 'neon', color: srgb(1, 0.3, 0.7), emissive: srgb(1, 0.25, 0.65).multiplyScalar(3.5) }));
  neon.position.set(-8.8, 5, -26);
  scene.add(neon);
  addLight(-7.5, 5, -26, 9, srgb(1, 0.3, 0.7), 1.6);
  return { spawn: new THREE.Vector3(-5, 0.15, 0), colliders: [] };
}
