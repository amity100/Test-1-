// (v5, GTA IV round) Lettering made of strokes, for the signs inside the places you sit down in and
// in the malls' halls: the word over the doors to the auditorium, the box office's, the films' names
// on their posters, the offers on the banners and in the windows, a kiosk's name round its roof.
// The city's neon (world/paint.js, world/mainland/index.js) is a picture of so many places shared by
// every shop's name in sight - on the mainland it is full where the blocks are thick - so what is
// lettered inside a room is not taken from it: each letter is a handful of little boxes (a letter of
// five strokes by seven, the shape of an old shop's sign or a cinema's board of lights), in the
// batches and the soups like everything else in the room, drawn by the same pens.

// the glyphs: eight rows each (the last for a tail under the line), five columns, a row a digit of
// base 32 (its bits the columns, the leftmost the highest)
const GLYPHS = {
  A: '4ahhvhh0', B: 'u99e99u0', C: 'ehggghe0', D: 'u99999u0', E: 'vgguggv0', F: 'vgguggg0', G: 'ehggjhe0', H: 'hhhvhhh0',
  I: 'e44444e0', J: '71111he0', K: 'hikokih0', L: 'ggggggv0', M: 'hhrlhhh0', N: 'hhpljhh0', O: 'ehhhhhe0', P: 'uhhuggg0',
  Q: 'ehhhhle1', R: 'uhhukih0', S: 'ehge1he0', T: 'v4444440', U: 'hhhhhhe0', V: 'hhhaaa40', W: 'hhhllrh0', X: 'hha4ahh0',
  Y: 'hha44440', Z: 'v1248gv0', 0: '4ahhha40', 1: '4ck444v0', 2: 'eh168gv0', 3: 'v1261he0', 4: '26aiv220', 5: 'vgmp1he0',
  6: '68gmphe0', 7: 'v1224880', 8: 'ehhehhe0', 9: 'ehjd12c0', ' ': '00000000', '!': '44444040', '%': '9la4ali0', '-': '000v0000',
  '&': '8kk8lid0', "'": '64800000', '.': '000004e4', ',': '00000648', ':': '04e404e4', '/': '11248gg0', $: '4eke5e40', '?': 'eh244040',
  '+': '044v4400', '#': 'aavavaa0', '*': '0havah00',
};

// a glyph's strokes: the runs of each row, a run joined with the one under it where they are the
// same (so an I is three boxes, not seven) - [c0, r0, c1, r1] in cells, r0 the top
const cache = new Map();
function strokes(ch) {
  let out = cache.get(ch);
  if (out) return out;
  out = [];
  const g = GLYPHS[ch] || GLYPHS['?'];
  const open = [];
  for (let r = 0; r < 8; r++) {
    const v = parseInt(g[r], 32);
    const runs = [];
    let c = 0;
    while (c < 5) {
      if (v & (16 >> c)) {
        const c0 = c;
        while (c < 5 && v & (16 >> c)) c++;
        runs.push([c0, c]);
      } else c++;
    }
    // (carry the runs of the row over this one down, where they match)
    const next = [];
    for (const [c0, c1] of runs) {
      const k = open.findIndex((o) => o[0] === c0 && o[2] === c1 && o[3] === r);
      if (k >= 0) {
        open[k][3] = r + 1;
        next.push(open[k]);
        open.splice(k, 1);
      } else next.push([c0, r, c1, r + 1]);
    }
    for (const o of open) out.push(o);
    open.length = 0;
    open.push(...next);
  }
  for (const o of open) out.push(o);
  cache.set(ch, out);
  return out;
}

/**
 * A word lettered: cb(a0, b0, a1, b1) for each stroke - a along the line (0 at the word's left
 * edge), b up from the line - for a word h high (its capitals) centred on 0 along the line. Returns
 * the word's length. (Six cells a letter: five of it, one between.)
 */
export function letter(text, h, cb) {
  const cell = h / 7;
  const t = String(text).toUpperCase();
  const len = (t.length * 6 - 1) * cell;
  let a = -len / 2;
  for (const ch of t) {
    for (const [c0, r0, c1, r1] of strokes(ch)) cb(a + c0 * cell, (7 - r1) * cell, a + c1 * cell, (7 - r0) * cell);
    a += 6 * cell;
  }
  return len;
}

// how long a word is, lettered h high
export function letterLen(text, h) {
  return ((String(text).length * 6 - 1) * h) / 7;
}
