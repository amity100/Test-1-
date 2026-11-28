# R26 — paused at the owner's word (resume exactly from here)

Owner's request (R26): (b) serious damage + people flee gunfire; (c) blueprints in the city, photographed, a few on the map,
"one is near" notice; (d) valuables never on the open street - small, in alleys; (e) everything you have is "to draw
once" before it is in the library; (f) clear AAA explanations + demo; (g) guns held like GTA/CoD; (h) Fable for the hard parts.

## State when paused
- **Gun holding (R26-1)** and **damage + fleeing (R26-2)**: two jobs' work is in the tree, committed as WIP
  (gunhold.js, doodle.js, player.js / weapons.js, civilians.js, brain.js, enemies.js, farcrowd.js, traffic.js, wounds.js).
  Not finished, not verified, not published. Resume: finish and verify each (in-play captures phone + desktop, the
  opening story), then wire any game.js hooks.
- **Blueprints + library + tutorial (R26-3) and valuables hidden (R26-4)**: written and tested in a separate worktree,
  kept here as `wip/r26-blueprints.patch` (applies cleanly: `git apply scribble-city/wip/r26-blueprints.patch`).
  Checked: 22 finds all placed (16 old-board items as small 1.3 m pages in alleys / on roofs, never on the map); old
  street/roof boards of non-start items rubbed out (the tank board too - the tank itself is a later tier, hidden from
  the library); "a hidden blueprint is close" at 30 m; F / camera button photographs; card "PHOTOGRAPHED - now draw it
  once"; the pen opens on it with a pencil demo over its lines; a good drawing -> in the library, a touch makes it
  (phone and desktop). Map: 3 pinned (Rocket Booster, Inkhawk, Hover Bike) + a settings switch to show all.
  Story now under the start-kit rules too (no "everything open" in the story); rotor opens at the roof jump.
- **Not yet verified:** the story's end -> free roam handover (the test page closed mid-run twice in s7 on the
  autopilot - cause not found yet; looked external, re-run it).
- Then: apply the patch, test together (incl. the opening story via open2.mjs), commit, publish the lab, send.
