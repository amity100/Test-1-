// (v5, ROADMAP 13.6) The city's people drawn as the hero is: the first of them, each their own - their
// faces' shapes and colours, how they wear their hair, what they wear and in what. A spec here is all
// render/folkink.js needs to draw their pictures, render/folkshapes.js to make their bodies,
// render/herolines.js to draw their lines and game/looks.js to dress them (folkLook).
//
// Colours are the drawing's own: the hex of the coloured pencils, light to dark.

// ------------------------------------------------------------------ skin
// base: the paper's tint for it; grain: the pencil over all of it; warm: the cheeks, the nose, the
// ears; sh1, sh2, sh3: its shadows - warm, cool across them, the deepest; light: where it catches the
// light; neck: the warm dark under the jaw (r, g, b); rgb: its colour for the rest of the game
export const SKINS = {
  fair: {
    base: '#e8c3a6', grain: ['#f0ceb2', '#dcae90', '#e6c0a2', '#cfa084', '#efc8ac'], warm: ['#e49482', '#ec9e8c', '#d88472'],
    sh1: ['#b47e66', '#a6725c', '#9a6a56'], sh2: ['#80586c', '#705474', '#8a6452', '#625064'], sh3: ['#4c3036', '#5c3c38', '#402c34'],
    light: ['#fde8d2', '#fff2e0', '#f8dec6'], neck: [128, 78, 60], rgb: [0.93, 0.8, 0.7],
  },
  light: {
    base: '#d9a888', grain: ['#e2b496', '#c8987a', '#d6a686', '#bc8c70', '#e0b090'], warm: ['#d4826e', '#dc907a', '#c87462'],
    sh1: ['#a06a52', '#925e48', '#865844'], sh2: ['#6c4a5c', '#5e4664', '#78543e', '#523e52'], sh3: ['#3e2428', '#4a2e2a', '#341e24'],
    light: ['#f6d4b4', '#fce0c4', '#eec8a6'], neck: [104, 60, 44], rgb: [0.86, 0.68, 0.56],
  },
  golden: {
    base: '#dcae86', grain: ['#e4b892', '#cc9c74', '#dab088', '#c09068', '#e2b48e'], warm: ['#d8846c', '#e09278', '#cc7660'],
    sh1: ['#a06e4c', '#946446', '#885c40'], sh2: ['#6e4c58', '#604862', '#7a5a40', '#54404e'], sh3: ['#3e2622', '#4a2e26', '#341e1e'],
    light: ['#f6d8b4', '#fce4c4', '#efcca4'], neck: [104, 64, 42], rgb: [0.86, 0.69, 0.53],
  },
  olive: {
    base: '#c49070', grain: ['#cc9a78', '#b07e5e', '#c28e6c', '#a47252', '#ca9676'], warm: ['#c4705c', '#cc7e68', '#b46450'],
    sh1: ['#8a5a40', '#7c5038', '#704a34'], sh2: ['#5a3c4a', '#4c384e', '#664632', '#42303e'], sh3: ['#2e1a1c', '#3a221e', '#26161a'],
    light: ['#eec4a0', '#f6d2b0', '#e4b892'], neck: [86, 48, 32], rgb: [0.78, 0.6, 0.46],
  },
  tan: {
    base: '#c8956c', grain: ['#d09e76', '#b4805a', '#c69468', '#a8744e', '#ce9c72'], warm: ['#cc765c', '#d48468', '#bc6a50'],
    sh1: ['#8e5c3c', '#805236', '#744a30'], sh2: ['#5c3e46', '#4e3a4c', '#68482e', '#44323c'], sh3: ['#301c1a', '#3c241c', '#281818'],
    light: ['#f0c89e', '#f8d6ae', '#e6bc90'], neck: [90, 52, 32], rgb: [0.8, 0.62, 0.46],
  },
  deep: {
    base: '#76452e', grain: ['#82503a', '#663a26', '#7c4a32', '#5a3220', '#885640'], warm: ['#8a4636', '#985242', '#7a3c2e'],
    sh1: ['#4a281c', '#3e2216', '#361e16'], sh2: ['#2e1c2a', '#28182c', '#36201c', '#22162a'], sh3: ['#140a0c', '#1c0e0c', '#100808'],
    light: ['#b07c5e', '#c08a6a', '#a07054'], neck: [36, 18, 12], rgb: [0.46, 0.29, 0.2],
  },
};

// ------------------------------------------------------------------ eyes
export const IRIS = {
  brown: ['#3a2410', '#5a3a18', '#6a4a28', '#2a1a0c', '#7a5a30'],
  dark: ['#22140a', '#3a2412', '#2e1c0e', '#180e08', '#4a3018'],
  hazel: ['#3a2410', '#8a6a30', '#9a8040', '#5a3a18', '#7a7a3a'],
  green: ['#2e4a28', '#4a6a34', '#6a8a44', '#3a5a30', '#8a9a50'],
  grey: ['#3a5068', '#5a7890', '#7a90a4', '#4a6278', '#90a4b4'],
};

/**
 * Each of them: who (key, name, age), the body (fem: a woman's - render/folkshapes.js; build: as a
 * look's), the face (head: its shape - jaw, chin, nose, lips, brow; skin; eyes, brows, nose,
 * mouth; beard; lines of age; freckles, makeup), the hair (style, its colours, grey), what they wear:
 * top (over the rest: a jacket worn open), inner (seen in its opening), bottom, shoes, a few things
 * besides (acc). And what makes each of them their own beyond their colours: the shape of their
 * face (shape: render/folkshapes.js warpOf - its width and length, the jaw, the cheeks, the chin,
 * the nose, the brow, how far apart the eyes are, the neck), their body (body: a belly, a chest, how
 * thick their limbs), how they look (expr: 'neutral', 'soft', 'half', 'smile', 'laugh'), glasses.
 */
export const FOLK = [
  {
    // the owner of a trattoria by the bay: heavy, a round full face, a grey moustache, gold glasses,
    // a warm smile; a tobacco wool blazer over a cream shirt, grey trousers, brown loafers
    key: 'bruno', name: 'Bruno', age: 58, fem: false,
    build: { height: 0.95, head: 1.05, bulk: 1.24, limbs: 1.08 },
    body: { belly: 1.0, chest: 0.25, thick: 0.16 },
    shape: { width: 1.1, long: 0.93, forehead: 1.04, crown: 0.96, jaw: 1.16, cheeks: 1.0, cheekbones: -0.02, chin: -0.3, chinW: 1.25, dbl: 1.0, brow: 0.3, noseLen: 1.06, noseW: 1.32, noseOut: 1.1, lips: 0.2, gap: 0.97, neck: 1.22 },
    expr: 'smile',
    head: { jaw: 1.1, chin: 1.0, nose: 1.3, lips: 0.95, brow: 1.0 },
    skin: 'light', eyes: { iris: 'brown', open: 0.84, lid: 0.72, lashes: 0.1, liner: 0 },
    brows: { col: ['#6a6460', '#8a8480', '#4e4844'], thick: 1.4, arch: 0.35 },
    mouth: { w: 1.06, full: 0.9, lip: ['#a86a5c', '#b4766a'], lipstick: null },
    beard: 'mustache', beardCol: ['#9a9590', '#b8b4ae', '#7a7672', '#5a5652'], lines: 0.95, freckles: 0, blush: 0.65,
    hair: { style: 'buzz', base: '#8a8682', dark: ['#5a5652', '#6a6662', '#4e4a46'], mid: ['#9a9692', '#a6a29e'], light: ['#d0ccc6', '#dcd8d2', '#c4c0ba'], grey: 1 },
    glasses: { col: [0.78, 0.62, 0.3], shape: 'round' },
    top: { kind: 'blazer', fabric: 'wool', base: '#7a5634', dark: ['#4a3220', '#56381e', '#3e2a18'], mid: ['#8a6440', '#7e5a38'], light: ['#b48a5e', '#c09668', '#a87e54'], buttons: '#3a2a1c', square: '#9a2a34' },
    inner: { kind: 'shirt', base: '#f2ecdc', dark: ['#cfc6b2', '#c4baa4', '#d8d0bc'], light: ['#fffcf2', '#faf6ea'], collar: true, open: 2 },
    bottom: { kind: 'trousers', base: '#4a4a50', dark: ['#2a2a30', '#323238', '#24242a'], mid: ['#56565c', '#505056'], light: ['#7a7a82', '#84848c'], crease: true },
    belt: { col: '#4a2c1a', buckle: '#c8b080' },
    shoes: { kind: 'loafer', base: '#6a3c22', dark: ['#3a1e0e', '#462612', '#30180a'], light: ['#a06a44', '#b07a50', '#946040'], sole: [0.22, 0.14, 0.09] },
    acc: { watch: '#c8a860' },
  },
  {
    // a young designer from the arts district: tall and slim, a long face, high cheekbones, a short
    // beard, a sure half-smile; olive bomber, white tee, black jeans, white sneakers
    key: 'dre', name: 'Dre', age: 26, fem: false,
    build: { height: 1.06, head: 0.98, bulk: 0.9, limbs: 0.96 },
    body: { belly: -0.3, chest: 0.1, thick: -0.04 },
    shape: { width: 0.93, long: 1.1, forehead: 1.02, crown: 1.04, jaw: 0.98, cheeks: -0.4, cheekbones: 0.07, chin: 0.5, chinW: 0.95, dbl: 0, brow: 0.3, noseLen: 1.02, noseW: 1.26, noseOut: 0.95, lips: 0.8, gap: 1.03, neck: 0.96 },
    expr: 'half',
    head: { jaw: 0.95, chin: 1.0, nose: 1.12, lips: 1.25, brow: 0.95 },
    skin: 'deep', eyes: { iris: 'dark', open: 1.05, lid: 0.35, lashes: 0.35, liner: 0 },
    brows: { col: ['#120a08', '#1a100c', '#0c0806'], thick: 1.05, arch: 0.2 },
    mouth: { w: 1.05, full: 1.25, lip: ['#5a2e28', '#6e3a32'], lipstick: null },
    beard: 'short', beardCol: ['#0e0806', '#160c08', '#1c120c'], lines: 0.1, freckles: 0, blush: 0,
    hair: { style: 'curls', base: '#120c0a', dark: ['#080504', '#0e0806', '#140c0a'], mid: ['#241812', '#2c1e16', '#1e140e'], light: ['#4a3628', '#56402e', '#3e2c20'], grey: 0 },
    top: { kind: 'bomber', fabric: 'nylon', base: '#4a5232', dark: ['#2a301c', '#323a22', '#262c18'], mid: ['#5a6440', '#525c38', '#626c46'], light: ['#8a9468', '#96a072', '#a0aa7c'], rib: '#30361e', lining: '#e0702a', buttons: '#9a9a90' },
    inner: { kind: 'tee', base: '#f2f0ea', dark: ['#c8c6c0', '#bcbab4', '#d2d0ca'], light: ['#ffffff', '#fbfaf6'] },
    bottom: { kind: 'jeans', base: '#1a1a1e', dark: ['#0a0a0c', '#101012', '#0c0c10'], mid: ['#2a2a30', '#24242a'], light: ['#4a4a54', '#56565e', '#5e5e68'], stitch: '#6a6a70' },
    belt: { col: '#141414', buckle: '#b0b0b8' },
    shoes: { kind: 'sneaker', base: '#f2f2ee', dark: ['#c8c8c4', '#bcbcb8', '#d4d4d0'], light: ['#ffffff'], accent: '#e0702a', lace: '#f8f8f4', sole: [0.95, 0.94, 0.9] },
    acc: {},
  },
  {
    // a silver-haired gentleman of the bay: lean, a long gaunt face, a high hooked nose, deep-set
    // eyes, a trimmed white beard; cream linen jacket, sky-blue shirt, sand chinos, loafers
    key: 'sal', name: 'Salvatore', age: 63, fem: false,
    build: { height: 1.03, head: 1.0, bulk: 0.92, limbs: 0.98 },
    body: { belly: -0.15, chest: 0, thick: -0.06 },
    shape: { width: 0.92, long: 1.12, forehead: 1.1, crown: 1.0, jaw: 0.94, cheeks: -1.0, cheekbones: 0.05, chin: 0.4, chinW: 0.88, dbl: 0, brow: 0.9, noseLen: 1.18, noseW: 1.04, noseOut: 1.22, hook: 1.0, lips: -0.4, gap: 0.98, neck: 0.92 },
    expr: 'neutral',
    head: { jaw: 1.02, chin: 0.95, nose: 1.15, lips: 0.8, brow: 1.1 },
    skin: 'tan', eyes: { iris: 'grey', open: 0.9, lid: 0.78, lashes: 0.15, liner: 0 },
    brows: { col: ['#9a9690', '#b4b0aa', '#7a7670'], thick: 1.15, arch: 0.25 },
    mouth: { w: 0.98, full: 0.75, lip: ['#a0645a', '#ac7064'], lipstick: null },
    beard: 'trim', beardCol: ['#c8c6c2', '#e0deda', '#a8a6a2', '#8a8884'], lines: 1.0, freckles: 0, blush: 0.1,
    hair: { style: 'back', base: '#a8a6a2', dark: ['#6a6864', '#7a7874', '#5a5854'], mid: ['#b8b6b2', '#c4c2be', '#acaaa6'], light: ['#eceae6', '#f6f4f0', '#dedcd8'], grey: 1 },
    top: { kind: 'blazer', fabric: 'linen', base: '#e6dcc8', dark: ['#b8ac94', '#c4b89e', '#a89c84'], mid: ['#dcd0ba', '#d4c8b0'], light: ['#f6f0e2', '#fffaee', '#f0e8d6'], buttons: '#6a4e36', square: '#e07a3a' },
    inner: { kind: 'shirt', base: '#a8c8e6', dark: ['#7a9cbe', '#86a8c8', '#6e90b2'], light: ['#cae0f4', '#d6e8f8'], collar: true, open: 2 },
    bottom: { kind: 'chinos', base: '#cbb48e', dark: ['#9e8866', '#a8926e', '#94805e'], mid: ['#c0a882', '#b8a07a'], light: ['#e2d0ae', '#ead8b8'], cuff: true },
    belt: { col: '#6a4a2e', buckle: '#d0c4a0' },
    shoes: { kind: 'loafer', base: '#8a5e3a', dark: ['#5a3a20', '#664428', '#4e321a'], light: ['#b48a62', '#c09670', '#a87e58'], sole: [0.3, 0.2, 0.13] },
    acc: { watch: '#d8c08a' },
  },
  {
    // an architect from the harbour studios: a broad face with wide cheekbones, a small nose, straight
    // brows over almond eyes, a sleek black bob, a gentle smile; sage blazer, white tee, wide cream
    // trousers, white sneakers
    key: 'mei', name: 'Mei', age: 29, fem: true,
    build: { height: 0.95, head: 0.97, bulk: 0.86, limbs: 0.97 },
    body: { belly: -0.2, chest: 0, thick: -0.02 },
    shape: { width: 1.05, long: 0.95, forehead: 1.0, crown: 1.0, jaw: 0.97, cheeks: 0.35, cheekbones: 0.07, chin: -0.1, chinW: 1.0, dbl: 0, brow: -0.7, noseLen: 0.9, noseW: 1.1, noseOut: 0.8, lips: 0.2, gap: 1.05, neck: 0.96 },
    expr: 'soft',
    head: { jaw: 0.0, chin: 0.95, nose: 0.95, lips: 1.0, brow: 0.5 },
    skin: 'golden', eyes: { iris: 'dark', open: 0.8, lid: 0.2, lashes: 0.55, liner: 0.45, mono: true, shadow: '#a07a6a' },
    brows: { col: ['#120c0a', '#1c1410', '#0a0706'], thick: 0.85, arch: 0.08 },
    mouth: { w: 0.94, full: 1.05, lip: ['#c06a66', '#cc7872'], lipstick: null },
    beard: null, lines: 0.0, freckles: 0, blush: 0.35,
    hair: { style: 'long', len: 0.13, base: '#0e0a0a', dark: ['#050404', '#0a0807', '#080606'], mid: ['#1e1814', '#241c18', '#1a1410'], light: ['#4a4040', '#56484a', '#3e3434'], grey: 0, wave: 0 },
    top: { kind: 'blazer', fabric: 'crepe', base: '#9aa88a', dark: ['#64705a', '#6e7a62', '#5a664e'], mid: ['#909e80', '#a2b092'], light: ['#c4d0b2', '#ccd8bc', '#bcc8aa'], buttons: '#e8e4d8' },
    inner: { kind: 'tee', base: '#f6f4ee', dark: ['#cecbc2', '#c4c1b8', '#d8d5cc'], light: ['#ffffff', '#fcfbf6'] },
    bottom: { kind: 'wide', base: '#e4dcc8', dark: ['#b4aa94', '#bcb29c', '#aca28c'], mid: ['#dad2bc', '#d2caae'], light: ['#f4eedc', '#faf4e4'] },
    belt: null,
    shoes: { kind: 'sneaker', base: '#f6f4ee', dark: ['#cecbc2', '#c4c1b8', '#d8d5cc'], light: ['#ffffff'], accent: '#9aa88a', lace: '#fbfaf6', sole: [0.96, 0.95, 0.92] },
    acc: { earrings: '#e0c070' },
  },
  {
    // a fashion buyer between two shows: tall, a heart-shaped face - wide at the cheekbones, a
    // narrow pointed chin - red lips, her hair drawn back in a bun; camel blazer over a black silk
    // blouse, wide black trousers, black booties
    key: 'valeria', name: 'Valeria', age: 33, fem: true,
    build: { height: 1.0, head: 0.96, bulk: 0.86, limbs: 0.98 },
    body: { belly: -0.3, chest: 0.1, thick: -0.04 },
    shape: { width: 1.0, long: 1.02, forehead: 1.06, crown: 1.02, jaw: 0.84, cheeks: -0.3, cheekbones: 0.09, chin: 0.25, chinW: 0.78, dbl: 0, brow: -0.4, noseLen: 0.95, noseW: 0.86, noseOut: 1.0, lips: 0.7, gap: 1.02, neck: 0.94 },
    expr: 'neutral',
    head: { jaw: 0.0, chin: 0.9, nose: 0.85, lips: 1.15, brow: 0.7 },
    skin: 'light', eyes: { iris: 'brown', open: 1.12, lid: 0.3, lashes: 1.0, liner: 0.8, shadow: '#8a6a5a' },
    brows: { col: ['#1e1410', '#2a1c14', '#160e0a'], thick: 0.78, arch: 0.75 },
    mouth: { w: 0.95, full: 1.15, lip: ['#a8262e', '#b8323a'], lipstick: true },
    beard: null, lines: 0.1, freckles: 0, blush: 0.35,
    hair: { style: 'bun', base: '#1c1410', dark: ['#0a0706', '#120c09', '#0e0907'], mid: ['#2e2016', '#36261a', '#281c14'], light: ['#6a4e3a', '#7a5c44', '#5e4432'], grey: 0 },
    top: { kind: 'blazer', fabric: 'crepe', base: '#c4925c', dark: ['#8e6236', '#9a6c3e', '#845a30'], mid: ['#b88452', '#c08c58'], light: ['#e0b480', '#e8bc8a', '#d8aa76'], buttons: '#2a1e14' },
    inner: { kind: 'blouse', base: '#16141a', dark: ['#060508', '#0c0a0e', '#08070a'], light: ['#4a4652', '#5a5662', '#3e3a46'] },
    bottom: { kind: 'wide', base: '#141418', dark: ['#060608', '#0a0a0c', '#08080a'], mid: ['#1e1e24', '#222228'], light: ['#3c3c46', '#46464e'] },
    belt: { col: '#121012', buckle: '#d4b878' },
    shoes: { kind: 'bootie', base: '#141214', dark: ['#060506', '#0a0809', '#040304'], light: ['#5a5662', '#6a6672', '#4a4652'], sole: [0.06, 0.05, 0.05] },
    acc: { earrings: '#e0c070' },
  },
  {
    // out for the afternoon by the bay: a round soft face, a snub nose, freckles, a wide laugh, long
    // wavy auburn hair; a light denim jacket over a terracotta flowered midi dress, white sneakers
    key: 'lena', name: 'Lena', age: 24, fem: true,
    build: { height: 0.94, head: 0.98, bulk: 0.96, limbs: 1.0 },
    body: { belly: 0, chest: 0.15, thick: 0.04 },
    shape: { width: 1.05, long: 0.92, forehead: 0.98, crown: 1.0, jaw: 0.97, cheeks: 0.9, cheekbones: -0.02, chin: -0.3, chinW: 1.06, dbl: 0, brow: -0.6, noseLen: 0.88, noseW: 0.95, noseOut: 0.86, lips: 0.4, gap: 1.0, neck: 0.98 },
    expr: 'laugh',
    head: { jaw: 0.0, chin: 0.85, nose: 0.8, lips: 1.05, brow: 0.6 },
    skin: 'fair', eyes: { iris: 'green', open: 1.1, lid: 0.25, lashes: 0.8, liner: 0.15, shadow: '#b48a7a' },
    brows: { col: ['#7a3a20', '#8a4628', '#6a321a'], thick: 0.72, arch: 0.55 },
    mouth: { w: 0.98, full: 1.05, lip: ['#c8766a', '#d4847a'], lipstick: null },
    beard: null, lines: 0.0, freckles: 1.0, blush: 0.55,
    hair: { style: 'long', base: '#8a3a1c', dark: ['#4a1a0a', '#5a2210', '#3e160a'], mid: ['#9a4422', '#a84e28', '#8c3c1c'], light: ['#d07a44', '#de8a50', '#e89a60'], grey: 0, wave: 1 },
    top: { kind: 'denim', fabric: 'denim', base: '#8eaccc', dark: ['#5a7aa0', '#6888ac', '#4e6c94'], mid: ['#86a4c6', '#7e9cc0'], light: ['#c4d6ea', '#d2e0f0', '#b8cce4'], stitch: '#d8964a', buttons: '#a8743a' },
    inner: { kind: 'dress', base: '#c4583a', dark: ['#8e3420', '#9a3c26', '#7e2e1c'], light: ['#e48a66', '#ec9a74'], flower: ['#f4e6c8', '#f8d880', '#fff4dc'] },
    bottom: { kind: 'dress', base: '#c4583a', dark: ['#8e3420', '#9a3c26', '#7e2e1c'], mid: ['#b84e32', '#c0563a'], light: ['#e48a66', '#ec9a74'], flower: ['#f4e6c8', '#f8d880', '#fff4dc'] },
    belt: null,
    shoes: { kind: 'sneaker', base: '#f4f2ec', dark: ['#ccc8c0', '#c0bcb4', '#d6d2ca'], light: ['#ffffff'], accent: '#c4583a', lace: '#fbfaf6', sole: [0.96, 0.94, 0.9] },
    acc: { earrings: '#e8e4dc' },
  },
];

// a hex colour as linear-ish 0..1 rgb (for the game's own looks: game/looks.js folkLook)
export function hexRGB(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
