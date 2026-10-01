import * as THREE from 'three';

/*
 * Camera-facing strand ribbons for eyebrows and eyelashes (geometry from tools/human/strands.py).
 * Each centreline point is duplicated (side = -1/+1); the vertex shader skins the centreline and the strand
 * direction, expands the ribbon perpendicular to the view, and never lets it get thinner than ~0.6 px —
 * instead it lowers the alpha (coverage-preserving thin-hair anti-aliasing).  Colour varies root -> tip
 * and per strand; lighting uses the skin normal under the root (brows lie on the skin).
 */

export interface StrandOptions {
  color: THREE.Color;
  tipColor?: THREE.Color;
  opacity?: number;
  minPixels?: number;
  widthScale?: number;
  roughness?: number;
  /** fraction of strands (by their per-strand random) drawn in `pepperColor` — grey brows are salt and pepper */
  pepper?: number;
  pepperColor?: THREE.Color;
}

export class StrandMaterial extends THREE.MeshStandardMaterial {
  readonly strandUniforms = {
    uResolutionY: { value: 1080 },
    uMinPx: { value: 0.65 },
    uWidthScale: { value: 1 },
    uRootColor: { value: new THREE.Color() },
    uTipColor: { value: new THREE.Color() },
    uOpacity: { value: 1 },
    uPepper: { value: 0 },
    uPepperColor: { value: new THREE.Color(0.06, 0.05, 0.045) },
  };
  constructor(o: StrandOptions) {
    super({ color: 0xffffff, roughness: o.roughness ?? 0.7, metalness: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 0.25 });
    this.name = 'HumanStrands';
    const u = this.strandUniforms;
    u.uRootColor.value.copy(o.color);
    u.uTipColor.value.copy(o.tipColor ?? o.color.clone().multiplyScalar(1.35));
    u.uOpacity.value = o.opacity ?? 1;
    u.uMinPx.value = o.minPixels ?? 0.65;
    u.uWidthScale.value = o.widthScale ?? 1;
    u.uPepper.value = o.pepper ?? 0;
    if (o.pepperColor) u.uPepperColor.value.copy(o.pepperColor);
    this.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, u);
      s.vertexShader = s.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute vec3 strandDir;
attribute vec4 strand;
uniform float uResolutionY, uMinPx, uWidthScale;
varying float vStrandT;
varying float vStrandSide;
varying float vStrandAlpha;
varying float vStrandRand;`,
        )
        .replace(
          '#include <project_vertex>',
          `vec3 sDir = strandDir;
#ifdef USE_SKINNING
  sDir = ( skinMatrix * vec4( strandDir, 0.0 ) ).xyz;
#endif
#include <project_vertex>
{
  vec3 vd = normalize( ( modelViewMatrix * vec4( sDir, 0.0 ) ).xyz );
  vec3 toCam = normalize( -mvPosition.xyz );
  vec3 sideV = cross( vd, toCam );
  float sl = length( sideV );
  sideV = sl > 1e-4 ? sideV / sl : vec3( 1.0, 0.0, 0.0 );
  float taper = mix( 1.0, 0.25, smoothstep( 0.35, 1.0, strand.y ) );
  float w = strand.z * uWidthScale * taper;
  float px = 2.0 * max( -mvPosition.z, 0.01 ) / ( projectionMatrix[ 1 ][ 1 ] * uResolutionY );
  float wv = max( w, px * uMinPx );
  vStrandAlpha = clamp( w / wv, 0.0, 1.0 );
  mvPosition.xyz += sideV * strand.x * 0.5 * wv;
  gl_Position = projectionMatrix * mvPosition;
  vStrandT = strand.y;
  vStrandSide = strand.x;
  vStrandRand = strand.w;
}`,
        );
      s.fragmentShader = s.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform vec3 uRootColor, uTipColor, uPepperColor;
uniform float uOpacity, uPepper;
varying float vStrandT;
varying float vStrandSide;
varying float vStrandAlpha;
varying float vStrandRand;`,
        )
        .replace(
          '#include <normal_fragment_begin>',
          `#include <normal_fragment_begin>
  // face pass: the lash ribbons' normals point AWAY from the camera (up / back, toward a back light): the GGX term
  // at N.V < 0 exploded into a cream-white "eyeliner" fringe above every eye. Keep strand normals on the camera side.
  if ( !( dot( normal, normal ) > 0.01 ) ) normal = vec3( 0.0, 0.0, 1.0 );
  {
    vec3 sv = normalize( vViewPosition );
    float snv = dot( normal, sv );
    if ( snv < 0.45 ) normal = normalize( normal + ( 0.45 - snv ) * sv );
  }`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
diffuseColor.rgb = mix( uRootColor, uTipColor, smoothstep( 0.1, 1.0, vStrandT ) ) * ( 0.75 + 0.5 * vStrandRand );
if ( vStrandRand < uPepper ) diffuseColor.rgb = uPepperColor * ( 0.8 + 0.6 * vStrandRand / max( uPepper, 1e-3 ) );
float edge = 1.0 - vStrandSide * vStrandSide;
diffuseColor.a = uOpacity * vStrandAlpha * smoothstep( 0.0, 0.35, edge ) * ( 1.0 - smoothstep( 0.82, 1.0, vStrandT ) );
if ( diffuseColor.a < 0.004 ) discard;`,
        );
    };
    this.customProgramCacheKey = () => 'human-strands';
  }
}
