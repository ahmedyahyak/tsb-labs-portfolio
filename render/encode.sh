#!/bin/bash
# Encode the rendered frames into the scroll-scrub asset.
#
# Every flag here was decided by measurement, not preference:
#
#   H.264, not AV1 or HEVC, though both are 4-5x smaller. AV1 hardware
#   decode starts at M3 and A17 Pro; everything older decodes in software,
#   which burns battery and janks during scroll, which is precisely when
#   you cannot afford it. The larger codec buys smooth scrubbing.
#
#   -g 12 -keyint_min 12 -sc_threshold 0 -bf 0 gives a fixed GOP with no
#   B-frames, so decode order equals display order and every 12th frame is
#   an I-frame. Scrubbing to an arbitrary time never waits on a reorder.
#
#   The colour tagging is not optional. Measured on a lossless encode, an
#   untagged stream reports color_range=unknown and shifts near-black by
#   2-3 levels: (15,20,34) became (13,18,32). On a ground of #05070d that
#   is the whole look drifting because a header was missing.
#
#   No grain is baked in. Measured: grain in the master costs 5.4x the
#   bytes AND scores worse (SSIM 0.932 vs 0.996), because the codec cannot
#   preserve noise and spends its bitrate failing to. Grain, if wanted, is
#   a runtime overlay for ~2KB.
set -e
cd "$(dirname "$0")"

N=$(ls frames/*.png 2>/dev/null | wc -l | tr -d ' ')
[ "$N" -eq 0 ] && { echo "no frames"; exit 1; }
echo "  encoding $N frames"

ffmpeg -y -loglevel error -framerate 30 -start_number 1 -i frames/f%04d.png \
  -c:v libx264 -crf 21 -g 12 -keyint_min 12 -sc_threshold 0 -bf 0 \
  -preset slow -tune film -pix_fmt yuv420p \
  -color_range pc -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -x264-params "fullrange=1:colormatrix=bt709" \
  -movflags +faststart -an ../assets/stack.mp4

# The poster is the reduced-motion and slow-connection design, not a
# leftover: it is what most Lighthouse runs and every reduced-motion
# visitor actually sees, so it is chosen from the gate beat where the
# warm ring is lit and the stack is open.
GATE=$(printf "frames/f%04d.png" 91)
[ -f "$GATE" ] && {
  cwebp -quiet -q 78 "$GATE" -o ../assets/stack-poster.webp
  command -v avifenc >/dev/null && avifenc -q 65 --speed 6 "$GATE" ../assets/stack-poster.avif >/dev/null 2>&1 || true
}

echo "  mp4:    $(du -h ../assets/stack.mp4 | cut -f1)"
[ -f ../assets/stack-poster.webp ] && echo "  poster: $(du -h ../assets/stack-poster.webp | cut -f1) webp"
[ -f ../assets/stack-poster.avif ] && echo "  poster: $(du -h ../assets/stack-poster.avif | cut -f1) avif"

echo "  ── verifying the colour tagging actually landed ──"
ffprobe -v error -select_streams v:0 \
  -show_entries stream=color_range,color_space,color_primaries,has_b_frames \
  -of default=noprint_wrappers=1 ../assets/stack.mp4
