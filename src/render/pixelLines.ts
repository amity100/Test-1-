import * as THREE from 'three';

/**
 * GL lines are always 1 device pixel wide: on a phone rendering at 2x that is
 * half a CSS pixel, and a laser telegraph all but vanishes. `PixelLines`
 * draws a LineSegments' segments as camera-facing quads of a fixed width in
 * CSS pixels instead: the LineSegments stays the source of truth (the game
 * writes its positions, colours and draw range as before; its own draw is
 * switched off) and the quads, a child of it, follow its visibility.
 *
 * The material is the line material's own maths (vertex colour x colour,
 * opacity, fog, blending), only wider.
 */
export class PixelLines {
  readonly mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private max: number;
  private lastCount = 0;

  constructor(
    readonly lines: THREE.LineSegments,
    /** Width in CSS pixels. */
    public widthCss = 1,
  ) {
    const src = lines.material as THREE.LineBasicMaterial;
    const segs = Math.floor((lines.geometry.getAttribute('position') as THREE.BufferAttribute).count / 2);
    this.max = segs;
    const n = segs * 4;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aOther', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array(n), 1));
    const hasColor = !!src.vertexColors && !!lines.geometry.getAttribute('color');
    if (hasColor) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    // quad k: vertices 4k..4k+3 at a, a, b, b. Each offsets across the direction to its other end,
    // which flips at b: sides +,-,+,- put the corners at a+, a-, b-, b+ (two triangles on a+ b-)
    const side = g.getAttribute('aSide') as THREE.BufferAttribute;
    const idx: number[] = [];
    for (let k = 0; k < segs; k++) {
      side.setX(4 * k, 1);
      side.setX(4 * k + 1, -1);
      side.setX(4 * k + 2, 1);
      side.setX(4 * k + 3, -1);
      idx.push(4 * k, 4 * k + 1, 4 * k + 2, 4 * k, 4 * k + 2, 4 * k + 3);
    }
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { diffuse: { value: src.color.clone() }, opacity: { value: src.opacity }, uRes: { value: new THREE.Vector2(1, 1) }, uWidth: { value: 1 } }]),
      vertexShader: /* glsl */ `
        attribute vec3 aOther;
        attribute float aSide;
        uniform vec2 uRes;
        uniform float uWidth;
        #include <color_pars_vertex>
        #include <fog_pars_vertex>
        void main() {
          #include <color_vertex>
          vec4 a = modelViewMatrix * vec4(position, 1.0);
          vec4 b = modelViewMatrix * vec4(aOther, 1.0);
          // (an end behind the camera is pulled onto the near plane first)
          float near = -0.5 * projectionMatrix[3][2] / projectionMatrix[2][2];
          if (a.z > near && b.z > near) {
            // (wholly behind the camera: nothing to draw)
            gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
            return;
          }
          if (a.z > near && b.z < near) a.xyz = mix(a.xyz, b.xyz, (near - a.z) / (b.z - a.z));
          if (b.z > near && a.z < near) b.xyz = mix(b.xyz, a.xyz, (near - b.z) / (a.z - b.z));
          vec4 ca = projectionMatrix * a;
          vec4 cb = projectionMatrix * b;
          vec2 sa = ca.xy / ca.w * uRes, sb = cb.xy / cb.w * uRes;
          vec2 d = sb - sa;
          float l = length(d);
          vec2 dir = l > 1e-5 ? d / l : vec2(1.0, 0.0);
          vec2 off = vec2(-dir.y, dir.x) * aSide * uWidth / uRes;
          ca.xy += off * ca.w;
          gl_Position = ca;
          vec4 mvPosition = a;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 diffuse;
        uniform float opacity;
        #include <color_pars_fragment>
        #include <fog_pars_fragment>
        void main() {
          vec4 diffuseColor = vec4(diffuse, opacity);
          #include <color_fragment>
          gl_FragColor = vec4(diffuseColor.rgb, diffuseColor.a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      vertexColors: hasColor,
      transparent: src.transparent,
      depthWrite: src.depthWrite,
      depthTest: src.depthTest,
      blending: src.blending,
      fog: src.fog,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = lines.renderOrder;
    this.mesh.name = (lines.name || 'lines') + ':quads';
    lines.add(this.mesh);
  }

  /** Quads on (the line's own draw off) or off (plain GL lines again). */
  set enabled(on: boolean) {
    (this.lines.material as THREE.Material).visible = !on;
    this.mesh.visible = on;
  }
  get enabled() {
    return this.mesh.visible;
  }

  /**
   * Copy the line segments into the quads. `renderW` / `renderH`: the size the scene renders at
   * (device pixels, after any dynamic scale); `pxPerCss`: render pixels per CSS pixel.
   */
  sync(renderW: number, renderH: number, pxPerCss: number) {
    // (hidden lines, e.g. the replay beams outside a replay: their last draw range isn't copied every frame)
    if (!this.mesh.visible || !this.lines.visible) return;
    const lg = this.lines.geometry;
    const lp = lg.getAttribute('position') as THREE.BufferAttribute;
    const lc = lg.getAttribute('color') as THREE.BufferAttribute | undefined;
    const count = Math.min(this.max, Math.floor(Math.min(lg.drawRange.count, lp.count) / 2));
    // (nothing to draw now or last frame: no buffers to refill or upload)
    if (count === 0 && this.lastCount === 0) return;
    this.lastCount = count;
    const p = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const o = this.geo.getAttribute('aOther') as THREE.BufferAttribute;
    const c = this.geo.getAttribute('color') as THREE.BufferAttribute | undefined;
    for (let k = 0; k < count; k++) {
      const a = 2 * k, b = 2 * k + 1;
      const ax = lp.getX(a), ay = lp.getY(a), az = lp.getZ(a);
      const bx = lp.getX(b), by = lp.getY(b), bz = lp.getZ(b);
      for (let j = 0; j < 4; j++) {
        const atA = j < 2;
        const v = 4 * k + j;
        p.setXYZ(v, atA ? ax : bx, atA ? ay : by, atA ? az : bz);
        o.setXYZ(v, atA ? bx : ax, atA ? by : ay, atA ? bz : az);
        if (c && lc) {
          const s = atA ? a : b;
          c.setXYZ(v, lc.getX(s), lc.getY(s), lc.getZ(s));
        }
      }
    }
    // (half the width each side of the line, in clip units: 2 / size per pixel)
    this.mat.uniforms.uRes.value.set(renderW / 2, renderH / 2);
    this.mat.uniforms.uWidth.value = (this.widthCss * pxPerCss) / 2;
    const lm = this.lines.material as THREE.LineBasicMaterial;
    this.mat.uniforms.diffuse.value.copy(lm.color);
    this.mat.uniforms.opacity.value = lm.opacity;
    this.geo.setDrawRange(0, count * 6);
    p.needsUpdate = true;
    o.needsUpdate = true;
    if (c) c.needsUpdate = true;
  }
}
