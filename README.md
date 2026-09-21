# VANTAGE — Mission 01: Blacksite Delta

A single-player stealth-action prototype. You are one operator with a **gateway generator**: open a portal to almost any room, step through, and be gone before anyone understands what happened. Every guard who sees a kill, a body, you, or an open gateway keys his radio and starts a countdown. Cut him off before the report goes out, or the whole site goes to alarm.

Two of ours are held in a black-site detention compound. Get in, free both prisoners, bring them to the helipad.

## Play

**Easiest:** open `dist/VANTAGE.html` in Chrome, Edge or Firefox (double-click; no server or internet needed).
It is a single self-contained file with the engine, models, textures and environment map embedded.

**From source** (any static server works):

```bash
npm install
npm start          # http://localhost:8080
```

or `python3 -m http.server 8080` in the repository folder, then open `http://localhost:8080/`.

Requirements: WebGL 2 and a GPU. On a desktop you play with mouse and keyboard (pointer lock); on a phone or tablet the game switches to touch controls by itself (`?touch=1` / `?touch=0` in the URL forces either). The graphics quality preset can be changed in Settings.

**On a phone:** open `dist/VANTAGE.html` (or the hosted page) in Chrome or Safari, turn the phone sideways and tap the screen. The game asks for fullscreen and landscape. A portrait layout also works but the map and the view are smaller. Quality defaults to *high* (near-native resolution, sharp anti-aliasing); if frames run slow for a few seconds the game steps down a level by itself and says so.

## Controls

| On the ground | |
|---|---|
| Move / sprint / crouch | `W A S D` / `Shift` / `Ctrl` or `Z` |
| Jump, vault over low cover | `Space` |
| Fire (suppressed pistol; M4 once you have it) / aim | Left mouse / right mouse |
| Knife takedown | `F` |
| Switch weapon | `1` `2` / wheel |
| Reload / grenade | `R` / `G` |
| Interact (free a prisoner, take the M4, pick up a body) | hold `E` |
| Drop / throw the carried body | `E` / left mouse |
| Gateway at the marker under the crosshair | `Q` |
| Gateway behind the locked guard, and straight through it | `X` |
| Close the gateway | `C` |
| **Tactical map** | `Tab` |
| Pause | `Esc` |

| Tactical map (time runs at 15%) | |
|---|---|
| Open a gateway at the cursor (the near end opens in front of you) | Left mouse |
| Close the gateway | Right mouse |
| Pan, orbit, zoom | `W A S D` or screen edges, `Q` `E` or middle mouse, wheel |
| Recentre on yourself | `F` |

| Touch (phone / tablet) | |
|---|---|
| Move / sprint | Left half of the screen: floating stick; push it all the way to sprint |
| Look | Drag anywhere on the right half |
| Fire | `FIRE` button |
| Knife takedown / interact / grenade / reload | `KNIFE` / `ACTION` / `NADE` / `RELOAD` buttons (they appear when they apply) |
| Switch weapon / crouch | `SWAP` / `CROUCH` |
| Gateway at the marker / behind the locked guard / close it | `GATE` / `BEHIND` / `CLOSE` |
| Tactical map | `MAP` (top right); `BACK` returns to the ground |
| On the map: place a gateway | Tap a spot to preview it, tap it again (or `OPEN`) to open it |
| On the map: pan / zoom | Drag with one finger / pinch |
| Pause | `II` (top right) |

## The loop

A ring under your crosshair shows where `Q` (phone: `GATE`) would open a gateway, with its distance: aim nearer or farther to place it, press, and walk through when you choose. Aim at a guard instead and cyan brackets mark him as locked: `X` (phone: `BEHIND`) opens the gateway **behind his back** and takes you straight through it, coming out a step behind him with the knife ready. Kill him next to the open gateway and his body slides through it, out of sight. Every kill inside the slow-motion window extends it, waives the generator's recharge and adds a link to the **chain** counter. A guard who is on the radio can be locked from anywhere, even off screen: `X` puts you behind him before the ring closes.

Guards use gateways too. One who spots an open gateway from close by walks up to it and steps through; one who sees you through it comes through after you. A flash at the other end and a warning tell you it is about to happen.

## Being seen

Guards take time to make you out, and the time depends on everything: half a second at arm's length, two seconds at 10 m, six seconds far off; a third of that rate at the edge of their eye, about half in the dark, half again when you are crouched, more when you run. In the dark they see 12 m; under a floodlight 28 m, which is what the control room's floodlight switch is for. A guard who glimpses you turns and walks over to look ("a guard is looking your way"); only a guard who has made you out keys his radio. Posted guards look around slowly, so a back stays a back for a few seconds at a time.

## The guards

They stand in groups that watch each other, and the groups get harder along the way: a lone guard by the forklift, then two men facing each other across the warehouse floor, then the office trio on the mezzanine (a gunner watching the walkway, a patroller, the officer with the cell key), then the cell block: two men facing each other down a 26 m corridor, a patroller between them, one at the prisoner's door. The man at the east end wears armour: the knife only wounds him, so it is two pistol rounds to the head from behind, or something louder.

## The two rules

**Gateways are real openings.** One pair at a time. Both ends can be seen through, shot through and heard through, and anyone can walk through either way, guards included. A gateway into the armory gives you a carbine, but a guard who looks through it sees the armory. Opening a new pair closes the old one. There is no limit on how many you open; what limits you is the second rule.

**The witness chain.** A guard who sees a kill, a body, you, or an open gateway keys his radio: a red ring over his head and a line in the top-right panel count down (3.5 s for a kill or a sighting, 4.5 s for a body, 5 s for a gateway or shots heard). Killing him before it ends cuts the chain. If a report completes the alarm goes up: every guard hunts you, two guards post themselves on each prisoner, and reinforcements come through the gates. You can still win, loudly.

The map lifts the roofs, so you can see inside the buildings and place a gateway in any room. Time slows to 15% while the map is open and to 30% for a moment after every crossing; each kill inside that window extends it, so a fast chain stays slow. Bodies can be carried and thrown through a gateway where nobody will find them. Running is heard at 9 m, the suppressed pistol at 8 m, the M4 at 45 m.

The end screen ranks the run: **Ghost** (no report ever went out), **Operative**, or **Loud**.

## Project layout

```
index.html            dev entry (ES modules, no build step)
src/core              config, i18n (EN/HE), input, procedural audio, collision world, layered nav grid, assets
src/render            procedural PBR materials, post-processing (bloom, grade, SMAA)
src/portal            the gateway pair: transforms, render-through views, crossings, sight/sound/bullets through
src/map               the tactical map (slow-motion view from above, gateway placement, fog-of-war intel)
src/entities          characters (skinned Mixamo soldier, IK posing), operator, guards (witness chain), prisoners, weapons
src/world             level builder (merged static geometry, doors, props) and Mission 01 + its script
src/ui                HUD, menus
tools/build.mjs       builds dist/VANTAGE.html (single file) and dist/artifact.html
tools/smoke.mjs       headless Chromium smoke test (level validation, gateways, witnesses, knife, bodies, alarm)
tools/playthrough.mjs headless scripted playthrough of the whole mission
tools/probe.mjs       headless query / screenshot helper
```

Soldier model: Mixamo Vanguard (three.js examples). Everything else (textures, audio, geometry) is generated at runtime.
