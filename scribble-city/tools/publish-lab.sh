#!/usr/bin/env bash
# (GRAPHICS_PLAN.md) Puts the game, as it is committed now (HEAD), on the repository's site in a folder of its own, lab/scribble-city -
# the trial of the new look, apart from the game itself (scribble-city/ on the site is not touched).
#   bash scribble-city/tools/publish-lab.sh
# The trial is then at https://amity100.github.io/Test-1-/lab/scribble-city/v5/?look=1 a minute or two later.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
src="$(git rev-parse --short HEAD)"
tmp="$(mktemp -d)"
trap 'cd "$root"; git worktree remove --force "$tmp" >/dev/null 2>&1 || true' EXIT
git fetch -q origin gh-pages
git worktree add -q --detach "$tmp" origin/gh-pages
git -C "$tmp" rm -r -q --ignore-unmatch lab >/dev/null
mkdir -p "$tmp/lab"
# (only what the game itself reads: its own folder and the shared three.js beside it)
git archive HEAD scribble-city/v5 scribble-city/js | tar -x -C "$tmp/lab"
# (the game's code in one file, made small - one download instead of hundreds, and less for a phone
# to read before it can start; the files one by one stay too, for its helper thread. Without
# esbuild: published as it is)
ESBUILD="${ESBUILD:-npx --yes esbuild@0.24.0}"
v5="$tmp/lab/scribble-city/v5"
if (cd "$tmp/lab/scribble-city" && $ESBUILD v5/js/main.js --bundle --format=esm --minify --target=es2020 --alias:three=./js/vendor/three.module.min.js --outfile="v5/js/main.bundle.$src.js" --log-level=error); then
  # (the file named by the commit it was made from: a phone that kept the last one asks for this one - the owner saw the sky of the
  # build before on a link that had a newer one)
  sed -i "s#src=\"js/main.js\"#src=\"js/main.bundle.$src.js\"#" "$v5/index.html"
  echo "bundled: $(du -h "$v5/js/main.bundle.$src.js" | cut -f1)"
else
  # (no bundle: every module the game reaches named up front in the page, so the browser asks for
  # all of them at once - not a level of imports at a time, each level a round trip)
  if node "$root/scribble-city/tools/modulepreload.mjs" "$v5" > "$tmp/preload.txt"; then
    python3 - "$v5/index.html" "$tmp/preload.txt" <<'PYEOF'
import sys
page, links = sys.argv[1], open(sys.argv[2]).read()
s = open(page).read()
tag = '<script type="module" src="js/main.js"></script>'
if tag in s and 'rel="modulepreload"' not in s:
    s = s.replace(tag, links + tag)
    open(page, 'w').write(s)
PYEOF
    echo "bundling failed - published as it is, its $(wc -l < "$tmp/preload.txt") modules preloaded"
  else
    echo "bundling failed - published as it is"
  fi
fi
cd "$tmp"
git add -A lab
if git diff --cached --quiet; then
  echo "the site already has this version of the trial"
  exit 0
fi
# (PUBLISH_MSG: more lines for the commit's message, if any)
git commit -q -m "The new look's trial on the site (lab/), from $src" ${PUBLISH_MSG:+-m "$PUBLISH_MSG"}
git push -q origin HEAD:gh-pages
echo "published $src - https://amity100.github.io/Test-1-/lab/scribble-city/v5/?look=1"
