#!/bin/bash

# Make all worktree scripts executable

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Making scripts executable..."

chmod +x "$SCRIPT_DIR/create-worktree.sh"
chmod +x "$SCRIPT_DIR/remove-worktree.sh"
chmod +x "$SCRIPT_DIR/list-worktrees.sh"
chmod +x "$SCRIPT_DIR/dev-worktree.sh"
chmod +x "$SCRIPT_DIR/worktree-status.sh"
chmod +x "$SCRIPT_DIR/worktree-doctor.sh"
chmod +x "$SCRIPT_DIR/worktree-manager.sh"
chmod +x "$SCRIPT_DIR/find-free-port.js"

echo "✅ All scripts are now executable"
