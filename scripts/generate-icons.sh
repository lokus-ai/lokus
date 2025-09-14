#!/bin/bash

# Script to generate app icons from Group.svg
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🎨 Generating app icons from Group.svg...${NC}"

# Check if rsvg-convert is available (for SVG to PNG conversion)
if ! command -v rsvg-convert &> /dev/null; then
    echo -e "${YELLOW}⚠️  rsvg-convert not found. Installing with Homebrew...${NC}"
    brew install librsvg 2>/dev/null || {
        echo -e "${RED}❌ Failed to install librsvg. Please install manually:${NC}"
        echo "brew install librsvg"
        exit 1
    }
fi

# Create icons directory if it doesn't exist
mkdir -p src-tauri/icons

# Source SVG file
SVG_FILE="Group.svg"
ICONS_DIR="src-tauri/icons"

if [ ! -f "$SVG_FILE" ]; then
    echo -e "${RED}❌ Group.svg not found!${NC}"
    exit 1
fi

echo -e "${GREEN}📁 Creating icon files...${NC}"

# Generate PNG icons for different sizes
echo "  • 32x32.png"
rsvg-convert -w 32 -h 32 "$SVG_FILE" > "$ICONS_DIR/32x32.png"

echo "  • 128x128.png"
rsvg-convert -w 128 -h 128 "$SVG_FILE" > "$ICONS_DIR/128x128.png"

echo "  • 128x128@2x.png" 
rsvg-convert -w 256 -h 256 "$SVG_FILE" > "$ICONS_DIR/128x128@2x.png"

# Generate high-res PNG for macOS icon conversion
echo "  • 1024x1024.png (for .icns)"
rsvg-convert -w 1024 -h 1024 "$SVG_FILE" > "$ICONS_DIR/icon-1024.png"

# Generate .icns file for macOS
if command -v iconutil &> /dev/null; then
    echo "  • icon.icns"
    
    # Create iconset directory
    mkdir -p "$ICONS_DIR/icon.iconset"
    
    # Generate all required sizes for .icns
    rsvg-convert -w 16 -h 16 "$SVG_FILE" > "$ICONS_DIR/icon.iconset/icon_16x16.png"
    rsvg-convert -w 32 -h 32 "$SVG_FILE" > "$ICONS_DIR/icon.iconset/icon_16x16@2x.png"
    rsvg-convert -w 32 -h 32 "$SVG_FILE" > "$ICONS_DIR/icon.iconset/icon_32x32.png"
    rsvg-convert -w 64 -h 64 "$SVG_FILE" > "$ICONS_DIR/icon.iconset/icon_32x32@2x.png"
    rsvg-convert -w 128 -h 128 "$SVG_FILE" > "$ICONS_DIR/icon.iconset/icon_128x128.png"
    rsvg-convert -w 256 -h 256 "$SVG_FILE" > "$ICONS_DIR/icon.iconset/icon_128x128@2x.png"
    rsvg-convert -w 256 -h 256 "$SVG_FILE" > "$ICONS_DIR/icon.iconset/icon_256x256.png"
    rsvg-convert -w 512 -h 512 "$SVG_FILE" > "$ICONS_DIR/icon.iconset/icon_256x256@2x.png"
    rsvg-convert -w 512 -h 512 "$SVG_FILE" > "$ICONS_DIR/icon.iconset/icon_512x512.png"
    rsvg-convert -w 1024 -h 1024 "$SVG_FILE" > "$ICONS_DIR/icon.iconset/icon_512x512@2x.png"
    
    # Convert to .icns
    iconutil -c icns "$ICONS_DIR/icon.iconset" -o "$ICONS_DIR/icon.icns"
    
    # Clean up iconset directory
    rm -rf "$ICONS_DIR/icon.iconset"
else
    echo -e "${YELLOW}⚠️  iconutil not available, skipping .icns generation${NC}"
fi

# Generate .ico file for Windows (if available)
if command -v convert &> /dev/null; then
    echo "  • icon.ico"
    convert "$ICONS_DIR/icon-1024.png" -resize 256x256 "$ICONS_DIR/icon.ico"
else
    echo -e "${YELLOW}⚠️  ImageMagick not available, skipping .ico generation${NC}"
fi

# Clean up temporary high-res file
rm -f "$ICONS_DIR/icon-1024.png"

echo -e "${GREEN}✅ Icon generation completed!${NC}"
echo
echo "Generated files:"
ls -la "$ICONS_DIR"/*.png "$ICONS_DIR"/*.icns "$ICONS_DIR"/*.ico 2>/dev/null || true