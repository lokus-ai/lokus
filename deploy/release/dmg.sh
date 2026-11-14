#!/bin/sh
# Make the disk image people download: a small window with Lokus on the left, Applications on
# the right, an arrow between them and one line saying what to do. Without that window people
# double-click the app where it sits and use it from the disk, where it cannot update.
#
#   sh deploy/release/dmg.sh path/to/Lokus.app path/to/out.dmg
set -e
APP="$1"
DMG="$2"
[ -d "$APP" ] && [ -n "$DMG" ] || { echo "usage: dmg.sh APP OUT.dmg"; exit 2; }
HERE=$(cd "$(dirname "$0")" && pwd)
WORK="$(dirname "$DMG")/dmg-work"
STAGE="$WORK/stage"
RW="$WORK/rw.dmg"
MOUNT="/Volumes/Lokus"

mkdir -p "$STAGE/Lokus.app" "$STAGE/.background"
rsync -a --delete "$APP/" "$STAGE/Lokus.app/"
[ -L "$STAGE/Applications" ] || ln -s /Applications "$STAGE/Applications"
cp "$HERE/dmg-background.tiff" "$STAGE/.background/background.tiff"

# Finder lays a disk out by its name. Another disk called "Lokus" (an installer someone left
# open) would get the layout instead, and this one would come out plain. So none may be open.
if [ -d "$MOUNT" ]; then
  hdiutil detach "$MOUNT" >/dev/null 2>&1 || {
    echo "A disk called Lokus is open and in use. Quit Lokus, eject that disk, and run this again."
    exit 1
  }
fi
hdiutil create -volname "Lokus" -srcfolder "$STAGE" -fs HFS+ -format UDRW -ov "$RW" >/dev/null
hdiutil attach "$RW" -readwrite -noverify -noautoopen >/dev/null

osascript "$HERE/dmg-layout.applescript"
sync
sleep 2

# Something on a Mac (Spotlight, a sync tool) often holds a new disk for a few seconds.
TRIES=0
until hdiutil detach "$MOUNT" >/dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -ge 6 ]; then
    hdiutil detach "$MOUNT" -force >/dev/null
    break
  fi
  sleep 3
done

hdiutil convert "$RW" -format UDZO -imagekey zlib-level=9 -ov -o "$DMG" >/dev/null
echo "disk image: $DMG"
