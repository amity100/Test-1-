import * as THREE from 'three';

/**
 * Final display-referred grade: chromatic aberration, scanlines, grain,
 * vignette, glitch displacement and a cold cyan/magenta split-tone.
 */
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uChroma: { value: 1.0 },
    uScan: { value: 0.5 },
    uGrain: { value: 0.6 },
    uVignette: { value: 1.0 },
    uGlitch: { value: 0.0 },
    uAlert: { value: 0.0 },
    uFade: { value: 0.0 },
    /** 0 = the middle of the night · 1 = the sun is up and I am exposed. */
    uDawn: { value: 0.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime, uChroma, uScan, uGrain, uVignette, uGlitch, uAlert, uFade, uDawn;
    uniform vec2 uRes;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p.yx + 19.19);
      return fract((p.x + p.y) * p.x);
    }

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);

      // barrel warp — very subtle, keeps the "screen inside a screen" feel
      uv = 0.5 + c * (1.0 + r2 * 0.035);

      // glitch: horizontal band displacement
      if (uGlitch > 0.001) {
        float band = floor(uv.y * 28.0);
        float n = hash(vec2(band, floor(uTime * 22.0)));
        float amt = step(1.0 - uGlitch * 0.75, n) * uGlitch;
        uv.x += (n - 0.5) * 0.09 * amt;
      }

      // chromatic aberration grows toward the edges
      float ca = (0.0016 + uAlert * 0.0022) * uChroma * (0.25 + r2 * 2.2);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ca).b;

      // split tone: cold shadows, warm-magenta highlights under alert
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 shadowTint = vec3(0.16, 0.36, 0.52);
      vec3 highTint = mix(vec3(1.0, 0.98, 0.94), vec3(1.0, 0.72, 0.78), uAlert);
      col = mix(col * (0.82 + shadowTint * 0.45), col * highTint, smoothstep(0.15, 0.9, lum));

      // morning: the light comes up and the picture stops being a night picture
      col = mix(col, pow(col, vec3(0.76)) * vec3(1.09, 1.05, 0.97) + vec3(0.055, 0.052, 0.044), uDawn);

      // scanlines
      float scan = sin(uv.y * uRes.y * 1.35) * 0.5 + 0.5;
      col *= 1.0 - uScan * 0.075 * scan * (1.0 - uDawn * 0.8);

      // rolling interlace bar
      float roll = smoothstep(0.0, 0.06, abs(fract(uv.y - uTime * 0.06) - 0.5) - 0.44);
      col += roll * 0.018;

      // grain
      float g = hash(uv * uRes + fract(uTime) * 91.7) - 0.5;
      col += g * uGrain * 0.055 * (1.0 - uDawn * 0.7);

      // vignette
      float vig = smoothstep(0.95, 0.22, r2 * 1.6);
      col *= mix(1.0, vig, uVignette * (1.0 - uDawn * 0.6));

      // alert pulse at the frame edge
      float edge = smoothstep(0.18, 0.5, r2);
      col += vec3(0.35, 0.02, 0.08) * edge * uAlert * (0.55 + 0.45 * sin(uTime * 4.0));

      col *= (1.0 - uFade);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
