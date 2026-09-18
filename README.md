# VANTAGE — Mission 01: Blacksite Delta

A single-player tactical shooter where you are two things at once: an **operator on the ground** fighting alongside your fireteam, and an **architect above the battlefield** who can pick up the compound's structures (barriers, steel panels, shipping containers, ramps, stairs, catwalks, crates) and rebuild the fight in slow motion.

Two operators of Fireteam Halcyon are held in a black-site detention compound. Insert with your squad, find both prisoners, and bring them to the extraction pad. The site was built to keep people in — rebuild it to get them out.

## Play

**Easiest:** open `dist/VANTAGE.html` in Chrome, Edge or Firefox (double-click; no server or internet needed).
It is a single self-contained file with the engine, models, textures and environment map embedded.

**From source** (any static server works):

```bash
npm install
npm start          # http://localhost:8080
```

or `python3 -m http.server 8080` in the repository folder, then open `http://localhost:8080/`.

Requirements: WebGL 2, a mouse (pointer lock), and a GPU. The graphics quality preset can be lowered in Settings.

## Controls

| On the ground | |
|---|---|
| Move / sprint / crouch | `W A S D` / `Shift` / `C` |
| Jump, vault over low cover | `Space` |
| Fire / aim | Left mouse / right mouse |
| Reload / grenade | `R` / `G` |
| Interact (free prisoner, revive, cut power) | hold `E` |
| Squad: follow me / hold position | `Q` |
| **Architect view** | `Tab` |
| Pause | `Esc` |

| Architect view (time runs at 12%) | |
|---|---|
| Select and drag a module | Left mouse |
| Rotate the module | `R` |
| Order the squad: move here / focus fire / escort / follow | Right mouse on ground / enemy / prisoner / yourself |
| Pan, orbit, zoom | `W A S D` or screen edges, `Q` `E` or middle mouse, wheel |
| Recentre on yourself | `F` |

## The rules that make it deep

- **Reach.** A module can only be moved while a squad member is within 20 m of it. Push forward to unlock more of the site.
- **Structural charge.** Every placement costs charge (crates 8 … containers 38). Charge refills slowly and jumps when you complete objectives.
- **Support and physics.** Pieces drop onto whatever is beneath them, stack (crate on container, ramp against a mezzanine), and cannot be placed through people or walls. Elevated pieces need most of their footprint supported.
- **Noise.** Moving a module is loud. Guards within 16 m come to investigate.
- **Light.** Guards see 34 m into floodlit ground but only 13 m into darkness. A container dropped between a floodlight and your route casts a real shadow for their perception. Cutting the power at the guard house darkens the whole site (and unlocks the electronic cell-block door).
- **Cover that thinks.** Guards seek cover relative to where they last saw you, peek and hide, flank when suppressed, throw grenades when you hide too long, and radio each other. Move the wall they are hiding behind and their cover is gone.
- **Intel.** In the Architect view you only see enemies your team can currently see; the rest are shown as last-known ghosts with their vision cones.
- **Several ways in.** The cell block can be opened by cutting the power, by taking the key from the officer in the warehouse, or by pulling the steel panel out of its west wall.

## Project layout

```
index.html            dev entry (ES modules, no build step)
src/core              config, i18n (EN/HE), input, procedural audio, collision world, layered nav grid, assets
src/render            procedural PBR materials, post-processing (bloom, grade, SMAA)
src/entities          character (skinned model, IK limbs, poses), player, enemy AI, squad AI, hostages, weapons
src/architect         Architect view: slow-motion camera, module placement rules, orders, fog of war
src/world             level builder (merged static geometry, doors, movable modules) and Mission 01
src/fx                particles, tracers, decals, rain, explosions
src/ui                HUD and menus
tools/                build (single-file bundle), headless smoke test with screenshots
vendor/three          three.js r160 (module build + the addons used)
```

Build the single-file version: `npm run build` → `dist/VANTAGE.html`.
Run the automated smoke test (headless Chromium via Playwright): `node tools/smoke.mjs out/`.

## Credits

- Engine: [three.js](https://threejs.org) (MIT).
- Soldier model: "Vanguard" by T. Choonyung via Mixamo, as distributed with the three.js examples; textures and the night HDRI also from the three.js examples.
- Everything else (level, materials, AI, audio synthesis, UI) is original code in this repository.
