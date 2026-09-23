// Test helper: Soldier.glb + anims.json in node (image decoding stubbed out).
// Node built-ins are imported dynamically so the strict tsconfig (no @types/node) stays happy.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CharacterAsset } from '../../src/game/characters';

interface NodeFs {
  readFileSync(p: URL): Uint8Array;
  statSync(p: URL): { size: number };
}
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as NodeFs;

export const asset = (name: string) => new URL(`../../public/assets/${name}`, import.meta.url);
export const fileSize = (name: string) => fs.statSync(asset(name)).size;
export const env = (k: string): string | undefined => (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env[k];

export function readAnimsJson(): any {
  return JSON.parse(new TextDecoder().decode(fs.readFileSync(asset('anims.json'))));
}

function soldierBytes(): ArrayBuffer {
  const b = fs.readFileSync(asset('Soldier.glb'));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

/** Node names from Soldier.glb's JSON chunk (no three.js). */
export function soldierNodeNames(): string[] {
  const buf = soldierBytes();
  const len = new DataView(buf).getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, len)));
  return json.nodes.map((n: { name: string }) => n.name);
}

let cached: Promise<CharacterAsset> | null = null;

export function loadSoldier(): Promise<CharacterAsset> {
  if (cached) return cached;
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'stub-textures', loadTexture: () => Promise.resolve(new THREE.Texture()) }) as any);
  cached = loader.parseAsync(soldierBytes(), '').then((g) => ({ scene: g.scene as THREE.Group, animations: g.animations }));
  return cached;
}
