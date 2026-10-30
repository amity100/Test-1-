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
    morph: { 'head-round': 0.7, 'head-fat-incr': 0.9, 'head-age-incr': 0.6, 'head-scale-horiz-incr': 0.35, 'neck-double-incr': 0.9, 'chin-width-incr': 0.5, 'chin-prominent-decr': 0.3, 'chin-bones-incr': 0.3, 'cheek-volume-incr': 0.7, 'cheek-bones-decr': 0.5, 'nose-scale-horiz-incr': 0.55, 'nose-volume-incr': 0.6, 'nose-point-width-incr': 0.6, 'nose-nostrils-width-incr': 0.5, 'mouth-scale-horiz-incr': 0.3, 'mouth-angles-up': 0.6, 'eye-bag-incr': 0.6, 'eye-scale-decr': 0.2, 'ear-scale-incr': 0.3, 'ear-lobe-incr': 0.4, 'eyebrows-trans-down': 0.3 },
    shape: { cheeks: 1.0, jaw: 1.16, dbl: 1.0, neck: 1.22 },
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
    morph: { 'head-oval': 0.7, 'head-scale-vert-incr': 0.4, 'head-scale-horiz-decr': 0.2, 'chin-prominent-incr': 0.4, 'chin-height-incr': 0.3, 'chin-bones-incr': 0.2, 'nose-scale-horiz-incr': 0.7, 'nose-nostrils-width-incr': 0.8, 'nose-flaring-incr': 0.5, 'nose-point-width-incr': 0.4, 'nose-scale-depth-decr': 0.2, 'mouth-upperlip-volume-incr': 0.7, 'mouth-lowerlip-volume-incr': 0.8, 'mouth-scale-horiz-incr': 0.3, 'mouth-angles-up': 0.25, 'eyebrows-trans-forward': 0.3, 'cheek-bones-decr': 0.2 },
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
    morph: { 'head-rectangular': 0.5, 'head-scale-vert-incr': 0.5, 'head-scale-horiz-decr': 0.3, 'head-age-incr': 1.0, 'head-fat-decr': 0.6, 'cheek-volume-decr': 0.8, 'cheek-inner-decr': 0.5, 'cheek-bones-decr': 0.3, 'nose-hump-incr': 0.9, 'nose-scale-vert-incr': 0.6, 'nose-scale-depth-incr': 0.5, 'nose-point-down': 0.5, 'nose-curve-convex': 0.6, 'mouth-upperlip-volume-decr': 0.6, 'mouth-lowerlip-volume-decr': 0.4, 'mouth-angles-down': 0.25, 'eyebrows-trans-forward': 0.6, 'eye-bag-incr': 0.8, 'chin-prominent-incr': 0.3, 'chin-cleft-incr': 0.5, 'ear-scale-incr': 0.4, 'ear-lobe-incr': 0.6 },
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
};
const hairOf = (name, style, o = {}) => {
  const b = HAIRS[name];
  const grey = name === 'grey' || name === 'silver' || name === 'white' ? 1 : 0;
  return { style, base: b, dark: [shade(b, 0.45), shade(b, 0.55), shade(b, 0.4)], mid: [shade(b, 1.15), shade(b, 1.25), shade(b, 1.08)], light: [pale(b, 0.35), pale(b, 0.42), pale(b, 0.28)], grey, ...o };
};
const browsOf = (hairName, thick, arch) => {
  const b = HAIRS[hairName === 'white' || hairName === 'silver' ? 'grey' : hairName === 'blonde' || hairName === 'honey' ? 'ash' : hairName];
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
const MEN = ['Marco', 'Theo', 'Jonah', 'Ravi', 'Omar', 'Felix', 'Kenji', 'Luca', 'Andre', 'Samuel', 'Viktor', 'Diego', 'Hugo', 'Malik', 'Ezra', 'Tomas'];
const WOMEN = ['Nora', 'Priya', 'Sofia', 'Amara', 'Ines', 'Hana', 'Clara', 'Zoe', 'Leila', 'Mira', 'Esther', 'Rosa', 'Yuki', 'Talia', 'Greta', 'Noor'];
const HEADS = ['head-round', 'head-oval', 'head-rectangular', 'head-square', 'head-triangular', 'head-invertedtriangular', 'head-diamond'];
// the features a face is moved by: each [incr, decr] (one of a pair at a time), or a lone one
const FEATURES = [
  ['nose-scale-horiz-incr', 'nose-scale-horiz-decr'], ['nose-scale-vert-incr', 'nose-scale-vert-decr'], ['nose-scale-depth-incr', 'nose-scale-depth-decr'],
  ['nose-hump-incr', 'nose-hump-decr'], ['nose-point-up', 'nose-point-down'], ['nose-point-width-incr', 'nose-point-width-decr'], ['nose-nostrils-width-incr', 'nose-nostrils-width-decr'],
  ['nose-curve-convex', 'nose-curve-concave'], ['nose-volume-incr', 'nose-volume-decr'], ['nose-greek-incr', 'nose-greek-decr'],
  ['mouth-scale-horiz-incr', 'mouth-scale-horiz-decr'], ['mouth-upperlip-volume-incr', 'mouth-upperlip-volume-decr'], ['mouth-lowerlip-volume-incr', 'mouth-lowerlip-volume-decr'],
  ['mouth-cupidsbow-incr', 'mouth-cupidsbow-decr'], ['mouth-philtrum-volume-incr', 'mouth-philtrum-volume-decr'],
  ['chin-prominent-incr', 'chin-prominent-decr'], ['chin-width-incr', 'chin-width-decr'], ['chin-height-incr', 'chin-height-decr'], ['chin-bones-incr', 'chin-bones-decr'],
  ['chin-cleft-incr'], ['chin-prognathism-incr', 'chin-prognathism-decr'],
  ['eye-scale-incr', 'eye-scale-decr'], ['eye-corner1-up', 'eye-corner1-down'], ['eye-eyefold-down', 'eye-eyefold-up'], ['eye-bag-incr', 'eye-bag-decr'],
  ['eyebrows-trans-up', 'eyebrows-trans-down'], ['eyebrows-angle-up', 'eyebrows-angle-down'], ['eyebrows-trans-forward', 'eyebrows-trans-backward'],
  ['forehead-scale-vert-incr', 'forehead-scale-vert-decr'], ['forehead-trans-forward', 'forehead-trans-backward'],
  ['ear-scale-incr', 'ear-scale-decr'], ['ear-lobe-incr', 'ear-lobe-decr'], ['cheek-inner-incr', 'cheek-inner-decr'],
  ['head-scale-vert-incr', 'head-scale-vert-decr'], ['head-scale-horiz-incr', 'head-scale-horiz-decr'], ['head-back-scale-depth-incr', 'head-back-scale-depth-decr'],
];
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
function made(i) {
  const R = rngOf(7919 * (i + 11));
  const pick = (a) => a[Math.floor(R() * a.length)];
  const range = (a, b) => a + (b - a) * R();
  const fem = i % 2 === 1;
  const age = Math.round(19 + 54 * R() ** 1.7);
  const old = age > 52;
  const skin = pick(['fair', 'light', 'light', 'golden', 'olive', 'olive', 'tan', 'deep', 'deep']);
  const heavy = R() < 0.25;
  const bulk = heavy ? range(1.08, 1.26) : range(0.84, 1.02);
  // the face: a head's shape, then a handful of its features, each its own way
  const morph = { [pick(HEADS)]: +range(0.3, 0.85).toFixed(2), 'cheek-bones-decr': +range(0.2, 0.45).toFixed(2) };
  const used = new Set();
  for (let n = Math.round(range(7, 12)); n > 0; n--) {
    const f = Math.floor(R() * FEATURES.length);
    if (used.has(f)) continue;
    used.add(f);
    const pair = FEATURES[f];
    morph[pair.length > 1 && R() < 0.5 ? pair[1] : pair[0]] = +range(0.2, 0.8).toFixed(2);
  }
  if (old) morph['head-age-incr'] = +range(0.4, 1.0).toFixed(2);
  else if (age < 28) morph['head-age-decr'] = +range(0.1, 0.35).toFixed(2);
  if (heavy) Object.assign(morph, { 'head-fat-incr': +range(0.4, 0.9).toFixed(2), 'cheek-volume-incr': +range(0.3, 0.7).toFixed(2), 'neck-double-incr': +range(0.2, 0.8).toFixed(2) });
  else if (R() < 0.4) Object.assign(morph, { 'head-fat-decr': +range(0.2, 0.5).toFixed(2), 'cheek-volume-decr': +range(0.1, 0.5).toFixed(2) });
  if (fem) Object.assign(morph, { 'chin-width-decr': Math.max(morph['chin-width-decr'] || 0, 0.3), 'nose-scale-horiz-decr': Math.max(morph['nose-scale-horiz-decr'] || 0, 0.15) });
  if (skin === 'golden' && R() < 0.6) Object.assign(morph, { 'eye-eyefold-down': 0.55, 'eye-epicanthus-in': 0.5 });
  if (morph['mouth-scale-horiz-incr'] && morph['mouth-scale-horiz-decr']) delete morph['mouth-scale-horiz-decr'];
  // the hair
  const hairName = old && R() < 0.75 ? pick(['grey', 'silver', 'white', 'ash', 'grey']) : skin === 'deep' || skin === 'tan' || skin === 'golden' ? pick(['black', 'black', 'espresso', 'brown']) : pick(['black', 'espresso', 'brown', 'chestnut', 'auburn', 'copper', 'honey', 'blonde', 'ash']);
  const style = fem ? pick(['long', 'long', 'bun', 'long', 'curls']) : pick(skin === 'deep' ? ['curls', 'curls', 'buzz', 'side'] : ['side', 'side', 'back', 'buzz', 'curls']);
  const hair = hairOf(hairName, style, style === 'long' ? { len: +range(0.12, 0.3).toFixed(2), wave: R() < 0.4 ? 1 : 0 } : {});
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
  const beard = fem ? null : pick([null, null, null, 'short', 'trim', 'mustache', 'shadow']);
  const lipstick = fem && R() < 0.3;
  const expr = pick(['neutral', 'neutral', 'soft', 'soft', 'half', 'smile']);
  return {
    key: `p${i}`, name: (fem ? WOMEN : MEN)[(i >> 1) % 16], age, fem, how,
    build: { height: +range(fem ? 0.92 : 0.96, fem ? 1.02 : 1.08).toFixed(2), head: +range(0.95, 1.04).toFixed(2), bulk: +bulk.toFixed(2), limbs: +range(0.95, 1.05).toFixed(2) },
    body: heavy ? { belly: +range(0.5, 1.0).toFixed(2), chest: +range(0.1, 0.3).toFixed(2), thick: +range(0.06, 0.16).toFixed(2) } : { belly: +range(-0.3, 0.2).toFixed(2), chest: +range(0, 0.2).toFixed(2), thick: +range(-0.06, 0.04).toFixed(2) },
    morph,
    shape: { cheeks: heavy ? range(0.6, 1.0) : range(-0.6, 0.6), jaw: range(fem ? 0.84 : 0.94, fem ? 0.98 : 1.14), dbl: heavy ? range(0.4, 1.0) : 0, neck: heavy ? range(1.1, 1.22) : range(0.92, 1.02) },
    expr,
    head: { jaw: fem ? 0 : range(0.95, 1.1), chin: range(0.85, 1.0), nose: range(0.8, 1.25), lips: range(0.8, 1.2), brow: fem ? range(0.5, 0.7) : range(0.95, 1.1) },
    skin,
    eyes: {
      iris: skin === 'fair' || skin === 'light' ? pick(['brown', 'hazel', 'green', 'grey', 'brown']) : pick(['brown', 'dark', 'dark']),
      open: range(0.82, 1.1), lid: range(0.2, 0.75), lashes: fem ? range(0.5, 1.0) : range(0.1, 0.35), liner: fem ? range(0.1, 0.8) : 0,
      ...(fem ? { shadow: pick(['#a07a6a', '#8a6a5a', '#b48a7a']) } : {}), ...(morph['eye-eyefold-down'] ? { mono: true } : {}),
    },
    brows: browsOf(hairName, fem ? range(0.7, 0.9) : range(1.0, 1.4), fem ? range(0.3, 0.75) : range(0.1, 0.35)),
    mouth: { w: range(0.94, 1.06), full: range(0.8, 1.2), lip: lipstick ? [pick(['#a8262e', '#b8485a', '#9a3a3a']), '#c8505a'] : [shade(SKINS[skin].warm[0], 0.85), SKINS[skin].warm[1]], lipstick: lipstick || null },
    beard, ...(beard ? { beardCol: [shade(hair.base, 0.8), hair.base, shade(hair.base, 0.6), shade(hair.base, 0.45)] } : {}),
    lines: old ? range(0.6, 1.0) : age > 35 ? range(0.15, 0.4) : 0, freckles: (skin === 'fair' || skin === 'light') && R() < 0.25 ? range(0.5, 1) : 0, blush: fem ? range(0.25, 0.55) : range(0, 0.3),
    hair,
    ...(R() < 0.2 ? { glasses: { col: pick([[0.78, 0.62, 0.3], [0.08, 0.07, 0.07], [0.35, 0.22, 0.14]]), shape: 'round' } } : {}),
    top, inner, bottom,
    belt: bk === 'dress' || bk === 'wide' ? null : { col: '#2a1e16', buckle: '#c8b080' },
    shoes,
    acc: { ...(R() < 0.4 ? { watch: pick(['#c8a860', '#b0b0b8']) } : {}), ...(fem && R() < 0.6 ? { earrings: pick(['#e0c070', '#e8e4dc']) } : {}) },
  };
}
for (let i = FOLK.length; i < 32; i++) FOLK.push(made(i));

// (how many of them the city's renderer made: phones fewer - render/people.js; game/looks.js picks
// from those)
export const FOLK_ON = { n: FOLK.length };
