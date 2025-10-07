#!/bin/bash
# Install Build Dependencies for Local Multi-Platform Builds

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Lokus Build Dependencies Installer${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}\n"

# Check if on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ This script is for macOS only${NC}"
    exit 1
fi

echo -e "${YELLOW}This will install:${NC}"
echo "  • Docker Desktop (for Linux builds)"
echo "  • cargo-xwin (for Windows cross-compilation)"
echo "  • Additional Rust targets"
echo ""

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo -e "${RED}❌ Homebrew not found. Please install from https://brew.sh${NC}"
    exit 1
fi

# Install Docker Desktop
echo -e "\n${BLUE}[1/4] Installing Docker Desktop...${NC}"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker already installed${NC}"
else
    echo -e "${YELLOW}Installing Docker Desktop via Homebrew...${NC}"
    brew install --cask docker
    echo -e "${GREEN}✓ Docker Desktop installed${NC}"
    echo -e "${YELLOW}⚠️  Please open Docker Desktop app and wait for it to start${NC}"
    echo -e "${YELLOW}⚠️  Then run this script again${NC}"
    exit 0
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker is installed but not running${NC}"
    echo -e "${YELLOW}Please start Docker Desktop and run this script again${NC}"
    exit 1
fi

# Install cargo-xwin for Windows cross-compilation
echo -e "\n${BLUE}[2/4] Installing cargo-xwin...${NC}"
if cargo install --list | grep -q "cargo-xwin"; then
    echo -e "${GREEN}✓ cargo-xwin already installed${NC}"
else
    echo -e "${YELLOW}Installing cargo-xwin...${NC}"
    cargo install cargo-xwin
    echo -e "${GREEN}✓ cargo-xwin installed${NC}"
fi

# Add Windows Rust target
echo -e "\n${BLUE}[3/4] Adding Windows Rust target...${NC}"
if rustup target list | grep -q "x86_64-pc-windows-msvc (installed)"; then
    echo -e "${GREEN}✓ Windows target already installed${NC}"
else
    echo -e "${YELLOW}Adding x86_64-pc-windows-msvc target...${NC}"
    rustup target add x86_64-pc-windows-msvc
    echo -e "${GREEN}✓ Windows target installed${NC}"
fi

# Build Docker Linux builder image
echo -e "\n${BLUE}[4/4] Building Linux builder Docker image...${NC}"
cd "$(dirname "$0")/.."
if docker images | grep -q "lokus-linux-builder"; then
    echo -e "${YELLOW}Rebuilding Docker image...${NC}"
else
    echo -e "${YELLOW}Building Docker image (this may take a few minutes)...${NC}"
fi

docker build -t lokus-linux-builder -f docker/Dockerfile.linux-builder .

echo -e "\n${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ All dependencies installed successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}\n"

echo -e "${BLUE}You can now run:${NC}"
echo -e "  ${YELLOW}npm run build:all:local${NC} - Build for all platforms"
echo -e "  ${YELLOW}npm run build:macos${NC} - Build for macOS only"
echo ""
