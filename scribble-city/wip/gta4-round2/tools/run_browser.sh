#!/bin/bash
# One headless browser at a time on this machine (4 processors): every browser test of every agent
# goes through this lock. Usage (from anywhere):
#   run_browser.sh <worktree>/scribble-city <script.json> <out prefix> [W] [H] [query]
# Writes "<out prefix>.log" with the page's console, [eval] results and [shot] names; screenshots are
# "<out prefix>_<shot>.png"; then "<out prefix>.done" containing the exit code.
ROOT="$1"; JSON="$2"; OUT="$3"; W="${4:-1280}"; H="${5:-720}"; Q="${6:-test=1&autostart=1}"
LOCK=/tmp/claude-0/-home-user-Test-1-/1f04fdad-ca96-5cb8-bcb1-fccf2f5dd162/scratchpad/gta4/browser.lock
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT.done"
cd "$ROOT" || { echo 99 > "$OUT.done"; exit 99; }
flock "$LOCK" env PAGE=v5/index.html MAXLOG=3000 timeout 1500 node tools/play.mjs "$Q" "$JSON" "$OUT" "$W" "$H" > "$OUT.log" 2>&1
code=$?
echo "$code" > "$OUT.done"
exit $code
