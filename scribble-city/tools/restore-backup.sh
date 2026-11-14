#!/usr/bin/env bash
# Puts the game on the site back to a backup kept on the site itself: gh-pages/<name>/scribble-city
# (a whole copy of the game as it was, playable at its own link the while - e.g.
# https://amity100.github.io/Test-1-/backup-r22b/scribble-city/v5/). The site's scribble-city/ becomes
# that copy again, in one new commit on gh-pages - nothing of its history rewritten, and the copy
# itself left where it is. The game is back at its usual link a minute or two later.
#   bash scribble-city/tools/restore-backup.sh backup-r22b
#
# The backups so far (the site's copy, and the commit its game was published from):
#   backup-r22b   7f630b9   round 22b, before round 23's film fixes
#   backup-r25   809b51a   round 25, before the phone speed work (PHONE_SPEED_PLAN.md, ROADMAP 19)
#   backup-r26   2c582d4   before the new look: no look layer at all in it (source 2d0eb85; the first look commit, 69e86bf, came
#                           after) - the game as it was before the street's new graphics, its light, the new Danny and Lily, the film work
#
# The code itself back to such a commit, as a new commit on the working branch (also nothing
# rewritten):  git checkout <commit> -- scribble-city && git commit -m "Back to <name>"
set -euo pipefail
name="${1:?which backup - its name on the site, e.g. backup-r22b}"
root="$(git rev-parse --show-toplevel)"
cd "$root"
git fetch -q origin gh-pages
base="$(git rev-parse origin/gh-pages)"
if ! git cat-file -e "$base:$name/scribble-city" 2>/dev/null; then
  echo "no backup called $name on the site"
  exit 1
fi
# (the new tree: the site's own, its scribble-city/ swapped for the copy - made from the trees
# themselves, nothing checked out)
sub="$(git rev-parse "$base:$name/scribble-city")"
tree="$(git ls-tree "$base" | awk -v s="$sub" -F '\t' '{ if ($2 == "scribble-city") { split($1, a, " "); print a[1] " " a[2] " " s "\t" $2 } else print }' | git mktree)"
if [ "$tree" = "$(git rev-parse "$base^{tree}")" ]; then
  echo "the site already has $name"
  exit 0
fi
commit="$(git commit-tree "$tree" -p "$base" -m "The game on the site back to the backup $name")"
git push -q origin "$commit:refs/heads/gh-pages"
echo "restored $name - https://amity100.github.io/Test-1-/scribble-city/v5/"
