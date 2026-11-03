import * as THREE from 'three';
import { productPens, model, place, PEN_KEYS } from '../world/products.js';
import { BRANDS } from '../world/labels.js';
import { fmt } from './money.js';
import { LAYERS } from '../render/materials.js';
import { Shopper } from './shopper.js';
import { ShopMural } from './shopmural.js';
import { CounterLife } from './counterlife.js';
import { TryLife } from './trylife.js';

// (v5, ROADMAP 14.4) A shop's day, as it really goes - the shops of the new kind (world/market.js):
// every action tied to a real thing in the shop.
//
// A customer comes in at the door, stops a step inside and looks round, takes a basket off the stack
// by the door, goes to a part of the shop (the drinks, the cans, the fruit), looks along the shelf,
// reaches for one thing - and takes it: it leaves its place on the shelf and is in the hand (the
// fridge's door opened first, and shut after). Looks at it, turns it, reads it; puts it back where it
// was, or into the basket. Then the line at the till: the things out of the basket onto the belt one
// by one; the cashier takes each, passes it over the scanner's glass (a beep), into the bag; says the
// total; the card to the reader; the bag handed over the counter; the basket back on the stack; out.
//
// The staff: the cashier at the till between customers - wiping the counter, at the till's keys, a
// look round the shop; greeting who comes in (and you); serving. The one who fills the shelves fetches
// a box from the stock room, sets it down by the shelf that was emptied, and puts what is in it into
// the empty places one by one; faces the products on the shelves, checks them with the scanner, picks
// up what was dropped in a fright.
//
// The live products are the shop's own (world/shopkit.js LiveSet, streamed in with its goods: rec.live):
// taken, one is squeezed out of its place and drawn in the hand instead (Movers: every thing in motion
// in the shop, a few draws for all of them) - on the counter, in the bag, back on the shelf.
//
// game/streetlife.js OpenShop hands its people over: the customers (addVisitor), the cashier (its
// keeper: workInside), the one who fills the shelves (spawnStaff); it lets them go (drop, dispose).
// A fright is game/brain.js's: whoever is frightened is let go - what was in their hands falls.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

// ------------------------------------------------------------------ what each business is like
const GROCERY = {
  baskets: 0.7,
  items: [1, 3],
  // (how many customers at once: game/streetlife.js wantVisitors, the most when you are inside)
  crowd: 6,
  // (whole dollars: game/money.js)
  prices: { soda: 2, water: 1, cans: 1, juice: 3, cartons: 3, yogurt: 1, tins: 2, jars: 3, sauce: 3, oil: 5, cereal: 4, dry: 2, small: 2, meds: 5, chips: 2, coffee: 6, bread: 3, clean: 5, candy: 1, fruit: 1, energy: 3, pain: 6, kit: 12, care: 5, hotdog: 2, slush: 2 },
  names: { soda: 'a bottle of pop', water: 'a bottle of water', cans: 'a can of pop', juice: 'a bottle of juice', cartons: 'a carton', yogurt: 'a yoghurt', tins: 'a tin', jars: 'a jar', sauce: 'a bottle of sauce', oil: 'a bottle of oil', cereal: 'a box of cereal', dry: 'a box', small: 'a small box', meds: 'a box of medicine', chips: 'a bag of chips', coffee: 'a bag of coffee', bread: 'a loaf', clean: 'a bottle of cleaner', candy: 'a bar of chocolate', fruit: 'a piece of fruit', energy: 'an energy drink', pain: 'a box of painkillers', kit: 'a first-aid kit', care: 'a bottle of shampoo', hotdog: 'a hot dog', slush: 'a slush' },
  heb: { soda: 'בקבוק משקה', water: 'בקבוק מים', cans: 'פחית משקה', juice: 'בקבוק מיץ', cartons: 'קרטון חלב/מיץ', yogurt: 'יוגורט', tins: 'שימורים', jars: 'צנצנת', sauce: 'רוטב', oil: 'שמן', cereal: 'דגני בוקר', dry: 'קופסה', small: 'קופסה קטנה', meds: 'תרופה', chips: 'שקית צ\'יפס', coffee: 'שקית קפה', bread: 'לחם', clean: 'חומר ניקוי', candy: 'חטיף שוקולד', fruit: 'פרי', energy: 'משקה אנרגיה', pain: 'משככי כאבים', kit: 'ערכת עזרה ראשונה', care: 'שמפו', hotdog: 'נקניקייה', slush: 'ברד' },
  food: new Set(['soda', 'water', 'cans', 'juice', 'cartons', 'yogurt', 'chips', 'bread', 'candy', 'fruit', 'energy', 'hotdog', 'slush']),
  say: {
    shelf: ['Hmm, which one...', 'Two for one? Nice.', 'Where is the milk?', 'This one\'s cheaper.', 'We\'re out of eggs again?', 'Ooh, a new flavour.', 'Is this the low-fat one?', 'I always forget something.'],
    back: ['Nah.', 'Not today.', 'Too sweet.', 'Maybe next time.'],
    keep: ['That\'ll do.', 'Perfect.', 'Got it.'],
    hi: ['Hi!', 'Morning!', 'Hello there!', 'Hey, welcome in!', 'Afternoon!'],
    player: ['Hi! Let me know if you need anything.', 'Welcome in! The drinks are cold.', 'Hey there! Fresh fruit came in today.'],
    found: ['Find everything all right?', 'Hi! Is that all?', 'Good afternoon!'],
    total: (n) => [`That's ${n} dollars.`, `${n} dollars, please.`, `Comes to ${n}.`],
    card: ['Card, please.', 'Tap away.', 'Here you go.'],
    thanks: ['Thank you! Have a nice day!', 'Thanks, see you soon!', 'Enjoy!', 'Bye now!'],
    bye: ['Thanks!', 'See you!', 'Bye!', 'Have a good one!'],
    run: ['Easy, please - no running in here!', 'Whoa, slow down!'],
    bump: ['Oh! Excuse me.', 'Hey - careful!', 'Sorry!', 'Whoa there.'],
    ask: ['Excuse me, where\'s the coffee?', 'Do you have more of these?', 'Where can I find the milk?'],
    answer: ['Aisle two, by the cereal.', 'In the fridges, at the back.', 'Let me check in the back.', 'Right over there.'],
    stock: ['Coming through!', 'Fresh stock!'],
    // (to you, at a shelf with something in your hand: the one filling the shelves, if near)
    help: ['Need a hand finding anything?', 'Those just came in this morning.', 'That one\'s two for three today.'],
  },
};
// (a clothes shop: no baskets - a garment in the hand, held up at the mirror, tried on; folded at the
// counter, not scanned; the one on the floor straightens the hangers and refolds the tables)
const FASHION = {
  flow: 'fashion',
  baskets: 0,
  items: [1, 2],
  crowd: 5,
  prices: { garment: 49, folded: 29, shoe: 69 },
  names: { garment: 'a garment', folded: 'a folded shirt', shoe: 'a shoe' },
  heb: { garment: 'בגד', folded: 'חולצה מקופלת', shoe: 'נעל' },
  food: new Set(),
  say: {
    shelf: ['Do you have this in blue?', 'Too small...', 'I love this colour!', 'Is this on sale?', 'Does it come in a medium?', 'Hmm, linen...'],
    back: ['Not my colour.', 'Too long.', 'Maybe not.'],
    keep: ['This one.', 'I\'ll try it.'],
    mirror: ['What do you think?', 'Hmm...', 'Not bad!', 'It\'s a bit big.'],
    out: ['How does it look?', 'I like it!', 'Ta-da!'],
    hi: ['Hi! Welcome in!', 'Hello!'],
    player: ['Hi! Let me know if you want to try anything on.', 'Welcome! The new season just came in.', 'Hello! The fitting rooms are free.'],
    found: ['Did you find everything?', 'Great choice!', 'Lovely, isn\'t it?'],
    total: (n) => [`That's ${n} dollars.`, `${n} dollars, please.`],
    card: ['Card, please.'],
    thanks: ['Thank you! Enjoy it!', 'Wear it well!', 'Thanks, come again!'],
    bye: ['Thanks!', 'Bye!', 'See you!'],
    run: ['Easy, please!', 'Careful with the rails!'],
    bump: ['Oh! Sorry.', 'Excuse me!', 'Oops.'],
    praise: ['That colour suits you!', 'It looks great on you.', 'Want a size up?', 'That one\'s new this week.'],
    stock: ['New ones on the rail!'],
    help: ['Want me to get you a size?', 'The fitting rooms are just over there.', 'That one runs a little small.'],
  },
};
// (an electronics shop: the demo phones and laptops picked up and tried where they are - they are
// tied to their tables - the headphones put on; the seller comes over and shows what it does; what is
// bought comes boxed from the counter)
const TECH = {
  flow: 'tech',
  baskets: 0,
  items: [1, 2],
  crowd: 5,
  prices: { phone: 599, laptop: 999, headphones: 129 },
  names: { phone: 'a phone', laptop: 'a laptop', headphones: 'headphones' },
  heb: { phone: 'טלפון', laptop: 'מחשב נייד', headphones: 'אוזניות' },
  food: new Set(),
  boxed: { model: 'small', cell: 'box.laptop', tint: [0.95, 0.95, 0.94] },
  say: {
    shelf: ['Is this the new model?', 'How much storage?', 'The screen is huge!', 'Does it come with a charger?', 'So light!'],
    back: ['Too expensive.', 'Maybe next year.'],
    keep: ['I\'ll take one.', 'Okay, sold.'],
    hi: ['Hi there!'],
    player: ['Hi! Want to try the new phone?', 'Welcome! Everything on the tables is on - try anything.'],
    found: ['Great choice!', 'You\'ll love it.'],
    total: (n) => [`That's ${n} dollars.`, `${n}, please.`],
    thanks: ['Enjoy it!', 'Thanks - come back if you need anything.'],
    bye: ['Thanks!', 'Bye!'],
    run: ['Easy - lots of screens in here!'],
    bump: ['Oh! Sorry.', 'Excuse me!'],
    explain: ['The camera on this one is amazing.', 'The battery lasts two whole days.', 'Try drawing on it - the screen follows the pen.', 'This one folds in half.', 'It is the fastest one we have.'],
    reply: ['Really?', 'How much is it?', 'Nice...', 'Does it come in black?', 'Hmm, interesting.'],
    listen: ['Wow, the sound!', 'So clear!', 'Hmm, a bit tight.'],
    watch: ['Look at those colours!', 'That screen is huge.', 'I need one of those.'],
    stock: ['One from the back, coming up!'],
    help: ['Want me to show you what it does?', 'That one\'s on special this week.', 'Go ahead - it\'s a demo, try it.'],
  },
};
// (a jeweller: the things are behind glass - asked for, taken out by the seller, laid on a tray,
// picked up and tried; back into the case, or into a little box)
const JEWEL = {
  flow: 'jewel',
  baskets: 0,
  items: [1, 1],
  // (a quiet shop, one seller: two or three at a time, each one served in turn)
  crowd: 3,
  prices: { ring: 890, watch: 1250, necklace: 640 },
  names: { ring: 'a ring', watch: 'a watch', necklace: 'a necklace' },
  heb: { ring: 'טבעת', watch: 'שעון', necklace: 'שרשרת' },
  food: new Set(),
  say: {
    shelf: ['Oh, that one sparkles.', 'Hmm...', 'Look at that one.'],
    ask: ['Could I see that one?', 'May I see the ring on the left?', 'Could you show me that watch?'],
    show: ['Of course. This is eighteen carat gold.', 'A beautiful choice - the stone is real.', 'Here you are. Take your time.'],
    tryIt: ['It\'s lovely...', 'How does it look?', 'It fits!'],
    back: ['It\'s beautiful, but... not today.', 'Let me think about it.'],
    keep: ['I\'ll take it.', 'This is the one.'],
    hi: ['Good afternoon.'],
    player: ['Good afternoon. Is there anything you would like to see?', 'Welcome. Just ask, and I will take anything out for you.'],
    found: ['An excellent choice.'],
    total: (n) => [`That comes to ${n} dollars.`],
    thanks: ['Thank you. Wear it well.', 'Enjoy it - it suits you.'],
    bye: ['Thank you.', 'Goodbye.'],
    run: ['Please - walk, in here.'],
    bump: ['Oh! Pardon me.'],
    stock: [''],
    help: ['Of course - let me take it out for you.', 'A lovely piece. Here, have a closer look.'],
  },
};
// (ROADMAP 16.5: a shoe shop: the shoes on the wall are its samples - one taken down, sat with on a
// bench, a size asked for; the box comes out of the stock room, tried on, looked at in the low mirror;
// game/trylife.js)
const SHOES = {
  flow: 'shoes',
  baskets: 0,
  items: [1, 1],
  crowd: 4,
  prices: { shoe: 89 },
  names: { shoe: 'a pair of shoes' },
  heb: { shoe: 'נעליים' },
  food: new Set(),
  say: {
    shelf: ['Ooh, these.', 'Do these come in black?', 'Hmm, nice.', 'Are these comfortable?'],
    back: ['Not for me.', 'Too pricey.'],
    keep: ['I\'ll take them.', 'These ones.'],
    hi: ['Hi! Welcome in!', 'Hello!'],
    player: ['Hi! Let me know your size and I\'ll bring a pair out.', 'Welcome! Everything on the wall comes in all sizes.'],
    found: ['Great choice!', 'Those are really popular.'],
    total: (n) => [`That's ${n} dollars.`, `${n} dollars, please.`],
    card: ['Card, please.'],
    thanks: ['Enjoy them!', 'Wear them well!', 'Thanks, come again!'],
    bye: ['Thanks!', 'Bye!'],
    run: ['Easy, please!', 'No running - unless you\'re testing the shoes!'],
    bump: ['Oh! Sorry.', 'Excuse me!'],
    stock: ['New ones in!'],
    help: ['Want to try those on? I\'ll get your size.', 'Those run a little small.', 'That one\'s on sale this week.'],
  },
};
// (a sports shop: the team's clothes as in a clothes shop, the running shoes as in a shoe shop; the
// balls bounced, the treadmill walked on, the bikes looked at - game/trylife.js)
const SPORTS = {
  flow: 'fashion',
  baskets: 0,
  items: [1, 2],
  crowd: 5,
  prices: { garment: 39, folded: 25, shoe: 99 },
  names: { garment: 'a jersey', folded: 'a training shirt', shoe: 'a pair of running shoes' },
  heb: { garment: 'בגד ספורט', folded: 'חולצת אימון', shoe: 'נעלי ריצה' },
  food: new Set(),
  say: {
    shelf: ['That\'s our team!', 'Do you have it in a large?', 'Nice colours.', 'Is this breathable?'],
    back: ['Not my team.', 'Too big.'],
    keep: ['This one.', 'I\'ll take it.'],
    mirror: ['Looks fast!', 'Hmm...', 'Not bad!'],
    out: ['How does it look?', 'Ready for the game!'],
    hi: ['Hey! Welcome in!', 'Hi there!'],
    player: ['Hey! Try the treadmill if you like.', 'Welcome! Running shoes are on the lit wall.'],
    found: ['Great pick!', 'That one\'s our best seller.'],
    total: (n) => [`That's ${n} dollars.`, `${n} dollars, please.`],
    card: ['Card, please.'],
    thanks: ['Have a great game!', 'Enjoy!', 'Thanks!'],
    bye: ['See you!', 'Bye!'],
    run: ['Save it for the track!', 'Easy there!'],
    bump: ['Oh! Sorry.', 'Excuse me!'],
    praise: ['That looks great on you.', 'Very sporty!'],
    stock: ['New jerseys on the rail!'],
    help: ['Need a size?', 'Those are great for running.', 'The treadmill\'s free - give it a go.'],
  },
};
// (an eatery: nothing taken off a shelf - ordered at the till, made, drawn, served: game/eaterylife.js)
const FOOD = {
  flow: 'food',
  baskets: 0,
  items: [1, 1],
  crowd: 6,
  prices: {},
  names: {},
  heb: {},
  food: new Set(),
  say: {
    hi: ['Hi!', 'Hello there!', 'Welcome in!'],
    player: ['Hi! The board\'s up there - take your time.', 'Welcome! Today\'s special is on the board.', 'Hey! Sit anywhere you like.'],
    found: ['What can I get you?'],
    total: (n) => [`That's ${n} dollars.`],
    thanks: ['Enjoy!', 'Thanks!'],
    bye: ['Bye!', 'See you!'],
    run: ['Careful - hot food!', 'Easy, please!'],
    bump: ['Oh! Sorry.', 'Watch the tray!', 'Excuse me!'],
    help: ['Anything else?'],
    stock: [''],
  },
};
export const PROFILES = { grocery: GROCERY, deli: GROCERY, shop: GROCERY, pharmacy: GROCERY, fashion: FASHION, boutique: FASHION, surf: FASHION, electronics: TECH, phones: TECH, jewelry: JEWEL, shoes: SHOES, sports: SPORTS, cafe: FOOD, bagel: FOOD, pizza: FOOD, burger: FOOD, tacos: FOOD, noodles: FOOD, diner: FOOD, juice: FOOD, icecream: FOOD, sushi: FOOD, falafel: FOOD };

// ------------------------------------------------------------------ the things in motion
// Every product, basket, bag and box in a hand, on the counter or on the floor: one geometry a pen
// for all of them (its corners rewritten each frame from each thing's place: where the hand is),
// a few draws for the whole shop.
const TPL = new Map();
function template(look, low) {
  const key = `${look.model}|${look.cell}|${look.side}|${(look.tint || []).join(',')}|${(look.cap || []).join(',')}|${low ? 1 : 0}`;
  let t = TPL.get(key);
  if (t) return t;
  const S = { bufs: {}, light: null, n: 0, buf(pen) {
    let b = this.bufs[pen];
    if (!b) b = this.bufs[pen] = { P: [], N: [], U: [], C: [], I: [], X: [], n: 0 };
    return b;
  } };
  const m = model(look.model, low);
  place(S, m, 0, 0, 0, 0, look);
  t = { size: m.size, hang: m.hang || 0, pens: {} };
  for (const [k, b] of Object.entries(S.bufs)) {
    if (!b.n) continue;
    t.pens[k] = { P: new Float32Array(b.P), N: new Float32Array(b.N), U: new Float32Array(b.U), C: new Float32Array(b.C), I: new Float32Array(b.I), X: b.X.slice(), n: b.n };
  }
  TPL.set(key, t);
  return t;
}

class Movers {
  constructor(game, pens, centre) {
    this.game = game;
    this.pens = pens;
    this.items = [];
    this.dirty = false;
    this.meshes = {};
    this.cap = {};
    this.centre = centre;
  }

  add(look, low = false) {
    const it = { look, t: template(look, low), pos: new THREE.Vector3(), yaw: 0, tilt: 0, roll: 0, at: null, off: {} };
    this.items.push(it);
    this.dirty = true;
    return it;
  }

  remove(it) {
    const i = this.items.indexOf(it);
    if (i >= 0) {
      this.items.splice(i, 1);
      this.dirty = true;
    }
  }

  mesh(k, nv, ni) {
    let m = this.meshes[k];
    const cap = this.cap[k] || 0;
    if (m && cap >= nv) return m;
    const c = Math.max(nv, 512) * 1.5;
    const g = new THREE.BufferGeometry();
    for (const [name, w] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3], ['aId', 1], ['aObj', 1]]) {
      const a = new THREE.BufferAttribute(new Float32Array(c * w), w);
      a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(name, a);
    }
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(Math.max(ni, 1024) * 1.5), 1));
    g.boundingSphere = new THREE.Sphere(this.centre.clone(), 30);
    if (m) {
      m.geometry.dispose();
      m.geometry = g;
    } else {
      m = new THREE.Mesh(g, this.pens[k]);
      m.name = `shop movers ${k}`;
      m.matrixAutoUpdate = false;
      m.renderOrder = 1;
      m.userData.dynamic = true;
      // (in the shop - or in a hand at its door: out of the sun's map and the street's mirror, as the
      // shelves' goods are)
      m.userData.indoor = true;
      m.layers.set(LAYERS.MIRRORLESS);
      this.game.scene.add(m);
      this.meshes[k] = m;
    }
    this.cap[k] = c;
    return m;
  }

  // the set of things changed: the corners that never move (their uvs, colours, ids) and the
  // triangles laid out again
  rebuild() {
    this.dirty = false;
    for (const k of PEN_KEYS) {
      let nv = 0;
      let ni = 0;
      for (const it of this.items) {
        const p = it.t.pens[k];
        if (p) {
          nv += p.n;
          ni += p.X.length;
        }
      }
      if (!nv) {
        if (this.meshes[k]) this.meshes[k].visible = false;
        continue;
      }
      const m = this.mesh(k, nv, ni);
      m.visible = true;
      const g = m.geometry;
      const U = g.attributes.uv.array;
      const C = g.attributes.color.array;
      const I = g.attributes.aId.array;
      const X = g.index.array;
      let o = 0;
      let oi = 0;
      for (const it of this.items) {
        const p = it.t.pens[k];
        if (!p) continue;
        it.off[k] = o;
        U.set(p.U, o * 2);
        C.set(p.C, o * 3);
        I.set(p.I, o);
        for (let j = 0; j < p.X.length; j++) X[oi + j] = p.X[j] + o;
        o += p.n;
        oi += p.X.length;
      }
      g.setDrawRange(0, oi);
      g.attributes.uv.needsUpdate = true;
      g.attributes.color.needsUpdate = true;
      g.attributes.aId.needsUpdate = true;
      g.index.needsUpdate = true;
    }
  }

  // every frame: each thing's corners where it is now
  update() {
    if (this.dirty) this.rebuild();
    for (const k of PEN_KEYS) {
      const m = this.meshes[k];
      if (!m || !m.visible) continue;
      const P = m.geometry.attributes.position.array;
      const N = m.geometry.attributes.normal.array;
      for (const it of this.items) {
        const p = it.t.pens[k];
        if (!p) continue;
        const o = it.off[k];
        const cy = Math.cos(it.yaw);
        const sy = Math.sin(it.yaw);
        const ct = Math.cos(it.tilt);
        const st = Math.sin(it.tilt);
        const cr = Math.cos(it.roll);
        const sr = Math.sin(it.roll);
        const x0 = it.pos.x;
        const y0 = it.pos.y;
        const z0 = it.pos.z;
        for (let v = 0; v < p.n; v++) {
          // (rolled about its front axis, tilted forward, turned)
          let x = p.P[v * 3];
          let y = p.P[v * 3 + 1];
          let z = p.P[v * 3 + 2];
          let nx = p.N[v * 3];
          let ny = p.N[v * 3 + 1];
          let nz = p.N[v * 3 + 2];
          let t1 = x * cr - y * sr;
          y = x * sr + y * cr;
          x = t1;
          t1 = nx * cr - ny * sr;
          ny = nx * sr + ny * cr;
          nx = t1;
          t1 = y * ct - z * st;
          z = y * st + z * ct;
          y = t1;
          t1 = ny * ct - nz * st;
          nz = ny * st + nz * ct;
          ny = t1;
          const q = (o + v) * 3;
          P[q] = x0 + x * cy + z * sy;
          P[q + 1] = y0 + y;
          P[q + 2] = z0 - x * sy + z * cy;
          N[q] = nx * cy + nz * sy;
          N[q + 1] = ny;
          N[q + 2] = -nx * sy + nz * cy;
        }
      }
      m.geometry.attributes.position.needsUpdate = true;
      m.geometry.attributes.normal.needsUpdate = true;
    }
  }

  dispose() {
    for (const m of Object.values(this.meshes)) {
      if (m.parent) m.parent.remove(m);
      m.geometry.dispose();
    }
    this.meshes = {};
    this.items = [];
  }
}

// ------------------------------------------------------------------ the shop's life
export class ShopLife {
  constructor(open) {
    this.open = open;
    this.game = open.game;
    this.room = open.room;
    this.shop = open.shop;
    this.prof = PROFILES[open.shop.kind] || GROCERY;
    this.rec = this.room.stock || null;
    this.live = null;
    this.zones = [];
    this.baskets = [];
    this.floor = [];
    this.belt = [];
    this.queue = [];
    this.payer = null;
    this.t = 0;
    const c = this.room.center;
    this.movers = new Movers(this.game, productPens(this.room.store ? 'store' : true), new THREE.Vector3(c.x, this.room.floor + 1, c.z));
    this.marks = this.room.marks || {};
    this.player = { in: false, greetT: -99, runT: -99, out: 0 };
    this.cool = new Map();
    this.stats = { taken: 0, back: 0, bought: 0, scanned: 0, restocked: 0, dropped: 0, doors: 0, baskets: 0, bags: 0 };
    // (you in the shop: your basket, the till, walking out without paying, a hold-up - game/shopper.js)
    this.you = new Shopper(this);
    // (now and then one of them at a wall, painting a mural: game/shopmural.js)
    this.mural = new ShopMural(this);
    this.muralOn = false;
    // (ROADMAP 16.4: the deli's counter, the pharmacy's, the slush machine, the chair - game/counterlife.js)
    this.counter = CounterLife.for(this);
    // (ROADMAP 16.5: a shoe shop's benches - a size from the stock room, tried on; a sports shop's balls,
    // its treadmill, its bikes - game/trylife.js)
    this.tries = TryLife.for(this);
    this.sync();
  }

  // ---------------------------------------------------------------- the shop's live products
  // (they come with the stream and go with it: rec.live, world/interiors.js)
  sync() {
    const L = this.rec ? this.rec.live : null;
    if (L === this.live) return;
    this.live = L;
    this.zones = [];
    this.baskets = [];
    if (!L) return;
    const byKey = new Map();
    for (const s of L.slots) {
      if (s.kind === 'basket') {
        this.baskets.push(s);
        continue;
      }
      if (s.zx === null) continue;
      const key = `${Math.round(s.zx * 20)},${Math.round(s.zz * 20)}`;
      let z = byKey.get(key);
      if (!z) {
        z = { x: s.zx, z: s.zz, slots: [], fridge: 0, what: s.what, busy: null };
        byKey.set(key, z);
        this.zones.push(z);
      }
      z.slots.push(s);
      if (s.fridge) z.fridge = s.fridge;
    }
    for (const z of this.zones) {
      let cx = 0;
      let cz = 0;
      for (const s of z.slots) {
        cx += s.x;
        cz += s.z;
      }
      cx /= z.slots.length;
      cz /= z.slots.length;
      z.yaw = Math.atan2(cx - z.x, cz - z.z);
      z.fruit = z.what === 'fruit';
    }
    this.baskets.sort((a, b) => a.y - b.y);
    // (what was taken before the stream let go of them is taken still)
    for (const s of L.slots) if (s.state !== 'shelf' && s.shown !== false) L.setShown(s.i, false);
  }

  shelfSlots(z) {
    return z.slots.filter((s) => s.state === 'shelf');
  }

  setSlot(s, state) {
    s.state = state;
    if (this.live && this.live.slots[s.i] === s) this.live.setShown(s.i, state === 'shelf');
  }

  // a fridge's door opening or shutting (k: where it wants to be)
  door(i, want) {
    if (!this.live || !i) return;
    const d = this.live.doors[i - 1];
    if (d) {
      if (want > d.want) this.stats.doors++;
      d.want = want;
    }
  }

  // ---------------------------------------------------------------- the people
  // a customer handed over by the shop (game/streetlife.js addVisitor): in at the door, or already
  // inside when the shop was opened whole
  enlist(v, o = {}) {
    const R = this.room;
    const L = (v.L = { st: 'enter', t: 0, list: [], zone: null, slot: null, item: null, basket: null, got: [], seed: Math.random() * 10, look: new THREE.Vector3(), reach: new THREE.Vector3(), reachL: new THREE.Vector3() });
    if (o.already) {
      // (already at a shelf: from there)
      L.list = this.planList(v);
      L.st = 'next';
      if (Math.random() < 0.5 && this.baskets.some((b) => b.state === 'shelf')) {
        const bs = this.takeTopBasket();
        if (bs) {
          L.basket = this.movers.add(bs.look, true);
          L.basket.at = { c: v.c, how: 'basket' };
          v.c.fig.carryL = 'basketHeld';
        }
      }
    } else {
      // (a step in from the door, then a look round)
      const p = R.door;
      const ix = p.x - this.shop.nx * 1.1;
      const iz = p.z - this.shop.nz * 1.1;
      L.orient = { x: ix, z: iz };
    }
    return L;
  }

  // the parts of the shop a customer means to go to (one, two, three), the nearest first
  planList(v) {
    const n = this.prof.items[0] + Math.floor(Math.random() * (this.prof.items[1] - this.prof.items[0] + 1));
    const zs = this.zones.filter((z) => this.shelfSlots(z).length);
    const out = [];
    for (let i = 0; i < n && zs.length; i++) {
      const k = Math.floor(Math.random() * zs.length);
      out.push(zs.splice(k, 1)[0]);
    }
    const c = v.c.pos;
    out.sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z));
    if (this.counter) this.counter.plan(v, out);
    if (this.tries) this.tries.plan(v, out);
    // (an electronics shop: a while before the wall of screens, now and then)
    if (this.prof.flow === 'tech' && Math.random() < 0.45) {
      const tv = this.room.browse.filter((b) => b.what === 'look');
      if (tv.length) out.unshift({ tv: pick(tv) });
    }
    return out;
  }

  takeTopBasket() {
    for (let i = this.baskets.length - 1; i >= 0; i--) {
      const b = this.baskets[i];
      if (b.state === 'shelf') {
        this.setSlot(b, 'held');
        this.stats.baskets++;
        return b;
      }
    }
    return null;
  }

  // the next free place on the basket stack, from the bottom
  freeBasket() {
    for (const b of this.baskets) if (b.state !== 'shelf') return b;
    return null;
  }

  go(v, x, z) {
    v.pts = this.room.path(v.c.pos.x, v.c.pos.z, x, z);
    v.t = 0;
  }

  say(c, text, chance = 1) {
    if (Math.random() < chance) this.open.say(c, text);
  }

  // where a product in a hand is held to be looked at: before the chest, a little to the side
  showAt(c, out) {
    const f = c.fig;
    const y = c.pos.y + 1.22 * (f.scale || 1);
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    return out.set(c.pos.x + fx * 0.36 - fz * 0.06, y, c.pos.z + fz * 0.36 + fx * 0.06);
  }

  // a customer's turn (game/streetlife.js OpenShop.visit): where to walk, or null to stand
  visit(v, dt) {
    const c = v.c;
    const f = c.fig;
    const L = v.L;
    L.t += dt;
    switch (L.st) {
      case 'enter': {
        if (!v.pts) v.pts = [{ x: this.shop.door[0], z: this.shop.door[2], bell: true }, { x: this.room.door.x, z: this.room.door.z, inRoom: true }, ...this.room.path(this.room.door.x, this.room.door.z, L.orient.x, L.orient.z)];
        const m = this.open.follow(v);
        if (m) return m;
        L.st = 'orient';
        L.t = 0;
        L.dur = 1.2 + Math.random() * 1.4;
        L.list = this.planList(v);
        return null;
      }
      case 'orient': {
        // a look round from just inside the door: at one part of the shop, then another
        const z = L.list[Math.min(L.list.length - 1, Math.floor(L.t / 0.8))] || this.zones[0];
        if (z) {
          L.look.set(z.x, c.pos.y + 1.3, z.z);
          f.lookAt = L.look;
        }
        if (L.t < L.dur) return null;
        f.lookAt = null;
        if (this.baskets.some((b) => b.state === 'shelf') && (L.list.length > 1 || Math.random() < this.prof.baskets) && this.marks.baskets) {
          L.st = 'toBaskets';
          this.go(v, this.marks.baskets.x, this.marks.baskets.z);
        } else L.st = 'next';
        L.t = 0;
        return null;
      }
      case 'toBaskets': {
        const m = this.open.follow(v);
        if (m) return m;
        L.st = 'takeBasket';
        L.t = 0;
        return null;
      }
      case 'takeBasket': {
        // bent down to the stack, a hand to the top basket's handle - and it is theirs
        const top = [...this.baskets].reverse().find((b) => b.state === 'shelf');
        if (!top) {
          L.st = 'next';
          return null;
        }
        c.faceYaw = Math.atan2(top.x - c.pos.x, top.z - c.pos.z);
        c.crouchW = top.y - this.room.floor < 0.25 ? 0.55 : 0.3;
        f.reachL = L.reachL.set(top.x, top.y + top.h + 0.04, top.z);
        f.lookAt = f.reachL;
        if (L.t < 0.8) return null;
        const b = this.takeTopBasket();
        if (b) {
          L.basket = this.movers.add(b.look, true);
          L.basket.at = { c, how: 'basket' };
          f.carryL = 'basketHeld';
        }
        f.reachL = null;
        f.lookAt = null;
        c.crouchW = 0;
        L.st = 'next';
        L.t = 0;
        return null;
      }
      case 'next': {
        // the next part of the shop on their mind, or the till, or out
        f.lookAt = null;
        f.reachR = null;
        c.crouchW = 0;
        let z = null;
        while (L.list.length && !z) {
          const q = L.list.shift();
          if (q.tv) {
            L.spot = q.tv;
            L.st = 'toTV';
            this.go(v, q.tv.x, q.tv.z);
            return null;
          }
          // (the deli's counter, the pharmacy's window, the chair: game/counterlife.js)
          if (q.svc && (this.counter || this.tries)) {
            L.svc = q.svc;
            L.S = null;
            L.st = 'svc';
            L.t = 0;
            v.pts = null;
            return null;
          }
          if (!q.busy || q.busy === v || !q.busy.c.alive) z = q;
        }
        if (z) {
          z.busy = v;
          L.zone = z;
          L.st = 'toZone';
          this.go(v, z.x, z.z);
          return null;
        }
        if (L.got.length) {
          L.st = 'queue';
          if (!this.queue.includes(v)) this.queue.push(v);
          L.qi = -1;
        } else if (!this.zones.length && (L.waited || 0) < 90 && this.room.browse.length) {
          // (the shelves' things not in yet - a shop's stock streams in as you come near, a moment
          // after its people, and not at all while you are down the street: a slow walk to a shelf
          // and a look along it meanwhile, then another; the plan again once they are there)
          L.st = 'linger';
          L.spot = pick(this.room.browse);
          L.dur = 4 + Math.random() * 6;
          this.go(v, L.spot.x, L.spot.z);
        } else this.goOut(v);
        L.t = 0;
        return null;
      }
      case 'svc':
        // (a pair tried on, a ball bounced, the treadmill, the bikes: game/trylife.js)
        if (this.tries && this.tries.has(L.svc)) return this.tries.visit(v, dt);
        if (!this.counter) {
          L.st = 'next';
          return null;
        }
        return this.counter.visit(v, dt);
      case 'linger': {
        if (v.pts) {
          const m = this.open.follow(v);
          if (m) return { ...m, speed: Math.min(m.speed || 1.2, 0.9) };
          v.pts = null;
          L.t = 0;
        }
        c.faceYaw = L.spot.yaw;
        L.look.set(L.spot.x + Math.sin(L.spot.yaw) * 0.8 + Math.sin(L.t * 0.6 + L.seed) * 0.5, c.pos.y + 1.1, L.spot.z + Math.cos(L.spot.yaw) * 0.8);
        f.lookAt = L.look;
        if (L.t < 1.5) return null;
        L.waited = (L.waited || 0) + L.t;
        L.look2 = (L.look2 || 0) + L.t;
        L.t = 0;
        if (this.zones.length) L.list = this.planList(v);
        if (L.list.length || L.waited >= 90) {
          f.lookAt = null;
          L.look2 = 0;
          L.st = 'next';
        } else if (L.look2 > L.dur) {
          // (enough of this shelf: the next one)
          L.look2 = 0;
          L.dur = 4 + Math.random() * 6;
          L.spot = pick(this.room.browse);
          this.go(v, L.spot.x, L.spot.z);
        }
        return null;
      }
      case 'toTV': {
        const m = this.open.follow(v);
        if (m) return m;
        L.st = 'watchTV';
        L.t = 0;
        return null;
      }
      case 'toZone': {
        const m = this.open.follow(v);
        if (m) return m;
        L.st = 'browse';
        L.t = 0;
        L.dur = 1.4 + Math.random() * 2.2;
        return null;
      }
      case 'browse': {
        // the eyes along the shelf: from one product to the next
        const z = L.zone;
        c.faceYaw = z.yaw;
        const sl = z.slots;
        const k = Math.floor((Math.sin(L.t * 0.9 + L.seed) * 0.5 + 0.5) * (sl.length - 0.01));
        const s = sl[k];
        if (s) {
          L.look.set(s.x, s.y + s.h * 0.6, s.z);
          f.lookAt = L.look;
          // (a low shelf: a bend to see it)
          c.crouchW = s.y - this.room.floor < 0.45 && L.t > L.dur * 0.5 ? 0.45 : 0;
        }
        if (z.what === 'garment' && sl.length > 1) {
          // (a hand along the bar, the hangers pushed along one by one: a look at each)
          const a = sl[0];
          const b = sl[sl.length - 1];
          const k2 = Math.sin(L.t * 0.7 + L.seed) * 0.5 + 0.5;
          f.reachR = L.reach.set(a.x + (b.x - a.x) * k2, a.y + a.h - 0.06, a.z + (b.z - a.z) * k2);
          f.lookAt = L.look.set(f.reachR.x, f.reachR.y - 0.3, f.reachR.z);
          c.crouchW = 0;
        }
        if (L.t < L.dur) return null;
        f.reachR = null;
        const free = this.shelfSlots(z);
        if (!free.length) {
          this.leaveZone(v);
          return null;
        }
        if (Math.random() < 0.18) this.say(c, pick(this.prof.say.shelf), 0.7);
        L.slot = pick(free);
        L.slot.state = 'aim';
        L.t = 0;
        // (behind glass: asked for - the seller takes it out)
        if (this.prof.flow === 'jewel') {
          L.st = 'ask';
          this.say(c, pick(this.prof.say.ask), 0.9);
          return null;
        }
        L.st = z.fridge && this.live && this.live.doors[z.fridge - 1] ? 'openDoor' : 'reach';
        return null;
      }
      case 'openDoor': {
        // a hand to the handle, the door swung open
        const d = this.live && this.live.doors[L.zone.fridge - 1];
        const h = this.handle(L.zone.fridge, L.reach);
        if (!d || !h) {
          L.st = 'reach';
          return null;
        }
        f.reachR = h;
        f.lookAt = h;
        if (L.t > 0.45) this.door(L.zone.fridge, 1);
        if (L.t > 0.95) {
          L.st = 'reach';
          L.t = 0;
          L.opened = L.zone.fridge;
        }
        return null;
      }
      case 'reach': {
        // to the product: bent down for a low one, up on the toes for a high one
        const s = L.slot;
        if (!s || (s.state !== 'aim' && s.state !== 'shelf')) {
          L.st = 'afterItem';
          return null;
        }
        c.faceYaw = Math.atan2(s.x - c.pos.x, s.z - c.pos.z);
        const low = s.y - this.room.floor;
        c.crouchW = low < 0.35 ? 0.75 : low < 0.65 ? 0.4 : 0;
        f.reachR = L.reach.set(s.x, s.y + (s.what === 'garment' ? s.h - 0.08 : Math.min(s.h * 0.5, 0.12)), s.z);
        f.lookAt = f.reachR;
        if (L.t < 0.75) return null;
        // (in the hand now, off the shelf)
        this.setSlot(s, 'held');
        L.item = this.movers.add(s.look, true);
        L.item.slot = s;
        L.item.at = { c, how: 'grip' };
        f.carry = 'held';
        f.reachR = null;
        this.stats.taken++;
        L.st = 'examine';
        L.t = 0;
        L.dur = 1.4 + Math.random() * 1.8;
        return null;
      }
      case 'examine': {
        // held up before the chest and looked at, turned to read the back
        c.crouchW = 0;
        f.reachR = this.showAt(c, L.reach);
        // (a garment held up by its hanger, higher: to see all of it)
        if (L.item && L.item.t.hang) f.reachR.y += 0.32;
        f.lookAt = f.reachR;
        if (L.item) L.item.at = { c, how: 'show', spin: Math.sin(L.t * 1.6 + L.seed) * (L.item.t.hang ? 0.5 : 1.1) };
        if (L.t < L.dur) return null;
        f.reachR = null;
        f.lookAt = null;
        if (L.item) L.item.at = { c, how: 'grip' };
        // (a shoe on a shoe shop's wall, a sports shop's: sat down with it, a size from the stock room -
        // game/trylife.js; or back on its shelf)
        if (this.tries && L.item && L.item.look.line === 'shoe') {
          if (this.tries.decide(v)) return null;
          if (this.prof.flow === 'shoes') {
            L.st = 'putBack';
            return null;
          }
        }
        // (a clothes shop: to the mirror with it, maybe into a fitting room)
        if (this.prof.flow === 'fashion') return this.decideClothes(v);
        // (an electronics shop: the seller comes to show it; headphones put on)
        if (this.prof.flow === 'tech') return this.decideTech(v);
        // put back, or kept
        const keep = Math.random() < 0.74;
        if (!keep) {
          L.st = 'putBack';
          if (Math.random() < 0.3) this.say(c, pick(this.prof.say.back), 0.6);
        } else if (L.basket) L.st = 'toBasket';
        else if (L.got.length === 0) {
          // (no basket: one thing, carried in the hand)
          L.got.push(L.item);
          L.item = null;
          L.st = 'afterItem';
        } else L.st = 'putBack';
        if (keep && Math.random() < 0.15) this.say(c, pick(this.prof.say.keep), 0.6);
        L.t = 0;
        return null;
      }
      case 'putBack': {
        const s = L.slot;
        if (!s || !L.item) {
          L.st = 'afterItem';
          return null;
        }
        c.faceYaw = Math.atan2(s.x - c.pos.x, s.z - c.pos.z);
        const low = s.y - this.room.floor;
        c.crouchW = low < 0.35 ? 0.75 : low < 0.65 ? 0.4 : 0;
        f.reachR = L.reach.set(s.x, s.y + (s.what === 'garment' ? s.h - 0.08 : Math.min(s.h * 0.5, 0.12)), s.z);
        f.lookAt = f.reachR;
        if (L.t < 0.7) return null;
        this.movers.remove(L.item);
        L.item = null;
        this.setSlot(s, 'shelf');
        f.carry = null;
        f.reachR = null;
        this.stats.back++;
        // (a demo put back, the one bought comes boxed: carried to the counter)
        if (L.buy && this.prof.boxed) {
          const bx = this.movers.add({ line: s.what, model: this.prof.boxed.model, cell: this.prof.boxed.cell, tint: this.prof.boxed.tint }, true);
          bx.at = { c, how: 'grip' };
          bx.price = s.what;
          f.carry = 'held';
          L.got.push(bx);
          L.buy = null;
          L.list = [];
        }
        L.st = 'afterItem';
        L.t = 0;
        return null;
      }
      case 'toBasket': {
        // down into the basket on the other arm
        c.crouchW = 0;
        const b = L.basket;
        if (!b || !L.item) {
          L.st = 'afterItem';
          return null;
        }
        f.reachR = L.reach.set(b.pos.x, b.pos.y + 0.24, b.pos.z);
        f.lookAt = f.reachR;
        if (L.t < 0.55) return null;
        L.item.at = { basket: b, k: L.got.length };
        L.got.push(L.item);
        L.item = null;
        f.carry = null;
        f.reachR = null;
        L.st = 'afterItem';
        L.t = 0;
        return null;
      }
      case 'afterItem': {
        f.lookAt = null;
        c.crouchW = 0;
        if (L.slot && L.slot.state === 'aim') L.slot.state = 'shelf';
        L.slot = null;
        // a fridge's door shut behind them
        if (L.opened) {
          const h = this.handle(L.opened, L.reach);
          if (h) {
            f.reachR = h;
            f.lookAt = h;
          }
          if (L.t > 0.3) this.door(L.opened, 0);
          if (L.t < 0.7) return null;
          L.opened = 0;
          f.reachR = null;
          f.lookAt = null;
        }
        // another from the same shelf now and then
        if (L.basket && L.got.length < 5 && Math.random() < 0.28 && this.shelfSlots(L.zone).length) {
          L.st = 'browse';
          L.t = L.dur * 0.6;
          return null;
        }
        this.leaveZone(v);
        return null;
      }
      case 'queue': {
        // in line for the till, facing it; a look at the phone while it takes
        const i = this.queue.indexOf(v);
        const ps = this.room.pay;
        if (i < 0 || !ps || !this.open.open) {
          this.goOut(v);
          return null;
        }
        if (i === 0 && (!this.payer || this.payer === v || !this.payer.c.alive)) {
          this.queue.shift();
          this.payer = v;
          L.st = 'toTill';
          this.go(v, ps.x, ps.z);
          return null;
        }
        const qd = this.room.queueDir || [-Math.sin(ps.yaw), -Math.cos(ps.yaw)];
        const tx = ps.x + qd[0] * 0.85 * (i + 1);
        const tz = ps.z + qd[1] * 0.85 * (i + 1);
        if (L.qi !== i) {
          L.qi = i;
          this.go(v, tx, tz);
        }
        const m = this.open.follow(v);
        if (m) return m;
        c.faceYaw = Math.atan2(ps.x - c.pos.x, ps.z - c.pos.z);
        return null;
      }
      case 'toTill': {
        const m = this.open.follow(v);
        if (m) return m;
        L.st = 'unload';
        L.t = 0;
        L.k = 0;
        return null;
      }
      case 'unload':
        return this.unload(v, dt);
      case 'waitScan': {
        // the cashier at work: watching
        const k = this.open.keeper;
        c.faceYaw = this.room.pay.yaw;
        if (k && k.alive) f.lookAt = k.fig.j.headC;
        if (L.t > 40) this.goOut(v);
        return null;
      }
      case 'pay': {
        // the card out, held to the reader, a beep
        const r = this.marks.reader;
        c.faceYaw = this.room.pay.yaw;
        f.carry = 'card';
        f.cardColor = f.cardColor || pick([[0.3, 0.45, 0.85], [0.85, 0.7, 0.3], [0.2, 0.2, 0.24], [0.85, 0.3, 0.35]]);
        if (r) {
          f.reachR = L.reach.set(r.x, r.y + 0.02, r.z);
          f.lookAt = f.reachR;
        }
        if (L.t > 1.0 && !L.paid) {
          L.paid = true;
          this.open.sound('beep', 0.7, 12);
          this.stats.bought += L.n || 0;
        }
        if (L.t < 1.5) return null;
        f.reachR = null;
        f.lookAt = null;
        f.carry = null;
        L.st = 'waitBag';
        L.t = 0;
        return null;
      }
      case 'waitBag': {
        const k = this.open.keeper;
        c.faceYaw = this.room.pay.yaw;
        if (k && k.alive) f.lookAt = k.fig.j.headC;
        // (the bag is handed over by the cashier: Cashier)
        if (L.bag) {
          f.reachR = null;
          f.lookAt = null;
          if (Math.random() < 0.5) this.say(c, pick(this.prof.say.bye), 0.7);
          if (this.payer === v) this.payer = null;
          L.st = L.basket ? 'toStack' : 'out';
          L.t = 0;
          if (L.basket && this.marks.baskets) this.go(v, this.marks.baskets.x, this.marks.baskets.z);
          else this.goOut(v);
          return null;
        }
        if (L.t > 20) {
          if (this.payer === v) this.payer = null;
          this.goOut(v);
        }
        return null;
      }
      case 'toMirror': {
        const m = this.open.follow(v);
        if (m) return m;
        L.st = 'mirror';
        L.t = 0;
        L.dur = 2.4 + Math.random() * 2;
        return null;
      }
      case 'mirror': {
        // held up against them at the mirror: a turn to one side, to the other
        const mi = L.mirror;
        c.faceYaw = mi.yaw + Math.sin(L.t * 1.3) * 0.35;
        if (L.item) L.item.at = { c, how: 'against' };
        f.reachR = this.showAt(c, L.reach);
        f.reachR.y += 0.22;
        f.lookAt = L.look.set(c.pos.x + Math.sin(mi.yaw) * 2, c.pos.y + 1.4, c.pos.z + Math.cos(mi.yaw) * 2);
        if (L.t > 1 && !L.said) {
          L.said = true;
          this.say(c, pick(this.prof.say.mirror), 0.35);
        }
        if (L.t < L.dur) return null;
        L.said = false;
        f.reachR = null;
        f.lookAt = null;
        if (L.item) L.item.at = { c, how: 'grip' };
        const fit = this.room.fitting || [];
        if (!L.tried && fit.length && Math.random() < 0.55) {
          L.tried = true;
          L.fit = pick(fit);
          L.st = 'toFit';
          this.go(v, L.fit.x, L.fit.z);
        } else this.chooseClothes(v);
        L.t = 0;
        return null;
      }
      case 'toFit': {
        const m = this.open.follow(v);
        if (m) return m;
        // in: the curtain drawn (they are out of sight), the garment with them
        c.inside = true;
        c.fig.setVisible(false);
        if (L.item) L.item.at = { hidden: true };
        L.st = 'fitIn';
        L.t = 0;
        L.dur = 3 + Math.random() * 3;
        return null;
      }
      case 'fitIn':
        if (L.t < L.dur) return null;
        // out again, wearing it (the top's colour theirs for now) - to the mirror
        c.inside = false;
        c.fig.setVisible(true);
        if (L.item && L.item.look.model !== 'trousers' && L.item.look.model !== 'shoe' && c.fig.look && c.fig.look.top) {
          L.orig = c.fig.look.top;
          c.fig.look.top = { ...L.orig, color: L.item.look.tint.slice() };
          if (L.item) L.item.at = { hidden: true };
          L.wearing = true;
          if (this.room.mirrors && this.room.mirrors.length) {
            L.mirror = this.room.mirrors[0];
            L.st = 'wearMirror';
            this.go(v, L.mirror.x, L.mirror.z);
            this.say(c, pick(this.prof.say.out), 0.5);
            return null;
          }
        }
        if (L.item) L.item.at = { c, how: 'grip' };
        this.chooseClothes(v);
        return null;
      case 'wearMirror': {
        const m = this.open.follow(v);
        if (m) return m;
        // a look in the mirror wearing it, turning; then back in to change
        c.faceYaw = L.mirror.yaw + Math.sin(L.t * 1.1) * 0.4;
        if (L.t < 3.2) return null;
        L.st = 'toFit2';
        this.go(v, L.fit.x, L.fit.z);
        L.t = 0;
        return null;
      }
      case 'toFit2': {
        const m = this.open.follow(v);
        if (m) return m;
        c.inside = true;
        c.fig.setVisible(false);
        L.st = 'fitOut';
        L.t = 0;
        return null;
      }
      case 'fitOut':
        if (L.t < 2.2) return null;
        c.inside = false;
        c.fig.setVisible(true);
        if (L.orig) c.fig.look.top = L.orig;
        L.orig = null;
        L.wearing = false;
        if (L.item) L.item.at = { c, how: 'grip' };
        this.chooseClothes(v);
        return null;
      case 'toRail': {
        const m = this.open.follow(v);
        if (m) return m;
        L.st = 'putBack';
        L.t = 0;
        return null;
      }
      case 'demo': {
        // trying it where it lies tied to its table: the screen turned to them, a thumb on it; the
        // seller over to show what it does
        c.faceYaw = L.zone ? L.zone.yaw : c.yaw;
        f.reachR = this.showAt(c, L.reach);
        f.reachR.y -= 0.12;
        f.reachL = L.reachL.set(f.reachR.x + Math.sin(L.t * 3) * 0.03, f.reachR.y + 0.02, f.reachR.z + Math.cos(L.t * 2.3) * 0.03);
        f.lookAt = f.reachR;
        if (L.item) L.item.at = { c, how: 'show', spin: 0 };
        if (L.t < L.dur) return null;
        f.reachL = null;
        f.reachR = null;
        f.lookAt = null;
        if (L.item) L.item.at = { c, how: 'grip' };
        // put back on its table; bought: one in its box, from the counter
        if (Math.random() < 0.4) {
          L.buy = L.item ? L.item.look : null;
          if (Math.random() < 0.5) this.say(c, pick(this.prof.say.keep), 0.7);
        } else if (Math.random() < 0.3) this.say(c, pick(this.prof.say.back), 0.6);
        L.st = 'putBack';
        L.t = 0;
        return null;
      }
      case 'listen': {
        // the headphones on: a nod to the music, a hand to one cup
        c.faceYaw = L.zone ? L.zone.yaw : c.yaw;
        if (L.item) L.item.at = { c, how: 'head' };
        f.reachR = L.reach.set(f.j.headC.x + Math.sin(c.yaw + 1.57) * 0.12, f.j.headC.y - 0.02, f.j.headC.z + Math.cos(c.yaw + 1.57) * 0.12);
        f.lookAt = null;
        if (L.t > 0.8 && !L.said) {
          L.said = true;
          this.say(c, pick(this.prof.say.listen), 0.5);
        }
        if (L.t < L.dur) return null;
        L.said = false;
        f.reachR = null;
        if (L.item) L.item.at = { c, how: 'grip' };
        if (Math.random() < 0.35) L.buy = L.item ? L.item.look : null;
        L.st = 'putBack';
        L.t = 0;
        return null;
      }
      case 'watchTV': {
        // a while before the wall of screens
        c.faceYaw = L.spot.yaw;
        f.lookAt = L.look.set(L.spot.x + Math.sin(L.spot.yaw) * 2, c.pos.y + 1.5, L.spot.z + Math.cos(L.spot.yaw) * 2);
        if (L.t > 1.5 && !L.said) {
          L.said = true;
          this.say(c, pick(this.prof.say.watch), 0.4);
        }
        if (L.t < 4) return null;
        L.said = false;
        f.lookAt = null;
        L.st = 'next';
        return null;
      }
      case 'ask':
        // at the case, pointing at the one they want, waiting for the seller to bring it out
        c.faceYaw = L.zone.yaw;
        if (L.slot) {
          f.reachR = L.reach.set(L.slot.x, L.slot.y + 0.3, L.slot.z);
          f.lookAt = L.look.set(L.slot.x, L.slot.y, L.slot.z);
        }
        if (L.t > 1.4) f.reachR = null;
        if (L.shown) {
          L.st = 'pickTray';
          L.t = 0;
          return null;
        }
        // (one seller, one customer at a time: a while to wait, a glance at the other cases meanwhile)
        if (L.t > 6 && Math.sin(L.t * 0.5 + L.seed) > 0.6) f.lookAt = L.look.set(this.room.center.x, c.pos.y + 1.2, this.room.center.z);
        if (L.t > 50) {
          if (L.slot && L.slot.state === 'aim') L.slot.state = 'shelf';
          L.slot = null;
          this.leaveZone(v);
        }
        return null;
      case 'pickTray': {
        // the thing laid on the tray for them: picked up
        const it = L.shown;
        c.faceYaw = L.zone.yaw;
        f.reachR = L.reach.set(it.pos.x, it.pos.y + 0.03, it.pos.z);
        f.lookAt = f.reachR;
        if (L.t < 0.6) return null;
        it.at = { c, how: 'grip' };
        L.item = it;
        L.shown = null;
        L.st = 'tryOn';
        L.t = 0;
        L.dur = 3 + Math.random() * 2.5;
        return null;
      }
      case 'tryOn': {
        // held up to the light, turned; tried on - a ring on a finger, a watch on the wrist, a necklace
        // at the neck
        const it = L.item;
        c.faceYaw = L.zone.yaw;
        if (!it) {
          L.st = 'next';
          return null;
        }
        if (L.t < L.dur * 0.4) {
          f.reachR = this.showAt(c, L.reach);
          f.reachR.y += 0.25;
          f.lookAt = f.reachR;
          it.at = { c, how: 'show', spin: Math.sin(L.t * 2) * 0.8 };
        } else {
          const w = it.look.model;
          if (w === 'necklace') {
            it.at = { c, how: 'neck' };
            f.reachR = L.reach.set(f.j.headC.x + Math.sin(c.yaw) * 0.12, f.j.headC.y - 0.2, f.j.headC.z + Math.cos(c.yaw) * 0.12);
            f.reachL = L.reachL.copy(f.reachR);
          } else {
            it.at = { c, how: w === 'watch' ? 'wrist' : 'finger' };
            const p = this.showAt(c, L.reach);
            f.reachL = L.reachL.set(p.x, p.y + 0.05, p.z);
            f.reachR = null;
            f.lookAt = f.reachL;
          }
          if (!L.said) {
            L.said = true;
            this.say(c, pick(this.prof.say.tryIt), 0.6);
          }
        }
        if (L.t < L.dur) return null;
        L.said = false;
        f.reachL = null;
        f.reachR = null;
        f.lookAt = null;
        // back on the tray for the seller; bought or not
        const tr = L.tray;
        it.at = tr ? { x: tr.pos.x, y: tr.pos.y + 0.025, z: tr.pos.z, yaw: tr.yaw } : { x: c.pos.x, y: c.pos.y + 1.1, z: c.pos.z };
        const buy = Math.random() < 0.4;
        this.say(c, pick(buy ? this.prof.say.keep : this.prof.say.back), 0.7);
        L.verdict = buy ? 'buy' : 'no';
        L.item = null;
        L.st = 'decided';
        L.t = 0;
        return null;
      }
      case 'decided':
        // the seller takes it back (into the case, or into its box for them)
        c.faceYaw = L.zone.yaw;
        if (L.boxed) {
          L.got.push(L.boxed);
          L.boxed = null;
          L.list = [];
          this.leaveZone(v);
          return null;
        }
        if (!L.verdict || L.t > 25) {
          L.verdict = null;
          this.leaveZone(v);
        }
        return null;
      case 'toStack': {
        const m = this.open.follow(v);
        if (m) return m;
        L.st = 'dropBasket';
        L.t = 0;
        return null;
      }
      case 'dropBasket': {
        // the empty basket back on top of the stack
        const free = this.freeBasket();
        if (!free || !L.basket) {
          if (L.basket) this.movers.remove(L.basket);
          L.basket = null;
          f.carryL = L.bag ? 'bagHeld' : null;
          this.goOut(v);
          return null;
        }
        c.faceYaw = Math.atan2(free.x - c.pos.x, free.z - c.pos.z);
        c.crouchW = 0.35;
        f.reachL = L.reachL.set(free.x, free.y + free.h, free.z);
        if (L.t < 0.7) return null;
        this.movers.remove(L.basket);
        L.basket = null;
        this.setSlot(free, 'shelf');
        f.reachL = null;
        c.crouchW = 0;
        f.carryL = L.bag ? 'bagHeld' : null;
        this.goOut(v);
        return null;
      }
      default:
        return null;
    }
  }

  // (a clothes shop) after a look at it in the hand: back on the rail, or to the mirror with it
  decideClothes(v) {
    const L = v.L;
    L.t = 0;
    if (Math.random() < 0.28) {
      L.st = 'putBack';
      if (Math.random() < 0.3) this.say(v.c, pick(this.prof.say.back), 0.6);
      return null;
    }
    const mi = this.room.mirrors && this.room.mirrors.length ? this.room.mirrors[0] : null;
    if (mi && L.item && L.item.look.line === 'garment') {
      L.mirror = mi;
      L.st = 'toMirror';
      if (L.zone && L.zone.busy === v) L.zone.busy = null;
      this.go(v, mi.x + (Math.random() - 0.5) * 0.6, mi.z + (Math.random() - 0.5) * 0.6);
      return null;
    }
    return this.chooseClothes(v);
  }

  // (an electronics shop) a phone or a laptop tried where it lies; headphones put on
  decideTech(v) {
    const L = v.L;
    L.t = 0;
    const w = L.item ? L.item.look.model : null;
    if (w === 'headphones') {
      L.st = 'listen';
      L.dur = 2.5 + Math.random() * 2;
      return null;
    }
    L.st = 'demo';
    L.dur = 4 + Math.random() * 4;
    if (this.S && !this.S.job) this.S.call = v;
    else if (this.S) this.S.call = this.S.call || v;
    return null;
  }

  // bought, or put back on its rail
  chooseClothes(v) {
    const L = v.L;
    L.t = 0;
    if (!L.item) {
      this.leaveZone(v);
      return null;
    }
    if (Math.random() < 0.55) {
      L.got.push(L.item);
      L.item = null;
      if (Math.random() < 0.4) this.say(v.c, pick(this.prof.say.keep), 0.6);
      L.list = [];
      this.leaveZone(v);
      return null;
    }
    // (back to where it came from, and onto the bar)
    const s = L.slot;
    if (s && s.zx !== null && Math.hypot(s.zx - v.c.pos.x, s.zz - v.c.pos.z) > 0.6) {
      L.st = 'toRail';
      this.go(v, s.zx, s.zz);
    } else L.st = 'putBack';
    return null;
  }

  // off the shelf they were at: the next part of the shop
  leaveZone(v) {
    const L = v.L;
    if (L.zone && L.zone.busy === v) L.zone.busy = null;
    L.zone = null;
    L.st = 'next';
    L.t = 0;
  }

  // a fridge's door handle (i: the door + 1), where a hand takes it
  handle(i, out) {
    const d = this.live && this.live.doors[i - 1];
    if (!d) return null;
    const z = this.zones.find((q) => q.fridge === i);
    if (!z) return null;
    // (between the hinge and the products, at a hand's height, a little out from the glass)
    let cx = 0;
    let cz = 0;
    for (const s of z.slots) {
      cx += s.x;
      cz += s.z;
    }
    cx /= z.slots.length || 1;
    cz /= z.slots.length || 1;
    const ox = z.x - cx;
    const oz = z.z - cz;
    const ol = Math.hypot(ox, oz) || 1;
    const a = d.sign * d.open * 1.75;
    // the handle's place on the door as it is now: from the hinge, turned with the door
    const hx = cx + (cx - d.hx) * 0.55 + (ox / ol) * 0.2;
    const hz = cz + (cz - d.hz) * 0.55 + (oz / ol) * 0.2;
    const x = hx - d.hx;
    const z2 = hz - d.hz;
    return out.set(d.hx + x * Math.cos(a) + z2 * Math.sin(a), this.room.floor + 1.18, d.hz - x * Math.sin(a) + z2 * Math.cos(a));
  }

  // at the till: what they chose onto the belt, one thing after another
  unload(v, dt) {
    const c = v.c;
    const f = c.fig;
    const L = v.L;
    c.faceYaw = this.room.pay.yaw;
    const belt = this.marks.belt;
    const belt2 = this.marks.belt2 || belt;
    const it = L.got[0];
    if (!it || !belt) {
      L.st = 'waitScan';
      L.t = 0;
      f.reachR = null;
      f.lookAt = null;
      return null;
    }
    const k = this.belt.length;
    const tx = belt.x + (belt2.x - belt.x) * Math.min(1, k * 0.34);
    const tz = belt.z + (belt2.z - belt.z) * Math.min(1, k * 0.34);
    if (!L.from) {
      // first out of the basket (or from the hand)
      L.from = true;
      L.t = 0;
    }
    if (it.at && it.at.basket) {
      f.reachR = L.reach.set(it.pos.x, it.pos.y + 0.1, it.pos.z);
      f.lookAt = f.reachR;
      if (L.t > 0.45) {
        it.at = { c, how: 'grip' };
        f.carry = 'held';
        L.t = 0;
      }
      return null;
    }
    f.reachR = L.reach.set(tx, belt.y + 0.06, tz);
    f.lookAt = f.reachR;
    if (L.t < 0.5) return null;
    it.at = { x: tx, y: belt.y, z: tz, yaw: Math.atan2(c.pos.x - tx, c.pos.z - tz) + (Math.random() - 0.5) * 0.6, tilt: it.t.hang ? -Math.PI / 2 : 0, flat: !!it.t.hang };
    L.got.shift();
    L.n = (L.n || 0) + 1;
    this.belt.push({ it, v });
    f.carry = null;
    L.from = false;
    L.t = 0;
    if (!L.got.length) {
      f.reachR = null;
      f.lookAt = null;
      L.st = 'waitScan';
      if (L.basket) f.carryL = 'basketHeld';
    }
    void dt;
    return null;
  }

  // out of the door: an ordinary customer's way out (game/streetlife.js OpenShop.leave)
  goOut(v) {
    const L = v.L;
    const c = v.c;
    this.unwear(v);
    const qi = this.queue.indexOf(v);
    if (qi >= 0) this.queue.splice(qi, 1);
    if (this.payer === v) this.payer = null;
    if (L.zone && L.zone.busy === v) L.zone.busy = null;
    if (L.slot && L.slot.state === 'aim') L.slot.state = 'shelf';
    c.crouchW = 0;
    c.fig.reachR = null;
    c.fig.reachL = null;
    c.fig.lookAt = null;
    // (whatever is still in a hand goes back where it came from: not out of the shop unpaid)
    if (L.item) this.giveBack(L.item);
    L.item = null;
    for (const it of L.got) this.giveBack(it);
    L.got = [];
    if (L.basket) {
      const free = this.freeBasket();
      this.movers.remove(L.basket);
      if (free) this.setSlot(free, 'shelf');
      L.basket = null;
    }
    if (c.fig.carry === 'held') c.fig.carry = null;
    if (c.fig.carryL === 'basketHeld') c.fig.carryL = L.bag ? 'bagHeld' : null;
    L.st = 'gone';
    v.life = false;
    this.open.leave(v);
    // (OpenShop.leave lets go of the hands: the bag stays in its hand)
    if (L.bag) c.fig.carryL = 'bagHeld';
  }

  // (a clothes shop) whoever was in a fitting room, or out of it wearing something: themselves again
  unwear(v) {
    const L = v.L;
    const c = v.c;
    if (L.orig && c.fig.look) c.fig.look.top = L.orig;
    L.orig = null;
    L.wearing = false;
    if (c.inside) {
      c.inside = false;
      c.fig.setVisible(true);
    }
    if (L.item && L.item.at && L.item.at.hidden) L.item.at = { c, how: 'grip' };
  }

  // a thing back on its shelf, as if it had not left it (it was not bought)
  giveBack(it) {
    this.movers.remove(it);
    if (it.slot && it.slot.state !== 'shelf') this.setSlot(it.slot, 'shelf');
  }

  // a frightened customer (or one rubbed out): let go of at once - what was in their hands falls
  // to the floor where they stood (game/streetlife.js OpenShop.drop)
  release(v) {
    const L = v.L;
    if (!L) return;
    if (this.counter) this.counter.release(v);
    if (this.tries) this.tries.release(v);
    const c = v.c;
    this.unwear(v);
    const qi = this.queue.indexOf(v);
    if (qi >= 0) this.queue.splice(qi, 1);
    if (this.payer === v) this.payer = null;
    if (L.zone && L.zone.busy === v) L.zone.busy = null;
    if (L.slot && L.slot.state === 'aim') L.slot.state = 'shelf';
    if (L.opened) this.door(L.opened, 0);
    // (everything in their hands and their basket on the floor where they stood; what they had put
    // on the belt stays on the counter - the staff put it all back)
    for (const it of [L.item, ...L.got, L.basket]) if (it) this.drop(it, c.pos.x, c.pos.z);
    for (const b of this.belt.filter((q) => q.v === v)) {
      this.belt.splice(this.belt.indexOf(b), 1);
      if (!this.floor.includes(b.it)) this.floor.push(b.it);
    }
    if (L.bag) {
      this.movers.remove(L.bag);
      c.fig.carryL = 'bag';
    }
    if (c.fig.carry === 'held') c.fig.carry = null;
    if (c.fig.carryL === 'basketHeld' || c.fig.carryL === 'bagHeld') c.fig.carryL = c.fig.carryL === 'bagHeld' ? 'bag' : null;
    L.item = null;
    L.got = [];
    L.basket = null;
    L.st = 'gone';
    v.life = false;
  }

  // a thing let fall: on the floor, on its side, a little way off
  drop(it, x, z) {
    const a = Math.random() * 6.28;
    const r = 0.2 + Math.random() * 0.4;
    it.at = { x: x + Math.cos(a) * r, y: this.room.floor, z: z + Math.sin(a) * r, yaw: Math.random() * 6.28, tilt: it.look.model === 'basket' ? 0 : Math.PI / 2, fallen: true };
    if (!this.floor.includes(it)) this.floor.push(it);
    this.stats.dropped++;
  }

  // ---------------------------------------------------------------- the cashier
  // (the keeper of the shop: game/streetlife.js OpenShop.workInside) - serving whoever is at the till,
  // and between them the counter wiped, the keys, a look round; a word to whoever comes in
  keeper(c, dt) {
    const f = c.fig;
    const K = (this.K = this.K || { st: 'idle', t: 0, act: 'look', actT: 0, reach: new THREE.Vector3(), look: new THREE.Vector3() });
    K.t += dt;
    // (held up: hands up, the till into a bag - game/shopper.js)
    if (this.you.rob && this.you.rob.k === c) {
      if (K.hold) {
        this.giveBack(K.hold);
        K.hold = null;
      }
      return this.you.robKeeper(c, dt);
    }
    const home = this.open.home;
    const yaw = this.open.homeYaw;
    const pv = this.payer;
    // serving: the belt has their things and they are at the till
    if (pv && pv.L && (pv.L.st === 'waitScan' || pv.L.st === 'unload' || pv.L.st === 'pay' || pv.L.st === 'card' || pv.L.st === 'waitBag')) return this.serve(c, pv, dt);
    if (K.hold) {
      // (the one being served went: what was in the hand back where it came from)
      this.giveBack(K.hold);
      K.hold = null;
      f.carry = null;
    }
    if (K.bag && !this.payer) {
      this.movers.remove(K.bag);
      K.bag = null;
    }
    // a greeting for whoever comes in (the player: game/shoplife.js update)
    if (K.greet && K.greet.until > this.game.time) {
      const g = K.greet;
      f.reachR = null;
      f.carry = null;
      f.lookAt = g.c && g.c.fig ? g.c.fig.j.headC : null;
      c.faceYaw = g.c ? Math.atan2(g.c.pos.x - c.pos.x, g.c.pos.z - c.pos.z) : yaw;
      return { x: home.x, z: home.z, speed: 0.6 };
    }
    K.actT -= dt;
    if (K.actT <= 0) {
      const acts = ['look', 'wipe', 'keys', 'look', 'tidy'];
      K.act = pick(acts.filter((a) => a !== K.act));
      K.actT = K.act === 'wipe' ? 5 + Math.random() * 4 : K.act === 'keys' ? 2.5 + Math.random() * 2 : 3 + Math.random() * 4;
      K.t = 0;
    }
    f.lookAt = null;
    switch (K.act) {
      case 'wipe': {
        // a cloth round and round over the counter
        const m = this.marks.wipe;
        f.carry = 'cloth';
        if (m) {
          const a = K.t * 3.2;
          f.reachR = K.reach.set(m.x + Math.cos(a) * 0.16 + Math.sin(K.t * 0.7) * 0.25, m.y + 0.03, m.z + Math.sin(a) * 0.12);
          f.lookAt = f.reachR;
          c.faceYaw = Math.atan2(m.x - c.pos.x, m.z - c.pos.z);
        }
        break;
      }
      case 'keys': {
        // at the till: a few keys pressed, a look at the screen
        const m = this.marks.keys;
        f.carry = null;
        if (m) {
          const k = Math.floor(K.t * 3.5);
          f.reachR = K.reach.set(m.x + ((k * 37) % 5) * 0.012 - 0.02, m.y + 0.02 + (K.t * 3.5 - k < 0.4 ? 0 : 0.03), m.z + ((k * 13) % 3) * 0.015);
          f.lookAt = K.look.set(m.x, m.y + 0.35, m.z);
          c.faceYaw = Math.atan2(m.x - c.pos.x, m.z - c.pos.z);
        }
        break;
      }
      case 'tidy': {
        // the bags straightened on their hooks, the counter's things put square
        const m = this.marks.bag;
        f.carry = null;
        if (m) {
          f.reachR = K.reach.set(m.x + Math.sin(K.t * 2.2) * 0.08, m.y + 0.05, m.z + Math.cos(K.t * 1.7) * 0.05);
          f.lookAt = f.reachR;
          c.faceYaw = Math.atan2(m.x - c.pos.x, m.z - c.pos.z);
        }
        break;
      }
      default: {
        // a look round the shop: at a customer now and then
        f.carry = null;
        f.reachR = null;
        const vs = this.open.visitors.filter((q) => q.c.alive && q.L);
        if (vs.length && Math.sin(K.t * 0.8) > 0.3) {
          const q = vs[Math.floor(K.t / 2.5) % vs.length];
          f.lookAt = q.c.fig.j.headC;
        }
        c.faceYaw = yaw + Math.sin(K.t * 0.4) * 0.5;
      }
    }
    return { x: home.x, z: home.z, speed: 0.6 };
  }

  // serving the one at the till: each thing off the belt, over the scanner, into the bag; the total;
  // the card; the bag handed over
  serve(c, pv, dt) {
    const f = c.fig;
    const K = this.K;
    const home = this.open.home;
    const scan = this.marks.scan;
    const bag = this.marks.bag;
    if (K.serving !== pv) {
      K.serving = pv;
      K.sst = 'hello';
      K.t = 0;
      K.n = 0;
      K.sum = 0;
      this.say(c, pick(this.prof.say.found), 0.7);
    }
    f.lookAt = null;
    switch (K.sst) {
      case 'hello':
        f.carry = null;
        f.reachR = null;
        f.lookAt = pv.c.fig.j.headC;
        c.faceYaw = Math.atan2(pv.c.pos.x - c.pos.x, pv.c.pos.z - c.pos.z);
        if (K.t > 0.8 && this.belt.some((b) => b.v === pv)) {
          K.sst = 'take';
          K.t = 0;
        }
        if (K.t > 1.2 && pv.L.st === 'waitScan' && !this.belt.some((b) => b.v === pv)) {
          K.sst = 'total';
          K.t = 0;
        }
        break;
      case 'take': {
        // a hand to the next thing on the belt
        const b = this.belt.find((q) => q.v === pv);
        if (!b) {
          if (pv.L.st === 'waitScan') {
            K.sst = 'total';
            K.t = 0;
          }
          break;
        }
        f.reachR = K.reach.set(b.it.pos.x, b.it.pos.y + 0.05, b.it.pos.z);
        f.lookAt = f.reachR;
        c.faceYaw = Math.atan2(b.it.pos.x - c.pos.x, b.it.pos.z - c.pos.z);
        if (K.t > 0.45) {
          this.belt.splice(this.belt.indexOf(b), 1);
          K.hold = b.it;
          K.t = 0;
          if (this.prof.flow === 'fashion' && b.it.t.hang) {
            // (a garment: folded where it lies - off its hanger, sleeves in, in half)
            K.sst = 'fold';
            break;
          }
          K.hold.at = { c, how: 'grip' };
          f.carry = 'held';
          K.sst = 'scan';
        }
        break;
      }
      case 'fold': {
        // both hands at it, folding; then it is a folded shirt, the hanger aside
        const it = K.hold;
        const m = this.marks.fold || this.marks.belt;
        if (!it || !m) {
          K.sst = 'take';
          break;
        }
        const k = Math.sin(K.t * 5);
        f.reachR = K.reach.set(m.x + k * 0.1, m.y + 0.06 + Math.abs(k) * 0.05, m.z);
        f.reachL = K.look.set(m.x - k * 0.1, m.y + 0.06, m.z + 0.02);
        f.lookAt = f.reachR;
        if (K.t > 0.6 && !K.folded) {
          K.folded = true;
          const look = { line: 'folded', model: 'folded', cell: null, tint: it.look.tint };
          const slot = it.slot;
          this.movers.remove(it);
          K.hold = this.movers.add(look, true);
          K.hold.slot = slot;
          K.hold.price = it.price;
          K.hold.at = { x: m.x, y: m.y, z: m.z, yaw: this.open.homeYaw };
          this.open.sound('pageflip', 0.4, 10);
        }
        if (K.t > 1.5) {
          K.folded = false;
          f.reachL = null;
          K.sst = 'bag';
          K.t = 0;
        }
        break;
      }
      case 'scan':
        // over the glass: a beep
        if (scan) {
          f.reachR = K.reach.set(scan.x, scan.y + 0.04, scan.z);
          f.lookAt = f.reachR;
        }
        if (K.t > 0.32 && !K.beeped) {
          K.beeped = true;
          this.open.sound('beep', 0.6, 12);
          this.stats.scanned++;
        }
        if (K.t > 0.5) {
          K.beeped = false;
          K.sst = 'bag';
          K.t = 0;
        }
        break;
      case 'bag':
        // into the bag at the counter's end
        if (bag) {
          f.reachR = K.reach.set(bag.x, bag.y + 0.2, bag.z);
          f.lookAt = f.reachR;
        }
        if (!K.bag && bag) {
          K.bag = this.movers.add(this.prof.flow === 'fashion' ? { line: 'bag', model: 'paperBag', cell: 'bag.chic', tint: [0.95, 0.93, 0.89] } : { line: 'bag', model: 'paperBag', cell: 'bag.thanks', tint: [0.79, 0.64, 0.45] }, true);
          K.bag.at = { x: bag.x, y: bag.y - 0.01, z: bag.z, yaw: this.open.homeYaw + Math.PI / 2 };
        }
        if (K.t > 0.45) {
          if (K.hold) {
            this.movers.remove(K.hold);
            const what = K.hold.slot ? K.hold.slot.what : null;
            K.sum += K.hold.price || this.prof.prices[what] || 2;
            if (K.hold.slot) this.setSlot(K.hold.slot, 'gone');
            K.hold = null;
            K.n++;
          }
          f.carry = null;
          K.sst = 'take';
          K.t = 0;
        }
        break;
      case 'total':
        f.reachR = null;
        f.lookAt = pv.c.fig.j.headC;
        c.faceYaw = Math.atan2(pv.c.pos.x - c.pos.x, pv.c.pos.z - c.pos.z);
        if (K.t > 0.2 && !K.said) {
          K.said = true;
          const n = Math.max(1, Math.round(K.sum || K.n * 2));
          this.say(c, pick(this.prof.say.total(n)), 0.85);
          // (the till's drawer: a tap on its key)
          this.open.sound('till', 0.25, 12);
        }
        if (K.t > 0.9 && pv.L.st === 'waitScan') {
          pv.L.st = 'pay';
          pv.L.t = 0;
        }
        if (pv.L.st === 'waitBag' && K.t > 1) {
          K.said = false;
          K.sst = 'hand';
          K.t = 0;
        }
        break;
      case 'hand': {
        // the bag lifted and handed across the counter
        if (K.bag && K.t < 0.5 && bag) {
          f.reachR = K.reach.set(bag.x, bag.y + 0.3, bag.z);
          f.lookAt = f.reachR;
          break;
        }
        if (K.bag && K.bag.at && K.bag.at.x !== undefined) {
          K.bag.at = { c, how: 'bag' };
          f.carry = 'held';
        }
        const mid = _a.copy(c.pos).lerp(pv.c.pos, 0.5);
        f.reachR = K.reach.set(mid.x, c.pos.y + 1.05, mid.z);
        f.lookAt = pv.c.fig.j.headC;
        pv.c.fig.reachL = pv.L.reachL.set(mid.x, c.pos.y + 1.05, mid.z);
        if (K.t > 1.2) {
          // (theirs now)
          if (K.bag) {
            K.bag.at = { c: pv.c, how: 'carried' };
            pv.L.bag = K.bag;
            pv.c.fig.carryL = pv.L.basket ? 'basketHeld' : 'bagHeld';
            this.stats.bags++;
          } else pv.L.bag = true;
          K.bag = null;
          pv.c.fig.reachL = null;
          f.reachR = null;
          f.carry = null;
          this.say(c, pick(this.prof.say.thanks), 0.8);
          K.serving = null;
          K.sst = 'done';
          K.t = 0;
        }
        break;
      }
      default:
        break;
    }
    void dt;
    return { x: home.x, z: home.z, speed: 0.6 };
  }

  // ---------------------------------------------------------------- the one who fills the shelves
  spawnStocker(look) {
    const R = this.room;
    const st = this.marks.stock || { x: R.center.x, z: R.center.z };
    const c = this.game.civilians.spawnScripted(st.x, st.z, look, this.open);
    c.noCollide = true;
    c.exitRoom = R;
    c.exitShop = this.shop;
    const S = (this.S = { c, st: 'idle', t: 0, reach: new THREE.Vector3(), look: new THREE.Vector3(), job: null, box: null, item: null, todo: [] });
    c.ctrl = (civ, dt) => this.stocker(civ, dt);
    void S;
    return c;
  }

  // (whatever they are doing, a look over at you a moment when you have taken something near them)
  stocker(c, dt) {
    const m = this.stockerWork(c, dt);
    const S = this.S;
    if (S && S.c === c && S.glance && S.glance.until > this.game.time && S.glance.c.fig) c.fig.lookAt = S.glance.c.fig.j.headC;
    return m;
  }

  stockerWork(c, dt) {
    const S = this.S;
    if (!S || S.c !== c) return null;
    // (a deli's clerk, a pharmacist: behind the counter all day - game/counterlife.js)
    if (this.counter && this.counter.kind) return this.counter.staff(c, dt);
    // (a shoe shop's: to the stock room for a size, the box to the bench; the boxes left there taken
    // back - game/trylife.js)
    if (this.tries && S.st && S.st.startsWith('try')) return this.tries.staff(c, S, dt);
    const f = c.fig;
    // (somebody on a bench waiting for a size: the facing and the scanning can wait)
    if (this.tries && (S.st === 'toZone' || S.st === 'face' || S.st === 'check') && this.tries.waiting()) {
      f.reachR = null;
      f.lookAt = null;
      if (f.carry === 'scanner') f.carry = null;
      c.crouchW = 0;
      S.st = 'idle';
      S.job = null;
    }
    S.t += dt;
    const v = S;
    const walk = () => this.open.follow(v);
    switch (S.st) {
      case 'idle': {
        f.reachR = null;
        f.lookAt = null;
        c.crouchW = 0;
        // what needs doing: the floor first, then the empty places, then the tidying
        const fallen = this.floor.find((it) => !it.claimed);
        const gone = [];
        for (const z of this.zones) for (const s of z.slots) if (s.state === 'gone') gone.push(s);
        // (a size wanted from the stock room, a box left on a bench: game/trylife.js)
        if (this.tries && !fallen) {
          const r = this.tries.job(c, S);
          if (r !== undefined) return r;
        }
        if (this.prof.flow === 'fashion' && !fallen) return this.associate(c, S);
        if (this.prof.flow === 'tech' && !fallen && S.call) return this.explainGo(c, S);
        if (this.prof.flow === 'jewel') return this.seller(c, S);
        if (fallen) {
          fallen.claimed = true;
          S.job = { kind: 'pickup', it: fallen };
          S.st = 'toFloor';
          this.goS(c, fallen.at.x, fallen.at.z, 0.45);
        } else if (gone.length >= 2 || (gone.length && Math.random() < 0.4)) {
          S.job = { kind: 'restock', slots: gone.slice(0, 5) };
          S.st = 'toStock';
          const m = this.marks.stock;
          if (m) this.goS(c, m.x, m.z);
          else S.st = 'idle';
          if (Math.random() < 0.3) this.say(c, pick(this.prof.say.stock), 0.6);
        } else {
          const z = pick(this.zones);
          if (!z) return null;
          S.job = { kind: Math.random() < 0.6 ? 'face' : 'check', z, k: 0 };
          S.st = 'toZone';
          this.goS(c, z.x, z.z);
        }
        S.t = 0;
        return null;
      }
      case 'toFloor': {
        const m = walk();
        if (m) return { ...m, speed: 1.0 };
        S.st = 'pickup';
        S.t = 0;
        return null;
      }
      case 'pickup': {
        // bent down: the thing that fell, back in the hand
        const it = S.job.it;
        c.crouchW = it.pos.y - this.room.floor < 0.5 ? 0.8 : 0;
        f.reachR = S.reach.set(it.pos.x, it.pos.y + 0.05, it.pos.z);
        f.lookAt = f.reachR;
        if (S.t < 0.9) return null;
        const i = this.floor.indexOf(it);
        if (i >= 0) this.floor.splice(i, 1);
        if (it.look.model === 'basket') {
          // (a basket: back on the stack)
          const free = this.freeBasket();
          this.movers.remove(it);
          if (free) this.setSlot(free, 'shelf');
          S.st = 'idle';
          c.crouchW = 0;
          return null;
        }
        it.at = { c, how: 'grip' };
        f.carry = 'held';
        S.item = it;
        c.crouchW = 0;
        const s = it.slot;
        if (s && s.zx !== null) {
          S.st = 'toSlot';
          this.goS(c, s.zx, s.zz);
        } else {
          this.movers.remove(it);
          S.item = null;
          f.carry = null;
          S.st = 'idle';
        }
        S.t = 0;
        return null;
      }
      case 'toSlot': {
        const m = walk();
        if (m) return { ...m, speed: 1.0 };
        S.st = 'putSlot';
        S.t = 0;
        return null;
      }
      case 'putSlot': {
        const it = S.item;
        const s = it && it.slot;
        if (!s) {
          S.st = 'idle';
          return null;
        }
        c.faceYaw = Math.atan2(s.x - c.pos.x, s.z - c.pos.z);
        const low = s.y - this.room.floor;
        c.crouchW = low < 0.35 ? 0.75 : low < 0.65 ? 0.4 : 0;
        f.reachR = S.reach.set(s.x, s.y + Math.min(0.12, s.h * 0.5), s.z);
        f.lookAt = f.reachR;
        if (S.t < 0.7) return null;
        this.movers.remove(it);
        this.setSlot(s, 'shelf');
        S.item = null;
        f.carry = null;
        f.reachR = null;
        c.crouchW = 0;
        S.st = 'idle';
        S.t = 0;
        return null;
      }
      case 'toStock': {
        const m = walk();
        if (m) return { ...m, speed: 1.0 };
        S.st = 'grabBox';
        S.t = 0;
        return null;
      }
      case 'grabBox': {
        // the box from the stock room's door: bent down, lifted in both hands
        const m = this.marks.stock;
        c.faceYaw = m ? m.yaw : c.yaw;
        c.crouchW = S.t < 0.8 ? 0.7 : 0;
        if (S.t < 1.2) return null;
        S.box = this.movers.add(this.prof.flow === 'fashion' ? { line: 'bag', model: 'paperBag', cell: 'bag.chic', tint: [0.95, 0.93, 0.89] } : { line: 'box', model: 'stockBox', cell: 'box.stock', tint: [0.78, 0.63, 0.43] }, true);
        S.box.at = { c, how: 'box' };
        f.carry = 'boxHeld';
        // (to where the empty places are)
        const s = S.job.slots[0];
        if (!s || s.zx === null) {
          S.st = 'stow';
          return null;
        }
        S.st = 'toShelf';
        this.goS(c, s.zx, s.zz);
        S.t = 0;
        return null;
      }
      case 'toShelf': {
        const m = walk();
        if (m) return { ...m, speed: 0.95 };
        S.st = 'boxDown';
        S.t = 0;
        return null;
      }
      case 'boxDown': {
        // the box set down at their feet, by the shelf
        c.crouchW = 0.75;
        if (S.t < 0.7) return null;
        const fx = Math.sin(c.yaw);
        const fz = Math.cos(c.yaw);
        S.box.at = { x: c.pos.x + fx * 0.15 - fz * 0.4, y: this.room.floor, z: c.pos.z + fz * 0.15 + fx * 0.4, yaw: c.yaw };
        f.carry = null;
        S.st = 'fromBox';
        S.t = 0;
        return null;
      }
      case 'fromBox': {
        // a hand into the box: the next one out
        const s = S.job.slots.find((q) => q.state === 'gone');
        if (!s) {
          S.st = 'boxUp';
          S.t = 0;
          return null;
        }
        c.crouchW = 0.75;
        const b = S.box.at;
        f.reachR = S.reach.set(b.x, b.y + 0.22, b.z);
        f.lookAt = f.reachR;
        if (S.t < 0.6) return null;
        s.state = 'refill';
        S.item = this.movers.add(s.look, true);
        S.item.slot = s;
        S.item.at = { c, how: 'grip' };
        f.carry = 'held';
        S.st = 'fill';
        S.t = 0;
        return null;
      }
      case 'fill': {
        // onto the shelf, in its place
        const it = S.item;
        const s = it && it.slot;
        if (!s) {
          S.st = 'fromBox';
          return null;
        }
        c.faceYaw = Math.atan2(s.x - c.pos.x, s.z - c.pos.z);
        const low = s.y - this.room.floor;
        c.crouchW = low < 0.35 ? 0.75 : low < 0.65 ? 0.35 : 0;
        f.reachR = S.reach.set(s.x, s.y + (s.what === 'garment' ? s.h - 0.08 : Math.min(0.12, s.h * 0.5)), s.z);
        f.lookAt = f.reachR;
        if (S.t < 0.65) return null;
        this.movers.remove(it);
        this.setSlot(s, 'shelf');
        S.item = null;
        f.carry = null;
        this.stats.restocked++;
        S.st = 'fromBox';
        S.t = 0;
        return null;
      }
      case 'boxUp': {
        c.crouchW = 0.75;
        f.reachR = null;
        if (S.t < 0.6) return null;
        S.box.at = { c, how: 'box' };
        f.carry = 'boxHeld';
        c.crouchW = 0;
        const m = this.marks.stock;
        S.st = 'stow';
        if (m) this.goS(c, m.x, m.z);
        S.t = 0;
        return null;
      }
      case 'stow': {
        const m = walk();
        if (m) return { ...m, speed: 1.0 };
        if (S.box) this.movers.remove(S.box);
        S.box = null;
        f.carry = null;
        S.st = 'idle';
        S.t = 0;
        return null;
      }
      case 'toZone': {
        const m = walk();
        if (m) return { ...m, speed: 0.95 };
        S.st = S.job.kind;
        S.t = 0;
        if (S.job.kind === 'check') f.carry = 'scanner';
        return null;
      }
      case 'face': {
        // the products pulled to the front of the shelf one by one, their labels turned out
        const z = S.job.z;
        c.faceYaw = z.yaw;
        const sl = z.slots;
        const s = sl[Math.floor(S.t / 0.9) % sl.length];
        if (s) {
          const low = s.y - this.room.floor;
          c.crouchW = low < 0.35 ? 0.7 : 0;
          const k = (S.t % 0.9) / 0.9;
          f.reachR = S.reach.set(s.x + Math.sin(k * 6.28) * 0.02, s.y + 0.08, s.z + Math.cos(k * 6.28) * 0.02);
          f.lookAt = f.reachR;
        }
        if (S.t > 3.6 + Math.random() * 0.02) {
          f.reachR = null;
          S.st = 'idle';
        }
        return null;
      }
      case 'check': {
        // the scanner along the shelf, low and high, a look at its screen
        const z = S.job.z;
        c.faceYaw = z.yaw;
        const sl = z.slots;
        const s = sl[Math.floor(S.t / 1.2) % sl.length];
        if (s) {
          c.crouchW = S.t > 2.5 && S.t < 4 ? 0.6 : 0;
          S.look.set(s.x, s.y + 0.1, s.z);
          f.lookAt = S.look;
        }
        if (S.t > 5) {
          f.carry = null;
          f.lookAt = null;
          c.crouchW = 0;
          S.st = 'idle';
        }
        return null;
      }
      case 'toExplain': {
        const m = walk();
        if (m) return { ...m, speed: 1.0 };
        S.st = 'explain';
        S.t = 0;
        S.n = 0;
        return null;
      }
      case 'explain': {
        // beside them, turned to them: a hand to the thing they hold, a word on what it does; their word
        const v2 = S.job.v;
        if (!v2 || !v2.c.alive || !v2.L || v2.L.st !== 'demo' || S.t > 9) {
          f.reachR = null;
          f.lookAt = null;
          S.st = 'idle';
          return null;
        }
        c.faceYaw = Math.atan2(v2.c.pos.x - c.pos.x, v2.c.pos.z - c.pos.z);
        f.lookAt = S.t % 3 < 1.6 ? v2.c.fig.j.headC : v2.L.item ? v2.L.item.pos : null;
        if (v2.L.item && S.t % 3 > 0.4 && S.t % 3 < 1.4) f.reachR = S.reach.set(v2.L.item.pos.x, v2.L.item.pos.y + 0.05, v2.L.item.pos.z);
        else f.reachR = null;
        if (S.t > S.n * 3 + 0.3) {
          S.n++;
          if (S.n % 2) this.say(c, pick(this.prof.say.explain), 0.9);
          else this.say(v2.c, pick(this.prof.say.reply), 0.8);
          // (they stay a little longer with it while it is explained)
          v2.L.dur = Math.max(v2.L.dur, v2.L.t + 2.5);
        }
        return null;
      }
      case 'toCase': {
        const m = walk();
        if (m) return { ...m, speed: 0.9 };
        S.st = 'takeOut';
        S.t = 0;
        return null;
      }
      case 'takeOut': {
        // bent to the case from behind, a hand in: the thing out of its place
        const v2 = S.job.v;
        const s = v2 && v2.L ? v2.L.slot : null;
        if (!s || !v2.c.alive) {
          S.st = 'idle';
          return null;
        }
        c.faceYaw = Math.atan2(s.x - c.pos.x, s.z - c.pos.z);
        c.crouchW = 0.25;
        f.reachR = S.reach.set(s.x, s.y + 0.02, s.z);
        f.lookAt = f.reachR;
        if (S.t < 0.9) return null;
        this.setSlot(s, 'held');
        S.item = this.movers.add(s.look, true);
        S.item.slot = s;
        S.item.at = { c, how: 'grip' };
        c.crouchW = 0;
        S.st = 'lay';
        S.t = 0;
        return null;
      }
      case 'lay': {
        // on a velvet tray on the glass before them
        const v2 = S.job.v;
        if (!v2 || !v2.c.alive || !v2.L) {
          if (S.item) this.giveBack(S.item);
          S.item = null;
          S.st = 'idle';
          return null;
        }
        const s = v2.L.slot;
        const tx = s.x + (v2.c.pos.x - s.x) * 0.35;
        const tz = s.z + (v2.c.pos.z - s.z) * 0.35;
        const ty = s.y + 0.26;
        f.reachR = S.reach.set(tx, ty + 0.05, tz);
        f.lookAt = v2.c.fig.j.headC;
        if (S.t < 0.6) return null;
        const tray = this.movers.add({ line: 'tray', model: 'tray', cell: null, tint: [0.1, 0.12, 0.22] }, true);
        tray.at = { x: tx, y: ty, z: tz, yaw: Math.atan2(v2.c.pos.x - tx, v2.c.pos.z - tz) };
        S.item.at = { x: tx, y: ty + 0.025, z: tz, yaw: tray.at.yaw };
        v2.L.shown = S.item;
        v2.L.tray = tray;
        S.tray = tray;
        S.item = null;
        f.reachR = null;
        this.say(c, pick(this.prof.say.show), 0.9);
        S.st = 'waitTry';
        S.t = 0;
        return null;
      }
      case 'waitTry': {
        // standing back while they try it; then it is given back on the tray
        const v2 = S.job.v;
        if (!v2 || !v2.c.alive || !v2.L) {
          if (S.tray) this.movers.remove(S.tray);
          S.tray = null;
          S.st = 'idle';
          return null;
        }
        f.lookAt = v2.c.fig.j.headC;
        if (v2.L.st !== 'decided' || S.t > 30) return null;
        // the thing back from the tray: into its box for them, or into the case
        const it = this.movers.items.find((q) => q.slot === v2.L.slot && q.at && q.at.x !== undefined);
        f.reachR = it ? S.reach.set(it.pos.x, it.pos.y + 0.03, it.pos.z) : null;
        if (S.t < 0.8) return null;
        if (S.tray) this.movers.remove(S.tray);
        S.tray = null;
        if (it) {
          if (v2.L.verdict === 'buy') {
            this.movers.remove(it);
            const bx = this.movers.add({ line: it.look.line, model: 'ringBox', cell: null, tint: [0.1, 0.12, 0.22], cap: it.look.cap }, true);
            bx.at = { c: v2.c, how: 'grip' };
            bx.slot = it.slot;
            bx.price = it.slot ? it.slot.what : 'ring';
            v2.c.fig.carry = 'held';
            v2.L.boxed = bx;
            this.say(c, pick(this.prof.say.found), 0.8);
          } else {
            it.at = { c, how: 'grip' };
            S.item = it;
            S.st = 'putCase';
            S.t = 0;
            v2.L.verdict = null;
            f.reachR = null;
            return null;
          }
        }
        v2.L.verdict = null;
        f.reachR = null;
        S.st = 'idle';
        return null;
      }
      case 'putCase': {
        const s = S.item && S.item.slot;
        if (!s) {
          S.st = 'idle';
          return null;
        }
        c.crouchW = 0.25;
        f.reachR = S.reach.set(s.x, s.y + 0.02, s.z);
        f.lookAt = f.reachR;
        if (S.t < 0.8) return null;
        this.movers.remove(S.item);
        this.setSlot(s, 'shelf');
        S.item = null;
        c.crouchW = 0;
        f.reachR = null;
        S.st = 'idle';
        return null;
      }
      case 'toHelp': {
        const m = walk();
        if (m) return { ...m, speed: 1.0 };
        const v2 = S.job.v;
        if (v2 && v2.c.alive) {
          c.faceYaw = Math.atan2(v2.c.pos.x - c.pos.x, v2.c.pos.z - c.pos.z);
          f.lookAt = v2.c.fig.j.headC;
          this.say(c, pick(this.prof.say.praise), 0.9);
        }
        S.st = 'helping';
        S.t = 0;
        return null;
      }
      case 'helping':
        if (S.t < 2.5) return null;
        f.lookAt = null;
        S.st = 'idle';
        return null;
      case 'toFold': {
        const m = walk();
        if (m) return { ...m, speed: 0.95 };
        S.st = 'refold';
        S.t = 0;
        return null;
      }
      case 'refold': {
        // both hands at the stacks: a shirt lifted, smoothed, laid square again
        const t = S.job.t;
        c.faceYaw = t.yaw;
        const r = t.reach || { x: t.x, y: this.room.floor + 0.9, z: t.z };
        const k = Math.sin(S.t * 3.1);
        f.reachR = S.reach.set(r.x + Math.cos(t.yaw) * (0.15 + k * 0.08), r.y + 0.05 + Math.max(0, k) * 0.06, r.z - Math.sin(t.yaw) * (0.15 + k * 0.08));
        f.reachL = S.look.set(r.x - Math.cos(t.yaw) * 0.12, r.y + 0.05, r.z + Math.sin(t.yaw) * 0.12);
        f.lookAt = f.reachR;
        if (S.t > 5) {
          f.reachR = null;
          f.reachL = null;
          f.lookAt = null;
          S.st = 'idle';
        }
        return null;
      }
      case 'toHangers': {
        const m = walk();
        if (m) return { ...m, speed: 0.95 };
        S.st = 'hangers';
        S.t = 0;
        return null;
      }
      case 'hangers': {
        // along the bar, a hanger at a time put square and spaced
        const z = S.job.z;
        c.faceYaw = z.yaw;
        const sl = z.slots;
        const a = sl[0];
        const b = sl[sl.length - 1];
        const k = (S.t / 4) % 1;
        if (a && b) {
          f.reachR = S.reach.set(a.x + (b.x - a.x) * k, a.y + a.h - 0.05, a.z + (b.z - a.z) * k);
          f.lookAt = f.reachR;
        }
        if (S.t > 4) {
          f.reachR = null;
          f.lookAt = null;
          S.st = 'idle';
        }
        return null;
      }
      default:
        S.st = 'idle';
        return null;
    }
  }

  // (a clothes shop) the one on the floor: the hangers straightened along a bar, the tables refolded,
  // a word to someone at the mirror, the bought ones' places on the bar filled again
  associate(c, S) {
    const f = c.fig;
    S.t = 0;
    const gone = [];
    for (const z of this.zones) for (const s of z.slots) if (s.state === 'gone') gone.push(s);
    const atMirror = this.open.visitors.find((v) => v.L && (v.L.st === 'mirror' || v.L.st === 'wearMirror'));
    const r = Math.random();
    if (atMirror && r < 0.5 && (!S.helped || this.game.time - S.helped > 20)) {
      S.helped = this.game.time;
      S.job = { kind: 'help', v: atMirror };
      S.st = 'toHelp';
      const p = atMirror.c.pos;
      this.goS(c, p.x + 0.9, p.z + 0.4);
      return null;
    }
    if (gone.length && r < 0.75) {
      S.job = { kind: 'restock', slots: gone.slice(0, 4) };
      S.st = 'toStock';
      const m = this.marks.stock;
      if (m) this.goS(c, m.x, m.z);
      else S.st = 'idle';
      return null;
    }
    const tables = this.room.browse.filter((b) => b.what === 'folded');
    if (tables.length && r < 0.6) {
      const t = pick(tables);
      S.job = { kind: 'refold', t };
      S.st = 'toFold';
      this.goS(c, t.x, t.z);
      return null;
    }
    const z = pick(this.zones.filter((q) => q.what === 'garment'));
    if (!z) return null;
    S.job = { kind: 'hangers', z };
    S.st = 'toHangers';
    this.goS(c, z.x, z.z);
    void f;
    return null;
  }

  // (an electronics shop) over to the one trying a demo: beside them, a word on what it does
  explainGo(c, S) {
    const v = S.call;
    S.call = null;
    if (!v || !v.c.alive || !v.L || v.L.st !== 'demo') return null;
    S.job = { kind: 'explain', v };
    const p = v.c.pos;
    const fx = Math.sin(v.c.yaw);
    const fz = Math.cos(v.c.yaw);
    S.st = 'toExplain';
    this.goS(c, p.x - fz * 0.75 - fx * 0.15, p.z + fx * 0.75 - fz * 0.15);
    return null;
  }

  // (a jeweller) the seller: whoever asks at a case is served - behind the case to them, the thing
  // taken out and laid on a tray on the glass; then back into the case, or into its box
  seller(c, S) {
    const v = this.open.visitors.find((q) => q.L && (q.L.st === 'ask' || (q.L.st === 'decided' && q.L.verdict)) && !q.L.served);
    if (!v) {
      // (nobody asking: a look along the cases, the glass wiped)
      const z = pick(this.zones);
      if (!z) return null;
      S.job = { kind: 'face', z, k: 0 };
      S.st = 'toZone';
      this.goS(c, z.x, z.z);
      return null;
    }
    v.L.served = true;
    S.job = { kind: 'show', v };
    const s = v.L.slot;
    // (behind the case, opposite them: the far side of the thing from where they stand)
    const bx = s.x + (s.x - v.c.pos.x) * 0.9;
    const bz = s.z + (s.z - v.c.pos.z) * 0.9;
    S.st = v.L.st === 'ask' ? 'toCase' : 'toCase2';
    this.goS(c, bx, bz);
    return null;
  }

  goS(c, x, z, near = 0) {
    const S = this.S;
    S.pts = this.room.path(c.pos.x, c.pos.z, x, z);
    S.c = c;
    S.t = 0;
    if (near && S.pts.length) {
      // (stopping short of a thing on the floor, to bend down to it)
      const e = S.pts[S.pts.length - 1];
      const p = S.pts.length > 1 ? S.pts[S.pts.length - 2] : c.pos;
      const d = Math.hypot(e.x - p.x, e.z - p.z) || 1;
      e.x -= ((e.x - p.x) / d) * near;
      e.z -= ((e.z - p.z) / d) * near;
    }
  }

  // ---------------------------------------------------------------- every frame
  update(dt) {
    this.sync();
    this.t += dt;
    if (this.counter) this.counter.update(dt);
    if (this.tries) this.tries.update(dt);
    // (once its stock is in - the room is there round it - and not where they make food)
    if (!this.muralOn && this.live && this.open.open && this.shop.kind !== 'deli') {
      this.muralOn = true;
      this.mural.start();
    }
    // (the staff let go of - frightened, or gone: what was in their hands falls where they were)
    const S = this.S;
    if (S && (!S.c.alive || S.c.owner !== this.open)) {
      for (const it of [S.item, S.box]) if (it) this.drop(it, S.c.pos.x, S.c.pos.z);
      if (S.item && S.item.slot && S.item.slot.state === 'refill') S.item.slot.state = 'gone';
      if (S.job && S.job.slots) for (const q of S.job.slots) if (q.state === 'refill') q.state = 'gone';
      if (this.tries) this.tries.letGo(S);
      this.S = null;
    }
    const k = this.open.keeper;
    const K = this.K;
    if (K && (!k || !k.alive || k.owner !== this.open)) {
      if (K.hold) this.drop(K.hold, k ? k.pos.x : this.room.center.x, k ? k.pos.z : this.room.center.z);
      if (K.bag) this.movers.remove(K.bag);
      K.hold = null;
      K.bag = null;
    }
    // the doors swing to where they are wanted
    if (this.live) {
      for (const d of this.live.doors) {
        if (Math.abs(d.open - d.want) > 0.001) {
          const k = d.open + Math.sign(d.want - d.open) * Math.min(Math.abs(d.want - d.open), dt * 2.2);
          this.live.setDoor(d.i, k);
        }
      }
    }
    // the customers who are leaving with a bag: theirs to carry on the street
    for (const it of this.movers.items) {
      const at = it.at;
      if (at && at.c && at.how === 'carried' && (!at.c.alive || !this.room.inside(at.c.pos.x, at.c.pos.z, 0.3, at.c.pos.y))) {
        this.movers.remove(it);
        if (at.c.alive) {
          at.c.fig.carryL = 'bag';
          at.c.fig.bagBread = true;
          at.c.carryUntil = this.game.time + 50;
          // (yours: carried a while down the street - game/player.js)
          if (at.c.player) this.game.player.bagUntil = this.game.time + 40;
        }
      }
    }
    this.notice(dt);
    this.you.update(dt);
    // (yours: bought and in your hand a moment; or the look at it given up some other way)
    const g = this.game;
    if (this.pocket && g.time > this.pocket.until) {
      this.movers.remove(this.pocket.it);
      this.pocket = null;
    }
    if (this.inspecting && !g.dialog.open && g.time - this.inspecting.t > 0.3) {
      this.inspecting.back();
      this.inspecting = null;
    }
  }

  // you in the shop: the cashier sees you come in; the customers mostly go on with their shopping;
  // running, or walking into someone, gets a word
  notice(dt) {
    const g = this.game;
    const p = g.player;
    const R = this.room;
    const inside = p.mode === 'foot' && R.inside(p.pos.x, p.pos.z, 0.2, p.pos.y);
    const P = this.player;
    const k = this.open.keeper;
    if (inside && !P.in && this.open.open && k && k.alive) {
      // (in at the door: the cashier looks up, a hello - not every time you come in)
      if (g.time - P.greetT > 25) {
        P.greetT = g.time;
        if (this.K === undefined) this.K = { st: 'idle', t: 0, act: 'look', actT: 0, reach: new THREE.Vector3(), look: new THREE.Vector3() };
        this.K.greet = { c: p, until: g.time + 2.2 };
        this.say(k, pick(this.prof.say.player), 1);
      }
      // (one of the customers glances over, most do not)
      const near = this.open.visitors.filter((v) => v.L && v.c.alive && Math.hypot(v.c.pos.x - p.pos.x, v.c.pos.z - p.pos.z) < 6);
      if (near.length && Math.random() < 0.45) {
        const v = pick(near);
        v.c.glanceAt = p;
        v.c.fig.lookAt = p.fig.j.headC;
        v.glanceT = 1.1;
      }
    }
    P.in = inside;
    if (!inside) return;
    for (const v of this.open.visitors) {
      if (v.glanceT > 0) {
        v.glanceT -= dt;
        if (v.glanceT <= 0 && v.c.fig.lookAt === p.fig.j.headC) v.c.fig.lookAt = null;
      }
    }
    // running in the shop
    const sp = p.vel ? Math.hypot(p.vel.x, p.vel.z) : 0;
    if (sp > 4.6 && g.time - P.runT > 14 && k && k.alive && this.open.open) {
      P.runT = g.time;
      this.say(k, pick(this.prof.say.run), 1);
    }
    // walking into somebody
    for (const v of this.open.visitors) {
      if (!v.L || !v.c.alive) continue;
      const d = Math.hypot(v.c.pos.x - p.pos.x, v.c.pos.z - p.pos.z);
      if (d < 0.55 && sp > 1.2) {
        const last = this.cool.get(v.c) || -99;
        if (g.time - last > 8) {
          this.cool.set(v.c, g.time);
          v.c.fig.lookAt = p.fig.j.headC;
          v.glanceT = 1.4;
          this.say(v.c, pick(this.prof.say.bump), sp > 3 ? 1 : 0.6);
        }
      }
    }
  }

  // every frame, after everybody has moved (their hands where they are now): the things in motion
  // put where they are
  draw() {
    for (const it of this.movers.items) this.place(it);
    this.movers.update();
  }

  place(it) {
    const at = it.at;
    if (!at) return;
    if (at.hidden) {
      // (with them in the fitting room: out of sight, far under the floor)
      it.pos.set(0, -50, 0);
      return;
    }
    if (at.basket) {
      // in a basket: on its bottom, side by side
      const b = at.basket;
      const k = at.k || 0;
      const lx = ((k % 3) - 1) * 0.11;
      const lz = (Math.floor(k / 3) - 0.5) * 0.1;
      const cy = Math.cos(b.yaw);
      const sy = Math.sin(b.yaw);
      it.pos.set(b.pos.x + lx * cy + lz * sy, b.pos.y + 0.012 + (it.t.size[1] > 0.2 ? 0 : 0), b.pos.z - lx * sy + lz * cy);
      it.yaw = b.yaw + k * 0.7;
      it.tilt = it.t.size[1] > 0.17 ? 1.2 : 0;
      it.roll = 0;
      if (it.tilt) it.pos.y += 0.03;
      return;
    }
    if (at.c) {
      const c = at.c;
      const f = c.fig;
      if (!f || !f.j) return;
      const yaw = f.yaw !== undefined ? f.yaw : c.yaw;
      if (at.how === 'basket') {
        // by its handle, hanging at the side
        const h = f.j.handL;
        it.pos.set(h.x, h.y - it.t.size[1] - 0.03, h.z);
        it.yaw = yaw + Math.PI / 2;
        it.tilt = 0;
        it.roll = 0;
        return;
      }
      if (at.how === 'box') {
        // held in both hands before them
        _b.addVectors(f.j.handR, f.j.handL).multiplyScalar(0.5);
        it.pos.set(_b.x, _b.y - it.t.size[1] * 0.45, _b.z);
        it.yaw = yaw;
        it.tilt = 0;
        it.roll = 0;
        return;
      }
      if (at.how === 'carried') {
        // a bag in the hand at their side
        const h = f.j.handL;
        it.pos.set(h.x, h.y - it.t.size[1] - 0.01, h.z);
        it.yaw = yaw;
        it.tilt = 0;
        it.roll = 0;
        return;
      }
      if (at.how === 'head') {
        // headphones on: the band over the head, the cups at the ears
        const hc = f.j.headC;
        it.pos.set(hc.x, hc.y - 0.2, hc.z);
        it.yaw = yaw;
        it.tilt = 0;
        it.roll = 0;
        return;
      }
      if (at.how === 'neck') {
        const hc = f.j.headC;
        const fx = Math.sin(yaw);
        const fz = Math.cos(yaw);
        it.pos.set(hc.x + fx * 0.02, hc.y - 0.42, hc.z + fz * 0.02);
        it.yaw = yaw;
        it.tilt = 0;
        it.roll = 0;
        return;
      }
      if (at.how === 'finger' || at.how === 'wrist') {
        const h = f.j.handL;
        it.pos.set(h.x, h.y - (at.how === 'wrist' ? 0.05 : 0.01), h.z);
        it.yaw = yaw + Math.PI / 2;
        it.tilt = 0;
        it.roll = 0;
        return;
      }
      if (at.how === 'armful') {
        // (yours, not paid for yet: game/shopper.js) over your left arm - a garment by its hanger's
        // hook, a box held, one over another
        const h = f.j.handL;
        const k = at.k || 0;
        if (it.t.hang) {
          it.pos.set(h.x, h.y - it.t.hang + 0.03 + k * 0.012, h.z);
          it.yaw = yaw + Math.PI / 2 + (k - 1) * 0.16;
        } else {
          it.pos.set(h.x, h.y - it.t.size[1] * 0.6 + k * it.t.size[1], h.z);
          it.yaw = yaw;
        }
        it.tilt = 0;
        it.roll = 0;
        return;
      }
      if (at.how === 'against') {
        // a garment held up against the body at the mirror: its hook at the chin, hanging before them
        const fx = Math.sin(yaw);
        const fz = Math.cos(yaw);
        it.pos.set(c.pos.x + fx * 0.2, c.pos.y + 1.5 * (f.scale || 1) - it.t.hang, c.pos.z + fz * 0.2);
        it.yaw = yaw;
        it.tilt = 0;
        it.roll = 0;
        return;
      }
      // in the right hand: gripped round its middle; held up to be looked at, turned (a garment by its
      // hanger's hook, hanging from the hand)
      const h = f.j.handR;
      const hh = it.t.size[1];
      if (it.t.hang) {
        it.pos.set(h.x, h.y - it.t.hang + 0.02, h.z);
        it.yaw = yaw + (at.spin || 0);
        it.tilt = 0;
        it.roll = 0;
        return;
      }
      it.pos.set(h.x, h.y - Math.min(hh * 0.45, 0.09), h.z);
      it.yaw = yaw + Math.PI + (at.spin || 0);
      // (a phone held up: its screen turned to them)
      it.tilt = at.how === 'bag' ? 0 : it.look.model === 'phone' && at.how === 'show' ? 1.25 : -0.12;
      it.roll = 0;
      if (at.how === 'bag') it.pos.y = h.y - hh - 0.01;
      return;
    }
    it.pos.set(at.x, at.y, at.z);
    it.yaw = at.yaw || 0;
    it.tilt = at.tilt || 0;
    it.roll = 0;
    if (at.tilt && it.look.model !== 'basket') it.pos.y += Math.min(it.t.size[0], it.t.size[2]) * 0.5;
  }

  // ---------------------------------------------------------------- you, at a shelf
  // the product in front of you (within reach, the one you face): what E does there
  target(p) {
    if (!this.live || !this.open.open) return null;
    const fx = Math.sin(p.yaw);
    const fz = Math.cos(p.yaw);
    let best = null;
    let bd = 1.25;
    for (const z of this.zones) {
      if (Math.hypot(z.x - p.pos.x, z.z - p.pos.z) > 2.2) continue;
      for (const s of z.slots) {
        if (s.state !== 'shelf') continue;
        const dx = s.x - p.pos.x;
        const dz = s.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > bd || d < 0.1) continue;
        // (in front of you, at a height a hand reaches)
        if ((dx * fx + dz * fz) / d < 0.55) continue;
        const dy = s.y - (p.pos.y || this.room.floor);
        if (dy < 0.05 || dy > 1.9) continue;
        bd = d;
        best = s;
      }
    }
    return best;
  }

  label(s) {
    const what = s.what;
    const heb = this.prof.heb[what] || 'מוצר';
    // (a jeweller's things are behind glass: asked for, and the seller hands it over)
    return this.prof.flow === 'jewel' ? `E — לבקש לראות: ${heb}` : `E — לבדוק: ${heb}`;
  }

  // you take it off the shelf and look at it: its name, its price; buy it, or put it back
  inspect(s) {
    const game = this.game;
    const p = game.player;
    if (s.state !== 'shelf') return;
    this.setSlot(s, 'held');
    const it = this.movers.add(s.look, false);
    it.slot = s;
    it.at = { c: p, how: 'show', spin: 0.4 };
    const price = this.prof.prices[s.what] || 2;
    const brand = brandOf(s.look);
    const name = this.prof.names[s.what] || 'a product';
    const back = () => {
      this.giveBack(it);
      p.fig.reachR = null;
    };
    p.fig.reachR = this.showAt(p, _b).clone();
    const M = game.money;
    const k = this.open.keeper;
    // (the one on the floor, if near, looks over - a word now and then; at a jeweller the seller
    // always: it is the seller who takes it out of the case for you)
    const st = this.S && this.S.c && this.S.c.alive ? this.S.c : null;
    const helper = st && Math.hypot(st.pos.x - p.pos.x, st.pos.z - p.pos.z) < 5 ? st : this.prof.flow === 'jewel' && k && k.alive ? k : null;
    if (helper && this.prof.say.help) {
      if (helper === st) this.S.glance = { c: p, until: game.time + 2.4 };
      else if (this.K) this.K.greet = { c: p, until: game.time + 2.4 };
      this.say(helper, pick(this.prof.say.help), this.prof.flow === 'jewel' ? 1 : 0.5);
    }
    // (ROADMAP 16.2: kept - into the basket, over your arm, boxed, on the counter - and paid for at
    // the till, as everybody does: game/shopper.js)
    const you = this.you;
    const take = you.takeLabel(price, s);
    const full = !take && !you.pv ? ' · הידיים מלאות: קודם לקופה' : '';
    const choices = [];
    if (take) {
      choices.push({
        label: take,
        fn: () => {
          p.fig.reachR = null;
          this.inspecting = null;
          you.take(it, s, price);
          if (k && k.alive && Math.random() < 0.25) this.say(k, pick(['Good choice!', 'Those are fresh today.', 'Let me know if you need a bag.']), 0.6);
        },
      });
    }
    choices.push({
      label: 'להחזיר למדף',
      fn: () => {
        back();
        this.inspecting = null;
      },
    });
    void M;
    game.dialog.show(brand ? `${brand}` : this.prof.heb[s.what] || 'מוצר', `${this.prof.heb[s.what] || ''} — ${name}. ${this.prof.flow ? 'המחיר' : 'המחיר על המדף'}: ${fmt(price)}${you.have()}${full}`, choices);
    // (if the dialog is closed some other way: back on the shelf)
    this.inspecting = { it, s, back, t: game.time };
  }

  // what the shop's life is doing (for the tests)
  debug() {
    const vs = this.open.visitors.filter((v) => v.L).map((v) => `${v.L.st}${v.L.got.length ? `:${v.L.got.length}` : ''}${v.L.basket ? '+b' : ''}`);
    return { zones: this.zones.length, slots: this.live ? this.live.slots.length : 0, movers: this.movers.items.length, belt: this.belt.length, queue: this.queue.length, cash: this.K ? `${this.K.act}/${this.K.sst || '-'}` : '-', stock: this.S ? `${this.S.st}` : '-', vs: vs.join(' '), stats: this.stats };
  }

  dispose() {
    this.you.dispose();
    this.mural.dispose();
    if (this.counter) this.counter.dispose();
    if (this.tries) this.tries.dispose();
    // (whatever is in motion goes back where it came from)
    for (const it of [...this.movers.items]) {
      if (it.slot && (it.slot.state === 'held' || it.slot.state === 'aim')) this.setSlot(it.slot, 'shelf');
    }
    for (const d of this.live ? this.live.doors : []) {
      d.want = 0;
      this.live.setDoor(d.i, 0);
    }
    this.movers.dispose();
  }
}

// the maker's name on a product (its label's cell: world/labels.js BRANDS)
function brandOf(look) {
  const cell = look.cell || '';
  const m = cell.match(/^([a-z]+)\.([a-z]*)(\d+)$/);
  if (!m) return null;
  const [, kind, sub, n] = m;
  const table = { 'bottle.soda': 'soda', 'can.soda': 'soda', 'bottle.water': 'water', 'can.energy': 'energy', 'bottle.juice': 'juice', 'carton.juice': 'juice', 'carton.milk': 'milk', 'can.tin': 'tins', 'jar.': 'jars', 'bottle.sauce': 'sauce', 'box.cereal': 'cereal', 'box.dry': 'boxes', 'small.': 'tea', 'small.med': 'meds', 'bag.chips': 'chips', 'bag.dry': 'bags', 'bag.bread': 'bread', 'jug.': 'clean', 'candy.': 'candy' };
  const list = BRANDS[table[`${kind}.${sub}`]];
  return list && list[+n] ? list[+n][0] : null;
}
void UP;
