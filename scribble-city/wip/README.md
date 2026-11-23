# Paused work (23.11)

The owner asked to stop the parallel jobs and go one part at a time. What the three paused jobs had written but
not finished is kept here as patches, off the game, so the game stays as last tested:

- `boxing-paused.patch` - the boxing fight (boxing.js, boxrig.js): camera side and uppercut reach fixes in progress.
- `hoverbike-places-paused.patch` - the Hover Bike ride and its hover pads (rides.js, ridemodels.js, fuse.js,
  fusemodel.js, traycat.js, buildtray.js, vehicles.js, game.js, weapons.js, audio.js, blueprints.js) and the
  find places' roof boards (city.js, roofs.js). Not finished, not tested.

To take one up again: `git apply wip/<name>.patch` from `scribble-city`, finish it, test it, then delete the patch.
