// The little drawings on the city's map (ui/citymap.js): one for every kind of shop, for the
// blueprints' boards and for the places worth a visit, each in a round sticker of its group's
// colour. Drawn with the pen, about 16 px across, round (0, 0); the stroke is set by the caller.

const TAU = Math.PI * 2;

function circle(g, x, y, r, fill = false) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  if (fill) g.fill();
  g.stroke();
}

function line(g, ...pts) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}

function shape(g, pts, fill = true) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  if (fill) g.fill();
  g.stroke();
}

function rrect(g, x, y, w, h, r, fill = true) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  if (fill) g.fill();
  g.stroke();
}

// (the white of a drawing: a cup, a page, a bun)
const W = '#fffaf0';

export const GLYPHS = {
  cafe(g) {
    g.fillStyle = W;
    shape(g, [-5, -1, 5, -1, 4, 4.5, 2.5, 6, -2.5, 6, -4, 4.5]);
    g.beginPath();
    g.arc(5.2, 2, 2.1, -1.4, 1.6);
    g.stroke();
    g.beginPath();
    g.moveTo(-1.6, -2.6);
    g.quadraticCurveTo(-3.4, -4.4, -1.6, -6.4);
    g.moveTo(1.8, -2.6);
    g.quadraticCurveTo(0, -4.4, 1.8, -6.4);
    g.stroke();
  },
  tacos(g) {
    g.fillStyle = '#ffd25a';
    g.beginPath();
    g.moveTo(-6.5, 4);
    g.arc(0, 4, 6.5, Math.PI, TAU);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#5cbf4a';
    g.beginPath();
    g.moveTo(-5, -0.5);
    for (let i = 0; i <= 6; i++) g.lineTo(-5 + i * (10 / 6), -0.5 - (i % 2 ? 2.2 : 0.6) - Math.sin((i / 6) * Math.PI) * 2.2);
    g.stroke();
  },
  diner(g) {
    g.fillStyle = '#f6b25e';
    g.beginPath();
    g.moveTo(-6.5, -0.5);
    g.quadraticCurveTo(-6.5, -6.5, 0, -6.5);
    g.quadraticCurveTo(6.5, -6.5, 6.5, -0.5);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#7a3f2a';
    rrect(g, -6.8, 0.8, 13.6, 2.4, 1.2);
    g.fillStyle = '#f6b25e';
    rrect(g, -6.2, 4.2, 12.4, 2.6, 1.3);
  },
  pizza(g) {
    g.fillStyle = '#ffd25a';
    g.beginPath();
    g.moveTo(0, 7);
    g.lineTo(-5.6, -4.2);
    g.quadraticCurveTo(0, -7.4, 5.6, -4.2);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#e2335f';
    circle(g, -1.2, -2.4, 1.3, true);
    circle(g, 1.6, 1.2, 1.2, true);
  },
  icecream(g) {
    g.fillStyle = '#f2c27a';
    shape(g, [-3.8, -0.6, 3.8, -0.6, 0, 7.4]);
    g.fillStyle = '#ffb3d6';
    g.beginPath();
    g.arc(0, -3, 4.2, Math.PI * 0.95, Math.PI * 2.05);
    g.closePath();
    g.fill();
    g.stroke();
  },
  juice(g) {
    g.fillStyle = '#ffd25a';
    shape(g, [-4.4, -2.6, 4.4, -2.6, 3.2, 6.6, -3.2, 6.6]);
    line(g, 1, -2.6, 2.8, -7, 5.4, -7);
  },
  falafel(g) {
    g.fillStyle = '#f2d39a';
    g.beginPath();
    g.moveTo(-6.6, -0.6);
    g.quadraticCurveTo(0, 10, 6.6, -0.6);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#9a6a3a';
    circle(g, -2.7, -2.2, 2, true);
    circle(g, 2.7, -2.2, 2, true);
    circle(g, 0, -4.6, 2, true);
  },
  bagel(g) {
    g.fillStyle = '#e8a85a';
    g.beginPath();
    g.arc(0, 0, 6.2, 0, TAU);
    g.arc(0, 0, 2.2, 0, TAU, true);
    g.fill();
    g.stroke();
    circle(g, 0, 0, 2.2);
    line(g, -4, -2.5, -3.2, -3.4);
    line(g, 3, -3.6, 3.9, -2.8);
    line(g, 1.2, 4.6, 2.3, 4.2);
  },
  deli(g) {
    g.fillStyle = '#f6d8a0';
    shape(g, [-6.6, 4.6, 6.6, 4.6, 0, -5.6]);
    g.strokeStyle = '#3fa64a';
    line(g, -4.6, 1.6, 4.6, 1.6);
    g.strokeStyle = '#1b1430';
  },
  sushi(g) {
    g.fillStyle = '#2b2a3e';
    circle(g, 0, 0, 6.2, true);
    g.fillStyle = W;
    circle(g, 0, 0, 4.2, true);
    g.fillStyle = '#ff8a5a';
    circle(g, 0, 0, 1.9, true);
  },
  grocery(g) {
    g.fillStyle = W;
    shape(g, [-4.8, -3.4, 6.6, -3.4, 5, 2.8, -3.2, 2.8]);
    line(g, -7.4, -6, -5.2, -6, -4.8, -3.4);
    line(g, -3.2, 2.8, -3.6, 4);
    circle(g, -2.4, 5.6, 1.3);
    circle(g, 4, 5.6, 1.3);
  },
  shop(g) {
    g.fillStyle = '#ffd25a';
    rrect(g, -5.2, -2, 10.4, 8.4, 1.2);
    g.beginPath();
    g.moveTo(-2.6, -2);
    g.quadraticCurveTo(-2.6, -6.6, 0, -6.6);
    g.quadraticCurveTo(2.6, -6.6, 2.6, -2);
    g.stroke();
  },
  books(g) {
    g.fillStyle = W;
    g.beginPath();
    g.moveTo(0, -3.4);
    g.quadraticCurveTo(-3.4, -5.6, -7, -4.4);
    g.lineTo(-7, 5);
    g.quadraticCurveTo(-3.4, 4, 0, 6);
    g.quadraticCurveTo(3.4, 4, 7, 5);
    g.lineTo(7, -4.4);
    g.quadraticCurveTo(3.4, -5.6, 0, -3.4);
    g.closePath();
    g.fill();
    g.stroke();
    line(g, 0, -3.4, 0, 6);
  },
  phones(g) {
    g.fillStyle = '#3a3550';
    rrect(g, -3.8, -6.8, 7.6, 13.6, 1.8);
    g.fillStyle = '#9fe3e0';
    g.fillRect(-2.4, -5, 4.8, 8.4);
    line(g, -1, 5, 1, 5);
  },
  boutique(g) {
    g.beginPath();
    g.arc(0, -4.6, 1.7, Math.PI * 0.9, Math.PI * 2.4);
    g.stroke();
    g.fillStyle = '#ffb3d6';
    shape(g, [0, -2.6, 7, 4.2, -7, 4.2]);
  },
  music(g) {
    g.fillStyle = '#2b2a3e';
    circle(g, 0, 0, 6.6, true);
    g.strokeStyle = '#8c86a8';
    g.beginPath();
    g.arc(0, 0, 4.4, -0.6, 1.2);
    g.stroke();
    g.strokeStyle = '#1b1430';
    g.fillStyle = '#ff4fa3';
    circle(g, 0, 0, 2, true);
  },
  hardware(g) {
    g.save();
    g.rotate(-0.75);
    g.fillStyle = '#c98f5a';
    rrect(g, -1.1, -2, 2.2, 10, 0.8);
    g.fillStyle = '#8c86a8';
    rrect(g, -5, -6, 10, 3.8, 0.8);
    g.restore();
  },
  optics(g) {
    g.fillStyle = '#d8ecff';
    circle(g, -3.6, 1, 2.9, true);
    circle(g, 3.6, 1, 2.9, true);
    g.beginPath();
    g.moveTo(-0.8, 0.4);
    g.quadraticCurveTo(0, -0.7, 0.8, 0.4);
    g.stroke();
    line(g, -6.4, 0.2, -7.2, -2.4);
    line(g, 6.4, 0.2, 7.2, -2.4);
  },
  flowers(g) {
    line(g, 0, 1.8, 0, 7.4);
    g.fillStyle = '#ff7eb6';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      circle(g, Math.cos(a) * 3, -1.8 + Math.sin(a) * 3, 2.2, true);
    }
    g.fillStyle = '#ffd25a';
    circle(g, 0, -1.8, 1.6, true);
  },
  surf(g) {
    g.save();
    g.rotate(0.7);
    g.fillStyle = '#5ad1d1';
    g.beginPath();
    g.ellipse(0, 0, 2.8, 7.6, 0, 0, TAU);
    g.fill();
    g.stroke();
    line(g, 0, -6, 0, 6);
    g.restore();
  },
  pharmacy(g) {
    g.fillStyle = '#3fbf6a';
    shape(g, [-2.2, -6.4, 2.2, -6.4, 2.2, -2.2, 6.4, -2.2, 6.4, 2.2, 2.2, 2.2, 2.2, 6.4, -2.2, 6.4, -2.2, 2.2, -6.4, 2.2, -6.4, -2.2, -2.2, -2.2]);
  },
  barber(g) {
    g.fillStyle = W;
    circle(g, -3, 4.4, 2.1, true);
    circle(g, 3, 4.4, 2.1, true);
    line(g, -1.7, 2.8, 3.8, -6.6);
    line(g, 1.7, 2.8, -3.8, -6.6);
  },
  laundry(g) {
    g.fillStyle = W;
    rrect(g, -5.8, -6.4, 11.6, 12.8, 1.4);
    g.fillStyle = '#9fd0ff';
    circle(g, 0, 1.2, 3.4, true);
    line(g, -5.8, -3.4, 5.8, -3.4);
    g.fillStyle = '#1b1430';
    g.fillRect(-4.2, -5.4, 1.4, 1.2);
  },
  gym(g) {
    g.fillStyle = '#5a5470';
    line(g, -4.6, 0, 4.6, 0);
    rrect(g, -7.4, -4, 2.6, 8, 0.8);
    rrect(g, 4.8, -4, 2.6, 8, 0.8);
    rrect(g, -4.8, -2.6, 1.6, 5.2, 0.6);
    rrect(g, 3.2, -2.6, 1.6, 5.2, 0.6);
  },
  lobby(g) {
    line(g, -7, -3.6, -7, 5);
    line(g, 7, 1.4, 7, 5);
    g.fillStyle = W;
    rrect(g, -7, 0.6, 14, 2.6, 0.6);
    g.fillStyle = '#ffb3d6';
    rrect(g, -6, -2.4, 3.6, 2.6, 1);
    g.fillStyle = '#9fc0f5';
    rrect(g, -2, -1.8, 9, 2.4, 0.8);
  },
  motel(g) {
    GLYPHS.lobby(g);
  },
  bar(g) {
    g.fillStyle = '#ff9ccc';
    shape(g, [-5.8, -5.4, 5.8, -5.4, 0, 1.4]);
    line(g, 0, 1.4, 0, 6.2);
    line(g, -3.2, 6.4, 3.2, 6.4);
    g.fillStyle = '#5cbf4a';
    circle(g, 1.8, -3.4, 1.1, true);
  },
  club(g) {
    line(g, 0, -7.6, 0, -5.6);
    g.fillStyle = '#d8d4ec';
    circle(g, 0, 0.4, 5.6, true);
    g.beginPath();
    g.ellipse(0, 0.4, 2.4, 5.6, 0, 0, TAU);
    g.moveTo(-5.6, 0.4);
    g.lineTo(5.6, 0.4);
    g.moveTo(-4.8, -2.6);
    g.lineTo(4.8, -2.6);
    g.moveTo(-4.8, 3.4);
    g.lineTo(4.8, 3.4);
    g.stroke();
  },
  cinema(g) {
    g.fillStyle = '#2b2a3e';
    rrect(g, -6.4, -1, 12.8, 7.2, 0.8);
    shape(g, [-6.4, -1, -6.8, -4.4, 5.6, -7, 6.2, -3.6]);
    g.strokeStyle = W;
    line(g, -3.6, -1.6, -2.4, -5);
    line(g, 0, -2.4, 1.2, -5.8);
    line(g, 3.4, -3.1, 4.4, -6.2);
    g.strokeStyle = '#1b1430';
  },
  arcade(g) {
    g.fillStyle = '#5a5470';
    rrect(g, -6.6, 2, 13.2, 4.6, 1.4);
    line(g, -1.4, 2, -1.4, -2.8);
    g.fillStyle = '#e2335f';
    circle(g, -1.4, -4.4, 2.4, true);
    g.fillStyle = '#ffd25a';
    circle(g, 3.6, 4.2, 1.1, true);
  },
  friends(g) {
    g.fillStyle = W;
    circle(g, -1, -0.6, 5.8, true);
    g.fillStyle = '#1b1430';
    g.fillRect(-3.4, -2.8, 1.3, 1.6);
    g.fillRect(0.6, -2.8, 1.3, 1.6);
    g.beginPath();
    g.arc(-1, -0.2, 3, 0.35, Math.PI - 0.35);
    g.stroke();
    g.fillStyle = '#ffd25a';
    shape(g, [3.6, 7.4, 4.2, 4.2, 7.4, 1, 8, 1.6, 4.8, 4.8]);
  },
  board(g) {
    line(g, -4.4, 3, -4.4, 7.4);
    line(g, 4.4, 3, 4.4, 7.4);
    g.fillStyle = '#ffd23f';
    rrect(g, -7.4, -6.6, 14.8, 10, 1);
    g.strokeStyle = '#3a6ad6';
    g.beginPath();
    g.moveTo(-4.8, 0.6);
    g.quadraticCurveTo(-2.4, -5.2, 0, -1.6);
    g.quadraticCurveTo(2, 1.6, 4.8, -3.6);
    g.stroke();
    g.strokeStyle = '#1b1430';
  },
  hide(g) {
    g.fillStyle = W;
    g.beginPath();
    g.moveTo(-6.6, 0);
    g.quadraticCurveTo(0, -6, 6.6, 0);
    g.quadraticCurveTo(0, 6, -6.6, 0);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#1b1430';
    g.beginPath();
    g.arc(0, 0, 2, 0, TAU);
    g.fill();
    line(g, -6, 5, 6, -5);
  },
  bus(g) {
    g.fillStyle = '#ffd25a';
    rrect(g, -5.4, -6.6, 10.8, 11.6, 2);
    g.fillStyle = '#9fd0ff';
    g.fillRect(-3.8, -4.8, 7.6, 4);
    g.strokeRect(-3.8, -4.8, 7.6, 4);
    g.fillStyle = '#1b1430';
    g.fillRect(-4.6, 5, 2.2, 2);
    g.fillRect(2.4, 5, 2.2, 2);
  },
  wheel(g) {
    g.fillStyle = W;
    circle(g, 0, -1, 5.6, true);
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      g.moveTo(Math.cos(a) * 5.6, -1 + Math.sin(a) * 5.6);
      g.lineTo(-Math.cos(a) * 5.6, -1 - Math.sin(a) * 5.6);
    }
    g.stroke();
    line(g, -4, 7, 0, -1, 4, 7);
    g.fillStyle = '#ff4fa3';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      g.beginPath();
      g.arc(Math.cos(a) * 5.6, -1 + Math.sin(a) * 5.6, 1.2, 0, TAU);
      g.fill();
    }
  },
  heli(g) {
    g.fillStyle = '#5a5470';
    circle(g, 0, 0, 6.4, true);
    g.strokeStyle = '#ffd23f';
    line(g, -2.6, -3.6, -2.6, 3.6);
    line(g, 2.6, -3.6, 2.6, 3.6);
    line(g, -2.6, 0, 2.6, 0);
    g.strokeStyle = '#1b1430';
  },
  fountain(g) {
    g.strokeStyle = '#3a6ad6';
    g.beginPath();
    g.moveTo(0, 4);
    g.lineTo(0, -5);
    g.moveTo(0, -5);
    g.quadraticCurveTo(-4.6, -6.6, -5.4, 1.6);
    g.moveTo(0, -5);
    g.quadraticCurveTo(4.6, -6.6, 5.4, 1.6);
    g.stroke();
    g.strokeStyle = '#1b1430';
    g.fillStyle = '#9fd0ff';
    rrect(g, -6.6, 3, 13.2, 3.6, 1.2);
  },
  court(g) {
    g.fillStyle = '#ff9a3c';
    circle(g, 0, 0, 6.2, true);
    g.beginPath();
    g.moveTo(-6.2, 0);
    g.lineTo(6.2, 0);
    g.moveTo(0, -6.2);
    g.lineTo(0, 6.2);
    g.moveTo(-4.2, -4.6);
    g.quadraticCurveTo(-1.4, 0, -4.2, 4.6);
    g.moveTo(4.2, -4.6);
    g.quadraticCurveTo(1.4, 0, 4.2, 4.6);
    g.stroke();
  },
  market(g) {
    g.fillStyle = W;
    g.fillRect(-5.6, -1, 11.2, 6.6);
    g.strokeRect(-5.6, -1, 11.2, 6.6);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? W : '#e2335f';
      g.beginPath();
      g.moveTo(-7 + i * 3.5, -1);
      g.lineTo(-6 + i * 3.5, -6);
      g.lineTo(-2.5 + i * 3.5, -6);
      g.lineTo(-3.5 + i * 3.5, -1);
      g.closePath();
      g.fill();
      g.stroke();
    }
  },
  beach(g) {
    line(g, 0, -4.6, 1.6, 7);
    g.fillStyle = '#ff7eb6';
    g.beginPath();
    g.moveTo(-7, -1.6);
    g.quadraticCurveTo(-1, -9.6, 6.8, -4.2);
    g.quadraticCurveTo(4.6, -3.8, 3.2, -2.6);
    g.quadraticCurveTo(1.2, -4.6, -1.4, -2.4);
    g.quadraticCurveTo(-4, -3.6, -7, -1.6);
    g.closePath();
    g.fill();
    g.stroke();
  },
  tower(g) {
    g.fillStyle = '#b3a6e6';
    shape(g, [-4.4, 7, -4.4, -4, -1.6, -7.4, 1.6, -7.4, 4.4, -4, 4.4, 7]);
    line(g, -1.6, -2, -1.6, 5);
    line(g, 1.6, -2, 1.6, 5);
  },
  car(g) {
    g.fillStyle = '#5f8be8';
    shape(g, [-7, 2.4, -7, -0.6, -4.2, -1.2, -2.4, -4.6, 3, -4.6, 5, -1.2, 7, -0.6, 7, 2.4]);
    g.fillStyle = '#1b1430';
    circle(g, -3.8, 3, 1.7, true);
    circle(g, 3.8, 3, 1.7, true);
  },
  // the phone's apps
  mapApp(g) {
    g.fillStyle = '#fffaf0';
    shape(g, [-7, -5, -2.4, -7, 2.4, -5, 7, -7, 7, 5, 2.4, 7, -2.4, 5, -7, 7]);
    line(g, -2.4, -7, -2.4, 5);
    line(g, 2.4, -5, 2.4, 7);
    g.strokeStyle = '#e2335f';
    g.beginPath();
    g.moveTo(-5, 3);
    g.quadraticCurveTo(-1, -4, 4.6, -2);
    g.stroke();
    g.strokeStyle = '#1b1430';
  },
  camera(g) {
    g.fillStyle = '#5a5470';
    rrect(g, -7.4, -4, 14.8, 10, 2);
    rrect(g, -3, -6.6, 6, 3, 1);
    g.fillStyle = '#9fd0ff';
    circle(g, 0, 1, 3.4, true);
    g.fillStyle = '#ffd23f';
    g.fillRect(4, -2.6, 2, 1.4);
  },
  photos(g) {
    g.fillStyle = '#fffaf0';
    g.save();
    g.rotate(-0.2);
    rrect(g, -6.4, -6, 11, 10, 1);
    g.restore();
    g.save();
    g.rotate(0.15);
    rrect(g, -4.6, -4.4, 11, 10, 1);
    g.fillStyle = '#9fd0ff';
    g.fillRect(-3.2, -3, 8.2, 5.4);
    g.fillStyle = '#5cbf4a';
    shape(g, [-3.2, 2.4, 0, -0.8, 2.4, 1.2, 5, -1.4, 5, 2.4]);
    g.restore();
  },
  gear(g) {
    g.fillStyle = '#d2c0f3';
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const r = i % 2 ? 5 : 7.2;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#fffaf0';
    circle(g, 0, 0, 2.4, true);
  },
  gang(g) {
    g.fillStyle = '#ff8a8a';
    g.beginPath();
    g.moveTo(-5.4, -4.6);
    g.lineTo(5.4, -4.6);
    g.lineTo(6.4, 5.4);
    g.lineTo(-6.4, 5.4);
    g.closePath();
    g.fill();
    g.stroke();
    line(g, -3.6, -1.6, 3.6, 2.6);
    line(g, -3.6, 2.6, 3.6, -1.6);
  },
};

// the destination: a pin whose point is at (0, 0), with a flag in it
export function pin(g, x, y, size = 1) {
  g.save();
  g.translate(x, y);
  g.scale(size, size);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const body = () => {
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-4, -9, -12, -14, -12, -23);
    g.arc(0, -23, 12, Math.PI, 0);
    g.bezierCurveTo(12, -14, 4, -9, 0, 0);
    g.closePath();
  };
  g.fillStyle = 'rgba(27, 20, 48, 0.85)';
  g.translate(1.6, 2);
  body();
  g.fill();
  g.translate(-1.6, -2);
  g.fillStyle = '#ff4fa3';
  g.strokeStyle = '#1b1430';
  g.lineWidth = 2.2;
  body();
  g.fill();
  g.stroke();
  g.fillStyle = '#fffaf0';
  g.beginPath();
  g.arc(0, -23, 7.6, 0, TAU);
  g.fill();
  g.lineWidth = 1.6;
  line(g, -2.8, -17.6, -2.8, -29);
  g.fillStyle = '#ffd23f';
  shape(g, [-2.8, -29, 4.4, -26.4, -2.8, -23.6]);
  g.restore();
}

// a sticker: the group's colour in a circle (a rounded square for the blueprints and the buses),
// an ink edge and its shadow, the drawing inside
export function sticker(g, x, y, kind, fill, size = 11, o = {}) {
  g.save();
  g.translate(x, y);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const square = o.square;
  const path = () => {
    g.beginPath();
    if (square) {
      const r = size * 0.92;
      const c = size * 0.36;
      g.moveTo(-r + c, -r);
      g.arcTo(r, -r, r, r, c);
      g.arcTo(r, r, -r, r, c);
      g.arcTo(-r, r, -r, -r, c);
      g.arcTo(-r, -r, r, -r, c);
      g.closePath();
    } else g.arc(0, 0, size, 0, TAU);
  };
  if (o.ring) {
    g.beginPath();
    g.arc(0, 0, size + 5, 0, TAU);
    g.fillStyle = 'rgba(255, 210, 63, 0.55)';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#1b1430';
    g.stroke();
  }
  g.fillStyle = 'rgba(27, 20, 48, 0.85)';
  g.translate(1.4, 1.8);
  path();
  g.fill();
  g.translate(-1.4, -1.8);
  g.fillStyle = fill;
  g.strokeStyle = '#1b1430';
  g.lineWidth = o.dashed ? 1.6 : 2;
  if (o.dashed) g.setLineDash([3, 2.4]);
  path();
  g.fill();
  g.stroke();
  g.setLineDash([]);
  const s = (size / 11) * (o.scale || 1);
  g.scale(s * 0.86, s * 0.86);
  g.lineWidth = 1.5;
  g.strokeStyle = '#1b1430';
  g.fillStyle = '#fffaf0';
  const fn = GLYPHS[kind];
  if (fn) fn(g);
  g.restore();
}
