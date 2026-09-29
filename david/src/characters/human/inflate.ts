/*
 * gzip / raw-deflate decoding for the human assets (human.binz).
 * Uses the browser's DecompressionStream when available, otherwise a small RFC 1951 inflater.
 */

export async function gunzip(buf: ArrayBuffer): Promise<ArrayBuffer> {
  let u8 = new Uint8Array(buf);
  // the published artifact can't serve arbitrary binary files, so tools/package_artifact.py ships each .binz as
  // base64 text (".binz.txt"); gzip data always starts with "H4sI" once base64-encoded
  if (u8.length >= 4 && u8[0] === 0x48 && u8[1] === 0x34 && u8[2] === 0x73 && u8[3] === 0x49) {
    const s = atob(new TextDecoder().decode(u8).replace(/\s+/g, ''));
    u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    buf = u8.buffer;
  }
  if (u8.length < 18 || u8[0] !== 0x1f || u8[1] !== 0x8b) return buf; // not gzip
  const DS = (globalThis as unknown as { DecompressionStream?: new (f: string) => TransformStream<Uint8Array, Uint8Array> }).DecompressionStream;
  if (DS) {
    try {
      const stream = new Blob([u8]).stream().pipeThrough(new DS('gzip'));
      return await new Response(stream).arrayBuffer();
    } catch {
      /* fall through to the JS inflater */
    }
  }
  // gzip header (RFC 1952)
  let p = 10;
  const flg = u8[3];
  if (flg & 4) p += 2 + (u8[p] | (u8[p + 1] << 8));
  if (flg & 8) while (u8[p++] !== 0);
  if (flg & 16) while (u8[p++] !== 0);
  if (flg & 2) p += 2;
  const isize = u8[u8.length - 4] | (u8[u8.length - 3] << 8) | (u8[u8.length - 2] << 16) | (u8[u8.length - 1] << 24);
  const out = new Uint8Array(isize >>> 0);
  inflateRaw(u8.subarray(p, u8.length - 8), out);
  return out.buffer;
}

// ------------------------------------------------------------------------------------------ inflate
const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

interface Huff {
  counts: Uint16Array;
  symbols: Uint16Array;
}

function buildHuff(lengths: Uint8Array, n: number): Huff {
  const counts = new Uint16Array(16);
  for (let i = 0; i < n; i++) counts[lengths[i]]++;
  counts[0] = 0;
  const offs = new Uint16Array(16);
  for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
  const symbols = new Uint16Array(n);
  for (let i = 0; i < n; i++) if (lengths[i]) symbols[offs[lengths[i]]++] = i;
  return { counts, symbols };
}

export function inflateRaw(src: Uint8Array, dst: Uint8Array): number {
  let pos = 0; // byte position
  let bitbuf = 0;
  let bitcnt = 0;
  let out = 0;
  const bits = (n: number) => {
    while (bitcnt < n) {
      bitbuf |= (src[pos++] ?? 0) << bitcnt;
      bitcnt += 8;
    }
    const v = bitbuf & ((1 << n) - 1);
    bitbuf >>>= n;
    bitcnt -= n;
    return v;
  };
  const decode = (h: Huff) => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const count = h.counts[len];
      if (code - count < first) return h.symbols[index + (code - first)];
      index += count;
      first += count;
      first <<= 1;
      code <<= 1;
    }
    throw new Error('inflate: bad code');
  };
  // fixed tables
  const fl = new Uint8Array(288);
  for (let i = 0; i < 144; i++) fl[i] = 8;
  for (let i = 144; i < 256; i++) fl[i] = 9;
  for (let i = 256; i < 280; i++) fl[i] = 7;
  for (let i = 280; i < 288; i++) fl[i] = 8;
  const fixedLit = buildHuff(fl, 288);
  const fd = new Uint8Array(30).fill(5);
  const fixedDist = buildHuff(fd, 30);
  let final = 0;
  while (!final) {
    final = bits(1);
    const type = bits(2);
    if (type === 0) {
      bitbuf = 0;
      bitcnt = 0;
      const len = src[pos] | (src[pos + 1] << 8);
      pos += 4;
      dst.set(src.subarray(pos, pos + len), out);
      pos += len;
      out += len;
      continue;
    }
    let lit = fixedLit, dist = fixedDist;
    if (type === 2) {
      const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
      const cl = new Uint8Array(19);
      for (let i = 0; i < hclen; i++) cl[CL_ORDER[i]] = bits(3);
      const clh = buildHuff(cl, 19);
      const lens = new Uint8Array(hlit + hdist);
      for (let i = 0; i < hlit + hdist; ) {
        const sym = decode(clh);
        if (sym < 16) lens[i++] = sym;
        else {
          let rep = 0, val = 0;
          if (sym === 16) {
            val = lens[i - 1];
            rep = 3 + bits(2);
          } else if (sym === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          while (rep--) lens[i++] = val;
        }
      }
      lit = buildHuff(lens.subarray(0, hlit), hlit);
      dist = buildHuff(lens.subarray(hlit), hdist);
    } else if (type === 3) throw new Error('inflate: bad block');
    for (;;) {
      const sym = decode(lit);
      if (sym < 256) dst[out++] = sym;
      else if (sym === 256) break;
      else {
        const li = sym - 257;
        const len = LEN_BASE[li] + bits(LEN_EXTRA[li]);
        const di = decode(dist);
        const d = DIST_BASE[di] + bits(DIST_EXTRA[di]);
        for (let k = 0; k < len; k++, out++) dst[out] = dst[out - d];
      }
    }
  }
  return out;
}
