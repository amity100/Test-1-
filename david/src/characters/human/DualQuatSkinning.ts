import * as THREE from 'three';

/*
 * Skinning for the MakeHuman bodies:
 *
 *  - 8 bone influences per vertex (attributes skinIndex/skinWeight + skinIndex2/skinWeight2).  MakeHuman's
 *    default weights use up to 8 bones around the shoulders and hips; three.js' 4-bone skinning drops
 *    different bones on neighbouring vertices, which tears the skin under large rotations.
 *  - Dual-quaternion skinning (DQS) blended with linear blend skinning (LBS) per bone.  LBS collapses volume
 *    when a joint rotates far (a raised arm pinches the deltoid and armpit, a flexed hip flattens the buttock,
 *    a twisted spine thins the waist); DQS keeps the volume but bulges on the inside of hinge joints, so each
 *    bone carries a DQS factor (shoulders / spine / hips ~1, elbows / knees / hands ~0.5, face 0) and every
 *    vertex blends the two results by its skin-weighted factor.  The factor is looked up from the bone
 *    indices, so any geometry skinned to the same skeleton (garments from HumanModel.skinAttachment)
 *    deforms identically once its material is patched with `patchMaterial`.
 *
 * Per frame (hooked into Skeleton.update, which the renderer calls once per frame) the mesh-space skinning
 * transform of every bone, M = rootWorld⁻¹ · boneWorld · boneInverse, is converted to a unit dual quaternion
 * plus a uniform scale and written to a small float texture (3 texels per bone).
 */

const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _t = new THREE.Vector3();
const _s = new THREE.Vector3();

const VERT_PARS = /* glsl */ `
#ifdef SKIN8
attribute vec4 skinIndex2;
attribute vec4 skinWeight2;
#endif
uniform highp sampler2D dqTexture;
uniform float dqEnable;
vec4 dqR; vec4 dqD; float dqScale; float dqFactor;
vec4 dqAccR; vec4 dqAccD; vec4 dqRef; float dqAccS; float dqAccF;
vec3 dqRotate( const in vec4 q, const in vec3 v ) {
  return v + 2.0 * cross( q.xyz, cross( q.xyz, v ) + q.w * v );
}
void dqAdd( const in float bone, const in float w ) {
  int b = int( bone ) * 3;
  vec4 r = texelFetch( dqTexture, ivec2( b, 0 ), 0 );
  vec4 d = texelFetch( dqTexture, ivec2( b + 1, 0 ), 0 );
  vec4 e = texelFetch( dqTexture, ivec2( b + 2, 0 ), 0 );
  float s = dot( dqRef, r ) < 0.0 ? -w : w; // shortest arc relative to the first influence
  dqAccR += r * s;
  dqAccD += d * s;
  dqAccS += e.x * w;
  dqAccF += e.y * w;
}
void dqBlend() {
  dqRef = texelFetch( dqTexture, ivec2( int( skinIndex.x ) * 3, 0 ), 0 );
  dqAccR = vec4( 0.0 ); dqAccD = vec4( 0.0 ); dqAccS = 0.0; dqAccF = 0.0;
  dqAdd( skinIndex.x, skinWeight.x );
  dqAdd( skinIndex.y, skinWeight.y );
  dqAdd( skinIndex.z, skinWeight.z );
  dqAdd( skinIndex.w, skinWeight.w );
  #ifdef SKIN8
  dqAdd( skinIndex2.x, skinWeight2.x );
  dqAdd( skinIndex2.y, skinWeight2.y );
  dqAdd( skinIndex2.z, skinWeight2.z );
  dqAdd( skinIndex2.w, skinWeight2.w );
  #endif
  float len = max( length( dqAccR ), 1e-6 );
  dqR = dqAccR / len;
  dqD = dqAccD / len;
  dqScale = dqAccS;
  dqFactor = clamp( dqAccF * dqEnable, 0.0, 1.0 );
}
vec3 dqTransform( const in vec3 p ) {
  vec3 t = 2.0 * ( dqR.w * dqD.xyz - dqD.w * dqR.xyz + cross( dqR.xyz, dqD.xyz ) );
  return dqRotate( dqR, p * dqScale ) + t;
}
`;

const SKINBASE8 = /* glsl */ `
#ifdef USE_SKINNING
  mat4 boneMatX = getBoneMatrix( skinIndex.x );
  mat4 boneMatY = getBoneMatrix( skinIndex.y );
  mat4 boneMatZ = getBoneMatrix( skinIndex.z );
  mat4 boneMatW = getBoneMatrix( skinIndex.w );
  #ifdef SKIN8
  mat4 boneMat2X = getBoneMatrix( skinIndex2.x );
  mat4 boneMat2Y = getBoneMatrix( skinIndex2.y );
  mat4 boneMat2Z = getBoneMatrix( skinIndex2.z );
  mat4 boneMat2W = getBoneMatrix( skinIndex2.w );
  #endif
  dqBlend();
#endif`;

const SKINNORMAL8 = /* glsl */ `
#ifdef USE_SKINNING
  vec3 dqRestN = objectNormal;
  #ifdef USE_TANGENT
  vec3 dqRestT = objectTangent;
  #endif
  mat4 skinMatrix = mat4( 0.0 );
  skinMatrix += skinWeight.x * boneMatX;
  skinMatrix += skinWeight.y * boneMatY;
  skinMatrix += skinWeight.z * boneMatZ;
  skinMatrix += skinWeight.w * boneMatW;
  #ifdef SKIN8
  skinMatrix += skinWeight2.x * boneMat2X;
  skinMatrix += skinWeight2.y * boneMat2Y;
  skinMatrix += skinWeight2.z * boneMat2Z;
  skinMatrix += skinWeight2.w * boneMat2W;
  #endif
  skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
  objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
  #ifdef USE_TANGENT
  objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
  #endif
  if ( dqFactor > 0.0 ) {
    objectNormal = normalize( mix( objectNormal, dqRotate( dqR, dqRestN ), dqFactor ) );
    #ifdef USE_TANGENT
    objectTangent = normalize( mix( objectTangent, dqRotate( dqR, dqRestT ), dqFactor ) );
    #endif
  }
#endif`;

const SKINNING8 = /* glsl */ `
#ifdef USE_SKINNING
  vec3 dqRestPos = transformed;
  vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
  vec4 skinned = vec4( 0.0 );
  skinned += boneMatX * skinVertex * skinWeight.x;
  skinned += boneMatY * skinVertex * skinWeight.y;
  skinned += boneMatZ * skinVertex * skinWeight.z;
  skinned += boneMatW * skinVertex * skinWeight.w;
  #ifdef SKIN8
  skinned += boneMat2X * skinVertex * skinWeight2.x;
  skinned += boneMat2Y * skinVertex * skinWeight2.y;
  skinned += boneMat2Z * skinVertex * skinWeight2.z;
  skinned += boneMat2W * skinVertex * skinWeight2.w;
  #endif
  transformed = ( bindMatrixInverse * skinned ).xyz;
  if ( dqFactor > 0.0 ) transformed = mix( transformed, dqTransform( dqRestPos ), dqFactor );
#endif`;

/**
 * Patch a three.js shader (inside onBeforeCompile) with LBS/DQS skinning, optionally with 8 influences.
 * `eight`: the geometry carries skinIndex2/skinWeight2 (influences 5-8).
 */
export function applyDQSChunks(shader: { vertexShader: string; uniforms: Record<string, THREE.IUniform> }, uniforms: Record<string, THREE.IUniform>, eight: boolean) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = (eight ? '#define SKIN8\n' : '') + shader.vertexShader
    .replace('#include <skinning_pars_vertex>', `#include <skinning_pars_vertex>\n#ifdef USE_SKINNING\n${VERT_PARS}\n#endif`)
    .replace('#include <skinbase_vertex>', SKINBASE8)
    .replace('#include <skinnormal_vertex>', SKINNORMAL8)
    .replace('#include <skinning_vertex>', SKINNING8);
}

export class DualQuatSkinning {
  readonly texture: THREE.DataTexture;
  readonly uniforms: { dqTexture: { value: THREE.DataTexture }; dqEnable: { value: number } };
  private readonly data: Float32Array;
  private readonly factors: Float32Array;

  /**
   * @param skeleton the character skeleton (bones in the same order as the rig)
   * @param root     the character root (skinned meshes are its direct children, bound with an identity bind matrix)
   * @param factor   DQS factor per bone name (0 = pure LBS, 1 = pure DQS)
   */
  constructor(readonly skeleton: THREE.Skeleton, readonly root: THREE.Object3D, factor: (boneName: string) => number) {
    const n = skeleton.bones.length;
    this.factors = new Float32Array(n);
    skeleton.bones.forEach((b, i) => (this.factors[i] = factor(b.name)));
    this.data = new Float32Array(n * 3 * 4);
    this.texture = new THREE.DataTexture(this.data as unknown as BufferSource, n * 3, 1, THREE.RGBAFormat, THREE.FloatType);
    this.texture.minFilter = this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.uniforms = { dqTexture: { value: this.texture }, dqEnable: { value: 1 } };
    for (let i = 0; i < n; i++) {
      this.data[i * 12 + 3] = 1; // identity rotation
      this.data[i * 12 + 8] = 1; // scale
      this.data[i * 12 + 9] = this.factors[i];
    }
    this.texture.needsUpdate = true;
    // the renderer calls skeleton.update() once per frame before drawing any mesh bound to it
    const orig = skeleton.update.bind(skeleton);
    skeleton.update = () => {
      orig();
      this.compute();
    };
  }

  /** Replace the per-bone DQS factors (0 = LBS .. 1 = DQS), e.g. to tune a joint at runtime. */
  setFactors(factor: (boneName: string) => number) {
    this.skeleton.bones.forEach((b, i) => (this.factors[i] = factor(b.name)));
    this.compute();
  }

  /** Blend amount of DQS over LBS (0 = plain linear blend skinning, 1 = per-bone factors). */
  set enabled(v: number) {
    this.uniforms.dqEnable.value = v;
  }
  get enabled() {
    return this.uniforms.dqEnable.value;
  }

  /** Recompute the dual quaternions from skeleton.boneMatrices (called automatically by skeleton.update). */
  compute() {
    const bm = this.skeleton.boneMatrices;
    const d = this.data;
    this.root.updateWorldMatrix(false, false);
    _inv.copy(this.root.matrixWorld).invert();
    const n = this.skeleton.bones.length;
    for (let i = 0; i < n; i++) {
      _m.fromArray(bm, i * 16).premultiply(_inv);
      _m.decompose(_t, _q, _s);
      const o = i * 12;
      const qx = _q.x, qy = _q.y, qz = _q.z, qw = _q.w;
      d[o] = qx;
      d[o + 1] = qy;
      d[o + 2] = qz;
      d[o + 3] = qw;
      // dual part = 0.5 * (t, 0) * q
      d[o + 4] = 0.5 * (_t.x * qw + _t.y * qz - _t.z * qy);
      d[o + 5] = 0.5 * (-_t.x * qz + _t.y * qw + _t.z * qx);
      d[o + 6] = 0.5 * (_t.x * qy - _t.y * qx + _t.z * qw);
      d[o + 7] = -0.5 * (_t.x * qx + _t.y * qy + _t.z * qz);
      d[o + 8] = (_s.x + _s.y + _s.z) / 3;
      d[o + 9] = this.factors[i];
    }
    this.texture.needsUpdate = true;
  }

  /**
   * Patch a material used on a mesh skinned to this skeleton (keeps its own onBeforeCompile).
   * `eight`: the mesh geometry has skinIndex2/skinWeight2 (8 influences; the body and skinAttachment garments).
   */
  patchMaterial<M extends THREE.Material>(material: M, eight = false): M {
    const prev = material.onBeforeCompile;
    const prevKey = material.customProgramCacheKey.bind(material);
    const u = this.uniforms;
    material.onBeforeCompile = (shader, renderer) => {
      prev.call(material, shader, renderer);
      applyDQSChunks(shader, u, eight);
    };
    const tag = eight ? '|dqs8' : '|dqs';
    material.customProgramCacheKey = () => prevKey() + tag;
    material.needsUpdate = true;
    return material;
  }
}

/** Default per-bone DQS factors for the MakeHuman default skeleton. */
export function defaultDQSFactor(name: string): number {
  if (/^(clavicle|shoulder01|upperarm0[12])/.test(name)) return 1;
  if (/^(spine0[1-5]|root|pelvis|neck0[1-3])/.test(name)) return 1;
  if (/^upperleg0[12]/.test(name)) return 0.85;
  if (/^(lowerarm0[12]|lowerleg0[12])/.test(name)) return 0.5;
  if (/^(wrist|metacarpal|finger|foot|toe)/.test(name)) return 0.45;
  return 0; // head, jaw and facial muscles, eyes: linear blend (small rotations, FACS-like units)
}
