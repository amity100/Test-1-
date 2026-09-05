/**
 * Share card: the fortress screenshot composited with the player's name, style and stats.
 * Output is a 1280x720 PNG (data URL + blob) suitable for saving or the Web Share API.
 */
export interface CardInfo {
  name: string;
  colorHex: string;
  styleName: string;
  blocks: number;
  /** Optional match results. */
  place?: number;
  players?: number;
  score?: number;
  captures?: number;
  /** Localised labels. */
  labels: { fortressOf: string; blocks: string; score: string; captures: string; place: string; tagline: string; style: string };
  rtl: boolean;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, value: string, accent: string, alignRight: boolean): number {
  ctx.font = '700 22px Rajdhani, Rubik, Heebo, sans-serif';
  const vw = ctx.measureText(value).width;
  ctx.font = '600 14px Rajdhani, Rubik, Heebo, sans-serif';
  const lw = ctx.measureText(label.toUpperCase()).width;
  const w = Math.max(vw, lw) + 32;
  const h = 62;
  const left = alignRight ? x - w : x;
  ctx.fillStyle = 'rgba(8, 14, 22, 0.78)';
  roundRect(ctx, left, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(left, y + h - 3, w, 3);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9aa5b1';
  ctx.font = '600 14px Rajdhani, Rubik, Heebo, sans-serif';
  ctx.fillText(label.toUpperCase(), left + w / 2, y + 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 24px Rajdhani, Rubik, Heebo, sans-serif';
  ctx.fillText(value, left + w / 2, y + 48);
  return w;
}

export async function composeCard(shotUrl: string, info: CardInfo): Promise<{ dataUrl: string; blob: Blob | null }> {
  const W = 1280;
  const H = 720;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = new Image();
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = shotUrl;
  });
  // Cover-fit the screenshot.
  ctx.fillStyle = '#0f1923';
  ctx.fillRect(0, 0, W, H);
  if (img.width && img.height) {
    const s = Math.max(W / img.width, H / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
  // Vignette and bottom gradient for legibility.
  const grad = ctx.createLinearGradient(0, H * 0.55, 0, H);
  grad.addColorStop(0, 'rgba(8, 14, 22, 0)');
  grad.addColorStop(1, 'rgba(8, 14, 22, 0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  const top = ctx.createLinearGradient(0, 0, 0, 140);
  top.addColorStop(0, 'rgba(8, 14, 22, 0.75)');
  top.addColorStop(1, 'rgba(8, 14, 22, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 140);
  // Chamfered accent bars.
  ctx.fillStyle = info.colorHex;
  ctx.fillRect(0, 0, W * 0.42, 6);
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(W * 0.62, H - 6, W * 0.38, 6);
  // Logo.
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = '700 44px Rajdhani, Rubik, Heebo, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 12;
  ctx.fillText('FLAG', 48, 70);
  const flagW = ctx.measureText('FLAG').width;
  ctx.fillStyle = '#ff4655';
  ctx.fillText('KEEP', 48 + flagW, 70);
  ctx.shadowBlur = 0;
  ctx.font = '600 16px Rajdhani, Rubik, Heebo, sans-serif';
  ctx.fillStyle = '#c7d0da';
  ctx.fillText(info.labels.tagline.toUpperCase(), 50, 96);
  // Name block.
  const nameX = info.rtl ? W - 48 : 48;
  ctx.textAlign = info.rtl ? 'right' : 'left';
  ctx.font = '600 26px Rajdhani, Rubik, Heebo, sans-serif';
  ctx.fillStyle = '#c7d0da';
  ctx.fillText(info.labels.fortressOf, nameX, H - 118);
  ctx.font = '700 64px Rubik, Heebo, Rajdhani, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 16;
  ctx.fillText(info.name, nameX, H - 52);
  ctx.shadowBlur = 0;
  // Team swatch next to the name.
  const nameW = ctx.measureText(info.name).width;
  ctx.fillStyle = info.colorHex;
  roundRect(ctx, info.rtl ? nameX - nameW - 34 : nameX + nameW + 16, H - 96, 18, 44, 4);
  ctx.fill();
  // Stat chips on the other side.
  let x = info.rtl ? 48 : W - 48;
  const y = H - 116;
  const put = (label: string, value: string): void => {
    const w = chip(ctx, x, y, label, value, info.colorHex, !info.rtl);
    x += info.rtl ? w + 12 : -(w + 12);
  };
  put(info.labels.blocks, String(info.blocks));
  if (info.styleName) put(info.labels.style, info.styleName);
  if (info.score !== undefined) put(info.labels.score, String(info.score));
  if (info.captures !== undefined) put(info.labels.captures, String(info.captures));
  if (info.place !== undefined && info.players !== undefined) put(info.labels.place, `#${info.place}/${info.players}`);
  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
  return { dataUrl, blob };
}
