import * as THREE from 'three';

/*
 * Eyes: an eyeball (sclera + recessed iris/pupil, front-projected procedural texture baked by
 * tools/human/bake_skin.py) under a clear corneal bulge that only adds reflections (sharp catch-lights).
 * Pupils react to light (uPupil), the sclera is shadowed near the lids (socket-space occlusion).
 */

export interface EyeParams {
  radius: number; // eyeball radius (m)
  irisRadius: number; // limbus radius (m)
  texture: THREE.Texture | null;
  quality: 'low' | 'medium' | 'high';
}

/** Wet, clear layer: renders only specular (additive) — cornea & tear lines. */
export class WetMaterial extends THREE.MeshPhysicalMaterial {
  constructor(roughness = 0.03, strength = 1) {
    super({ color: 0x000000, roughness, metalness: 0, ior: 1.376, specularIntensity: 1, transparent: true, depthWrite: false });
    this.blending = THREE.AdditiveBlending;
    this.name = 'HumanWet';
    const str = { value: strength };
    this.userData.strength = str;
    this.onBeforeCompile = (s) => {
      s.uniforms.uWetStrength = str;
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uWetStrength;')
        .replace(
          '#include <opaque_fragment>',
          `gl_FragColor = vec4( ( reflectedLight.directSpecular + reflectedLight.indirectSpecular ) * uWetStrength, 1.0 );`,
        );
    };
    this.customProgramCacheKey = () => 'human-wet';
  }
}

export class EyeMaterial extends THREE.MeshPhysicalMaterial {
  readonly eyeUniforms = {
    uEyeTex: { value: null as THREE.Texture | null },
    uPupil: { value: 0.35 }, // 0 = pinhole, 1 = fully dilated
    uIrisR: { value: 0.3 }, // iris radius / eyeball radius
    uTexIrisR: { value: 0.37 }, // iris radius in the baked texture (tools/human/bake_skin.py: IR)
    uLidOpen: { value: 1.0 },
    uSocket: { value: new THREE.Matrix4() }, // world -> socket (head) space
    uOpening: { value: new THREE.Vector4(0, 0, 0.012, 0.004) }, // opening centre xy, half extents (socket space)
    uCornea: { value: new THREE.Vector4(0, 0, 0, 0) }, // cornea sphere centre z, radius, iris plane z, eyeball radius (local units)
    uCaustic: { value: 1.0 }, // strength of the corneal caustic on the iris (the crescent opposite the light)
    uHero: { value: 0.0 }, // hero close-up 0..1 (HumanModel.setHero): stronger caustic, limbal detail
  };
  constructor(p: EyeParams) {
    super({ color: 0xffffff, roughness: 0.075, metalness: 0, ior: 1.376, clearcoat: 0, sheen: 0 });
    this.name = 'HumanEye';
    const u = this.eyeUniforms;
    u.uEyeTex.value = p.texture;
    u.uIrisR.value = p.irisRadius / p.radius;
    this.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, u);
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vEyeLocal;\nvarying vec3 vEyeWorld;\nvarying vec3 vEyePos;\nvarying vec3 vEyeCam;\nvarying vec3 vEyeCentreV;\nvarying vec3 vEyeFwdV;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEyeLocal = normalize( position );\nvEyePos = position;\nvEyeCam = ( inverse( modelMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz;\nvEyeCentreV = ( modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;\nvEyeFwdV = normalize( ( modelViewMatrix * vec4( 0.0, 0.0, 1.0, 0.0 ) ).xyz );')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvEyeWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
      s.fragmentShader = s.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform sampler2D uEyeTex;
uniform float uPupil, uIrisR, uLidOpen, uTexIrisR;
uniform mat4 uSocket;
uniform vec4 uOpening;
uniform vec4 uCornea;
uniform float uCaustic, uHero;
varying vec3 vEyeCentreV;
varying vec3 vEyeFwdV;
varying vec3 vEyeLocal;
varying vec3 vEyeWorld;
varying vec3 vEyePos;
varying vec3 vEyeCam;
float gEyeOcc = 1.0;
float gEyeShadow = 1.0;
float gIris = 0.0;`,
        )
        .replace(
          '#include <map_fragment>',
          `{
  // front planar projection of the eyeball (z forward); the texture maps the unit disc x,y in [-1,1] with the
  // limbus at radius uTexIrisR and the pupil at 0.28 of the iris
  vec2 p = vEyeLocal.xy;
  #ifndef EYE_LOW
  // corneal refraction: follow the camera ray through the cornea sphere, refract (n = 1.376), hit the iris plane
  if ( length( p ) < uIrisR * 1.15 && uCornea.y > 0.0 ) {
    vec3 ro = vEyeCam;
    vec3 rd = normalize( vEyePos - vEyeCam );
    vec3 cc = vec3( 0.0, 0.0, uCornea.x );
    vec3 oc = ro - cc;
    float b = dot( oc, rd );
    float c = dot( oc, oc ) - uCornea.y * uCornea.y;
    float h = b * b - c;
    if ( h > 0.0 ) {
      float t = -b - sqrt( h );
      vec3 hit = ro + rd * t;
      if ( hit.z > uCornea.z ) {
        vec3 nrm = normalize( hit - cc );
        vec3 rr = refract( rd, nrm, 1.0 / 1.376 );
        float ti = ( uCornea.z - hit.z ) / min( rr.z, -1e-3 );
        vec3 ip = hit + rr * ti;
        p = ip.xy / uCornea.w;
      }
    }
  }
  #endif
  float r = length( p );
  float ir = uIrisR;
  float rt;
  if ( r < ir ) {
    float t = r / ir;
    float pr = mix( 0.16, 0.5, uPupil );
    float tt = t < pr ? t / pr * 0.28 : 0.28 + ( t - pr ) / ( 1.0 - pr ) * 0.72;
    rt = tt * uTexIrisR;
  } else {
    rt = uTexIrisR + ( r - ir ) / max( 1.0 - ir, 1e-3 ) * ( 1.0 - uTexIrisR );
  }
  p *= rt / max( r, 1e-5 );
  vec2 uv = p * 0.5 + 0.5;
  vec4 texel = vEyeLocal.z > 0.0 ? texture2D( uEyeTex, uv ) : vec4( 0.8, 0.7, 0.66, 1.0 );
  if ( r < ir ) {
    // iris detail on top of the baked texture: radial stroma fibres (crypts between them), a lighter golden
    // collarette around the pupil and a dark limbal ring — what makes an iris read as alive at portrait distance
    float t = r / ir;
    float ang = atan( p.y, p.x );
    float fib = sin( ang * 71.0 + sin( ang * 13.0 ) * 1.7 + t * 5.0 ) * 0.5 + 0.5;
    fib = fib * 0.6 + ( sin( ang * 157.0 + sin( ang * 7.0 + t * 9.0 ) * 2.3 ) * 0.5 + 0.5 ) * 0.4;
    float body = smoothstep( 0.3, 0.45, t ) * smoothstep( 0.97, 0.8, t );
    texel.rgb *= mix( 1.0, 0.72 + 0.5 * fib, body );
    float coll = exp( -pow( ( t - 0.4 ) / 0.07, 2.0 ) );
    texel.rgb = mix( texel.rgb, texel.rgb * vec3( 1.35, 1.2, 0.85 ), coll * 0.55 );
    texel.rgb *= mix( 1.0, 0.32, smoothstep( 0.8, 0.99, t ) );
  }
  diffuseColor.rgb *= texel.rgb;
  // occlusion from lids & lashes, in socket space relative to the (blink-scaled) opening ellipse
  vec3 sp = ( uSocket * vec4( vEyeWorld, 1.0 ) ).xyz;
  vec2 e = ( sp.xy - uOpening.xy ) / ( uOpening.zw * vec2( 1.0, max( uLidOpen, 0.05 ) ) );
  float d = length( e );
  // ambient: a little darker toward the lid margins and in the canthi (the eye sits in a socket) — a clear,
  // bright sclera is what makes eyes read as young and beautiful; heavy occlusion made them look sunken
  gEyeOcc = mix( 0.58, 1.0, smoothstep( 1.0, 0.35, d ) ) * mix( 0.78, 1.0, smoothstep( 0.97, 0.45, abs( e.x ) ) );
  // direct light: the upper lid and the lashes shade only the top quarter of the opening
  gEyeShadow = mix( 1.0, 0.3, smoothstep( 0.42, 0.88, e.y ) ) * mix( 0.72, 1.0, smoothstep( 1.0, 0.6, d ) );
  gIris = smoothstep( uIrisR * 1.03, uIrisR * 0.97, length( vEyeLocal.xy ) ) * step( 0.0, vEyeLocal.z );
  // living sclera: near white with a faint warm cast, a touch pinker only in the canthi
  diffuseColor.rgb *= mix( mix( vec3( 0.97, 0.95, 0.92 ), vec3( 0.95, 0.85, 0.82 ), smoothstep( 0.6, 0.98, abs( e.x ) ) ), vec3( 1.0 ), gIris );
  #ifndef EYE_LOW
  if ( gIris < 1.0 ) {
    // sclera around the limbus: a soft grey-blue shadow ring (the cornea's edge) rounds the eye; faint
    // capillaries toward the canthi keep it from reading as painted porcelain
    float rl = length( vEyeLocal.xy ) / uIrisR;
    float limb = exp( -pow( ( rl - 1.08 ) / 0.1, 2.0 ) );
    diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.8, 0.8, 0.84 ), limb * 0.6 * ( 1.0 - gIris ) );
    float ang = atan( vEyeLocal.y, vEyeLocal.x );
    float vein = sin( ang * 23.0 + sin( ang * 7.0 + rl * 3.0 ) * 2.0 + rl * 4.0 ) * 0.5 + 0.5;
    vein = pow( vein, 18.0 ) * smoothstep( 1.4, 2.4, rl ) * smoothstep( 0.5, 0.95, abs( e.x ) );
    diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.95, 0.62, 0.6 ), vein * 0.5 * ( 1.0 - gIris ) );
  }
  #endif
}`,
        )
        .replace(
          '#include <lights_physical_pars_fragment>',
          `#include <lights_physical_pars_fragment>
void RE_Direct_Eye( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  #ifndef EYE_LOW
  if ( gIris > 0.0 ) {
    // the cornea is a lens: light arriving from the side is focused into a bright crescent on the iris on the
    // side AWAY from the light (what makes an iris read as deep and wet, not painted)
    vec3 L = directLight.direction;
    vec3 fwd = normalize( vEyeFwdV );
    float lf = dot( L, fwd );
    vec3 Lp = L - lf * fwd;
    float t = length( Lp );
    vec3 q = geometryPosition - vEyeCentreV;
    vec3 qp = q - dot( q, fwd ) * fwd;
    float irisR = uIrisR * uCornea.w;
    vec3 c = -Lp / max( t, 1e-4 ) * mix( 0.15, 0.62, t ) * irisR;
    float d = length( qp - c ) / irisR;
    float caus = exp( -d * d / mix( 0.06, 0.1, uHero ) ) * smoothstep( 0.08, 0.55, t ) * smoothstep( -0.25, 0.25, lf );
    reflectedLight.directDiffuse += caus * directLight.color * material.diffuseColor * ( 1.4 + 1.0 * uHero ) * uCaustic * gEyeShadow;
  }
  #endif
}
#undef RE_Direct
#define RE_Direct RE_Direct_Eye`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `float roughnessFactor = roughness;
{
  float rr = length( vEyeLocal.xy );
  roughnessFactor = rr < uIrisR ? 0.35 : roughness;
}`,
        )
        .replace(
          '#include <aomap_fragment>',
          `reflectedLight.directDiffuse *= gEyeOcc * gEyeShadow;
reflectedLight.indirectDiffuse *= gEyeOcc;
// the clear cornea mesh provides the specular over the iris; the wet sclera reflects on its own
reflectedLight.directSpecular *= gEyeShadow * ( 1.0 - gIris );
reflectedLight.indirectSpecular *= gEyeOcc * gEyeOcc * ( 1.0 - gIris );`,
        );
    };
    const eyeKey = p.quality === 'low' ? 'human-eye-low' : 'human-eye';
    this.customProgramCacheKey = () => eyeKey;
  }
}

/** Eyeball geometry: sphere (+Z forward) whose front cap is recessed into a slightly convex iris plane. */
export function eyeballGeometry(radius: number, irisRadius: number, segs = 48): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(radius, segs, Math.round(segs * 0.75));
  g.rotateX(Math.PI / 2); // poles on the z axis (front pole = +Z)
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const zl = Math.sqrt(radius * radius - irisRadius * irisRadius); // limbus plane
  const depth = radius * 0.035; // iris recessed behind the limbus
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.y);
    if (v.z > 0 && r < irisRadius * 0.999) {
      const t = r / irisRadius;
      // iris: convex toward the cornea (sits on the lens), meets the sclera at the limbus
      v.z = zl - depth * (1 - Math.pow(t, 3));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Clear cornea cap over the limbus (radius of curvature ~1.33 limbus radius), slightly beyond the sclera. */
export function corneaGeometry(radius: number, irisRadius: number, segs = 40): THREE.BufferGeometry {
  const a = irisRadius * 1.04;
  const Rc = a * 1.38;
  const zl = Math.sqrt(radius * radius - a * a);
  const h = Rc - Math.sqrt(Rc * Rc - a * a);
  const zc = zl + h - Rc; // centre of the corneal sphere
  const thetaMax = Math.asin(a / Rc);
  const g = new THREE.SphereGeometry(Rc, segs, Math.round(segs / 2), 0, Math.PI * 2, 0, thetaMax * 1.08);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, zc + radius * 0.004);
  return g;
}

export class EyeBall {
  readonly group = new THREE.Group();
  readonly ball: THREE.Mesh;
  readonly cornea: THREE.Mesh;
  readonly material: EyeMaterial;
  constructor(p: EyeParams) {
    const segs = p.quality === 'high' ? 56 : p.quality === 'medium' ? 40 : 24;
    this.material = new EyeMaterial(p);
    {
      const a = p.irisRadius * 1.04;
      const Rc = a * 1.38;
      const zl = Math.sqrt(p.radius * p.radius - a * a);
      const hh = Rc - Math.sqrt(Rc * Rc - a * a);
      const zc = zl + hh - Rc + p.radius * 0.004;
      const zIris = Math.sqrt(p.radius * p.radius - p.irisRadius * p.irisRadius) - p.radius * 0.035 * 0.5;
      this.material.eyeUniforms.uCornea.value.set(zc, Rc, zIris, p.radius);
      if (p.quality === 'low') this.material.defines = { ...(this.material.defines ?? {}), EYE_LOW: '' };
    }
    this.ball = new THREE.Mesh(eyeballGeometry(p.radius, p.irisRadius, segs), this.material);
    this.cornea = new THREE.Mesh(corneaGeometry(p.radius, p.irisRadius, Math.round(segs * 0.7)), new WetMaterial(0.025, 1.0));
    this.cornea.renderOrder = 2;
    this.ball.castShadow = false;
    this.ball.receiveShadow = true;
    this.group.add(this.ball, this.cornea);
  }
}
