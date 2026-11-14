# גיבוי: הקניון הקודם (DOWNTOWN GALLERIA)

הגיבוי נלקח לפני שהקניון נבנה מחדש בתור BAYVIEW MALL (ROADMAP 13.2).

- **הגרסה המלאה שמורה ב־git, ב־commit `ca1c8c8`.** זה ה־commit האחרון לפני השינוי, בענף `claude/serene-hypatia-mj9w2j`.
- **הקבצים כאן הם עותק של הקבצים שהשינוי נוגע בהם,** באותם נתיבים.

**כדי להחזיר את הקניון הקודם במלואו** (מתוך התיקייה `scribble-city`):

```
git checkout ca1c8c8 -- v5/index.html v5/js/main.js v5/js/game/game.js v5/js/game/mall.js v5/js/render/glsl.js v5/js/render/materials.js v5/js/ui/citymap.js v5/js/world/hallpaint.js v5/js/world/mats.js v5/js/world/mainland/blocks.js v5/js/world/mainland/lanes.js v5/js/world/mainland/megamall.js v5/js/world/mainland/plan.js v5/js/world/mainland/far.json
```

אפשר גם להעתיק את הקבצים מהתיקייה הזאת למקומם (אותם נתיבים). הקבצים החדשים של BAYVIEW MALL (`v5/js/world/mainland/bayview.js`, `v5/js/world/bayart.js`, `v5/js/game/mallcrowd.js`) יכולים להישאר: אחרי ההחזרה אף קובץ לא משתמש בהם.

`far.json` שבגיבוי הוא מה שרואים מרחוק של הקניון הקודם, כך שלא צריך לאפות מחדש. רק לבדוק.
