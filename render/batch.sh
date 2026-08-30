#!/bin/bash
B=/Volumes/Blender/Blender.app/Contents/MacOS/Blender
cd "/Users/zainulabideen/Desktop/My Projects/tsb-labs-portfolio/render"
for r in "1 30" "31 60" "61 90" "91 120"; do
  set -- $r
  echo "=== chunk $1..$2 $(date +%H:%M:%S)"
  "$B" -b tsb-stack.blend -s $1 -e $2 -a 2>&1 | grep -E "Saved:|Error" | tail -2
done
echo "=== done $(date +%H:%M:%S), $(ls frames/*.png 2>/dev/null | wc -l | tr -d ' ') frames"
