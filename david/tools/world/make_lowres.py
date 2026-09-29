"""512 px variants of the world textures for the phone ('low') content tier.

Run from the david/ folder after tools/world/gen_world_textures.py:
    python3 tools/world/make_lowres.py

Why offline: the world textures pack data into alpha (height in *_a, AO in *_n) or carry colour under
transparent texels (dilated foliage atlases). Downscaling them at runtime through a 2D canvas premultiplies
alpha and destroys that data (black texels on phones). Here every channel is resampled independently
(Lanczos on the straight, un-premultiplied values) and saved with `exact=True` so RGB under alpha 0 survives.
"""
import glob
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', 'src', 'assets', 'world')
SIZE = 512


def main():
    for path in sorted(glob.glob(os.path.join(SRC, '*.webp'))):
        stem = os.path.basename(path)[:-5]
        if stem.endswith('_512'):
            continue
        im = Image.open(path)
        im.load()
        if max(im.size) <= SIZE:
            continue
        s = SIZE / max(im.size)
        size = (max(1, round(im.size[0] * s)), max(1, round(im.size[1] * s)))
        bands = [b.resize(size, Image.LANCZOS) for b in im.split()]
        out = Image.merge(im.mode, bands)
        q = 90 if stem.endswith('_n') else 88
        dst = os.path.join(SRC, stem + '_512.webp')
        out.save(dst, 'WEBP', quality=q, method=6, exact=True, alpha_quality=100)
        print('wrote %-30s %6.1f KB' % (os.path.basename(dst), os.path.getsize(dst) / 1024))


if __name__ == '__main__':
    main()
