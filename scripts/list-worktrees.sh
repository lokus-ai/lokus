#!/bin/bash

# List all git worktrees with their details

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
GIT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$GIT_ROOT"

echo "📋 Git Worktrees:"
echo ""

git worktree list

echo ""
echo "Port assignments:"
echo ""

# Check workspaces directory for .env.local files
WORKSPACES_DIR="../workspaces"
if [ -d "$WORKSPACES_DIR" ]; then
    for worktree in "$WORKSPACES_DIR"/*; do
        if [ -d "$worktree" ] && [ -f "$worktree/.env.local" ]; then
            WORKTREE_NAME=$(basename "$worktree")
            VITE_PORT=$(grep "VITE_PORT=" "$worktree/.env.local" | cut -d'=' -f2)
            VITE_HMR_PORT=$(grep "VITE_HMR_PORT=" "$worktree/.env.local" | cut -d'=' -f2)
            echo "  $WORKTREE_NAME: Vite=$VITE_PORT, HMR=$VITE_HMR_PORT"
        fi
    done
fi

echo ""
