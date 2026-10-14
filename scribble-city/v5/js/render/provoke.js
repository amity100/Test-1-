// (ROADMAP 11.5) Which corner of a triangle its "flat" values come from - the ones the shaders keep
// the same across a whole triangle instead of blending them (render/glsl.js: a surface's instance
// values vX and vClip, its pen's row vMat; a pen line's colour and width, a raindrop's fade).
//
// WebGL takes them from the last corner. Direct3D, under the browser on Windows, takes them from the
// first, so there the browser (ANGLE) puts a geometry shader in front of every triangle of every
// program with such values, to hand it the last corner's: on a graphics card in the processor that
// is most of the time of the drawing and of the mirror, per triangle, however few pixels they cover
// (ANGLE ProgramExecutableD3D::usesGeometryShader, DynamicHLSL's geometry shader).
//
// A surface's flat values are the same on all three corners of every triangle (they are per thing
// drawn, or per piece of a merged one), so from the first corner they are exactly what they were:
// where the browser lets the game say so (WEBGL_provoking_vertex), surfaces are drawn with the first
// corner, and pen lines and raindrops - whose corners differ - with the last, as always.
// ?provokelast: always the last, as it was.

const FIRST = 1;
const LAST = 2;
let ext = null;
let cur = 0;
let keepLast = false;

// (main.js, once the renderer is made, and again if the graphics context is lost and comes back)
export function initProvoke(gl, last = false) {
  ext = gl.getExtension('WEBGL_provoking_vertex');
  keepLast = last;
  cur = 0;
  provokeFirst();
  return !!ext;
}

// a surface's draw (render/materials.js): the first corner, where it may
export function provokeFirst() {
  const want = keepLast ? LAST : FIRST;
  if (!ext || cur === want) return;
  ext.provokingVertexWEBGL(want === FIRST ? ext.FIRST_VERTEX_CONVENTION_WEBGL : ext.LAST_VERTEX_CONVENTION_WEBGL);
  cur = want;
}

// a pen line's or a raindrop's draw: the last corner, as WebGL has it
export function provokeLast() {
  if (!ext || cur === LAST) return;
  ext.provokingVertexWEBGL(ext.LAST_VERTEX_CONVENTION_WEBGL);
  cur = LAST;
}

// (game/telemetry.js) whether the browser lets the game choose; and the timing of the old way
export function provokeState() {
  return { can: !!ext, first: !!ext && !keepLast };
}

export function setProvokeLast(on) {
  keepLast = !!on;
  cur = 0;
}
