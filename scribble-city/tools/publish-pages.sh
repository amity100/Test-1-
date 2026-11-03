#!/usr/bin/env bash
# Puts the game, as it is committed now (HEAD), on the repository's site: the branch GitHub Pages
# publishes (gh-pages) gets it in its own folder, scribble-city/ - next to what is already there
# (FLAGKEEP at the site's root), which is left as it was.
#   bash scribble-city/tools/publish-pages.sh
# The game is then at https://amity100.github.io/Test-1-/scribble-city/v5/ a minute or two later.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
src="$(git rev-parse --short HEAD)"
tmp="$(mktemp -d)"
trap 'cd "$root"; git worktree remove --force "$tmp" >/dev/null 2>&1 || true; rm -rf "${tmp:?}"' EXIT
git fetch -q origin gh-pages
git worktree add -q --detach "$tmp" origin/gh-pages
rm -rf "${tmp:?}/scribble-city"
git archive HEAD scribble-city | tar -x -C "$tmp"
cd "$tmp"
git add -A scribble-city
if git diff --cached --quiet; then
  echo "the site already has this version of the game"
  exit 0
fi
# (PUBLISH_MSG: more lines for the commit's message, if any)
git commit -q -m "Scribble City on the site, from $src" ${PUBLISH_MSG:+-m "$PUBLISH_MSG"}
git push -q origin HEAD:gh-pages
echo "published $src - https://amity100.github.io/Test-1-/scribble-city/v5/"
