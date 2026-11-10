import { PAINTERS } from './heroink.js';
import { FOLK_PAINTERS } from './folkink.js';

// (v5, ROADMAP 13.1) The helper that draws the hero's drawings off the game's own thread - and, ROADMAP
// 13.6, the city's people's drawn as he is (render/heroart.js asks; each comes back as a picture)
self.onmessage = (e) => {
  const { art, folk, name, i, w, h, seed, blink, flat, expr } = e.data;
  try {
    const c = new OffscreenCanvas(w, h);
    // (ROADMAP 13.6: or one of the city's people's, by their number)
    // (ROADMAP 14.1: flat - a portrait's picture, its colours and features without shading)
    if (folk !== null && folk !== undefined) FOLK_PAINTERS[name](c, { seed, blink, spec: folk, flat });
    else PAINTERS[name](c, { seed, blink, expr });
    const bmp = c.transferToImageBitmap();
    self.postMessage({ art, folk, name, i, bmp }, [bmp]);
  } catch (err) {
    // (ROADMAP 13.7: one picture that could not be drawn - said, and the helper goes on with the rest)
    self.postMessage({ art, folk, name, i, err: String((err && err.stack) || err).slice(0, 400) });
  }
};
