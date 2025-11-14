#!/bin/bash

# Worktree Health Check System
# Diagnoses issues with worktrees

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
GIT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$GIT_ROOT"

ISSUES_FOUND=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Running Worktree Health Checks..."
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check 1: Node modules symlinks
echo "1️⃣  Checking node_modules symlinks..."
WORKTREES=$(git worktree list --porcelain | awk '/^worktree/ {print $2}')

for WORKTREE_PATH in $WORKTREES; do
    # Skip main repo
    if [ "$WORKTREE_PATH" = "$GIT_ROOT" ]; then
        continue
    fi

    WORKTREE_NAME=$(basename "$WORKTREE_PATH")

    if [ -L "$WORKTREE_PATH/node_modules" ]; then
        if [ ! -e "$WORKTREE_PATH/node_modules" ]; then
            echo -e "  ${RED}❌ BROKEN:${NC} $WORKTREE_NAME/node_modules"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
        else
            echo -e "  ${GREEN}✓${NC} $WORKTREE_NAME/node_modules"
        fi
    else
        if [ -d "$WORKTREE_PATH/node_modules" ]; then
            echo -e "  ${YELLOW}⚠️  WARNING:${NC} $WORKTREE_NAME/node_modules (not a symlink - wasting disk space)"
        else
            echo -e "  ${RED}❌ MISSING:${NC} $WORKTREE_NAME/node_modules"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
        fi
    fi
done
echo ""

# Check 2: Stale worktrees
echo "2️⃣  Checking for stale worktrees..."
PRUNABLE=$(git worktree list --porcelain | grep "^prunable")
if [ -n "$PRUNABLE" ]; then
    echo -e "  ${RED}❌ Found prunable worktrees${NC}"
    echo "     Run: git worktree prune"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "  ${GREEN}✓${NC} No stale worktrees found"
fi
echo ""

# Check 3: Port configurations
echo "3️⃣  Checking port configurations..."
for WORKTREE_PATH in $WORKTREES; do
    # Skip main repo
    if [ "$WORKTREE_PATH" = "$GIT_ROOT" ]; then
        continue
    fi

    WORKTREE_NAME=$(basename "$WORKTREE_PATH")

    if [ ! -f "$WORKTREE_PATH/.env.local" ]; then
        echo -e "  ${RED}❌ MISSING:${NC} $WORKTREE_NAME/.env.local"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        continue
    fi

    VITE_PORT=$(grep "VITE_PORT=" "$WORKTREE_PATH/.env.local" 2>/dev/null | cut -d'=' -f2)
    HMR_PORT=$(grep "VITE_HMR_PORT=" "$WORKTREE_PATH/.env.local" 2>/dev/null | cut -d'=' -f2)

    if [ -z "$VITE_PORT" ] || [ -z "$HMR_PORT" ]; then
        echo -e "  ${RED}❌ INVALID:${NC} $WORKTREE_NAME - Missing port configuration"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        echo -e "  ${GREEN}✓${NC} $WORKTREE_NAME: Vite=$VITE_PORT, HMR=$HMR_PORT"
    fi
done
echo ""

# Check 4: Tauri configurations
echo "4️⃣  Checking Tauri configurations..."
for WORKTREE_PATH in $WORKTREES; do
    # Skip main repo
    if [ "$WORKTREE_PATH" = "$GIT_ROOT" ]; then
        continue
    fi

    WORKTREE_NAME=$(basename "$WORKTREE_PATH")

    if [ ! -f "$WORKTREE_PATH/src-tauri/tauri.worktree.conf.json" ]; then
        echo -e "  ${YELLOW}⚠️  MISSING:${NC} $WORKTREE_NAME/src-tauri/tauri.worktree.conf.json"
    else
        # Validate port in tauri config matches .env.local
        if [ -f "$WORKTREE_PATH/.env.local" ]; then
            VITE_PORT=$(grep "VITE_PORT=" "$WORKTREE_PATH/.env.local" | cut -d'=' -f2)
            TAURI_PORT=$(grep "devUrl" "$WORKTREE_PATH/src-tauri/tauri.worktree.conf.json" | grep -o '[0-9]\+')

            if [ "$VITE_PORT" = "$TAURI_PORT" ]; then
                echo -e "  ${GREEN}✓${NC} $WORKTREE_NAME: Ports match"
            else
                echo -e "  ${RED}❌ PORT MISMATCH:${NC} $WORKTREE_NAME (.env.local=$VITE_PORT, tauri=$TAURI_PORT)"
                ISSUES_FOUND=$((ISSUES_FOUND + 1))
            fi
        fi
    fi
done
echo ""

# Check 5: Port registry consistency
echo "5️⃣  Checking port registry consistency..."
if [ -f ".worktree-ports.json" ]; then
    # Get registered worktrees
    REGISTERED=$(node "$SCRIPT_DIR/find-free-port.js" list | node -pe "Object.keys(JSON.parse(require('fs').readFileSync(0))).join(' ')")

    # Get actual worktrees
    ACTUAL=$(git worktree list --porcelain | awk '/^worktree/ {print $2}' | while read wt; do [ "$wt" != "$GIT_ROOT" ] && basename "$wt"; done)

    # Check for orphaned registrations
    for REG in $REGISTERED; do
        if ! echo "$ACTUAL" | grep -q "^$REG$"; then
            echo -e "  ${YELLOW}⚠️  ORPHANED:${NC} Port registration for '$REG' (worktree doesn't exist)"
        fi
    done

    # Check for missing registrations
    for ACT in $ACTUAL; do
        if ! echo "$REGISTERED" | grep -q "$ACT"; then
            echo -e "  ${YELLOW}⚠️  UNREGISTERED:${NC} Worktree '$ACT' not in port registry"
        fi
    done

    if [ -z "$(echo $REGISTERED)" ] && [ -z "$(echo $ACTUAL)" ]; then
        echo -e "  ${GREEN}✓${NC} Port registry is consistent"
    fi
else
    echo -e "  ${YELLOW}⚠️${NC} No port registry found (.worktree-ports.json)"
fi
echo ""

# Check 6: Uncommitted changes
echo "6️⃣  Checking for uncommitted changes..."
DIRTY_COUNT=0
for WORKTREE_PATH in $WORKTREES; do
    WORKTREE_NAME=$(basename "$WORKTREE_PATH")

    if ! git -C "$WORKTREE_PATH" diff-index --quiet HEAD 2>/dev/null; then
        echo -e "  ${YELLOW}⚠️${NC} $WORKTREE_NAME has uncommitted changes"
        DIRTY_COUNT=$((DIRTY_COUNT + 1))
    fi
done

if [ $DIRTY_COUNT -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} All worktrees have clean working trees"
else
    echo "  Found $DIRTY_COUNT worktree(s) with uncommitted changes"
fi
echo ""

# Check 7: Disk space
echo "7️⃣  Checking disk space..."
if [ -d "../workspaces" ]; then
    TOTAL_SIZE=$(du -sh "../workspaces" 2>/dev/null | awk '{print $1}')
    echo "  Total workspace disk usage: $TOTAL_SIZE"

    # Check if node_modules are symlinked (should save space)
    SYML_COUNT=0
    REAL_COUNT=0
    for WORKTREE_PATH in $WORKTREES; do
        if [ "$WORKTREE_PATH" != "$GIT_ROOT" ] && [ -e "$WORKTREE_PATH/node_modules" ]; then
            if [ -L "$WORKTREE_PATH/node_modules" ]; then
                SYML_COUNT=$((SYML_COUNT + 1))
            else
                REAL_COUNT=$((REAL_COUNT + 1))
            fi
        fi
    done

    if [ $REAL_COUNT -gt 0 ]; then
        echo -e "  ${YELLOW}⚠️  WARNING:${NC} $REAL_COUNT worktree(s) have real node_modules (not symlinked)"
        echo "     This wastes ~500MB per worktree. Consider recreating them."
    else
        echo -e "  ${GREEN}✓${NC} All worktrees use symlinked node_modules"
    fi
fi
echo ""

# Summary
echo "════════════════════════════════════════════════════════════════"
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ All health checks passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Found $ISSUES_FOUND critical issue(s)${NC}"
    echo ""
    echo "Recommended actions:"
    echo "  • Run 'git worktree prune' to remove stale worktrees"
    echo "  • Fix broken symlinks with: ln -s ../../Lokus-Main/node_modules <worktree>/node_modules"
    echo "  • Update port configs in .env.local files"
    echo "  • Recreate worktrees with issues using 'npm run worktree:create'"
    exit 1
fi
