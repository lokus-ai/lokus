# Progress Log

## 2026-02-24

### Session 1 — Brainstorming & Investigation

**Context recovery:**
- Previous session (2026-02-23) did workspace architecture overhaul brainstorming
- User shifted direction: wants to replace TipTap entirely with raw ProseMirror
- Created `fixing-root` worktree from latest origin/main (d6076a6)

**Brainstorming phase:**
- User invoked /brainstorming about TipTap → ProseMirror
- Pain points: TipTap abstraction blocks custom syntax, md→HTML→TipTap chain is lossy, many workarounds
- Proposed 3 approaches: A (raw PM), B (stay TipTap, fix), C (hybrid)
- User chose: Approach A (raw ProseMirror), big bang rewrite, "do it right take time"

**Deep investigation (4 parallel Opus agents):**
1. React integration layer — identified tab switching bug root cause (useEditor dep array)
2. Extension migration — categorized all 36 extensions (7 trivial, 8 moderate, 7 hard, 5 delete)
3. Pipeline/schema — confirmed lokus-md-pipeline.js is foundation, identified schema gap
4. External consumers — mapped all files needing changes, found abstraction barrier in EditorAPI

**Design presented to user:**
- 7 sections: Architecture, Replacements, Schema, Extensions, External Impact, Phases, Tab Bug Fix
- Awaiting user feedback on design sections

### Session 2 — Planning Files Update
- Updated task_plan.md, findings.md, progress.md with current state
- Previous files were stale (referenced old workspace overhaul approach)
- Next: get user approval on design → write design doc → invoke writing-plans

### Session 3 — Implementation Plan Written
- Ran 4 additional Opus investigation agents for exact code details:
  - Agent A: PM schema (24 nodes, 8 marks, all attributes documented)
  - Agent B: Editor lifecycle (useEditor deps, isSettingRef, content sync, imperativeHandle)
  - Agent C: Extension patterns (Extension.create → Plugin, suggestion config shapes, ReactRenderer API)
  - Agent D: External consumers (17 getHTML sites, 20+ chain().focus() commands, all file:line documented)
- Wrote comprehensive implementation plan: `docs/plans/2026-02-25-prosemirror-migration.md`
  - 22 tasks, each with exact file paths and code
  - Dependency graph between tasks
  - Follows writing-plans skill format (bite-sized steps, TDD, frequent commits)

### Session 4 — Foundation Tasks (1-7) Executed
- Task 1: Installed PM dependencies (prosemirror-model, state, view, commands, keymap, inputrules, history, dropcursor, gapcursor, schema-list, tables)
- Tasks 2-7: Dispatched 6 parallel agents (3 Opus, 3 Sonnet):
  - Task 2 (Opus): Created `src/editor/schema/lokus-schema.js` (846 lines) — 24 nodes, 8 marks, all attrs
  - Task 3 (Sonnet): Created `src/editor/lib/react-pm-helpers.jsx` (296 lines) — ReactPopup + createReactNodeView
  - Task 4 (Opus): Created `src/editor/lib/suggestion-plugin.js` (598 lines) — faithful @tiptap/suggestion port
  - Task 5 (Sonnet): Created `src/editor/lib/floating-menu-plugin.js` (140 lines) — replaces BubbleMenu
  - Task 6 (Sonnet): Created `src/editor/commands/index.js` (804 lines) — all command helpers
  - Task 7 (Opus): Created `src/editor/hooks/useProseMirror.js` (284 lines) — core hook, fixes tab bug
- Fixed: floating-menu-plugin.js had `@tiptap/pm/state` import → changed to `prosemirror-state`
- All files verified: zero @tiptap imports in any new file
- Total: ~3000 lines of foundation code

### Pending
- [ ] Review and commit foundation code (Tasks 1-7)
- [ ] Execute Tasks 8-22 (core editor replacement, extension ports, external consumers, cleanup)
