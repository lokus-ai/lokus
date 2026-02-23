# Task Plan: Workspace Architecture Overhaul

## Goal
Production-grade VSCode-style workspace architecture. Fix all 4 critical bugs, offload main thread, full tab/pane independence, error isolation.

## Current Phase: Brainstorming / Design (finalizing)

## Phases
1. [complete] Investigate root causes (4 bugs + 11 main-thread blockers + existing EditorGroups audit)
2. [in_progress] Brainstorm & design fix approach
3. [ ] Write design doc → docs/plans/2026-02-23-workspace-overhaul-design.md
4. [ ] Create implementation plan (invoke writing-plans skill)
5. [ ] Implement fixes
6. [ ] Test & verify

## Constraints
- Working on `refactor/workspace-decomposition` branch (worktree at .claude/worktrees/workspace-refactor/)
- Branch already has 10 commits of Zustand decomposition work
- Must not break existing features
- Tauri desktop app (Rust backend, React frontend)
- Existing `useEditorGroups` hook (381 lines) is salvageable — nearly complete

## Decisions Made
- [decided] Full architectural overhaul, not surgical patches
- [decided] VSCode-style EditorGroup model (Approach B)
- [decided] Delete BOTH split pane systems completely, rewrite from scratch
- [decided] 4 independent Zustand stores (layout, editorGroup, view, fileTree)
- [decided] Exclusive view state machine, not boolean flags
- [decided] ProseMirror JSON cache per tab (not HTML strings)
- [decided] LRU eviction at ~20 cached tabs
- [decided] Error boundaries per zone (each EditorGroup, each sidebar, modal layer)
- [decided] Move MarkdownExporter to worker (off main thread)
- [decided] New Reference Worker for parallel index builds
- [decided] Component decomposition: WorkspaceShell → 7 sub-components

## Decisions Made (continued)
- [decided] Switch to @tiptap/markdown — eliminate HTML intermediate, direct md↔ProseMirror
  - Need custom renderMarkdown for 5 nodes: WikiLink, WikiLinkEmbed, Callout, MermaidDiagram, CanvasLink
  - Tables bug (upstream #5750) — we handle it ourselves
  - Removes 650-line MarkdownExporter + markdown-it dependency
- [decided] Persist scroll + cursor position per tab across restarts (~200 bytes/tab in session)
- [decided] Session: extend Rust SessionState with optional `editor_layout` field (non-breaking)
- [decided] Before implementation: push worktree changes to remote, destroy worktree, start fresh

## Pending Decisions
- [ ] Whether to batch Tauri IPC calls or keep individual invokes
