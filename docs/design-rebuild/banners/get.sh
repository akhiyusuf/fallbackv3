#!/bin/bash
# Download one generated banner, cut it out, and make the vetting view. usage: get.sh <name e.g. banner_2_b> <url> [sat] [band] [holes] [close]
cd "$(dirname "$0")"; n=$1
{ [ "$2" = "-" ] || curl -sS -o dl/${n}_raw.png "$2" -w "%{http_code} "; } && ./cutout_flat.sh dl/${n}_raw.png dl/$n.png ${3:-3.5} ${4:-5} ${5:-0} ${6:-4} && identify -format "%wx%h\n" dl/$n.png && ./onbanner.sh dl/$n.png dl/vet_$n.png
convert dl/${n}_raw.png -resize 500x500 dl/vet_${n}_raw.png; convert dl/vet_${n}_raw.png -background "#888" -gravity center -extent 780x520 dl/_r.png; convert dl/_r.png dl/vet_$n.png -append dl/vet_$n.png; rm dl/_r.png dl/vet_${n}_raw.png
