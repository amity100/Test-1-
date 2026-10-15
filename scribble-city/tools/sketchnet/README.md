# הרשת שמזהה ציורים (v5)

כך נבנית הרשת של `v5/js/game/sketchnet.js`, והמשקלים שלה ב־`v5/js/game/sketchnet_w.js`. ההסבר המלא נמצא ב־`ROADMAP.md`, סעיף 11.7.

הציורים מגיעים מ־Quick, Draw! של Google, ברישיון CC BY 4.0. הקבצים של הנתונים לא נשמרים במאגר, וכל שלב מוריד או מייצר אותם מחדש.

```sh
cd scribble-city/tools/sketchnet
python3 -m venv venv && ./venv/bin/pip install numpy jax optax   # נבדק עם jax 0.11, optax 0.2.8
./fetch.sh                               # ההתחלה של כל סוג (כ־16MB לסוג) אל raw/
./venv/bin/python build.py               # data_train.npz, data_val.npz, classes.json (כ־20–30 דקות, 4 ליבות)
./venv/bin/python train.py 4             # weights.npz (כ־12 דקות לסבב)
./venv/bin/python export.py ../../v5/js/game/sketchnet_w.js
./venv/bin/python parity.py && node parity.mjs   # הרשת בדפדפן נותנת את אותן תשובות
```

- `render.py`: איך ציור נהיה תמונה של 32×32, בדיוק כמו `picture` במשחק. כאן גם `qd`, ההכנה שעברו ציורי המאגר (והמשחק עושה אותה ב־`ready`), הגרסאות השונות של כל ציור (`augment`), והציורים שנוצרים בקוד בשביל מה שאין במאגר: אקדח, תת־מקלע, רובה ציד, מיניגאן, משגר רקטות, פצצה, טנק ומטוס מהצד.
- `train.py <סבבים> [משקלים להמשיך מהם] [שם]`: הרשת עצמה (JAX, על המעבד), והדיוק של כל סוג בסוף.
- `export.py <יעד> [משקלים]`: המשקלים כמספרים של בית אחד, עם קנה מידה לכל ערוץ.
