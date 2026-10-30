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
 * besides (acc).
 */
export const FOLK = [
  {
    // an executive on his way to a lunch meeting: navy suit, open collar, brown oxfords
    key: 'marco', name: 'Marco', age: 46, fem: false,
    build: { height: 1.02, head: 1.0, bulk: 1.02, limbs: 1.0 },
    head: { jaw: 1.0, chin: 1.0, nose: 1.05, lips: 0.95, brow: 1.0 },
    skin: 'olive', eyes: { iris: 'brown', open: 1.0, lid: 0.55, lashes: 0.2, liner: 0 },
    brows: { col: ['#2a1e16', '#3a2a1e', '#1e1610'], thick: 0.9, arch: 0.3 },
    mouth: { w: 1.0, full: 0.95, lip: ['#9a5e4e', '#a86a58'], lipstick: null },
    beard: 'shadow', beardCol: ['#2a1e18', '#3a2a22', '#1e1612'], lines: 0.55, freckles: 0, blush: 0,
    hair: { style: 'side', base: '#3a2a20', dark: ['#1e140e', '#2a1c14', '#24180f'], mid: ['#4e3826', '#5a4230', '#463020'], light: ['#8a6a50', '#9a7a5a', '#7a5a40'], grey: 0.25, greyAt: 'temples' },
    top: { kind: 'blazer', fabric: 'wool', base: '#1e2a44', dark: ['#101828', '#141e32', '#0c1220'], mid: ['#2a3858', '#24304e', '#30406a'], light: ['#4a5a80', '#56688e', '#5e6e96'], stripe: '#3a4a70', buttons: '#2a2420' },
    inner: { kind: 'shirt', base: '#eef0f2', dark: ['#c4c8d0', '#b8bec8', '#cdd2da'], light: ['#ffffff', '#f8faff'], collar: true, open: 2 },
    bottom: { kind: 'trousers', base: '#1c2640', dark: ['#0e1626', '#121a30', '#0a1020'], mid: ['#283450', '#222c48'], light: ['#44547a', '#4e5e86'], crease: true },
    belt: { col: '#4a2c1a', buckle: '#c8c0b0' },
    shoes: { kind: 'oxford', base: '#5a3420', dark: ['#2e180c', '#3a2010', '#24120a'], light: ['#a06a44', '#b47a50', '#c88c5e'], lace: '#3a2418', sole: [0.2, 0.13, 0.09] },
    acc: { watch: '#c8c4bc' },
  },
  {
    // a young designer from the arts district: olive bomber, white tee, black jeans, white sneakers
    key: 'dre', name: 'Dre', age: 26, fem: false,
    build: { height: 1.04, head: 1.0, bulk: 0.98, limbs: 1.03 },
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
    // a silver-haired gentleman of the bay: cream linen jacket, sky-blue shirt, sand chinos, loafers
    key: 'sal', name: 'Salvatore', age: 63, fem: false,
    build: { height: 0.99, head: 1.0, bulk: 1.04, limbs: 0.98 },
    head: { jaw: 1.02, chin: 0.95, nose: 1.15, lips: 0.85, brow: 1.1 },
    skin: 'tan', eyes: { iris: 'grey', open: 0.92, lid: 0.7, lashes: 0.15, liner: 0 },
    brows: { col: ['#9a9690', '#b4b0aa', '#7a7670'], thick: 1.15, arch: 0.25 },
    mouth: { w: 1.0, full: 0.85, lip: ['#a0645a', '#ac7064'], lipstick: null },
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
    // a fashion buyer between two shows: camel blazer over a black silk blouse, wide black trousers
    key: 'valeria', name: 'Valeria', age: 33, fem: true,
    build: { height: 0.98, head: 0.97, bulk: 0.9, limbs: 0.98 },
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
    // out for the afternoon by the bay: a light denim jacket over a terracotta flowered midi dress
    key: 'lena', name: 'Lena', age: 24, fem: true,
    build: { height: 0.96, head: 0.97, bulk: 0.88, limbs: 0.98 },
    head: { jaw: 0.0, chin: 0.85, nose: 0.8, lips: 1.05, brow: 0.6 },
    skin: 'fair', eyes: { iris: 'green', open: 1.1, lid: 0.25, lashes: 0.8, liner: 0.15, shadow: '#b48a7a' },
    brows: { col: ['#7a3a20', '#8a4628', '#6a321a'], thick: 0.72, arch: 0.55 },
    mouth: { w: 0.92, full: 1.05, lip: ['#c8766a', '#d4847a'], lipstick: null },
    beard: null, lines: 0.0, freckles: 1.0, blush: 0.5,
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
