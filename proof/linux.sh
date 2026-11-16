#!/bin/bash
# Drives the published Linux copy through its own update, by its own buttons.
set -u
mkdir -p out "$HOME/apps"
APP="$HOME/apps/Lokus.AppImage"
curl -fsSL -o "$APP" "https://github.com/lokus-ai/lokus/releases/download/v$FROM/Lokus_${FROM}_amd64.AppImage"
curl -fsSL -o new.AppImage "https://github.com/lokus-ai/lokus/releases/download/v$TO/Lokus_${TO}_amd64.AppImage"
chmod +x "$APP"
OLD=$(sha256sum "$APP" | cut -d' ' -f1); NEW=$(sha256sum new.AppImage | cut -d' ' -f1)
echo "published $FROM: $OLD" | tee out/hashes.txt
echo "published $TO: $NEW" | tee -a out/hashes.txt
"$APP" > out/app.log 2>&1 &
sleep 8
if ! pgrep -f "$APP" > /dev/null; then
  echo "did not start mounted; running unpacked" | tee -a out/hashes.txt
  tail -5 out/app.log
  APPIMAGE_EXTRACT_AND_RUN=1 "$APP" > out/app.log 2>&1 &
  sleep 10
fi
pgrep -af Lokus | cut -c1-200 | tee out/processes-before.txt
FIRST=$(pgrep -of "$APP")

# Look at the screen for two words side by side and click between them.
see() {
  import -window root out/now.png
  for how in "" "-negate"; do
    convert out/now.png $how -resize 200% -colorspace Gray out/big.png
    tesseract out/big.png out/ocr --psm 11 tsv > /dev/null 2>&1
    awk -F'\t' -v a="$1" -v b="$2" 'prev == a && $12 == b { print int((px + $7 + $9) / 4), int((2 * py + ph) / 4); exit } { prev = $12; px = $7; py = $8; ph = $10 }' out/ocr.tsv > out/at.txt
    [ -s out/at.txt ] && return 0
  done
  return 1
}
press() {
  for i in $(seq 1 "$3"); do
    if see "$1" "$2"; then
      cp out/now.png "out/$4.png"
      read -r X Y < out/at.txt
      echo "$(date -u +%T) $1 $2 at $X,$Y"
      xdotool mousemove "$X" "$Y" click 1
      return 0
    fi
    sleep 2
  done
  cp out/now.png "out/$4-not-found.png"
  cut -f12 out/ocr.tsv | tr '\n' ' ' | cut -c1-1500
  return 1
}
press Update now 45 1-offered || { echo "FAIL: no update offered on screen"; exit 1; }
sleep 2; import -window root out/2-downloading.png
press Restart now 150 3-ready || { echo "FAIL: the update did not reach Restart now"; exit 1; }
sleep 15
import -window root out/4-after.png
pgrep -af Lokus | cut -c1-200 | tee out/processes-after.txt
NOW=$(sha256sum "$APP" | cut -d' ' -f1)
echo "file after: $NOW" | tee -a out/hashes.txt
SECOND=$(pgrep -of "$APP")
echo "process before $FIRST, after ${SECOND:-none}" | tee -a out/hashes.txt
for i in 1 2 3 4 5; do see "version" "$TO" && { echo "screen says version $TO"; cp out/now.png out/5-says.png; break; }; sleep 1; done
convert out/4-after.png -resize 200% -colorspace Gray out/big.png; tesseract out/big.png out/after --psm 11 > /dev/null 2>&1; tr '\n' ' ' < out/after.txt | cut -c1-600; echo
rm -f out/big.png out/now.png
[ "$NOW" = "$NEW" ] || { echo "FAIL: the file on disk is not the published $TO"; exit 1; }
[ -n "$SECOND" ] && [ "$SECOND" != "$FIRST" ] || { echo "FAIL: Lokus did not come back after the restart"; exit 1; }
echo "PASS: the published copy updated itself from $FROM to $TO and reopened"
