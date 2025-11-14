#!/bin/bash

# Remove a git worktree and optionally its branch
# Usage: ./remove-worktree.sh <worktree-name> [--delete-branch]

set -e

WORKTREE_NAME=$1
DELETE_BRANCH=false

if [ -z "$WORKTREE_NAME" ]; then
    echo "Usage: $0 <worktree-name> [--delete-branch]"
    echo "Example: $0 feature-auth"
    echo "Example: $0 feature-auth --delete-branch"
    exit 1
fi

if [ "$2" == "--delete-branch" ]; then
    DELETE_BRANCH=true
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
GIT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$GIT_ROOT"

WORKSPACES_DIR="../workspaces"
WORKTREE_PATH="$WORKSPACES_DIR/$WORKTREE_NAME"

# Check if worktree exists
if [ ! -d "$WORKTREE_PATH" ]; then
    echo "❌ Worktree not found at: $WORKTREE_PATH"
    exit 1
fi

# Remove the worktree
echo "Removing worktree: $WORKTREE_NAME"
git worktree remove "$WORKTREE_PATH"

# Release allocated ports
echo "Releasing ports..."
node "$SCRIPT_DIR/find-free-port.js" release "$WORKTREE_NAME"

# Delete branch if requested
if [ "$DELETE_BRANCH" == "true" ]; then
    echo "Deleting branch: $WORKTREE_NAME"
    git branch -D "$WORKTREE_NAME"
fi

echo ""
echo "✅ Worktree removed successfully!"
if [ "$DELETE_BRANCH" == "true" ]; then
    echo "✅ Branch deleted"
fi
echo "✅ Ports released"
echo ""
