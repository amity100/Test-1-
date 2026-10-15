#!/bin/sh
# The start of each class's drawings in Quick, Draw! (Google, CC BY 4.0): the simplified ones,
# about 16 MB of each - enough for 21,000 recognized drawings - into raw/
set -e
cd "$(dirname "$0")"
mkdir -p raw
while IFS= read -r c; do
  [ -n "$c" ] || continue
  f="raw/$(echo "$c" | tr ' ' '_').part"
  u="https://storage.googleapis.com/quickdraw_dataset/full/simplified/$(echo "$c" | sed 's/ /%20/g').ndjson"
  curl -sS -r 0-16000000 -o "$f" "$u" || echo "FAIL $c"
done < classes.txt
