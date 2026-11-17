#!/bin/bash
# Vetting view: the cut-out on the banner orange at 2x banner size, and on a dark colour to show any fringe. usage: onbanner.sh cut.png out.png
convert -size 780x380 xc:"#F2601A" \( "$1" -resize 700x330 \) -gravity center -composite /tmp/_a.png
convert -size 780x380 xc:"#1C1C1C" \( "$1" -resize 700x330 \) -gravity center -composite /tmp/_b.png
convert /tmp/_a.png /tmp/_b.png -append "$2"
