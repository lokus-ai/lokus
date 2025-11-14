#!/bin/bash

# Worktree Status Dashboard
# Shows comprehensive status of all worktrees

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
GIT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$GIT_ROOT"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║            WORKTREE STATUS DASHBOARD                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Get all worktrees
WORKTREES=$(git worktree list --porcelain | awk '/^worktree/ {print $2}')

if [ -z "$WORKTREES" ]; then
    echo "No worktrees found."
    exit 0
fi

WORKTREE_COUNT=0

for WORKTREE_PATH in $WORKTREES; do
    WORKTREE_COUNT=$((WORKTREE_COUNT + 1))
    WORKTREE_NAME=$(basename "$WORKTREE_PATH")

    # Get branch name
    BRANCH=$(git -C "$WORKTREE_PATH" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

    # Check if this is the main repo
    if [ "$WORKTREE_PATH" = "$GIT_ROOT" ]; then
        WORKTREE_DISPLAY="🏠 $WORKTREE_NAME (Main Repo)"
    else
        WORKTREE_DISPLAY="📁 $WORKTREE_NAME"
    fi

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$WORKTREE_DISPLAY"
    echo "Branch: $BRANCH"

    # Check for uncommitted changes
    if git -C "$WORKTREE_PATH" diff-index --quiet HEAD 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Clean working tree"
    else
        echo -e "${YELLOW}✗${NC} Uncommitted changes"

        # Show what's changed
        MODIFIED=$(git -C "$WORKTREE_PATH" diff --name-only | wc -l | xargs)
        STAGED=$(git -C "$WORKTREE_PATH" diff --cached --name-only | wc -l | xargs)
        UNTRACKED=$(git -C "$WORKTREE_PATH" ls-files --others --exclude-standard | wc -l | xargs)

        echo "  Modified: $MODIFIED | Staged: $STAGED | Untracked: $UNTRACKED"
    fi

    # Check ahead/behind
    UPSTREAM=$(git -C "$WORKTREE_PATH" rev-parse --abbrev-ref @{u} 2>/dev/null)
    if [ -n "$UPSTREAM" ]; then
        COUNTS=$(git -C "$WORKTREE_PATH" rev-list --left-right --count HEAD...$UPSTREAM 2>/dev/null || echo "0 0")
        AHEAD=$(echo $COUNTS | awk '{print $1}')
        BEHIND=$(echo $COUNTS | awk '{print $2}')

        if [ "$AHEAD" -gt 0 ] || [ "$BEHIND" -gt 0 ]; then
            echo "↑ $AHEAD commits ahead | ↓ $BEHIND commits behind"
        else
            echo -e "${GREEN}✓${NC} Up to date with $UPSTREAM"
        fi
    fi

    # Check for port assignment
    if [ -f "$WORKTREE_PATH/.env.local" ]; then
        VITE_PORT=$(grep "VITE_PORT=" "$WORKTREE_PATH/.env.local" 2>/dev/null | cut -d'=' -f2)
        HMR_PORT=$(grep "VITE_HMR_PORT=" "$WORKTREE_PATH/.env.local" 2>/dev/null | cut -d'=' -f2)

        if [ -n "$VITE_PORT" ]; then
            # Check if dev server is running
            if lsof -Pi :$VITE_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
                PID=$(lsof -ti :$VITE_PORT 2>/dev/null)
                echo -e "${GREEN}🟢${NC} Dev server running on port $VITE_PORT (PID: $PID)"
            else
                echo "🔌 Ports: $VITE_PORT (Vite), $HMR_PORT (HMR) - Not running"
            fi
        fi
    fi

    # Last commit info
    LAST_COMMIT=$(git -C "$WORKTREE_PATH" log -1 --pretty=format:"%h - %s (%ar)" 2>/dev/null || echo "No commits")
    echo "📝 $LAST_COMMIT"

    # Disk usage
    if command -v du &> /dev/null; then
        DISK_USAGE=$(du -sh "$WORKTREE_PATH" 2>/dev/null | awk '{print $1}')
        echo "💾 Disk usage: $DISK_USAGE"
    fi

    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total worktrees: $WORKTREE_COUNT"
echo ""

# Show port registry
if [ -f ".worktree-ports.json" ]; then
    echo "📊 Port Allocations:"
    node "$SCRIPT_DIR/find-free-port.js" list | node -pe "
        const ports = JSON.parse(require('fs').readFileSync(0));
        Object.entries(ports).map(([name, p]) =>
            \`  \${name}: Vite=\${p.vitePort}, HMR=\${p.hmrPort}\`
        ).join('\n') || '  No ports allocated'
    "
    echo ""
fi
