import { PAINTERS } from './heroink.js';
import { FOLK_PAINTERS } from './folkink.js';

// (v5, ROADMAP 13.1) The helper that draws the hero's drawings off the game's own thread - and, ROADMAP
// 13.6, the city's people's drawn as he is (render/heroart.js asks; each comes back as a picture)
self.onmessage = (e) => {
  const { art, folk, name, i, w, h, seed, blink } = e.data;
  const c = new OffscreenCanvas(w, h);
  // (ROADMAP 13.6: or one of the city's people's, by their number)
  if (folk !== null && folk !== undefined) FOLK_PAINTERS[name](c, { seed, blink, spec: folk });
  else PAINTERS[name](c, { seed, blink });
  const bmp = c.transferToImageBitmap();
  self.postMessage({ art, name, i, bmp }, [bmp]);
};
