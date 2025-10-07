#!/bin/bash
# Build Lokus for All Platforms Locally

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BOLD}${BLUE}  Lokus Multi-Platform Local Build${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════${NC}\n"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}⚠️  .env.production not found${NC}"
    echo -e "${YELLOW}Creating from .env...${NC}"
    cp .env .env.production
fi

# Load environment variables
if [ -f ".env.production" ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Create dist-release directory
echo -e "${CYAN}📁 Creating dist-release directory...${NC}"
rm -rf dist-release
mkdir -p dist-release/{macos,windows,linux}

# Function to build macOS
build_macos() {
    echo -e "\n${BOLD}${BLUE}[1/3] Building for macOS...${NC}"
    echo -e "${CYAN}════════════════════════════════════${NC}\n"

    npm run build:macos

    echo -e "\n${CYAN}📦 Copying macOS build...${NC}"
    if [ -d "src-tauri/target/release/bundle/dmg" ]; then
        cp src-tauri/target/release/bundle/dmg/*.dmg dist-release/macos/ 2>/dev/null || true
    fi
    if [ -d "src-tauri/target/release/bundle/macos" ]; then
        cp -r src-tauri/target/release/bundle/macos/*.app dist-release/macos/ 2>/dev/null || true
    fi

    echo -e "${GREEN}✓ macOS build complete${NC}"
}

# Function to build Windows (cross-compile - experimental)
build_windows() {
    echo -e "\n${BOLD}${BLUE}[2/3] Building for Windows...${NC}"
    echo -e "${CYAN}════════════════════════════════════${NC}\n"

    echo -e "${YELLOW}⚠️  Windows cross-compilation from macOS is experimental${NC}"
    echo -e "${YELLOW}⚠️  For best results, use GitHub Actions workflow${NC}\n"

    # Check if cargo-xwin is installed
    if ! command -v cargo-xwin &> /dev/null; then
        echo -e "${RED}❌ cargo-xwin not installed${NC}"
        echo -e "${YELLOW}Run: npm run install:build:deps${NC}"
        return 1
    fi

    echo -e "${CYAN}Building with cargo-xwin...${NC}"
    npm run build
    cargo xwin build --release --target x86_64-pc-windows-msvc --manifest-path src-tauri/Cargo.toml

    echo -e "${YELLOW}Note: Full Windows installer (.msi) requires Windows or CI${NC}"
    echo -e "${GREEN}✓ Windows executable built${NC}"
}

# Function to build Linux
build_linux() {
    echo -e "\n${BOLD}${BLUE}[3/3] Building for Linux...${NC}"
    echo -e "${CYAN}════════════════════════════════════${NC}\n"

    # Check if Docker is running
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker is not running${NC}"
        echo -e "${YELLOW}Please start Docker Desktop and try again${NC}"
        echo -e "${YELLOW}Or run: npm run install:build:deps${NC}"
        return 1
    fi

    # Run Docker build
    bash scripts/docker-build-linux.sh

    echo -e "\n${CYAN}📦 Copying Linux builds...${NC}"
    if [ -d "src-tauri/target/release/bundle/deb" ]; then
        cp src-tauri/target/release/bundle/deb/*.deb dist-release/linux/ 2>/dev/null || true
    fi
    if [ -d "src-tauri/target/release/bundle/rpm" ]; then
        cp src-tauri/target/release/bundle/rpm/*.rpm dist-release/linux/ 2>/dev/null || true
    fi
    if [ -d "src-tauri/target/release/bundle/appimage" ]; then
        cp src-tauri/target/release/bundle/appimage/*.AppImage dist-release/linux/ 2>/dev/null || true
    fi

    echo -e "${GREEN}✓ Linux build complete${NC}"
}

# Build all platforms
START_TIME=$(date +%s)

build_macos || echo -e "${RED}✗ macOS build failed${NC}"
# build_windows || echo -e "${YELLOW}⚠️  Windows build skipped (use CI)${NC}"
build_linux || echo -e "${RED}✗ Linux build failed${NC}"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# Generate checksums
echo -e "\n${CYAN}🔐 Generating checksums...${NC}"
cd dist-release
find . -type f \( -name "*.dmg" -o -name "*.deb" -o -name "*.rpm" -o -name "*.AppImage" -o -name "*.msi" -o -name "*.exe" \) -exec shasum -a 256 {} \; > checksums.txt
cd ..

# Summary
echo -e "\n${BOLD}${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Build Complete! 🎉${NC}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════${NC}\n"

echo -e "${BOLD}Time taken:${NC} ${MINUTES}m ${SECONDS}s\n"

echo -e "${BOLD}${BLUE}📦 Build Artifacts:${NC}\n"

# List macOS builds
if [ "$(ls -A dist-release/macos 2>/dev/null)" ]; then
    echo -e "${GREEN}✓ macOS:${NC}"
    ls -lh dist-release/macos/ | tail -n +2 | awk '{print "  - " $9 " (" $5 ")"}'
else
    echo -e "${YELLOW}⚠️  macOS: No builds found${NC}"
fi

# List Windows builds
if [ "$(ls -A dist-release/windows 2>/dev/null)" ]; then
    echo -e "\n${GREEN}✓ Windows:${NC}"
    ls -lh dist-release/windows/ | tail -n +2 | awk '{print "  - " $9 " (" $5 ")"}'
else
    echo -e "\n${YELLOW}⚠️  Windows: Use GitHub Actions for full builds${NC}"
fi

# List Linux builds
if [ "$(ls -A dist-release/linux 2>/dev/null)" ]; then
    echo -e "\n${GREEN}✓ Linux:${NC}"
    ls -lh dist-release/linux/ | tail -n +2 | awk '{print "  - " $9 " (" $5 ")"}'
else
    echo -e "\n${YELLOW}⚠️  Linux: No builds found${NC}"
fi

echo -e "\n${BOLD}${BLUE}📍 Location:${NC} ${PROJECT_ROOT}/dist-release/\n"

echo -e "${CYAN}Next steps:${NC}"
echo -e "  1. Test installers on different machines"
echo -e "  2. When ready: ${YELLOW}git tag v1.2.1 && git push origin v1.2.1${NC}"
echo -e "  3. GitHub Actions will create the release automatically\n"
