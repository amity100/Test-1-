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
  // (ROADMAP 14.9)
  blue: ['#2a4a7a', '#3e6aa4', '#6a94c4', '#30507e', '#8ab0d8'],
  amber: ['#5a3a0c', '#9a6a1c', '#b8862a', '#6a4810', '#c89a40'],
};

/**
 * Each of them: who (key, name, age), the body (fem: a woman's - render/folkshapes.js; build: as a
 * look's), the face (head: its shape - jaw, chin, nose, lips, brow; skin; eyes, brows, nose,
 * mouth; beard; lines of age; freckles, makeup), the hair (style, its colours, grey), what they wear:
 * top (over the rest: a jacket worn open), inner (seen in its opening), bottom, shoes, a few things
 * besides (acc). And what makes each of them their own beyond their colours: their face (morph: a real
 * head moved by MakeHuman's targets - render/folkshapes.js headOf; shape: how its drawing is shaded -
 * full or hollow cheeks, the jaw, a double chin - and the neck), their body (body: a belly, a chest,
 * how thick their limbs), how they look (expr: 'neutral', 'soft', 'half', 'smile'), glasses.
 */
export const FOLK = [
  {
    // the owner of a trattoria by the bay: heavy, a round full face, a grey moustache, gold glasses,
    // a warm smile; a tobacco wool blazer over a cream shirt, grey trousers, brown loafers
    key: 'bruno', name: 'Bruno', age: 58, fem: false,
    build: { height: 0.95, head: 1.05, bulk: 1.24, limbs: 1.08 },
    body: { belly: 1.0, chest: 0.25, thick: 0.16 },
    // (a real head, moved by MakeHuman's targets: render/folkshapes.js headOf)
    morph: { 'head-round': 0.6, 'head-fat-incr': 0.7, 'head-age-incr': 0.6, 'head-scale-horiz-incr': 0.15, 'neck-double-incr': 0.55, 'chin-width-incr': 0.35, 'chin-prominent-decr': 0.2, 'chin-bones-incr': 0.3, 'cheek-volume-incr': 0.5, 'cheek-bones-decr': 0.5, 'nose-scale-horiz-incr': 0.55, 'nose-volume-incr': 0.6, 'nose-point-width-incr': 0.6, 'nose-nostrils-width-incr': 0.5, 'mouth-scale-horiz-incr': 0.3, 'mouth-angles-up': 0.6, 'eye-bag-incr': 0.6, 'eye-scale-decr': 0.2, 'ear-scale-incr': 0.3, 'ear-lobe-incr': 0.4, 'eyebrows-trans-down': 0.3 },
    shape: { cheeks: 0.85, jaw: 1.08, dbl: 0.7, neck: 1.12 },
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
    morph: { 'head-oval': 0.6, 'head-scale-vert-incr': 0.2, 'head-scale-horiz-decr': 0.1, 'chin-prominent-incr': 0.4, 'chin-height-incr': 0.3, 'chin-bones-incr': 0.2, 'nose-scale-horiz-incr': 0.7, 'nose-nostrils-width-incr': 0.8, 'nose-flaring-incr': 0.5, 'nose-point-width-incr': 0.4, 'nose-scale-depth-decr': 0.2, 'mouth-upperlip-volume-incr': 0.7, 'mouth-lowerlip-volume-incr': 0.8, 'mouth-scale-horiz-incr': 0.3, 'mouth-angles-up': 0.25, 'eyebrows-trans-forward': 0.3, 'cheek-bones-decr': 0.2 },
    shape: { cheeks: -0.3, jaw: 0.98, dbl: 0, neck: 0.96 },
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
    morph: { 'head-rectangular': 0.4, 'head-scale-vert-incr': 0.22, 'head-scale-horiz-decr': 0.12, 'head-age-incr': 1.0, 'head-fat-decr': 0.6, 'cheek-volume-decr': 0.8, 'cheek-inner-decr': 0.5, 'cheek-bones-decr': 0.3, 'nose-hump-incr': 0.9, 'nose-scale-vert-incr': 0.6, 'nose-scale-depth-incr': 0.5, 'nose-point-down': 0.5, 'nose-curve-convex': 0.6, 'mouth-upperlip-volume-decr': 0.6, 'mouth-lowerlip-volume-decr': 0.4, 'mouth-angles-down': 0.25, 'eyebrows-trans-forward': 0.6, 'eye-bag-incr': 0.8, 'chin-prominent-incr': 0.3, 'chin-cleft-incr': 0.5, 'ear-scale-incr': 0.4, 'ear-lobe-incr': 0.6 },
    shape: { cheeks: -0.8, jaw: 0.94, dbl: 0, neck: 0.92 },
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
    morph: { 'head-round': 0.5, 'head-scale-horiz-incr': 0.25, 'head-scale-vert-decr': 0.2, 'nose-scale-depth-decr': 0.6, 'nose-scale-vert-decr': 0.3, 'nose-volume-decr': 0.3, 'nose-nostrils-width-incr': 0.3, 'nose-curve-concave': 0.4, 'eye-eyefold-down': 0.6, 'eye-epicanthus-in': 0.6, 'eye-scale-decr': 0.1, 'eyebrows-trans-backward': 0.4, 'chin-prominent-decr': 0.3, 'chin-width-decr': 0.2, 'mouth-angles-up': 0.35, 'cheek-volume-incr': 0.3, 'cheek-bones-decr': 0.3 },
    shape: { cheeks: 0.3, jaw: 0.97, dbl: 0, neck: 0.96 },
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
    morph: { 'head-invertedtriangular': 0.8, 'head-fat-decr': 0.3, 'chin-width-decr': 0.7, 'chin-prominent-incr': 0.2, 'chin-bones-decr': 0.5, 'cheek-bones-decr': 0.3, 'nose-scale-horiz-decr': 0.5, 'nose-point-width-decr': 0.5, 'nose-scale-vert-decr': 0.2, 'nose-volume-decr': 0.4, 'mouth-upperlip-volume-incr': 0.6, 'mouth-lowerlip-volume-incr': 0.7, 'mouth-cupidsbow-incr': 0.6, 'eye-scale-incr': 0.3, 'eyebrows-trans-up': 0.2 },
    shape: { cheeks: -0.2, jaw: 0.84, dbl: 0, neck: 0.94 },
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
    morph: { 'head-round': 0.8, 'head-scale-vert-decr': 0.2, 'head-fat-incr': 0.3, 'cheek-volume-incr': 0.6, 'cheek-bones-decr': 0.3, 'nose-point-up': 0.6, 'nose-scale-vert-decr': 0.4, 'nose-scale-horiz-decr': 0.2, 'nose-curve-concave': 0.6, 'chin-prominent-decr': 0.3, 'chin-width-incr': 0.2, 'mouth-angles-up': 0.8, 'mouth-scale-horiz-incr': 0.25, 'mouth-lowerlip-volume-incr': 0.3, 'eye-scale-incr': 0.25 },
    shape: { cheeks: 0.9, jaw: 0.97, dbl: 0, neck: 0.98 },
    expr: 'smile',
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

// ------------------------------------------------------------------ everybody else (ROADMAP 13.7)
// The rest of the city's people, made from the same things by a rule: each their own face (a real
// head moved their own way: render/folkshapes.js headOf), colouring, hair and clothes - the same
// people on every computer and in the drawing helper (render/heroworker.js).
const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('');
// (a colour darker or lighter by k; towards white by t)
const shade = (h, k) => hex(hexRGB(h).map((v) => v * k));
const pale = (h, t) => hex(hexRGB(h).map((v) => v + (1 - v) * t));
const cloth = (base) => ({ base, dark: [shade(base, 0.62), shade(base, 0.7), shade(base, 0.55)], mid: [shade(base, 1.07), shade(base, 0.95)], light: [pale(base, 0.32), pale(base, 0.4), pale(base, 0.26)] });
const HAIRS = {
  black: '#120c0a', espresso: '#2a1a12', brown: '#5a3a24', chestnut: '#7a4a2a', auburn: '#8a3a1c', copper: '#a4542a',
  honey: '#b4844a', blonde: '#cca868', ash: '#8a7a62', grey: '#8a8682', silver: '#b8b6b2', white: '#dcdad6',
  // (ROADMAP 14.9: dyed)
  platinum: '#e2d8bc', ginger: '#c0602a', cherry: '#a8222a', pink: '#d06a98', violet: '#6a4a9a', teal: '#2a7a80', blue: '#2e4a8e',
};
const DYED = new Set(['platinum', 'cherry', 'pink', 'violet', 'teal', 'blue']);
const hairOf = (name, style, o = {}) => {
  const b = HAIRS[name];
  const grey = name === 'grey' || name === 'silver' || name === 'white' ? 1 : 0;
  return { style, base: b, dark: [shade(b, 0.45), shade(b, 0.55), shade(b, 0.4)], mid: [shade(b, 1.15), shade(b, 1.25), shade(b, 1.08)], light: [pale(b, 0.35), pale(b, 0.42), pale(b, 0.28)], grey, ...o };
};
const browsOf = (hairName, thick, arch) => {
  // (dyed hair: the brows as they grew)
  const b = HAIRS[DYED.has(hairName) ? 'brown' : hairName === 'white' || hairName === 'silver' ? 'grey' : hairName === 'blonde' || hairName === 'honey' || hairName === 'platinum' ? 'ash' : hairName === 'ginger' ? 'copper' : hairName];
  return { col: [shade(b, 0.8), shade(b, 1.0), shade(b, 0.65)], thick, arch };
};
// what they wear, by how they dress: top (a jacket worn open), inner, bottom, shoes
const TOPS = {
  smart: [['blazer', 'wool', ['#3a3e4a', '#5a4a3a', '#2e3a32', '#6a5a4a', '#4a3a3e', '#7a6a58']], ['blazer', 'linen', ['#e6dcc8', '#c8b898', '#a8b4c0', '#d8c8b0']]],
  chic: [['blazer', 'crepe', ['#c4925c', '#1e1e24', '#e8e0d0', '#9aa88a', '#c86a5a', '#7a8aa8', '#d8b8a8']]],
  street: [['bomber', 'nylon', ['#4a5232', '#1e2228', '#6a2a30', '#2a3a5a', '#8a7a5a', '#3a4a4a', '#b8a888']]],
  denim: [['denim', 'denim', ['#8eaccc', '#5a7aa0', '#3e5878', '#a8bcd0']]],
};
const INNERS = {
  shirt: ['#f2ecdc', '#a8c8e6', '#ffffff', '#d8e0e8', '#e8d8d0', '#c8d8c0'],
  tee: ['#f2f0ea', '#1a1a1e', '#8a8a90', '#c8b8a0', '#a83a3a', '#3a5a8a', '#e8c860'],
  blouse: ['#16141a', '#f4eee4', '#c8a8b8', '#6a2a3a', '#2a4a5a'],
  dress: ['#c4583a', '#2a4a6a', '#5a6a3a', '#8a2a4a', '#e8b860'],
};
const BOTTOMS = {
  trousers: ['#4a4a50', '#2a2a30', '#5a4a3a', '#3a3e4a', '#6a6a70'],
  chinos: ['#cbb48e', '#8a7a5a', '#3a4a3a', '#5a5048', '#e0d8c4'],
  jeans: ['#1a1a1e', '#2a3a5a', '#4a6a8a', '#5a7898'],
  wide: ['#e4dcc8', '#141418', '#8a6a4a', '#5a5a62', '#c8b8a0'],
};
const SHOES = {
  loafer: ['#6a3c22', '#2a1a12', '#8a5e3a'],
  oxford: ['#1a1412', '#4a2a1a'],
  sneaker: ['#f2f2ee', '#1a1a1e', '#e8e4dc', '#c8c8cc'],
  bootie: ['#141214', '#6a4a32', '#8a7a6a'],
};
const MEN = ['Marco', 'Theo', 'Jonah', 'Ravi', 'Omar', 'Felix', 'Kenji', 'Luca', 'Andre', 'Samuel', 'Viktor', 'Diego', 'Hugo', 'Malik', 'Ezra', 'Tomas', 'Bodhi', 'Caspar', 'Dante', 'Elio', 'Gustav', 'Idris', 'Jasper', 'Kofi', 'Lev', 'Milo', 'Nikos', 'Otto', 'Pablo', 'Rafi', 'Silas', 'Wendell'];
const WOMEN = ['Nora', 'Priya', 'Sofia', 'Amara', 'Ines', 'Hana', 'Clara', 'Zoe', 'Leila', 'Mira', 'Esther', 'Rosa', 'Yuki', 'Talia', 'Greta', 'Noor', 'Agnes', 'Beatriz', 'Cleo', 'Dalia', 'Edie', 'Frida', 'Gemma', 'Ilse', 'Juno', 'Kaia', 'Lotte', 'Maud', 'Odette', 'Pia', 'Rhea', 'Sunny'];
function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// (characters round 2) What makes a face a person's own is not a little here and a little there - a
// dozen of the head's targets each a third of the way, a face 2 mm from the next on average (2.2 mm
// from the base head: every one of them the same sculpted face) - but a few things about it that are
// strongly so: a long face or a short one, broad or narrow, a square jaw or a soft one, the chin out
// or back, a big nose or a small one, broad or fine, hooked or snub, a heavy brow, small eyes or
// large, slanting up or down, full lips or thin, a wide mouth, full cheeks or hollow, a high forehead,
// big ears. Sixteen such dimensions, each between its two ends (a set of the head's targets at each,
// as far as a real face goes); each person a place among them - five to seven of them strongly, the
// rest a little - and of a few dozen places tried, the one furthest from everybody made before, so
// that no two of the city's people share a face.
const DIMS = [
  // [its two ends: the head's targets at full, and how much it shows in a face (the eye is drawn to the
  // nose, the eyes and the mouth before the back of the skull)]
  [{ 'chin-height-incr': 0.7, 'forehead-scale-vert-incr': 0.3, 'head-oval': 0.6, 'head-scale-vert-incr': 0.3 }, { 'chin-height-decr': 0.8, 'head-round': 0.65, 'forehead-scale-vert-decr': 0.4, 'head-scale-vert-decr': 0.3 }, 1.2],
  [{ 'head-square': 0.6, 'chin-width-incr': 0.8, 'cheek-bones-incr': 0.4, 'head-scale-horiz-incr': 0.35 }, { 'head-invertedtriangular': 0.75, 'chin-width-decr': 0.8, 'head-scale-horiz-decr': 0.35 }, 1.1],
  [{ 'chin-bones-incr': 0.9, 'head-rectangular': 0.45 }, { 'chin-bones-decr': 0.9, 'head-diamond': 0.45 }, 0.9],
  [{ 'chin-prominent-incr': 0.8, 'chin-prognathism-incr': 0.35 }, { 'chin-prominent-decr': 0.8, 'chin-prognathism-decr': 0.4 }, 0.9],
  [{ 'nose-scale-vert-incr': 0.7, 'nose-scale-depth-incr': 0.6, 'nose-volume-incr': 0.5 }, { 'nose-scale-vert-decr': 0.6, 'nose-scale-depth-decr': 0.6, 'nose-volume-decr': 0.5 }, 1.3],
  [{ 'nose-scale-horiz-incr': 0.8, 'nose-nostrils-width-incr': 0.8, 'nose-flaring-incr': 0.5 }, { 'nose-scale-horiz-decr': 0.8, 'nose-nostrils-width-decr': 0.6, 'nose-point-width-decr': 0.6 }, 1.2],
  [{ 'nose-hump-incr': 0.8, 'nose-curve-convex': 0.7, 'nose-point-down': 0.5 }, { 'nose-curve-concave': 0.8, 'nose-point-up': 0.8 }, 1.2],
  [{ 'eyebrows-trans-forward': 0.8, 'forehead-trans-forward': 0.4, 'eyebrows-trans-down': 0.5 }, { 'eyebrows-trans-backward': 0.7, 'forehead-trans-backward': 0.6, 'eyebrows-trans-up': 0.5 }, 1.0],
  [{ 'eye-scale-incr': 0.6 }, { 'eye-scale-decr': 0.4, 'eye-bag-incr': 0.5 }, 1.1],
  [{ 'eye-corner1-up': 0.9, 'eyebrows-angle-up': 0.6 }, { 'eye-corner1-down': 0.9, 'eyebrows-angle-down': 0.6 }, 1.1],
  [{ 'mouth-upperlip-volume-incr': 0.9, 'mouth-lowerlip-volume-incr': 1.0, 'mouth-cupidsbow-incr': 0.6 }, { 'mouth-upperlip-volume-decr': 0.9, 'mouth-lowerlip-volume-decr': 0.8, 'mouth-cupidsbow-decr': 0.5 }, 1.1],
  [{ 'mouth-scale-horiz-incr': 0.8 }, { 'mouth-scale-horiz-decr': 0.7 }, 1.0],
  [{ 'cheek-volume-incr': 0.8, 'cheek-inner-incr': 0.5 }, { 'cheek-volume-decr': 0.8, 'cheek-inner-decr': 0.7, 'cheek-bones-incr': 0.5 }, 0.9],
  [{ 'forehead-scale-vert-incr': 0.5, 'forehead-trans-backward': 0.4 }, { 'forehead-scale-vert-decr': 0.7 }, 0.7],
  [{ 'ear-scale-incr': 0.8, 'ear-lobe-incr': 0.6 }, { 'ear-scale-decr': 0.7, 'ear-lobe-decr': 0.5 }, 0.5],
  [{ 'head-back-scale-depth-incr': 0.6 }, { 'head-back-scale-depth-decr': 0.6 }, 0.4],
];
// (each dimension's name, for the rest of the face to follow it: the drawn nose as broad as the
// shaped one, the lips as full, the eyes as open)
const D = { long: 0, wide: 1, jaw: 2, chin: 3, nose: 4, noseW: 5, hook: 6, brow: 7, eyes: 8, tilt: 9, lips: 10, mouth: 11, cheeks: 12, forehead: 13, ears: 14, skull: 15 };
// (the places already given: of those made by the rule, in order - the first of them the phone's too)
const PLACES = [];
// a place among the dimensions: five to seven of them strongly (two thirds of the way to all the way),
// the rest a little either way
function placeOf(R) {
  const v = DIMS.map(() => (R() * 2 - 1) * 0.3);
  const n = 5 + Math.floor(R() * 3);
  for (let k = 0; k < n; k++) {
    const d = Math.floor(R() * DIMS.length);
    v[d] = (R() < 0.5 ? -1 : 1) * (0.65 + R() * 0.35);
  }
  return v;
}
const apart = (a, b) => {
  let s = 0;
  for (let d = 0; d < DIMS.length; d++) s += ((a[d] - b[d]) * DIMS[d][2]) ** 2;
  return Math.sqrt(s);
};
// the place furthest from all the others, of 32 tried
function farPlace(R) {
  let best = null;
  let bd = -1;
  for (let t = 0; t < 32; t++) {
    const v = placeOf(R);
    let d = Infinity;
    for (const q of PLACES) d = Math.min(d, apart(v, q));
    if (d > bd) {
      bd = d;
      best = v;
    }
  }
  PLACES.push(best);
  return best;
}
// a place as the head's targets: each end's set, as far as the place goes towards it; a target named
// twice its larger; a pair (incr and decr) netted to the one that wins
function morphOf(v) {
  const m = {};
  for (let d = 0; d < DIMS.length; d++) {
    const end = v[d] >= 0 ? DIMS[d][0] : DIMS[d][1];
    const k = Math.abs(v[d]);
    for (const [name, w] of Object.entries(end)) m[name] = Math.max(m[name] || 0, +(w * k).toFixed(2));
  }
  for (const [a, b] of [['incr', 'decr'], ['up', 'down'], ['forward', 'backward'], ['convex', 'concave']]) {
    for (const name of Object.keys(m)) {
      if (!name.endsWith('-' + a)) continue;
      const other = name.slice(0, -a.length) + b;
      if (!(other in m)) continue;
      const net = m[name] - m[other];
      delete m[name];
      delete m[other];
      if (net > 0.02) m[name] = +net.toFixed(2);
      else if (net < -0.02) m[other] = +(-net).toFixed(2);
    }
  }
  for (const name of Object.keys(m)) if (m[name] < 0.04) delete m[name];
  return m;
}

// (ROADMAP 14.9) the ones after the first 32: further apart - younger and older, thinner and heavier,
// taller and shorter, more of the face moved and further each way (still a real face), dyed hair,
// a goatee or a full beard, blue or amber eyes, square frames - each of them nobody else
function made(i) {
  const R = rngOf(7919 * (i + 11));
  const pick = (a) => a[Math.floor(R() * a.length)];
  const range = (a, b) => a + (b - a) * R();
  const wild = i >= 32;
  const fem = i % 2 === 1;
  const age = wild ? Math.round(17 + 68 * R() ** 1.25) : Math.round(19 + 54 * R() ** 1.7);
  const old = age > 52;
  const skin = pick(wild ? ['fair', 'fair', 'light', 'golden', 'golden', 'olive', 'tan', 'tan', 'deep', 'deep'] : ['fair', 'light', 'light', 'golden', 'olive', 'olive', 'tan', 'deep', 'deep']);
  const heavy = R() < (wild ? 0.3 : 0.25);
  const thin = !heavy && wild && R() < 0.3;
  const bulk = heavy ? range(1.08, wild ? 1.34 : 1.26) : thin ? range(0.76, 0.86) : range(0.84, 1.02);
  // the face: its place among the dimensions (DIMS), as far from everybody's as it can be - a woman's
  // jaw and nose a little finer, a heavy face fuller, a thin one hollow (the place itself, so the
  // targets never pull against each other)
  const place = farPlace(R);
  const lean = (d, by) => (place[d] = Math.max(-1, Math.min(1, place[d] + by)));
  if (fem) {
    lean(D.wide, -0.3);
    lean(D.jaw, -0.35);
    lean(D.noseW, -0.25);
    lean(D.brow, -0.3);
  }
  if (heavy) lean(D.cheeks, 0.6);
  if (thin) lean(D.cheeks, -0.6);
  const morph = morphOf(place);
  // (eyes a touch larger than life read as eyes in a drawing - never beads)
  if (!morph['eye-scale-decr']) morph['eye-scale-incr'] = Math.max(morph['eye-scale-incr'] || 0, +range(0.12, 0.3).toFixed(2));
  if (old) morph['head-age-incr'] = +range(0.4, 1.0).toFixed(2);
  else if (age < 28) morph['head-age-decr'] = +range(0.1, wild && age < 22 ? 0.6 : 0.35).toFixed(2);
  if (thin) Object.assign(morph, { 'head-fat-decr': +range(0.4, 0.8).toFixed(2) });
  if (heavy) Object.assign(morph, { 'head-fat-incr': +range(0.4, 0.9).toFixed(2), 'neck-double-incr': +range(0.2, 0.8).toFixed(2) });
  else if (!thin && R() < 0.4) morph['head-fat-decr'] = +range(0.2, 0.5).toFixed(2);
  if (skin === 'golden' && R() < 0.6) Object.assign(morph, { 'eye-eyefold-down': 0.55, 'eye-epicanthus-in': 0.5 });
  // the hair
  const dyed = wild && R() < (age < 40 ? 0.28 : 0.1);
  const hairName = dyed ? pick(['platinum', 'cherry', 'pink', 'violet', 'teal', 'blue', 'platinum']) : old && R() < 0.75 ? pick(['grey', 'silver', 'white', 'ash', 'grey']) : skin === 'deep' || skin === 'tan' || skin === 'golden' ? pick(['black', 'black', 'espresso', 'brown']) : pick(wild ? ['black', 'espresso', 'brown', 'chestnut', 'auburn', 'copper', 'honey', 'blonde', 'ash', 'ginger', 'ginger'] : ['black', 'espresso', 'brown', 'chestnut', 'auburn', 'copper', 'honey', 'blonde', 'ash']);
  const style = wild
    ? fem ? pick(['long', 'long', 'bun', 'curls', 'curls', 'side', 'buzz', 'back']) : pick(skin === 'deep' ? ['curls', 'curls', 'buzz', 'side', 'long', 'bun'] : ['side', 'back', 'buzz', 'buzz', 'curls', 'long', 'bun'])
    : fem ? pick(['long', 'long', 'bun', 'long', 'curls']) : pick(skin === 'deep' ? ['curls', 'curls', 'buzz', 'side'] : ['side', 'side', 'back', 'buzz', 'curls']);
  const hair = hairOf(hairName, style, style === 'long' ? { len: +range(wild && !fem ? 0.08 : 0.12, wild ? 0.36 : 0.3).toFixed(2), wave: R() < 0.4 ? 1 : 0 } : {});
  // what they wear
  const how = pick(fem ? ['chic', 'chic', 'smart', 'street', 'denim'] : ['smart', 'smart', 'street', 'street', 'denim']);
  const [kind, fabric, cols] = pick(TOPS[how]);
  const top = { kind, fabric, ...cloth(pick(cols)), buttons: '#2a2420' };
  if (kind === 'bomber') Object.assign(top, { rib: shade(top.base, 0.6), lining: pick(['#e0702a', '#c8a050', '#2a2a2a']) });
  if (kind === 'denim') Object.assign(top, { stitch: '#d8964a', buttons: '#a8743a' });
  if (kind === 'blazer' && !fem && R() < 0.4) top.square = pick(['#9a2a34', '#e07a3a', '#f2ecdc']);
  const innerKind = fem ? pick(how === 'denim' ? ['dress', 'tee', 'blouse'] : ['blouse', 'tee', 'shirt']) : how === 'smart' ? pick(['shirt', 'shirt', 'tee']) : pick(['tee', 'tee', 'shirt']);
  const ib = pick(INNERS[innerKind]);
  const inner = { kind: innerKind, base: ib, dark: [shade(ib, 0.82), shade(ib, 0.76), shade(ib, 0.88)], light: [pale(ib, 0.3), pale(ib, 0.4)] };
  if (innerKind === 'shirt') Object.assign(inner, { collar: true, open: 2 });
  if (innerKind === 'dress') inner.flower = ['#f4e6c8', '#f8d880', '#fff4dc'];
  const bk = innerKind === 'dress' ? 'dress' : how === 'street' || how === 'denim' ? pick(['jeans', 'jeans', 'chinos']) : fem ? pick(['wide', 'wide', 'trousers']) : pick(['trousers', 'chinos']);
  const bottom = bk === 'dress' ? { kind: 'dress', ...cloth(ib), flower: inner.flower } : { kind: bk, ...cloth(pick(BOTTOMS[bk])) };
  if (bk === 'trousers') bottom.crease = true;
  if (bk === 'jeans') bottom.stitch = '#6a6a70';
  if (bk === 'chinos') bottom.cuff = true;
  const sk = how === 'street' || how === 'denim' ? 'sneaker' : fem ? pick(['bootie', 'bootie', 'loafer']) : pick(['loafer', 'oxford']);
  const sb = pick(SHOES[sk]);
  const shoes = { kind: sk, base: sb, dark: [shade(sb, 0.6), shade(sb, 0.7), shade(sb, 0.5)], light: [pale(sb, 0.3), pale(sb, 0.4), pale(sb, 0.22)], sole: sk === 'sneaker' ? [0.95, 0.94, 0.9] : [0.12, 0.09, 0.07] };
  if (sk === 'sneaker') Object.assign(shoes, { accent: top.base, lace: '#f8f8f4' });
  const beard = fem ? null : wild ? pick([null, null, 'short', 'trim', 'mustache', 'shadow', 'goatee', 'goatee', 'full', 'full']) : pick([null, null, null, 'short', 'trim', 'mustache', 'shadow']);
  const lipstick = fem && R() < 0.3;
  const expr = pick(['neutral', 'neutral', 'soft', 'soft', 'half', 'smile']);
  return {
    key: `p${i}`, name: (fem ? WOMEN : MEN)[(i >> 1) % 32], age, fem, how,
    build: wild
      ? { height: +range(fem ? 0.86 : 0.9, fem ? 1.05 : 1.13).toFixed(2), head: +range(0.92, 1.08).toFixed(2), bulk: +bulk.toFixed(2), limbs: +range(0.92, 1.08).toFixed(2) }
      : { height: +range(fem ? 0.92 : 0.96, fem ? 1.02 : 1.08).toFixed(2), head: +range(0.95, 1.04).toFixed(2), bulk: +bulk.toFixed(2), limbs: +range(0.95, 1.05).toFixed(2) },
    body: heavy ? { belly: +range(0.5, 1.0).toFixed(2), chest: +range(0.1, 0.3).toFixed(2), thick: +range(0.06, 0.16).toFixed(2) } : { belly: +range(-0.3, 0.2).toFixed(2), chest: +range(0, 0.2).toFixed(2), thick: +range(-0.06, 0.04).toFixed(2) },
    morph,
    shape: { cheeks: heavy ? range(0.6, 1.0) : Math.max(-0.8, Math.min(0.8, place[D.cheeks] * 0.8)), jaw: (fem ? 0.91 : 1.04) + place[D.jaw] * 0.08, dbl: heavy ? range(0.4, 1.0) : 0, neck: heavy ? range(1.1, 1.22) : range(0.92, 1.02) },
    expr,
    // (what is drawn on the face as its shape is: the nose as broad, the lips as full, the brow as heavy)
    head: { jaw: fem ? 0 : 1.02 + place[D.jaw] * 0.1, chin: 0.92 + place[D.chin] * 0.08, nose: 1.02 + place[D.noseW] * 0.24, lips: 1 + place[D.lips] * 0.22, brow: fem ? 0.6 + place[D.brow] * 0.12 : 1.02 + place[D.brow] * 0.1 },
    skin,
    eyes: {
      iris: skin === 'fair' || skin === 'light' ? pick(wild ? ['brown', 'hazel', 'green', 'grey', 'blue', 'blue', 'amber'] : ['brown', 'hazel', 'green', 'grey', 'brown']) : pick(wild ? ['brown', 'dark', 'dark', 'hazel', 'amber'] : ['brown', 'dark', 'dark']),
      open: Math.max(0.7, Math.min(1.2, range(0.9, 1.04) + place[D.eyes] * 0.14)), lid: range(0.2, 0.75), lashes: fem ? range(0.5, 1.0) : range(0.1, 0.35), liner: fem ? range(0.1, 0.8) : 0,
      ...(fem ? { shadow: pick(['#a07a6a', '#8a6a5a', '#b48a7a']) } : {}), ...(morph['eye-eyefold-down'] ? { mono: true } : {}),
    },
    // (brows of every kind: fine or bushy, straight or arched - an arch up where the eyes slant up)
    brows: browsOf(hairName, fem ? range(0.55, 1.0) : range(0.8, 1.75), Math.max(0, Math.min(0.9, (fem ? range(0.25, 0.7) : range(0.05, 0.4)) + place[D.tilt] * 0.2))),
    mouth: { w: 1 + place[D.mouth] * 0.07, full: Math.max(0.7, Math.min(1.3, 1 + place[D.lips] * 0.25)), lip: lipstick ? [pick(['#a8262e', '#b8485a', '#9a3a3a']), '#c8505a'] : [shade(SKINS[skin].warm[0], 0.85), SKINS[skin].warm[1]], lipstick: lipstick || null },
    beard, ...(beard ? { beardCol: [shade(hair.base, 0.8), hair.base, shade(hair.base, 0.6), shade(hair.base, 0.45)] } : {}),
    lines: old ? range(0.6, 1.0) : age > 35 ? range(0.15, 0.4) : 0, freckles: (skin === 'fair' || skin === 'light') && (hairName === 'ginger' || R() < (wild ? 0.4 : 0.25)) ? range(0.5, 1) : 0, blush: fem ? range(0.25, 0.55) : range(0, 0.3),
    hair,
    ...(R() < (wild ? 0.32 : 0.2) ? { glasses: { col: pick(wild ? [[0.78, 0.62, 0.3], [0.08, 0.07, 0.07], [0.35, 0.22, 0.14], [0.62, 0.1, 0.12], [0.14, 0.24, 0.52], [0.8, 0.8, 0.82]] : [[0.78, 0.62, 0.3], [0.08, 0.07, 0.07], [0.35, 0.22, 0.14]]), shape: wild && R() < 0.5 ? 'square' : 'round' } } : {}),
    top, inner, bottom,
    belt: bk === 'dress' || bk === 'wide' ? null : { col: '#2a1e16', buckle: '#c8b080' },
    shoes,
    acc: { ...(R() < 0.4 ? { watch: pick(['#c8a860', '#b0b0b8']) } : {}), ...(fem && R() < 0.6 ? { earrings: pick(['#e0c070', '#e8e4dc']) } : {}) },
  };
}
// (characters round 2) the six drawn by hand first: their faces further their own way (a third again,
// never past a real face's), so that they are no nearer each other than the rest are
for (const F of FOLK) for (const name of Object.keys(F.morph || {})) F.morph[name] = +Math.min(0.95, F.morph[name] * 1.35).toFixed(2);
// (ROADMAP 14.9: 72 of them - a phone makes the first 36: render/people.js)
const CIVIL = [];
for (let i = FOLK.length; i < 72; i++) CIVIL.push(made(i));

// ------------------------------------------------------------------ the city's people at work
// (characters round 2) Everybody drawn the one way - not only the passers-by: the police and their
// riot unit, the firefighters, whoever works the shops and the bars, the doormen, the street crews and
// the mob, the bikers, the Erasers, the masked robbers, children, a street painter, a bride and her
// groom, a courier, a busker. Each of them one of the city's people as the rule makes them (their own
// face, as far from everybody's as it can be: farPlace), dressed for what they do; a hat, a badge, a
// mask - what a costume has on top - the rig's own (game/looks.js roleLook). The first of each the
// phone's too.
const ink = (base) => ({ base, dark: [shade(base, 0.62), shade(base, 0.7), shade(base, 0.55)], light: [pale(base, 0.3), pale(base, 0.4)] });
const jacket = (kind, fabric, base, o = {}) => ({ kind, fabric, ...cloth(base), buttons: '#2a2420', ...o });
const under = (kind, base, o = {}) => ({ kind, ...ink(base), ...(kind === 'shirt' ? { collar: true, open: 1 } : {}), ...o });
const legs = (kind, base, o = {}) => ({ kind, ...cloth(base), ...(kind === 'trousers' ? { crease: true } : kind === 'jeans' ? { stitch: '#6a6a70' } : {}), ...o });
const feet = (kind, base) => ({ kind, base, dark: [shade(base, 0.6), shade(base, 0.7), shade(base, 0.5)], light: [pale(base, 0.3), pale(base, 0.4), pale(base, 0.22)], sole: kind === 'sneaker' ? [0.95, 0.94, 0.9] : [0.12, 0.09, 0.07], ...(kind === 'sneaker' ? { lace: '#f8f8f4', accent: base } : {}) });
const BELT = { col: '#141214', buckle: '#c8b080' };
// each: what they do, how many (the first n of them the phone's too), which of them a woman (fem: the
// share), their ages, what they wear (dress), their build, their hair, a beard
const ROLES = [
  { role: 'police', n: 4, phone: 2, fem: 0.5, age: [24, 56], hair: ['side', 'buzz', 'back'], hairF: ['bun'], beard: [null, null, 'short', 'mustache'],
    dress: () => ({ top: jacket('blazer', 'wool', '#1e2a46', { buttons: '#c8a848', square: '#d8b040' }), inner: under('shirt', '#9ab8d8'), bottom: legs('trousers', '#1a2234'), belt: BELT, shoes: feet('oxford', '#141212') }) },
  { role: 'swat', n: 2, phone: 1, fem: 0, age: [26, 46], hair: ['buzz'], beard: [null, 'short'], build: { bulk: 1.12 },
    dress: () => ({ top: jacket('bomber', 'nylon', '#23262e', { rib: '#16181c', lining: '#2a2a2a' }), inner: under('tee', '#2e323a'), bottom: legs('trousers', '#1c1f26'), belt: BELT, shoes: feet('oxford', '#121212') }) },
  { role: 'fire', n: 1, phone: 1, fem: 0, age: [26, 50], hair: ['buzz', 'side'], beard: [null, 'mustache', 'short'],
    dress: () => ({ top: jacket('bomber', 'nylon', '#a8884c', { rib: '#6a5630', lining: '#e0c83a' }), inner: under('tee', '#3a3a3e'), bottom: legs('trousers', '#9a7c46'), belt: BELT, shoes: feet('oxford', '#141212') }) },
  { role: 'staff', n: 6, phone: 3, fem: 0.5, age: [19, 58], hair: ['side', 'back', 'curls', 'buzz'], hairF: ['bun', 'long', 'curls'], beard: [null, null, 'short', 'trim'],
    dress: (j) => [
      { top: jacket('blazer', 'crepe', '#1c1c22'), inner: under('shirt', '#ffffff'), bottom: legs('trousers', '#1c1c22'), belt: BELT, shoes: feet('oxford', '#141212') },
      { top: jacket('bomber', 'nylon', '#2e5a3e', { rib: '#1e3a28', lining: '#c8a050' }), inner: under('tee', '#f2f0ea'), bottom: legs('chinos', '#cbb48e', { cuff: true }), belt: BELT, shoes: feet('sneaker', '#f2f2ee') },
      { top: jacket('blazer', 'linen', '#f2f2ee'), inner: under('shirt', '#a8c8e6'), bottom: legs('trousers', '#5a5a62'), belt: BELT, shoes: feet('loafer', '#2a1a12') },
      { top: jacket('denim', 'denim', '#5a7aa0', { stitch: '#d8964a', buttons: '#a8743a' }), inner: under('tee', '#f2f0ea'), bottom: legs('jeans', '#1a1a1e'), belt: BELT, shoes: feet('sneaker', '#1a1a1e') },
      { top: jacket('blazer', 'linen', '#f4f2ec', { buttons: '#d8d4cc' }), inner: under('tee', '#ffffff'), bottom: legs('trousers', '#2a2a30'), belt: BELT, shoes: feet('sneaker', '#1a1a1e') },
      { top: jacket('blazer', 'wool', '#5a1e28'), inner: under('shirt', '#ffffff'), bottom: legs('trousers', '#1c1c22'), belt: BELT, shoes: feet('oxford', '#141212') },
    ][j % 6] },
  { role: 'bartender', n: 2, phone: 1, fem: 0.5, age: [22, 45], hair: ['back', 'side'], hairF: ['bun', 'long'], beard: [null, 'trim', 'short'],
    dress: () => ({ top: jacket('blazer', 'crepe', '#16141a', { square: '#a8262e' }), inner: under('shirt', '#ffffff'), bottom: legs('trousers', '#16141a'), belt: BELT, shoes: feet('oxford', '#141212') }) },
  { role: 'bouncer', n: 2, phone: 1, fem: 0, age: [26, 50], hair: ['buzz'], beard: [null, 'short', 'goatee'], build: { bulk: 1.3, height: 1.08 },
    dress: () => ({ top: jacket('bomber', 'nylon', '#141418', { rib: '#0e0e10', lining: '#2a2a2a' }), inner: under('tee', '#16161a'), bottom: legs('trousers', '#141418'), belt: BELT, shoes: feet('oxford', '#101010') }) },
  { role: 'gangRed', n: 2, phone: 1, fem: 0, age: [17, 32], hair: ['buzz', 'curls'], beard: [null, 'shadow', 'goatee'],
    dress: (j) => ({ top: jacket('bomber', 'nylon', '#8a1e24', { rib: '#5a1216', lining: '#1a1a1a' }), inner: under('tee', j % 2 ? '#16161a' : '#f2f0ea'), bottom: legs('jeans', '#2a3a5a'), belt: BELT, shoes: feet('sneaker', '#f2f2ee') }) },
  { role: 'gangBlue', n: 2, phone: 1, fem: 0, age: [17, 32], hair: ['buzz', 'side'], beard: [null, 'shadow', 'goatee'],
    dress: (j) => ({ top: jacket('bomber', 'nylon', '#24407a', { rib: '#16284e', lining: '#1a1a1a' }), inner: under('tee', j % 2 ? '#f2f0ea' : '#16161a'), bottom: legs('jeans', '#1a1a1e'), belt: BELT, shoes: feet('sneaker', '#1a1a1e') }) },
  { role: 'mob', n: 2, phone: 1, fem: 0, age: [34, 66], hair: ['back'], beard: [null, 'mustache', 'trim'],
    dress: (j) => ({ top: jacket('blazer', 'wool', j % 2 ? '#3a3a40' : '#1e1e24', { square: '#f2ecdc' }), inner: under('shirt', '#f4f0e6'), bottom: legs('trousers', j % 2 ? '#3a3a40' : '#1e1e24'), belt: BELT, shoes: feet('oxford', '#1a1412') }) },
  { role: 'biker', n: 2, phone: 1, fem: 0, age: [30, 60], hair: ['long', 'buzz', 'back'], beard: ['full', 'full', 'goatee'], build: { bulk: 1.18 },
    dress: (j) => ({ top: jacket('bomber', 'nylon', '#1a1614', { rib: '#100e0c', lining: '#3a2a20' }), inner: under('tee', j % 2 ? '#1e1e22' : '#e8e6e0'), bottom: legs('jeans', '#3e5878'), belt: BELT, shoes: feet('oxford', '#1a1412') }) },
  { role: 'eraser', n: 2, phone: 1, fem: 0.25, age: [17, 30], hair: ['buzz', 'side'], hairF: ['bun', 'curls'], beard: [null],
    dress: (j) => ({ top: jacket('bomber', 'nylon', j % 2 ? '#f4f2ee' : '#f39eb3', { rib: '#4c72d8', lining: '#f39eb3' }), inner: under('tee', '#ffffff'), bottom: legs('jeans', '#4d73d9'), belt: BELT, shoes: feet('sneaker', '#f39eb3') }) },
  { role: 'robber', n: 1, phone: 1, fem: 0, age: [20, 40], hair: ['buzz'], beard: [null],
    dress: () => ({ top: jacket('bomber', 'nylon', '#202226', { rib: '#141518', lining: '#2a2a2a' }), inner: under('tee', '#e8e6e0'), bottom: legs('trousers', '#22242a'), belt: BELT, shoes: feet('oxford', '#161616') }) },
  { role: 'kid', n: 4, phone: 2, fem: 0.5, age: [7, 11], hair: ['side', 'curls', 'buzz'], hairF: ['long', 'bun', 'curls'], beard: [null], build: { height: 0.66, head: 1.12, bulk: 0.86, limbs: 0.92 },
    dress: (j) => ({ top: jacket(j % 2 ? 'denim' : 'bomber', j % 2 ? 'denim' : 'nylon', ['#e8783a', '#5a7aa0', '#3a8a5a', '#8eaccc'][j % 4], { rib: '#2a2a30', lining: '#e8c860', stitch: '#d8964a' }), inner: under('tee', ['#e8c860', '#f2f0ea', '#a83a3a', '#3a5a8a'][j % 4]), bottom: legs('jeans', '#4a6a8a'), belt: null, shoes: feet('sneaker', ['#f2f2ee', '#e86a5a', '#5a7ae8', '#f2f2ee'][j % 4]) }) },
  { role: 'painter', n: 1, phone: 1, fem: 0, age: [26, 60], hair: ['curls', 'long', 'side'], beard: ['full', 'trim', null],
    dress: () => ({ top: jacket('denim', 'denim', '#8eaccc', { stitch: '#d8964a', buttons: '#a8743a' }), inner: under('tee', '#f2f0ea'), bottom: legs('chinos', '#e0d8c4', { cuff: true }), belt: BELT, shoes: feet('sneaker', '#f2f2ee') }) },
  { role: 'bride', n: 1, phone: 1, fem: 1, age: [24, 36], hair: [], hairF: ['bun', 'long'], beard: [null],
    dress: () => ({ top: jacket('blazer', 'crepe', '#f8f6f0', { buttons: '#e8e4dc' }), inner: under('dress', '#fbf9f4', { flower: ['#ffffff', '#f4ecdc', '#fff8ec'] }), bottom: { kind: 'dress', ...cloth('#fbf9f4'), flower: ['#ffffff', '#f4ecdc', '#fff8ec'] }, belt: null, shoes: feet('bootie', '#f2eee6') }) },
  { role: 'groom', n: 1, phone: 1, fem: 0, age: [26, 40], hair: ['back', 'side'], beard: [null, 'trim'],
    dress: () => ({ top: jacket('blazer', 'wool', '#141418', { square: '#ffffff' }), inner: under('shirt', '#ffffff'), bottom: legs('trousers', '#141418'), belt: BELT, shoes: feet('oxford', '#0e0e0e') }) },
  { role: 'courier', n: 2, phone: 1, fem: 0.5, age: [19, 34], hair: ['buzz', 'side'], hairF: ['bun'], beard: [null, 'shadow'],
    dress: (j) => ({ top: jacket('bomber', 'nylon', j % 2 ? '#2a4a8a' : '#e07a2a', { rib: '#2a2a30', lining: '#2a2a30' }), inner: under('tee', j % 2 ? '#a8c8e6' : '#2a2a30'), bottom: legs(j % 2 ? 'trousers' : 'jeans', j % 2 ? '#1c2438' : '#1a1a1e'), belt: BELT, shoes: feet('sneaker', '#f2f2ee') }) },
  // (the city's own workers: the sweepers, the road crews, the drivers - the high-visibility jacket)
  { role: 'worker', n: 2, phone: 1, fem: 0.25, age: [22, 60], hair: ['buzz', 'side', 'back'], hairF: ['bun'], beard: [null, 'short', 'mustache', 'full'],
    dress: (j) => ({ top: jacket('bomber', 'nylon', '#e8a020', { rib: '#5a5a5a', lining: '#d8d8d0' }), inner: under('tee', j % 2 ? '#3a5a8a' : '#e8e6e0'), bottom: legs('trousers', '#3a4a3e'), belt: BELT, shoes: feet('oxford', '#2a1e14') }) },
  { role: 'busker', n: 1, phone: 1, fem: 0, age: [22, 50], hair: ['long', 'curls'], beard: ['full', 'trim', null],
    dress: () => ({ top: jacket('denim', 'denim', '#3e5878', { stitch: '#d8964a', buttons: '#a8743a' }), inner: under('tee', '#a83a3a'), bottom: legs('jeans', '#2a2a30'), belt: BELT, shoes: feet('bootie', '#6a4a32') }) },
];
// one of them: one of the city's people as the rule makes them, a woman or a man as asked, as old as
// the work has them (a child a child's face and build), dressed for it
function roleMade(R0, def, j, seed) {
  const fem = def.fem >= 1 || (def.fem > 0 && (j % Math.round(1 / def.fem) === 1 % Math.round(1 / def.fem)));
  const R = rngOf(seed);
  const pick = (a) => a[Math.floor(R() * a.length)];
  // (made's own rule - a woman at the odd numbers: the next of the right one)
  let i = 200 + seed * 2 + (fem ? 1 : 0);
  const kid = def.role === 'kid';
  const F = made(i);
  F.key = `${def.role}${j}`;
  F.role = def.role;
  F.variant = j;
  const [a0, a1] = def.age;
  F.age = Math.round(a0 + (a1 - a0) * R());
  // (the years in the face as the work's age has them)
  delete F.morph['head-age-incr'];
  delete F.morph['head-age-decr'];
  if (kid) F.morph['head-age-decr'] = 1;
  else if (F.age > 52) F.morph['head-age-incr'] = +(0.3 + (F.age - 52) / 30).toFixed(2);
  else if (F.age < 28) F.morph['head-age-decr'] = +(0.15 + (28 - F.age) / 30).toFixed(2);
  F.lines = F.age > 55 ? 0.7 : F.age > 38 ? 0.3 : 0;
  Object.assign(F, def.dress(j));
  const style = pick(F.fem ? def.hairF || def.hair : def.hair.length ? def.hair : ['side']);
  if (style) {
    const greyOk = F.age > 50;
    const name = kid ? pick(['black', 'brown', 'chestnut', 'blonde', 'espresso']) : greyOk && R() < 0.5 ? pick(['grey', 'silver', 'ash']) : pick(F.skin === 'deep' || F.skin === 'tan' ? ['black', 'espresso'] : ['black', 'espresso', 'brown', 'chestnut', 'auburn', 'blonde']);
    F.hair = hairOf(name, style, style === 'long' ? { len: +(0.12 + R() * 0.16).toFixed(2), wave: R() < 0.4 ? 1 : 0 } : {});
    F.brows = browsOf(name, F.brows.thick, F.brows.arch);
  }
  F.beard = F.fem || kid ? null : pick(def.beard);
  if (F.beard) F.beardCol = [shade(F.hair.base, 0.8), F.hair.base, shade(F.hair.base, 0.6), shade(F.hair.base, 0.45)];
  else delete F.beardCol;
  if (kid || def.role === 'swat' || def.role === 'robber' || def.role === 'bride') delete F.glasses;
  F.acc = { ...(R() < 0.4 && !kid ? { watch: '#b0b0b8' } : {}), ...(F.fem && R() < 0.5 ? { earrings: '#e8e4dc' } : {}) };
  if (def.build) F.build = { ...F.build, ...def.build };
  if (kid) {
    F.body = { belly: 0, chest: 0, thick: -0.04 };
    F.lines = 0;
    F.freckles = R() < 0.3 ? 0.6 : 0;
    // (a child's face as it is: no paint on it)
    F.eyes = { ...F.eyes, liner: 0, lashes: Math.min(F.eyes.lashes, 0.4) };
    delete F.eyes.shadow;
    F.mouth = { ...F.mouth, lipstick: null, lip: [shade(SKINS[F.skin].warm[0], 0.85), SKINS[F.skin].warm[1]] };
    F.blush = 0.2;
  }
  F.how = 'work';
  void R0;
  return F;
}
const ROLE = [];
let seedN = 0;
for (const def of ROLES) for (let j = 0; j < def.n; j++) ROLE.push(Object.assign(roleMade(null, def, j, ++seedN), { phone: j < def.phone }));
// (in order: the first 36 of the city's people - a phone's - then the phone's own of those at work, the
// rest at work, then the other 36 people: what a phone makes is the first FOLK_PHONE of them)
FOLK.push(...CIVIL.slice(0, 30));
FOLK.push(...ROLE.filter((F) => F.phone));
FOLK.push(...ROLE.filter((F) => !F.phone));
FOLK.push(...CIVIL.slice(30));
export const FOLK_PHONE = 36 + ROLE.filter((F) => F.phone).length;

// ------------------------------------------------------------------ the story's own
// (v5, ROADMAP 18) The prologue's people drawn as the city's people are, after all of them (nobody's
// number moves, nobody's face or hair is made another way), and none of the city's to walk its
// streets: each has a role of their own - game/looks.js folkPick passes over everybody with a role,
// rolePick finds only the role asked - and game/prologue/cast.js dresses them for their scenes.
// (A computer makes them; a phone makes the first FOLK_PHONE only, and cast.js draws them the old way
// there.)
// Lily Cruz, the hero's daughter, as her sheet has her: nine, a child's build and a child's face,
// curious and smiling; dark brown hair, curly and messy, drawn back into a ponytail, loose curls at her
// temples, a braid of beads ending in a feather by her right ear and a yellow clip above it; hazel
// eyes, freckles across her nose and her cheeks, uneven brows, a mole by her lip, a scratch on her
// cheek, a gap between her front teeth, ears that stand out; an open purple zip hoodie, its hood down,
// over a cream tee with a rocket and stars on it; olive cargo trousers; purple sneakers.
export const LILY = {
  key: 'lily', name: 'Lily', age: 9, fem: true, role: 'lily', how: 'cast',
  build: { height: 0.71, head: 1.14, bulk: 0.86, limbs: 0.92 },
  // (a child's: no waist or bust drawn in under the hoodie)
  body: { belly: 0, chest: -0.9, thick: -0.04 },
  morph: {
    'head-age-decr': 1, 'head-round': 0.35, 'cheek-volume-incr': 0.35, 'eye-scale-incr': 0.3, 'nose-scale-vert-decr': 0.3, 'nose-point-up': 0.45, 'nose-scale-horiz-decr': 0.15,
    'mouth-scale-horiz-incr': 0.25, 'mouth-angles-up': 0.3, 'ear-scale-incr': 0.8, 'chin-width-decr': 0.25, 'chin-prominent-decr': 0.1, 'eyebrows-angle-up': 0.15, 'forehead-scale-vert-incr': 0.15,
  },
  shape: { cheeks: 0.35, jaw: 0.9, dbl: 0, neck: 0.88 },
  expr: 'smile',
  head: { jaw: 0, chin: 0.9, nose: 0.88, lips: 1.02, brow: 0.58 },
  skin: 'golden', eyes: { iris: 'hazel', open: 1.12, lid: 0.3, lashes: 0.4, liner: 0 },
  // (uneven: the one arched higher than the other - render/folkink.js)
  brows: { col: ['#3a2216', '#4a2c1c', '#2a1810'], thick: 1.0, arch: 0.32, uneven: 0.5 },
  mouth: { w: 1.04, full: 1.0, lip: [shade(SKINS.golden.warm[0], 0.85), SKINS.golden.warm[1]], lipstick: null },
  beard: null, lines: 0, freckles: 1, blush: 0.4,
  // (her own marks, where her face has them - x her left, as the head's: render/folkink.js; the gap
  // between her front teeth, and a smile that shows them: render/portrait.js)
  mole: [0.02, -0.0605], scratch: [[-0.05, -0.011], [-0.04, -0.019]], gap: 1, grin: 0.5,
  // (style 'pony': render/folkshapes.js; bits: what is in it - side -1 her right)
  hair: {
    ...hairOf('espresso', 'pony'), base: '#3c2416', dark: ['#1c100a', '#24140c', '#160c06'], mid: ['#4e3020', '#5a3826', '#462a1a'], light: ['#8a5a34', '#9a6a3e', '#7a4c2a'], wave: 1,
    bits: { side: -1, clip: '#f2c230', beads: ['#d8402e', '#2a9a9a', '#f2c230', '#e8762a', '#4a78d0', '#e85aa0'], feather: ['#f2ead8', '#8a5a34'] },
  },
  // (a hoodie: a bomber's cut in soft cotton, its hood down on the back - render/folkshapes.js - and
  // open a little wider than a jacket is worn)
  top: jacket('bomber', 'cotton', '#674889', { rib: '#58397a', lining: '#4a3266', buttons: '#cfcac0', hood: true, open: 0.014 }),
  inner: under('tee', '#f1e7d2', { print: 'rocket' }),
  bottom: legs('chinos', '#6e6a3e', { cargo: true }),
  belt: null,
  shoes: { ...feet('sneaker', '#5e4280'), accent: '#efe8da' },
  acc: {},
};
FOLK.push(LILY);

// (how many of them the city's renderer made: phones fewer - render/people.js; game/looks.js picks
// from those)
export const FOLK_ON = { n: FOLK.length };
