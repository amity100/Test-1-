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
//   NODET=1           not repeatable: the clock and the dice as the browser has them (see seed, virtualClock)
//
// Two runs of the same build must give the same picture and the same counts, or no change can be judged
// by them (PHONE_SPEED_PLAN.md 0.6: two photographs of one build differed by up to 5.6% - the people, the
// cars, a shop's goods being drawn in: the streamers and the shops work by the wall clock). So here: the
// dice are seeded (seed) and the clock stands still inside a frame, and moves by the game's own step
// between frames (virtualClock) - as the browser's, only the game's own doing. The game itself is not changed.
import { startServer, launch } from '../shot.mjs';

// the dice, seeded: Math.random in the page, and the ids three.js gives its objects on dice of their own,
// so that a build that makes one more object does not shift every roll after it (tools/ab.mjs)
export async function seed(pg, value = 7) {
  await pg.addInitScript((v) => {
    let a = v >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    let u = 99991;
    globalThis.__uuidRand = () => {
      u = (u * 16807) % 2147483647;
      return u / 2147483647;
    };
  }, value);
  await pg.route('**/three.module.min.js', async (route) => {
    const resp = await route.fetch();
    const body = (await resp.text()).replaceAll('4294967295*Math.random()', '4294967295*(globalThis.__uuidRand||Math.random)()');
    await route.fulfill({ response: resp, body });
  });
}

// the page's clock stands still, and moves only by a frame's step when the test steps a frame
// (window.__frame): the streamers (world/mainland/stream.js, world/interiors.js) take their slice of a
// frame by it, the shops draw their goods in by it - so a slow run and a fast one do the same. Put on
// after the game is ready (its own loading is left to the real clock)
export async function virtualClock(pg) {
  await pg.evaluate(() => {
    let t = performance.now();
    performance.now = () => t;
    const f = window.__frame;
    window.__frame = (n = 1, dt = 1 / 30) => {
      t += n * dt * 1000;
      return f(n, dt);
    };
  });
}

export const PLACES = { mall: [-700, -37, -1.57], mall_in: [-835, -37, -1.57] };

export async function open({ where = process.env.WHERE || 'island', query = process.env.EXTRA || '', cond = process.env.COND || '', dsf = 2.625, init = null, frames = 8, det = !process.env.NODET } = {}) {
  const server = await startServer();
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 882, height: 411 }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
  if (init) await pg.addInitScript(init);
  if (det) await seed(pg);
  const scene = /^s\d/.test(where) ? where : null;
  const q = `test=1&autostart=1&prologue=${scene || 0}${query ? '&' + query.replace(/^&/, '') : ''}`;
  await pg.goto(`http://127.0.0.1:${server.address().port}/v5/index.html?${q}`);
  await pg.waitForFunction('window.__ready === true', null, { timeout: 1500000, polling: 1000 });
  if (det) await virtualClock(pg);
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
