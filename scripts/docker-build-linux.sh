#!/bin/bash
# Build Lokus for Linux using Docker

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Building Lokus for Linux in Docker...${NC}\n"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo -e "${YELLOW}Please start Docker Desktop and try again${NC}"
    exit 1
fi

# Check if image exists
if ! docker images | grep -q "lokus-linux-builder"; then
    echo -e "${YELLOW}Linux builder image not found. Building...${NC}"
    docker build -t lokus-linux-builder -f docker/Dockerfile.linux-builder .
fi

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Clean previous Linux builds
echo -e "${YELLOW}Cleaning previous Linux builds...${NC}"
rm -rf "$PROJECT_ROOT/src-tauri/target/release/bundle/deb"
rm -rf "$PROJECT_ROOT/src-tauri/target/release/bundle/rpm"
rm -rf "$PROJECT_ROOT/src-tauri/target/release/bundle/appimage"

# Run build in Docker
echo -e "${BLUE}Starting Docker build (this may take 10-15 minutes)...${NC}\n"

docker run --rm \
    -v "$PROJECT_ROOT:/app" \
    -w /app \
    -e GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
    -e GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}" \
    lokus-linux-builder \
    bash -c "
        set -e
        echo '📦 Installing npm dependencies...'
        npm ci

        echo '🏗️  Building frontend...'
        npm run build

        echo '🦀 Building Tauri app for Linux...'
        cargo tauri build

        echo '✅ Linux build complete!'
    "

echo -e "\n${GREEN}✓ Linux build completed!${NC}"
echo -e "${BLUE}Output:${NC}"
echo -e "  DEB: src-tauri/target/release/bundle/deb/"
echo -e "  RPM: src-tauri/target/release/bundle/rpm/"
echo -e "  AppImage: src-tauri/target/release/bundle/appimage/"
