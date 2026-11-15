# (ROADMAP 23.13) Michael's campaign boards carry his face as the game itself draws him: the two poster pictures taken by
# tools/castone.mjs (posterLook.png, posterSmile.png) cut to the boards' frame and saved where game/prologue/set.js reads them.
#   WHO=michael QUERY="look=1" HOUR=17.5 SHOTS=posterLook,posterSmile node tools/castone.mjs <dir>
#   python3 tools/boardface.py <dir>
import sys
from PIL import Image

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else 'v5/img/prologue'
# the boards' frame is 450 x 414: the head and the collar in it, the eyes a little over its middle
for name, to in [('posterLook', 'michael_look_game.jpg'), ('posterSmile', 'michael_smile_game.jpg')]:
    im = Image.open(f'{src}/{name}.png').convert('RGB')
    W, H = im.size
    w = int(W * 0.74)
    h = int(w * 414 / 450)
    x0 = (W - w) // 2
    y0 = int(H * 0.5 - h * 0.5)
    im = im.crop((x0, y0, x0 + w, y0 + h)).resize((900, 828), Image.LANCZOS)
    im.save(f'{out}/{to}', quality=90)
    print(to, im.size)
