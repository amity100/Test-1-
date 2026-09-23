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
  other side before you commit. Range: 60 m.
* **Rifts stay open until you close them** (X / middle mouse / ✕) and they are
  silent: guards react to *you*, never to a rift. Up to three rift pairs can be
  open at once; opening a fourth closes the oldest.
* **Perch.** Aim high on a wall, or under a crane boom, and the rift lands you
  *on top*: roofs, container stacks, the searchlight tower, the crane.
* **Smart snapping.** Aim near an unaware guard you can see and the rift locks
  in right behind him, facing his back.
* **No suicide rifts.** A placement that would drop you from a lethal height,
  or over water, is refused ("no safe landing"). Long falls hurt; a rooftop
  fall kills.
* **Snatch** a guard standing at the far end of an open rift; drop an **Anchor**
  in a hidden corner and throw bodies through a rift to it.
* **Inhibitors** block rifts inside their purple dome.

## Mission: Operation Pier 9

A walled port compound at dusk, designed so that walking is never enough:
you start on a 16 m rooftop across a canal; a 6.5 m wall surrounds the
compound (look through the mesh gate or climb a stepped container stack to see
over it); a searchlight sniper sweeps the central plaza; the ledger sits on a
control-tower deck 18 m up (keycard elevator from the officer, or sabotage the
warehouse inhibitor and rift up from the crane or the plaza); extraction is a
helicopter on a barge out on the water.

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
