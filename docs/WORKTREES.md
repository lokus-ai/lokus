# Git Worktrees for Parallel Development

This guide explains how to use git worktrees to enable parallel development with multiple instances of Lokus running simultaneously.

## Overview

Git worktrees allow you to have multiple working directories from the same repository, each checked out to a different branch. This enables:

- **Parallel Development**: Work on multiple features simultaneously
- **Isolated Testing**: Test changes without affecting your main workspace
- **AI Collaboration**: Multiple AI assistants can work on different features at once
- **Port Management**: Each worktree runs on its own ports (no conflicts)

## Directory Structure

```
/Users/pratham/Programming/Lokud Dir/
├── Lokus-Main/           # Main repository (this directory)
│   ├── .git/             # Git database (shared by all worktrees)
│   ├── node_modules/     # Dependencies (shared to save disk space)
│   ├── scripts/          # Worktree management scripts
│   └── ...
│
└── workspaces/           # All worktrees live here
    ├── feature-auth/     # Worktree for authentication feature
    ├── feature-ui/       # Worktree for UI improvements
    └── bugfix-save/      # Worktree for fixing save bug
```

## Port Allocation

Each worktree needs two ports (Vite dev server + HMR):

| Workspace | Vite Port | HMR Port | Usage |
|-----------|-----------|----------|-------|
| Lokus-Main | 1420 | 1421 | Main development |
| Worktree 1 | 1430 | 1431 | Feature work |
| Worktree 2 | 1440 | 1441 | Feature work |
| Worktree 3 | 1450 | 1451 | Bug fixes |
| Worktree 4 | 1460 | 1461 | Experiments |
| Worktree 5 | 1470 | 1471 | Refactoring |

**Recommended port spacing**: Increment by 10 for easy mental tracking.

## 🆕 New: Unified Command Interface

We now have a unified `wt` command for all worktree operations:

```bash
npm run wt <command> [options]
```

**Available commands:**
- `create <name> [port]` - Create worktree with auto port allocation
- `status` - Interactive dashboard showing all worktrees
- `doctor` - Run health checks
- `list` - List all worktrees
- `remove <name>` - Remove worktree
- `dev <name>` - Start dev server
- `ports` - Show port allocations
- `prune` - Clean up stale worktrees

## Quick Start

### 1. Create a New Worktree (with Auto Port Allocation)

```bash
npm run wt create feature-auth
```

This will:
- **Automatically find available ports** (no manual assignment!)
- Create a new branch named `feature-auth`
- Create worktree at `../workspaces/feature-auth`
- Configure ports in `.env.local`
- Generate `tauri.worktree.conf.json` with correct ports
- Symlink `node_modules` from main repo

Or specify ports manually:
```bash
npm run wt create feature-auth 1450
```

### 2. Start Development

```bash
cd ../workspaces/feature-auth
npm run dev
```

Or from the main repo:
```bash
npm run worktree:dev feature-auth
```

### 3. Work on Your Feature

The worktree behaves like a normal git repository:

```bash
cd ../workspaces/feature-auth
git status
git add .
git commit -m "Add authentication"
git push origin feature-auth
```

### 4. Check Status Dashboard

```bash
npm run wt status
```

Shows comprehensive status for all worktrees:
- Branch information
- Uncommitted changes
- Ahead/behind tracking
- Running dev servers
- Port assignments
- Last commit info
- Disk usage

### 5. Run Health Checks

```bash
npm run wt doctor
```

Diagnoses issues with:
- Broken symlinks
- Stale worktrees
- Port configuration problems
- Tauri config mismatches
- Port registry consistency

## Advanced Features

### Auto Port Allocation

Ports are automatically allocated and tracked:

```bash
# Create worktree with auto port detection
npm run wt create feature-name

# View all port allocations
npm run wt ports
```

Port registry is stored in `.worktree-ports.json` and automatically managed.

### Status Dashboard

Interactive CLI dashboard showing real-time status:

```bash
npm run wt status
```

Features:
- 🟢 Live detection of running dev servers
- ✓/✗ Clean/dirty working tree indicators
- ↑↓ Ahead/behind commit counts
- 🔌 Port assignments
- 📝 Last commit info
- 💾 Disk usage per worktree

### Health Check System

Comprehensive diagnostics:

```bash
npm run wt doctor
```

Checks:
1. **node_modules symlinks** - Verifies all symlinks are valid
2. **Stale worktrees** - Detects prunable worktrees
3. **Port configurations** - Validates .env.local files
4. **Tauri configs** - Checks port consistency
5. **Port registry** - Detects orphaned registrations
6. **Uncommitted changes** - Shows dirty worktrees
7. **Disk space** - Tracks workspace usage

### List All Worktrees

```bash
npm run wt list
```

Output:
```
📋 Git Worktrees:

/Users/pratham/Programming/Lokud Dir/Lokus-Main  abc1234 [main]
/Users/pratham/Programming/Lokud Dir/workspaces/feature-auth  def5678 [feature-auth]

Port assignments:
  feature-auth: Vite=1430, HMR=1431
```

### 5. Remove a Worktree

```bash
# Remove worktree but keep the branch
npm run worktree:remove feature-auth

# Remove worktree AND delete the branch
npm run worktree:remove feature-auth --delete-branch
```

## Manual Commands

If you prefer not to use the npm scripts:

### Create Worktree
```bash
bash scripts/create-worktree.sh <worktree-name> [base-port]
```

### List Worktrees
```bash
bash scripts/list-worktrees.sh
```

### Remove Worktree
```bash
bash scripts/remove-worktree.sh <worktree-name> [--delete-branch]
```

### Start Dev Server
```bash
bash scripts/dev-worktree.sh <worktree-name>
```

## Advanced Usage

### Create Worktree from Existing Branch

```bash
git worktree add ../workspaces/existing-feature existing-feature
cd ../workspaces/existing-feature

# Setup environment
echo "VITE_PORT=1440" > .env.local
echo "VITE_HMR_PORT=1441" >> .env.local

# Link node_modules
ln -s ../../Lokus-Main/node_modules node_modules
```

### Run Multiple Instances Simultaneously

Terminal 1:
```bash
cd /Users/pratham/Programming/Lokud Dir/Lokus-Main
npm run dev  # Runs on 1420
```

Terminal 2:
```bash
cd /Users/pratham/Programming/Lokud Dir/workspaces/feature-auth
npm run dev  # Runs on 1430
```

Terminal 3:
```bash
cd /Users/pratham/Programming/Lokud Dir/workspaces/feature-ui
npm run dev  # Runs on 1440
```

All three instances run simultaneously without conflicts!

### Check Port Usage

```bash
# See what's running on port 1420
lsof -i :1420

# Kill a process on port 1420
lsof -ti :1420 | xargs kill -9
```

## How It Works

### Port Configuration

The `vite.config.js` reads ports from environment variables:

```javascript
const port = parseInt(process.env.VITE_PORT || '1420');
const hmrPort = parseInt(process.env.VITE_HMR_PORT || '1421');
```

Each worktree has a `.env.local` file:

```bash
VITE_PORT=1430
VITE_HMR_PORT=1431
```

### Node Modules Sharing

Instead of duplicating `node_modules` (500MB+ each), worktrees use a symlink:

```bash
node_modules → ../../Lokus-Main/node_modules
```

This saves disk space and ensures consistent dependency versions.

### Git Database

All worktrees share the same `.git` directory from the main repo. This means:
- ✅ All branches are accessible from any worktree
- ✅ Changes in one worktree don't affect others
- ✅ Commits are immediately visible across all worktrees
- ✅ No need to fetch/pull between worktrees

## Best Practices

### Naming Conventions

Use prefixes to categorize branches:

- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `experiment/*` - Experimental work
- `refactor/*` - Code refactoring
- `docs/*` - Documentation updates

Examples:
- `feature-auth`
- `bugfix-save-crash`
- `experiment-3d-graph`
- `refactor-editor-components`

### Port Management

- Main repo: Always use 1420/1421
- Worktrees: Start at 1430 and increment by 10
- Document port assignments in this file or a shared note
- Don't reuse ports while a worktree is active

### Cleanup

Regularly prune deleted worktrees:

```bash
npm run worktree:prune
```

This removes worktree metadata for directories that no longer exist.

### Dependencies

Run `npm install` only in the main repo (`Lokus-Main`). All worktrees will automatically use the updated dependencies via the symlink.

```bash
# ✅ Good
cd /Users/pratham/Programming/Lokud Dir/Lokus-Main
npm install some-package

# ❌ Bad (will create duplicate node_modules)
cd /Users/pratham/Programming/Lokud Dir/workspaces/feature-auth
npm install some-package
```

## Troubleshooting

### Port Already in Use

**Problem:** `Error: Port 1430 is already in use`

**Solution:**
1. Check if another dev server is running:
   ```bash
   lsof -i :1430
   ```
2. Kill the process or use a different port:
   ```bash
   lsof -ti :1430 | xargs kill -9
   ```

### node_modules Not Found

**Problem:** `Cannot find module 'react'`

**Solution:**
1. Check if symlink exists:
   ```bash
   ls -la node_modules
   ```
2. Recreate symlink:
   ```bash
   ln -s ../../Lokus-Main/node_modules node_modules
   ```
3. Ensure main repo has dependencies:
   ```bash
   cd ../../Lokus-Main && npm install
   ```

### Tauri Can't Connect

**Problem:** Tauri window opens but shows connection error

**Solution:**
1. Ensure Vite is running first
2. Check ports match in `.env.local`
3. Verify `tauri.conf.json` has correct `devUrl`

### Worktree Won't Delete

**Problem:** `fatal: 'feature-auth' is already checked out`

**Solution:**
1. The worktree is still active somewhere
2. Find and remove it:
   ```bash
   git worktree list
   git worktree remove /path/to/worktree
   ```

### Different Package Versions

**Problem:** Worktrees using different dependency versions

**Solution:**
- Always install dependencies in main repo
- Delete and recreate node_modules symlink
- Avoid running `npm install` in worktrees

## AI-Assisted Parallel Development

Worktrees enable a powerful workflow with multiple AI assistants:

### Workflow Example

1. **Main Development** (You + AI Assistant 1)
   ```bash
   cd Lokus-Main
   npm run dev  # Port 1420
   ```
   Work on core features

2. **Feature Branch 1** (AI Assistant 2)
   ```bash
   npm run worktree:create feature-auth 1430
   # AI works on authentication in workspaces/feature-auth
   ```

3. **Feature Branch 2** (AI Assistant 3)
   ```bash
   npm run worktree:create feature-database 1440
   # AI works on database in workspaces/feature-database
   ```

4. **Bug Fix** (AI Assistant 4)
   ```bash
   npm run worktree:create bugfix-crash 1450
   # AI fixes critical bug in workspaces/bugfix-crash
   ```

All four instances run simultaneously without interfering!

### Context Isolation

Each AI assistant gets its own isolated environment:
- ✅ Separate working directory
- ✅ Separate branch
- ✅ Separate dev server
- ✅ No file conflicts

### Integration

When features are ready, merge them back:

```bash
cd Lokus-Main
git merge feature-auth
git merge feature-database
git merge bugfix-crash
```

## Maintenance

### Weekly Cleanup

```bash
# List all worktrees
npm run worktree:list

# Remove unused worktrees
npm run worktree:remove old-feature --delete-branch

# Prune deleted worktrees
npm run worktree:prune
```

### Disk Space Check

```bash
# Check worktree sizes
du -sh ../workspaces/*

# With symlinked node_modules, each worktree is ~50MB
# Without symlinks, each would be ~550MB+
```

## Resources

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [Mastering Git Worktrees with Claude](https://medium.com/@dtunai/mastering-git-worktrees-with-claude-code-for-parallel-development-workflow-41dc91e645fe)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

## Scripts Reference

All scripts are located in `scripts/`:

| Script | Description |
|--------|-------------|
| `create-worktree.sh` | Create new worktree with auto-configuration |
| `list-worktrees.sh` | List all worktrees and their ports |
| `remove-worktree.sh` | Remove worktree and optionally delete branch |
| `dev-worktree.sh` | Start dev server for specific worktree |

## Support

If you encounter issues not covered here:

1. Check [GitHub Issues](https://github.com/lokus-ai/lokus/issues)
2. Read git worktree docs: `git worktree --help`
3. Check Vite configuration: `vite --help`

---

**Last Updated:** 2025-11-07
**Lokus Version:** 1.3.3
