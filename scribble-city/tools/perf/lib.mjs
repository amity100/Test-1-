// (ROADMAP 19, PHONE_SPEED_PLAN.md) Shared by the probes in this folder: the game opened the way the
// player's own phone opens it - a screen of 882 x 411 CSS pixels held sideways, touch, the pixel
// ratio the game clamps to 2, so a canvas of 1764 x 822 and a drawing of 1544 x 719 - and put at a
// place. No graphics card here (SwiftShader): triangles, draws, passes and pictures can be measured,
// milliseconds cannot.
//
//   WHERE=island      the start of the game, on the island (the default)
//   WHERE=mall        the street east of Bayview Mall, looking at it (the mainland built round it)
//   WHERE=mall_in     under the dome inside Bayview Mall
//   WHERE=at:x,z,yaw  anywhere (the mainland and its shops built round it when x < -600)
//   WHERE=s2 ..       a scene of the opening film; COND="<js>" is waited for (g: the game, P: the prologue)
//   EXTRA="newgfx=1"  more for the address (& between them)
import { startServer, launch } from '../shot.mjs';

export const PLACES = { mall: [-700, -37, -1.57], mall_in: [-835, -37, -1.57] };

export async function open({ where = process.env.WHERE || 'island', query = process.env.EXTRA || '', cond = process.env.COND || '', dsf = 2.625, init = null, frames = 8 } = {}) {
  const server = await startServer();
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 882, height: 411 }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
  if (init) await pg.addInitScript(init);
  const scene = /^s\d/.test(where) ? where : null;
  const q = `test=1&autostart=1&prologue=${scene || 0}${query ? '&' + query.replace(/^&/, '') : ''}`;
  await pg.goto(`http://127.0.0.1:${server.address().port}/v5/index.html?${q}`);
  await pg.waitForFunction('window.__ready === true', null, { timeout: 1500000, polling: 1000 });
  const at = PLACES[where] || (where.startsWith('at:') ? where.slice(3).split(',').map(Number) : null);
  if (at) {
    await pg.evaluate(([x, z, yaw]) => {
      const g = window.__game;
      if (g.world.mainland && x < -600) {
        g.world.mainland.fill({ x, z });
        if (g.world.interiors && g.world.interiors.fill) g.world.interiors.fill(x, z, 20000, 0);
      }
      g.player.spawn(x, z, yaw || 0);
      g.camRig.yaw = yaw || 0;
    }, at);
    // (the shops round it filled in by the game itself too, a little a frame)
    await pg.evaluate(() => window.__frame(40));
  }
  if (scene) {
    await pg.evaluate(async () => {
      const g = window.__game;
      const P = g.prologue;
      const m = await import('./js/game/prologue/autopilot.js');
      P.autopilot = new m.Autopilot(P);
    });
    let t = 0;
    let ok = !cond;
    while (!ok && t < 300) {
      t = await pg.evaluate(() => {
        const g = window.__game;
        for (let i = 0; i < 6; i++) g.update(1 / 30);
        window.__t = (window.__t || 0) + 0.2;
        return window.__t;
      });
      ok = await pg.evaluate((c) => {
        const g = window.__game;
        const P = g.prologue;
        try {
          return !!eval(c);
        } catch (e) {
          return false;
        }
      }, cond);
    }
    console.log('cond', t.toFixed(1), ok);
  }
  await pg.evaluate((n) => window.__frame(n), frames);
  return {
    pg,
    where,
    close: async () => {
      await browser.close();
      server.close();
    },
  };
}

// the names of the pens' kinds (render/materials.js uKind)
export const KIND = ['wall', 'ground', 'street', 'cyl', 'box', 'uv', 'glass', 'leaf', 'neon', 'water', 'skin', 'paint'];
