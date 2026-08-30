#!/bin/bash
B=/Volumes/Blender/Blender.app/Contents/MacOS/Blender
cd "/Users/zainulabideen/Desktop/My Projects/tsb-labs-portfolio/render"
START=$(( $(ls frames/*.png 2>/dev/null | wc -l | tr -d ' ') + 1 ))
for r in "$START 40" "41 70" "71 100" "101 120"; do
  set -- $r
  [ "$1" -gt "$2" ] && continue
  echo "=== chunk $1..$2 $(date +%H:%M:%S)"
  "$B" -b tsb-stack.blend -s $1 -e $2 -a 2>&1 | grep -cE "^Saved:" | xargs echo "    wrote"
done
echo "=== done $(date +%H:%M:%S), $(ls frames/*.png | wc -l | tr -d ' ') frames total"
