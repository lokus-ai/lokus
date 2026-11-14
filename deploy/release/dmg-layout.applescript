-- Lay out the installer disk's window: icons, their places, and the picture behind them.
-- Run while the disk "Lokus" is mounted writable; Finder saves the layout onto the disk.
tell application "Finder"
	tell disk "Lokus"
		open
		delay 1
		tell container window
			set current view to icon view
			try
				set toolbar visible to false
				set statusbar visible to false
			end try
			set the bounds to {240, 140, 840, 568}
		end tell
		set opts to the icon view options of container window
		tell opts
			set icon size to 112
			set text size to 13
			set arrangement to not arranged
		end tell
		set background picture of opts to file ".background:background.tiff"
		set position of item "Lokus.app" to {160, 215}
		set position of item "Applications" to {440, 215}
		close
		open
		update without registering applications
		delay 4
		close
	end tell
end tell
