#!/bin/bash

# Unified Worktree Manager
# Single interface for all worktree operations

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
COMMAND=$1
shift

show_help() {
    echo "Worktree Manager - Unified interface for git worktrees"
    echo ""
    echo "Usage: npm run wt <command> [options]"
    echo ""
    echo "Commands:"
    echo "  create <name> [port]     Create new worktree with auto port allocation"
    echo "  remove <name> [--delete-branch]  Remove worktree and optionally its branch"
    echo "  list                     List all worktrees"
    echo "  status                   Show detailed status dashboard"
    echo "  dev <name>               Start dev server for a worktree"
    echo "  doctor                   Run health checks on all worktrees"
    echo "  ports                    Show port allocations"
    echo "  prune                    Clean up stale worktrees"
    echo "  help                     Show this help message"
    echo ""
    echo "Examples:"
    echo "  npm run wt create feature-auth         # Auto-assign ports"
    echo "  npm run wt create feature-ui 1440      # Use specific ports"
    echo "  npm run wt status                      # Show dashboard"
    echo "  npm run wt doctor                      # Check health"
    echo "  npm run wt remove feature-auth         # Remove worktree"
    echo "  npm run wt dev feature-auth            # Start dev server"
    echo ""
}

case $COMMAND in
    create)
        bash "$SCRIPT_DIR/create-worktree.sh" "$@"
        ;;

    remove)
        bash "$SCRIPT_DIR/remove-worktree.sh" "$@"
        ;;

    list)
        bash "$SCRIPT_DIR/list-worktrees.sh" "$@"
        ;;

    status)
        bash "$SCRIPT_DIR/worktree-status.sh" "$@"
        ;;

    dev)
        bash "$SCRIPT_DIR/dev-worktree.sh" "$@"
        ;;

    doctor)
        bash "$SCRIPT_DIR/worktree-doctor.sh" "$@"
        ;;

    ports)
        echo "📊 Port Allocations:"
        echo ""
        node "$SCRIPT_DIR/find-free-port.js" list | node -pe "
            const ports = JSON.parse(require('fs').readFileSync(0));
            if (Object.keys(ports).length === 0) {
                console.log('  No ports allocated yet.');
            } else {
                Object.entries(ports).forEach(([name, p]) => {
                    console.log(\`  \${name.padEnd(20)} Vite: \${p.vitePort}  HMR: \${p.hmrPort}\`);
                });
            }
            ''
        "
        echo ""
        ;;

    prune)
        echo "Pruning stale worktrees..."
        git worktree prune
        echo "✅ Done"
        ;;

    help|--help|-h)
        show_help
        ;;

    "")
        echo "Error: No command specified"
        echo ""
        show_help
        exit 1
        ;;

    *)
        echo "Error: Unknown command '$COMMAND'"
        echo ""
        show_help
        exit 1
        ;;
esac
