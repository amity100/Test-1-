// (v5, ROADMAP 16.3) What each eatery makes: the name on its board (in-world, English), the name you
// read in the dialog (Hebrew), the price, what it is when it is served (world/foods.js: its model, its
// colours), what the cook draws in the air before it comes true (game/airsketch.js SHAPES), what it
// does for you, and where in the kitchen it is made, one place after another (world/eatery.js names
// its stations). Shared by the boards (world/labels.js) and the life of the place (game/eaterylife.js).

const MUG = [0.96, 0.95, 0.92];
const KRAFT = [0.86, 0.8, 0.7];

export const MENUS = {
  cafe: [
    { id: 'cappuccino', name: 'CAPPUCCINO', heb: 'קפוצ׳ינו', price: 4, model: 'mug', tint: MUG, shape: 'cup', hp: 4, coffee: 60, at: ['grinder', 'espresso', 'milk'] },
    { id: 'latte', name: 'LATTE TO GO', heb: 'לאטה לדרך', price: 5, model: 'cupGo', tint: KRAFT, cap: [0.42, 0.28, 0.18], shape: 'cup', hp: 4, coffee: 60, at: ['grinder', 'espresso', 'milk'], go: true },
    { id: 'croissant', name: 'CROISSANT', heb: 'קרואסון', price: 3, model: 'croissant', shape: 'croissant', hp: 12, at: ['oven'] },
    { id: 'muffin', name: 'BLUEBERRY MUFFIN', heb: 'מאפין אוכמניות', price: 3, model: 'muffin', tint: [0.6, 0.4, 0.3], cap: [0.35, 0.45, 0.85], shape: 'dessert', hp: 10, at: ['case'] },
    { id: 'cake', name: 'CHEESECAKE', heb: 'עוגת גבינה', price: 5, model: 'cake', tint: [0.98, 0.9, 0.7], shape: 'dessert', hp: 15, at: ['case'] },
  ],
  bagel: [
    { id: 'bagel', name: 'SESAME BAGEL', heb: 'בייגל שומשום', price: 3, model: 'bagel', shape: 'bagel', hp: 15, at: ['deck', 'prep'] },
    { id: 'donut', name: 'PINK DONUT', heb: 'דונאט ורוד', price: 2, model: 'donut', tint: [0.95, 0.56, 0.7], cap: [0.3, 0.6, 0.95], shape: 'donut', hp: 10, at: ['racks'] },
    { id: 'croissant', name: 'CROISSANT', heb: 'קרואסון', price: 3, model: 'croissant', shape: 'croissant', hp: 12, at: ['deck'] },
    { id: 'coffee', name: 'COFFEE TO GO', heb: 'קפה לדרך', price: 3, model: 'cupGo', tint: KRAFT, cap: [0.6, 0.3, 0.2], shape: 'cup', hp: 3, coffee: 60, at: ['espresso'], go: true },
  ],
  pizza: [
    { id: 'slice', name: 'PEPPERONI SLICE', heb: 'משולש פפרוני', price: 4, model: 'slice', shape: 'slice', hp: 20, at: ['case', 'oven'] },
    { id: 'pie', name: 'WHOLE PIE', heb: 'פיצה שלמה', price: 14, model: 'pizza', shape: 'pizza', hp: 60, at: ['prep', 'oven', 'cutting', 'boxes'], boxed: { model: 'pizzaBox', cap: [0.85, 0.2, 0.2] } },
    { id: 'soda', name: 'SODA', heb: 'משקה קל', price: 2, model: 'sodaCup', tint: [0.85, 0.2, 0.2], cap: [0.95, 0.95, 0.95], shape: 'soda', hp: 5, at: ['soda'], go: true },
  ],
  burger: [
    { id: 'burger', name: 'CHEESEBURGER', heb: 'צ׳יזבורגר', price: 9, model: 'burger', shape: 'burger', hp: 40, at: ['grill', 'pass'] },
    { id: 'fries', name: 'FRIES', heb: 'צ׳יפס', price: 3, model: 'fries', cap: [0.85, 0.15, 0.15], shape: 'fries', hp: 12, at: ['fryer'], go: true },
    { id: 'shake', name: 'STRAWBERRY SHAKE', heb: 'מילקשייק תות', price: 5, model: 'shake', tint: [0.96, 0.7, 0.78], cap: [0.9, 0.2, 0.3], shape: 'smoothie', hp: 10, at: ['soda'], go: true },
    { id: 'soda', name: 'SODA', heb: 'משקה קל', price: 2, model: 'sodaCup', tint: [0.85, 0.2, 0.2], cap: [0.95, 0.95, 0.95], shape: 'soda', hp: 5, at: ['soda'], go: true },
  ],
  diner: [
    { id: 'burger', name: 'DINER BURGER', heb: 'המבורגר', price: 10, model: 'burger', shape: 'burger', hp: 40, at: ['grill', 'pass'] },
    { id: 'pie', name: 'CHERRY CAKE', heb: 'עוגת דובדבנים', price: 5, model: 'cake', tint: [0.9, 0.36, 0.38], shape: 'dessert', hp: 15, at: ['case'] },
    { id: 'shake', name: 'VANILLA SHAKE', heb: 'מילקשייק וניל', price: 5, model: 'shake', tint: [0.97, 0.94, 0.84], cap: [0.3, 0.6, 0.9], shape: 'smoothie', hp: 10, at: ['coffee'], go: true },
    { id: 'coffee', name: 'BOTTOMLESS COFFEE', heb: 'קפה', price: 3, model: 'mug', tint: MUG, shape: 'cup', hp: 3, coffee: 60, at: ['coffee'] },
  ],
  tacos: [
    { id: 'tacos', name: 'TACOS X3', heb: 'שלושה טאקו', price: 8, model: 'tacos', shape: 'taco', hp: 30, at: ['grill', 'prep'] },
    { id: 'soda', name: 'HORCHATA', heb: 'הורצ׳טה', price: 3, model: 'sodaCup', tint: [0.95, 0.9, 0.78], cap: [0.6, 0.4, 0.25], shape: 'soda', hp: 6, at: ['pots'], go: true },
  ],
  noodles: [
    { id: 'bowl', name: 'NOODLE BOWL', heb: 'קערת נודלס', price: 9, model: 'noodles', tint: [0.85, 0.25, 0.2], shape: 'noodles', hp: 35, at: ['pots', 'wok'] },
    { id: 'box', name: 'NOODLES TO GO', heb: 'נודלס לדרך', price: 8, model: 'noodleBox', cap: [0.85, 0.2, 0.2], shape: 'noodles', hp: 30, at: ['wok'], go: true },
  ],
  sushi: [
    { id: 'set', name: 'SUSHI SET', heb: 'מגש סושי', price: 12, model: 'sushi', tint: [0.98, 0.56, 0.4], shape: 'sushi', hp: 35, at: ['rice', 'prep'] },
    { id: 'tea', name: 'GREEN TEA', heb: 'תה ירוק', price: 2, model: 'mug', tint: [0.5, 0.62, 0.42], shape: 'cup', hp: 4, at: ['rice'] },
  ],
  juice: [
    { id: 'orange', name: 'ORANGE JUICE', heb: 'מיץ תפוזים', price: 5, model: 'juiceCup', tint: [0.98, 0.6, 0.18], cap: [0.3, 0.75, 0.4], shape: 'lemonade', hp: 10, coffee: 30, at: ['fruit', 'blenders'], go: true },
    { id: 'green', name: 'GREEN SMOOTHIE', heb: 'שייק ירוק', price: 6, model: 'juiceCup', tint: [0.5, 0.78, 0.3], cap: [0.9, 0.4, 0.5], shape: 'smoothie', hp: 12, coffee: 30, at: ['fruit', 'blenders'], go: true },
    { id: 'berry', name: 'BERRY BLAST', heb: 'שייק פירות יער', price: 6, model: 'juiceCup', tint: [0.75, 0.2, 0.4], cap: [0.95, 0.85, 0.3], shape: 'smoothie', hp: 12, coffee: 30, at: ['fruit', 'blenders'], go: true },
  ],
  icecream: [
    { id: 'cone', name: 'DOUBLE CONE', heb: 'גביע כפול', price: 4, model: 'cone', tint: [0.98, 0.72, 0.8], cap: [0.55, 0.35, 0.22], shape: 'cone', hp: 8, at: ['case', 'cones'], go: true },
    { id: 'cup', name: 'GELATO CUP', heb: 'גלידה בכוס', price: 4, model: 'gelatoCup', tint: [0.6, 0.85, 0.55], cap: [0.95, 0.6, 0.7], shape: 'cone', hp: 8, at: ['case'], go: true },
    { id: 'shake', name: 'MILKSHAKE', heb: 'מילקשייק', price: 5, model: 'shake', tint: [0.55, 0.36, 0.24], cap: [0.9, 0.2, 0.3], shape: 'smoothie', hp: 10, at: ['case', 'shake'], go: true },
  ],
  falafel: [
    { id: 'pita', name: 'FALAFEL PITA', heb: 'פלאפל בפיתה', price: 6, model: 'pita', shape: 'pita', hp: 30, at: ['fryer', 'prep'], go: true },
    { id: 'fries', name: 'FRIES', heb: 'צ׳יפס', price: 3, model: 'fries', cap: [0.95, 0.75, 0.2], shape: 'fries', hp: 12, at: ['fryer'], go: true },
    { id: 'soda', name: 'LEMONADE', heb: 'לימונדה', price: 3, model: 'sodaCup', tint: [0.98, 0.92, 0.5], cap: [0.4, 0.75, 0.4], shape: 'lemonade', hp: 6, at: ['pots'], go: true },
  ],
};

// the kinds that are eateries of the new kind
export const EATERY_KINDS = new Set(Object.keys(MENUS));
