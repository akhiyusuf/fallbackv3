#!/bin/bash
# Cut a clay render off a plain flat grey background (what the image prompts ask for).
# Background = no colour (low saturation) and close to the corner's brightness, connected to the picture's edge.
# usage: cutout_flat.sh in.png out.png [sat%=3.5] [band%=5] [holes=0|1] [close=4]
#   holes=1 also clears enclosed background (inside a handle or a loop); close = how big a bite out of the clay gets filled back in
#   (lower it when the picture has narrow gaps, like the rays of a sun, that would otherwise fill with grey)
in=$1; out=$2; sat=${3:-3.5}; band=${4:-5}; holes=${5:-0}; close=${6:-4}; T=$(mktemp -d)
b=$(convert "$in" -crop 8x8+4+4 +repage -colorspace HSB -channel B -separate +channel -format "%[fx:mean*100]" info:)
lo=$(python3 -c "print(max(0,$b-$band))"); hi=$(python3 -c "print(min(100,$b+$band))")
convert "$in" -colorspace HSB -channel G -separate +channel -threshold ${sat}% -negate $T/lowsat.png
convert "$in" -colorspace HSB -channel B -separate +channel -black-threshold ${lo}% -white-threshold ${hi}% -fill black -opaque white -fill white +opaque black $T/band.png
convert $T/lowsat.png $T/band.png -compose Multiply -composite $T/cand.png
if [ "$holes" = 1 ]; then
  # every background-coloured area counts, but only if it is big enough not to be a highlight on the clay
  convert $T/cand.png -morphology Open Disk:6 $T/bg.png
  convert $T/cand.png -bordercolor white -border 1 -fill red -draw "color 0,0 floodfill" -shave 1x1 -fill black +opaque red -fill white -opaque red $T/edge.png
  convert $T/bg.png $T/edge.png -compose Lighten -composite $T/bg.png
else
  convert $T/cand.png -bordercolor white -border 1 -fill red -draw "color 0,0 floodfill" -shave 1x1 -fill black +opaque red -fill white -opaque red $T/bg.png
fi
# alpha = not background; close small bites, drop specks, pull in a little and feather so no grey fringe is left
convert $T/bg.png -negate -morphology Close Disk:${close} -morphology Open Disk:3 -morphology Erode Disk:1.6 -blur 0x0.8 $T/alpha.png
convert "$in" $T/alpha.png -alpha off -compose CopyOpacity -composite -trim +repage "$out"
rm -rf $T
