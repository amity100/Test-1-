// (v5, ROADMAP 11.39) The same numbers, not sent again. Every pen's shader has the city's shared
// arrays in it - the lamps near you (render/materials.js uLightPos, uLightCol) and the eraser's
// spots (uWErase): forty vec4s. three.js sends a material's uniforms again whenever the next draw
// is drawn with another material, and an array it sends whole each time, with no look at whether
// the shader has it already - in the mainland, where nearly every draw is a pen of its own, that
// was most of a phone's time on the processor (uniform4fv: 54% of it, the browser's own profile).
// Here the graphics context remembers, for each place in each shader, what it was last sent, and
// an array that is the same again is not sent: the shader has it. The picture is the same.

// arrays shorter than this are sent as they are (a comparison would cost what it saves)
const MIN_LEN = 8;

export function cacheUniformArrays(gl) {
  if (!gl || gl.__uniformCache) return;
  gl.__uniformCache = true;
  // (where in which shader -> what it holds now; a shader linked again has new places, a lost
  // context new shaders: their old ones are let go with them)
  const held = new WeakMap();
  // (counted for the tests: calls, and those sent)
  const stats = (gl.__uniformStats = { calls: 0, sent: 0 });
  for (const fn of ['uniform4fv', 'uniform3fv', 'uniform2fv', 'uniform1fv']) {
    const send = gl[fn].bind(gl);
    gl[fn] = (loc, data, offset, length) => {
      stats.calls++;
      if (loc === null || loc === undefined || offset !== undefined || !data || data.length < MIN_LEN) return send(loc, data, offset, length);
      const had = held.get(loc);
      if (had && had.length === data.length) {
        let same = true;
        for (let i = 0; i < data.length; i++) {
          if (had[i] !== data[i]) {
            same = false;
            break;
          }
        }
        if (same) return undefined;
        had.set(data);
      } else held.set(loc, Float32Array.from(data));
      stats.sent++;
      return send(loc, data, offset, length);
    };
  }
}
