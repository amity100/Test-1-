#!/usr/bin/env python3
"""Bake the Judah dressing mask (opaque RGB, lossless WebP) for src/film/land/landJudah.ts.

R = aridity, G = drainage, B = valley depth — copied from judah_lc.webp (RGBA, whose alpha channel would be
destroyed by a premultiplied 2D-canvas read at runtime), so the browser can read it exactly on the CPU to place
olive groves, terrace walls and villages only on the humid hills west of the rain-shadow line.

usage: python3 tools/land/bake_dress.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
src = ROOT / 'src/assets/land/judah_lc.webp'
dst = ROOT / 'src/assets/land/judah_dress.webp'
im = Image.open(src).convert('RGBA')
r, g, b, a = im.split()
out = Image.merge('RGB', (r, g, a)).resize((im.width // 2, im.height // 2), Image.BILINEAR)  # 60 m cells
out.save(dst, 'WEBP', lossless=True, quality=100, method=6)
print('wrote', dst, out.size, dst.stat().st_size, 'bytes')
