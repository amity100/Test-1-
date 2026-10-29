import { ClubNight } from './partyclub.js';
import { JazzNight } from './partyjazz.js';
import { SkyPool } from './partyroof.js';

// (v5, ROADMAP 12.9) The city's parties: NEON INK's big night in Paintwood (game/partyclub.js), the
// jazz at BLUE VELVET on Inkwood Boulevard (game/partyjazz.js), SKY POOL on the roof of the casino's
// tower (game/partyroof.js).
// Each one is built when you come near and taken down when you go; game/game.js runs them all
// through here - every frame, the drawing, what E does there and what the prompt says.

export class Parties {
  constructor(game) {
    this.game = game;
    this.club = new ClubNight(game, '2,3');
    this.jazz = new JazzNight(game, '7,2');
    this.roof = new SkyPool(game);
    this.list = [this.club, this.jazz, this.roof];
  }

  update(dt) {
    for (const p of this.list) p.update(dt);
  }

  draw(fr) {
    for (const p of this.list) p.draw(fr);
  }

  target() {
    for (const p of this.list) {
      const t = p.target();
      if (t) return t;
    }
    return null;
  }

  interact() {
    for (const p of this.list) if (p.target() && p.interact()) return true;
    return false;
  }

  // (game/soundscape.js: a club whose party plays its own music)
  owns(shop) {
    return this.list.some((p) => p.owns && p.owns(shop));
  }
}
