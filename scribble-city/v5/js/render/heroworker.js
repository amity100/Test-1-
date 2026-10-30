import { PAINTERS } from './heroink.js';

// (v5, ROADMAP 13.1) The helper that draws the hero's drawings off the game's own thread
// (render/heroart.js asks; each comes back as a picture)
self.onmessage = (e) => {
  const { name, i, w, h, seed, blink } = e.data;
  const c = new OffscreenCanvas(w, h);
  PAINTERS[name](c, { seed, blink });
  const bmp = c.transferToImageBitmap();
  self.postMessage({ name, i, bmp }, [bmp]);
};
