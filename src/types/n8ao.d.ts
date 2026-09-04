declare module 'n8ao' {
  import type { Pass } from 'postprocessing';
  import type { Scene, Camera, Color } from 'three';

  export interface N8AOConfiguration {
    aoSamples: number;
    aoRadius: number;
    denoiseSamples: number;
    denoiseRadius: number;
    distanceFalloff: number;
    intensity: number;
    color: Color;
    renderMode: 0 | 1 | 2 | 3 | 4;
    biasOffset: number;
    biasMultiplier: number;
    gammaCorrection: boolean;
    logarithmicDepthBuffer: boolean;
    screenSpaceRadius: boolean;
    halfRes: boolean;
    depthAwareUpsampling: boolean;
    transparencyAware: boolean;
    accumulate: boolean;
  }

  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);
    configuration: N8AOConfiguration;
    setQualityMode(mode: 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra'): void;
    setDisplayMode(mode: 'Combined' | 'AO' | 'No AO' | 'Split' | 'Split AO'): void;
    setSize(width: number, height: number): void;
    enableDebugMode(): void;
    disableDebugMode(): void;
    dispose(): void;
  }
}
