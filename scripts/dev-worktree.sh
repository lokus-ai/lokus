#!/bin/bash

# Start development server for a specific worktree
# Usage: ./dev-worktree.sh <worktree-name>

set -e

WORKTREE_NAME=$1

if [ -z "$WORKTREE_NAME" ]; then
    echo "Usage: $0 <worktree-name>"
    echo "Example: $0 feature-auth"
    exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
GIT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

WORKSPACES_DIR="$GIT_ROOT/../workspaces"
WORKTREE_PATH="$WORKSPACES_DIR/$WORKTREE_NAME"

if [ ! -d "$WORKTREE_PATH" ]; then
    echo "❌ Worktree not found at: $WORKTREE_PATH"
    exit 1
fi

if [ ! -f "$WORKTREE_PATH/.env.local" ]; then
    echo "❌ No .env.local found in worktree"
    exit 1
fi

# Load environment variables
source "$WORKTREE_PATH/.env.local"

echo "🚀 Starting dev server for: $WORKTREE_NAME"
echo "📁 Path: $WORKTREE_PATH"
echo "🔌 Ports: $VITE_PORT (Vite), $VITE_HMR_PORT (HMR)"
echo ""

cd "$WORKTREE_PATH"
npm run dev
