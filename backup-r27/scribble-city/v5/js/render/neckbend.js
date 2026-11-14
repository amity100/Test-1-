// (v5, characters round) The neck that carries the head: how it twists and bends when the head turns,
// nods and tilts, worked out once here and used by everything that places a head - the rig (game/
// doodle.js: where the head is, its frame), every body's drawing (render/people.js: the neck's points
// in the graphics card, NECK_GLSL; the head, the hair, the eyes, the portrait on top of it), the
// neck's ink lines (render/herolines.js) and the shapes things hit - so that a head is in exactly the
// same place whichever of them draws it, near or far.
//
// THE NECK'S FRAME. Every neck is made in a frame of its own (x to the person's left, y up, z ahead),
// in units of the head's size (hs: headScale x the body's scale - the head's own units, as the head is
// made in), its origin J: the point under the head where the neck stops being part of the body and
// becomes part of the head. Below J the neck bends and twists; above it everything is carried rigidly
// with the head - the head's own edge (render/folkshapes.js: the MakeHuman head's cut, the ring where
// the neck's top IS the head's edge) lies above J, so the seam between them never moves.
// J is given in the head's frame centred on the rig's head point (j.headC): NECK_J.
//
// THE MOVE, D = [psi, bx, bz, yb] (one vec4 a neck, the instance's iClip in the graphics card):
//   psi    the twist: how far the head is turned from the chest (radians, + to the left), eased in
//          along the neck (smoothstep from yb up to 0: C1 at both ends - no kink where it leaves the
//          body nor where it meets the head)
//   bx, bz the bend: towards which side (x, z) and how far (its length, radians) the neck bends - an
//          arc of the same length (Barr's bend: its tangent continuous, the identity below yb, the
//          head carried on beyond its end); + z is a nod down, - z a look up, x a tilt to the side
//   yb     where the bending begins: the neck's frame's y where it leaves the body (< 0)
// The twist comes first (about the neck's own axis, x = z = 0), then the bend: so a head turned to
// the side and nodding nods about its own sideways axis (the bend's direction turns with it).
//
// Pure functions, no state: neckBend (a point and its normal), neckTop (the rigid move of all above
// J, as a matrix), headFrame (the head's frame from the neck's), and the same in GLSL.

// the junction J in the head's frame about j.headC (x left, y up, z ahead; head units), by the kind
// of head: the city's people's (the MakeHuman head: its edge, the ring under the jaw, is at y -0.0964
// .. -0.1176 about its own origin, which is 0.058 under j.headC - so J is just under the lowest of it,
// at its middle front to back) and the hero's (his head is placed as theirs is); the simple heads'
// (a ball and a jaw about j.headC, the neck a tube on its middle)
export const NECK_J = {
  folk: { y: -0.058 - 0.1185, z: -0.0288 },
  generic: { y: -0.118, z: 0 },
};
// (where the head's own mesh is made about: render/people.js draws the MakeHuman heads and the hero's
// at j.headC - 0.058 hs up)
export const HEAD_DROP = 0.058;

// below this a bend is no bend (the same test here and in the graphics card)
const A_MIN = 1e-3;

/**
 * The neck's point (px, py, pz) and its normal (nx, ny, nz), in the neck's frame, moved by D:
 * out[0..2] the point, out[3..5] the normal (unit). Mirrors NECK_GLSL exactly.
 */
export function neckBend(px, py, pz, nx, ny, nz, D, out) {
  const yb = D[3];
  const L = -yb;
  if (!(L > 1e-4)) {
    out[0] = px;
    out[1] = py;
    out[2] = pz;
    out[3] = nx;
    out[4] = ny;
    out[5] = nz;
    return out;
  }
  // the twist, eased in from the body to the head
  const s = Math.min(1, Math.max(0, (py - yb) / L));
  const w = s * s * (3 - 2 * s);
  const tw = D[0] * w;
  const c = Math.cos(tw);
  const si = Math.sin(tw);
  let x = c * px + si * pz;
  let z = -si * px + c * pz;
  let mx = c * nx + si * nz;
  let mz = -si * nx + c * nz;
  // (the normal of a twist that grows along the neck: the surface leans along it)
  const dw = s > 0 && s < 1 ? (6 * s * (1 - s)) / L : 0;
  let my = ny - D[0] * dw * (mx * z - mz * x);
  let y = py;
  // the bend: an arc from yb up to 0, all above it carried on rigidly
  const A = Math.hypot(D[1], D[2]);
  if (A > A_MIN) {
    const dx = D[1] / A;
    const dz = D[2] / A;
    const u = x * dx + z * dz;
    const v = -x * dz + z * dx;
    const yc = Math.min(0, Math.max(yb, y));
    const a = (A * (yc - yb)) / L;
    const rho = L / A;
    const ov = y - yc;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const h = Math.sin(a * 0.5);
    // (its normal turned with the arc - and, inside the arc, leaning as its side is squeezed)
    const k = ov === 0 ? rho / Math.max(rho - u, 0.2 * rho) : 1;
    const ny2 = yb + (rho - u) * sa + ov * ca;
    const nu = rho * 2 * h * h + u * ca + ov * sa;
    x = nu * dx - v * dz;
    z = nu * dz + v * dx;
    y = ny2;
    const nun = mx * dx + mz * dz;
    const nvn = -mx * dz + mz * dx;
    const nyk = my * k;
    const ny3 = nyk * ca - nun * sa;
    const nu3 = nyk * sa + nun * ca;
    mx = nu3 * dx - nvn * dz;
    mz = nu3 * dz + nvn * dx;
    my = ny3;
  }
  const l = Math.hypot(mx, my, mz) || 1;
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = mx / l;
  out[4] = my / l;
  out[5] = mz / l;
  return out;
}

/**
 * The rigid move of everything at and above J (the neck's y >= 0) under D, in the neck's frame: a
 * 3x4 matrix, column after column (out[0..2] x, [3..5] y, [6..8] z, [9..11] where J goes). The same
 * as neckBend there (closed form: the twist's full turn, then the arc's end).
 */
export function neckTop(D, out) {
  const c = Math.cos(D[0]);
  const s = Math.sin(D[0]);
  // the twist's columns
  out[0] = c;
  out[1] = 0;
  out[2] = -s;
  out[3] = 0;
  out[4] = 1;
  out[5] = 0;
  out[6] = s;
  out[7] = 0;
  out[8] = c;
  out[9] = 0;
  out[10] = 0;
  out[11] = 0;
  const yb = D[3];
  const L = -yb;
  const A = Math.hypot(D[1], D[2]);
  if (!(L > 1e-4) || !(A > A_MIN)) return out;
  const dx = D[1] / A;
  const dz = D[2] / A;
  const ca = Math.cos(A);
  const sa = Math.sin(A);
  const rho = L / A;
  const h = Math.sin(A * 0.5);
  // (each column through the arc's end: across towards the bend and up turn together)
  for (let k = 0; k < 9; k += 3) {
    const x = out[k];
    const y = out[k + 1];
    const z = out[k + 2];
    const u = x * dx + z * dz;
    const v = -x * dz + z * dx;
    const nu = u * ca + y * sa;
    out[k] = nu * dx - v * dz;
    out[k + 1] = y * ca - u * sa;
    out[k + 2] = nu * dz + v * dx;
  }
  const u0 = rho * 2 * h * h;
  out[9] = u0 * dx;
  out[10] = yb + rho * sa;
  out[11] = u0 * dz;
  return out;
}

/**
 * The move D of a neck, from how the head is turned (relative to the chest: yaw + to the left, pitch
 * + up, roll + its top to the left - radians) and where the neck leaves the body (yb, in the neck's
 * frame). The bend nods about the head's own sideways axis (turned with the twist).
 */
export function neckMove(yaw, pitch, roll, yb, out) {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  // (a nod down bends it towards the face, which is turned by yaw; a roll towards the head's left)
  const th = -pitch;
  out[0] = yaw;
  out[1] = th * s + roll * c;
  out[2] = th * c - roll * s;
  out[3] = yb;
  return out;
}

const _T = new Float64Array(12);
/**
 * The head's frame in the world from the neck's at rest: O (where J is at rest), r0, u0, f0 (the
 * chest's frame at the neck: left, up, ahead - unit), hs, J (NECK_J's) and D. Writes the head's own
 * axes (left, up, ahead - unit) into hr, hu, hf and the point j.headC is (the head frame's origin)
 * into c; returns c. (vectors: anything with x, y, z)
 */
export function headFrame(O, r0, u0, f0, hs, J, D, c, hr, hu, hf) {
  const T = neckTop(D, _T);
  // the head's origin in the neck's frame is -J; carried by the top's move
  const px = -T[3] * J.y - T[6] * J.z + T[9];
  const py = -T[4] * J.y - T[7] * J.z + T[10];
  const pz = -T[5] * J.y - T[8] * J.z + T[11];
  c.x = O.x + hs * (r0.x * px + u0.x * py + f0.x * pz);
  c.y = O.y + hs * (r0.y * px + u0.y * py + f0.y * pz);
  c.z = O.z + hs * (r0.z * px + u0.z * py + f0.z * pz);
  hr.x = r0.x * T[0] + u0.x * T[1] + f0.x * T[2];
  hr.y = r0.y * T[0] + u0.y * T[1] + f0.y * T[2];
  hr.z = r0.z * T[0] + u0.z * T[1] + f0.z * T[2];
  hu.x = r0.x * T[3] + u0.x * T[4] + f0.x * T[5];
  hu.y = r0.y * T[3] + u0.y * T[4] + f0.y * T[5];
  hu.z = r0.z * T[3] + u0.z * T[4] + f0.z * T[5];
  hf.x = r0.x * T[6] + u0.x * T[7] + f0.x * T[8];
  hf.y = r0.y * T[6] + u0.y * T[7] + f0.y * T[8];
  hf.z = r0.z * T[6] + u0.z * T[7] + f0.z * T[8];
  return c;
}

/**
 * From the neck's frame, as it is moved (a point that neckBend gave), into the head's own frame (the
 * one its mesh is made in: J given there, e.g. { y: NECK_J.folk.y + HEAD_DROP, z: NECK_J.folk.z } for
 * the MakeHuman heads): a 3x4 matrix as neckTop's. For a head that draws its own neck (a portrait,
 * render/portrait.js, later): its neck's points through neckBend and then this, in the head's matrix.
 */
export function headLocal(D, J, out) {
  const T = neckTop(D, _T);
  // (the inverse of the top's rigid move: its rotation's transpose, then J back)
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) out[a * 3 + b] = T[b * 3 + a];
  for (let a = 0; a < 3; a++) out[9 + a] = -(out[a] * T[9] + out[3 + a] * T[10] + out[6 + a] * T[11]);
  out[10] += J.y;
  out[11] += J.z;
  return out;
}

// The same in the graphics card (render/glsl.js, the people's vertex shader: a neck's points and
// normals, in its own frame, before its instance's matrix). D: [psi, bx, bz, yb].
export const NECK_GLSL = /* glsl */ `
void neckBend(inout vec3 p, inout vec3 n, vec4 D) {
  float yb = D.w;
  float L = -yb;
  if (L <= 1e-4) return;
  float s = clamp((p.y - yb) / L, 0.0, 1.0);
  float w = s * s * (3.0 - 2.0 * s);
  float tw = D.x * w;
  float c = cos(tw);
  float si = sin(tw);
  vec2 q = vec2(c * p.x + si * p.z, -si * p.x + c * p.z);
  vec2 m = vec2(c * n.x + si * n.z, -si * n.x + c * n.z);
  float dw = (s > 0.0 && s < 1.0) ? 6.0 * s * (1.0 - s) / L : 0.0;
  float my = n.y - D.x * dw * (m.x * q.y - m.y * q.x);
  float y = p.y;
  float A = length(D.yz);
  if (A > ${A_MIN.toExponential()}) {
    vec2 d = D.yz / A;
    float u = dot(q, d);
    float v = -q.x * d.y + q.y * d.x;
    float yc = clamp(y, yb, 0.0);
    float a = A * (yc - yb) / L;
    float rho = L / A;
    float ov = y - yc;
    float ca = cos(a);
    float sa = sin(a);
    float h = sin(a * 0.5);
    float ny2 = yb + (rho - u) * sa + ov * ca;
    float nu = rho * 2.0 * h * h + u * ca + ov * sa;
    q = nu * d + v * vec2(-d.y, d.x);
    float k = ov == 0.0 ? rho / max(rho - u, 0.2 * rho) : 1.0;
    y = ny2;
    float nun = dot(m, d);
    float nvn = -m.x * d.y + m.y * d.x;
    float nyk = my * k;
    my = nyk * ca - nun * sa;
    m = (nyk * sa + nun * ca) * d + nvn * vec2(-d.y, d.x);
  }
  p = vec3(q.x, y, q.y);
  n = normalize(vec3(m.x, my, m.y));
}
`;
