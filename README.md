# THRESHOLD

A third-person stealth game where your only tool is the **rift**: open a
portal anywhere you can see, step through, take the guard down from behind,
and throw the body through a rift to a hideout of your choosing.

Runs in the browser on desktop (keyboard + mouse or gamepad) and on phones
and tablets (touch controls, landscape).

## Play locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build: `npm run build` (output in `dist/`). `npm test` runs the rift
math unit tests.

## Controls

| Action | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Move / look | WASD / mouse | Left / right stick | Left-side joystick / drag right side |
| **Aim rift** (time slows) | Hold right mouse | LT | Tap **RIFT** |
| **Open rift** | Left click | RT | **OPEN** |
| Rift distance | Mouse wheel | LB / RB | **DIST** slider |
| Rift facing | Q / E | D-pad | ⟲ ⟳ |
| Free placement (no snapping) | Hold Alt | — | — |
| Takedown · snatch · carry · throw · use | F | X | Action button |
| Rift to Anchor / set Anchor | Tap R / hold R | Y | ⚓ tap / hold |
| Close all rifts | X | R3 | ✕ |
| Crouch / sprint / jump-climb | C / Shift / Space | B / L3 / A | Buttons / push stick fully |
| Tactical view (vision cones) | Tab | Select | Shown while aiming |

## How rifts work

* **Aim → preview → open.** A hologram shows exactly where you will stand and
  which way you will face. It's tinted by exposure: teal = unseen, yellow =
  risky, red = a guard would see you. A live *rift view* window shows the
  other side before you commit.
* **Smart snapping.** Aim near an unaware guard and the rift locks in right
  behind him, facing his back. Aim at a ceiling above a guard to drop on him.
* **Surfaces decide orientation.** Floor = a standing doorway, wall = step out
  of the wall, ceiling = drop from above. The wheel overrides distance so you
  can place a rift in open ground.
* **Snatch.** Stand at your end of an open rift while a guard stands at the
  other end, and pull him through.
* **Anchor.** Drop a persistent anchor in a dark corner. Tap R to open a rift
  straight to it — to escape, or to dump bodies where nobody patrols.
* **Limits.** Three charges that recharge; open rifts glow and hum, so guards
  who see or hear them come to look; purple inhibitor fields block rifts.

## Project layout

```
src/
  config.ts            all tuning values (movement, rift feel, stealth, quality presets)
  engine/              input (kbm/pad), touch controls, procedural audio
  render/              renderer + post-processing, rift shader, sky/rain/lamps
  world/               collision, nav grid, procedural textures, the harbor level
  game/                rift system & math, player, camera, guards, game loop
  ui/                  HUD, menus, EN/HE strings, styles
public/assets/         character model (three.js example Soldier) and night HDRI
legacy/puppet-brawl/   the previous prototype, kept for reference
```

## Hosting

`.github/workflows/pages.yml` builds and deploys to GitHub Pages. Enable it
once under **Settings → Pages → Source: GitHub Actions**.
