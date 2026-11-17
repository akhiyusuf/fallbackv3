#!/bin/bash
# Cut a clay render off the fake "transparent" checkerboard the image model paints.
# Background = neutral (no colour) and light, and connected to the picture's edge. usage: cutout.sh in.png out.png [sat%] [bri%] [floor_y floor_sat%]
in=$1; out=$2; sat=${3:-4.5}; bri=${4:-62}; floor_y=${5:-0}; floor_sat=${6:-8}
convert "$in" -colorspace HSB -channel G -separate +channel -threshold ${sat}% -negate /tmp/_lowsat.png
# optional: below row floor_y use a looser colour test, so a warm contact shadow on the floor counts as background too
if [ "$floor_y" -gt 0 ]; then
  h=$(identify -format %h "$in"); w=$(identify -format %w "$in")
  convert "$in" -colorspace HSB -channel G -separate +channel -threshold ${floor_sat}% -negate -crop ${w}x$((h-floor_y))+0+${floor_y} +repage /tmp/_lowsat_floor.png
  convert /tmp/_lowsat.png /tmp/_lowsat_floor.png -geometry +0+${floor_y} -compose Over -composite /tmp/_lowsat.png
fi
convert "$in" -colorspace HSB -channel B -separate +channel -threshold ${bri}% /tmp/_bright.png
convert /tmp/_lowsat.png /tmp/_bright.png -compose Multiply -composite /tmp/_cand.png
# keep only the candidate area that touches the border
convert /tmp/_cand.png -bordercolor white -border 1 -fill red -draw "color 0,0 floodfill" -shave 1x1 -fill black +opaque red -fill white -opaque red /tmp/_bg.png
# alpha = not background, pulled in a little and feathered so no pale fringe is left
# close small bites (a near-white highlight on the rim reads as background), drop thin slivers (what is left of a contact shadow), then pull in and feather
convert /tmp/_bg.png -negate -morphology Close Disk:9 -morphology Open Disk:13 -morphology Erode Disk:1.6 -blur 0x0.8 /tmp/_alpha.png
convert "$in" /tmp/_alpha.png -alpha off -compose CopyOpacity -composite -trim +repage "$out"
