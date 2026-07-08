# Phase 0 — "The Doorway" — Report

**Branch:** `phase0/doorway` (off `origin/main`) · **Scope:** stop losing users at the door. No new features — wire what exists, demote the auth wall, ship a Simple default, fix the README.

## What a new user now experiences

1. Opens Lokus → **lands straight in the app as a guest** (no login wall, no account).
2. Is greeted by the **onboarding wizard** (use-case → theme → vault name → daily notes → walkthrough), which was previously built but mounted nowhere.
3. Lands in a **Simple workspace**: Editor + Files + Search + command palette. The 13 advanced panels (Graph, Canvas, Kanban, Bases, Calendar, Meetings, AI, Sync, Plugins, Templates, Terminal, MCP, Version History) are hidden.
4. Can flip **Preferences → General → "Advanced features"** to reveal everything, one obvious switch.
5. Can sign in whenever they want via **Preferences → Account** (Google / Apple / email) — optional, not a gate.

Existing users (anyone with a saved vault) are auto-detected: they **keep every panel** and are **not** re-onboarded.

---

## Wiring checklist — final state

See `WIRING-CHECKLIST.md` for full file:line proof. Summary:

| # | Item | Status | Key proof |
|---|------|--------|-----------|
| 1 | Onboarding wizard mounted | ✅ wired | `App.jsx:252` renders `<OnboardingWizard/>`; self-gates on `hasCompletedOnboarding`; first-run-only via `detectExistingUser()`. Tests: `useOnboarding.test.js`. |
| 2 | Guest/local default (auth demoted) | ✅ wired | `core/auth/AuthGate.jsx` auto-enters guest; no `LoginScreen` gate; sign-in in Preferences → Account. Tests: `AuthGate.test.jsx`. |
| 3 | Simple feature-flag default + one Advanced toggle | ✅ wired | `RemoteConfigContext.jsx` (13 advanced flags off by default, `ADVANCED_FEATURE_FLAGS`), toggle at Preferences → General. Tests: `RemoteConfigContext.test.jsx`. |
| 4 | README honesty | ✅ done | telemetry, no-account, cloud-sync-not-P2P, ~30 commands, ProseMirror-not-TipTap all corrected. |

---

## Verification

### Tests — all green
- **Baseline (before changes):** 133 files, 2421 passed, 3 skipped.
- **After changes:** **136 files, 2435 passed, 3 skipped, 0 failing** (`npx vitest run`).
- Added 3 focused test files (+14 tests):
  - `src/core/auth/AuthGate.test.jsx` (5) — guest-default behavior, prefs-window exemption, loading fallback.
  - `src/contexts/RemoteConfigContext.test.jsx` (5) — Simple default, Advanced toggle reveal + persistence, `detectExistingUser` outside Tauri.
  - `src/hooks/useOnboarding.test.js` (4) — first-run gate, completion/skip persistence.
- Fixed one pre-existing test that assumed all-flags-on: `FileContextMenu.test.jsx` now mocks `useFeatureFlags` to advanced mode (its intent is to assert the Terminal/Version-History items render *when enabled*).

### Build — fails on the KNOWN pre-existing bug (not mine)
`NODE_OPTIONS=--max-old-space-size=4096 npx vite build` → **7957 modules transformed**, then fails at:
```
src/mcp-server/utils/graphIndex.js (9:9): "join" is not exported by "__vite-browser-external"
  import { readFile, writeFile, ... } from 'fs/promises';
  import { join, relative, ... } from 'path';
```
This is the Node-only `graphIndex` pulling `fs/path` into the client bundle — **PR #536's job, explicitly out of scope**. My changed files all transformed cleanly (they're upstream of the failure). Because a full production build is blocked by that unrelated bug, I verified my work via:
- the full Vitest suite (every changed module is imported and exercised),
- the 14 new focused tests above,
- code-tracing each wiring end-to-end (imported → rendered/called → reachable on the real user path).

### Runtime reachability (traced, not just imported)
- **Onboarding:** `App.jsx` imports `OnboardingWizard` (line 4) and renders it (line 252, `!isPrefsWindow`). It self-gates via `useOnboarding` → real config store. Reached on: fresh app → guest → Launcher → wizard opens.
- **Guest default:** `App.jsx` renders `AuthGate` (line 227) which, with no session, calls `continueAsGuest()` and renders children — the Launcher/Workspace, no login wall.
- **Simple flags:** every `featureFlags.enable_*` consumer (IconSidebar, CommandPalette, Workspace, Toolbar, EditorGroup, RightSidebar, LeftSidebar, FileContextMenu, …) reads `useFeatureFlags()`, which now returns the effective (Simple) flags. The toggle at Preferences → General writes `useAdvancedFeatures().setAdvancedFeatures`, flipping them live.

---

## Honest gaps / notes
- **Could not launch the app headless** (no Tauri runtime here) and the production build is blocked by the unrelated `graphIndex` bug, so verification is tests + code-tracing rather than a live click-through. Every wiring was traced to a rendered/called call site on the real path.
- **`LoginScreen.jsx` is now orphaned** (no longer the gate; sign-in lives in Preferences → Account). Left in place intentionally — auth is *demoted, not deleted* — but it's dead-ish code a future cleanup can remove.
- **Existing-user detection** relies on `get_validated_workspace_path` (a saved vault). Outside Tauri it returns false → Simple. First run persists the decision to `localStorage['lokus-advanced-features']`.
- **Remote config** can still push feature flags, but the client "Advanced features" toggle is authoritative over the 13 advanced flags by design, so a new user never gets the cockpit even if the server config enables everything.
- **Existing users see the onboarding wizard? No** — `useOnboarding` marks it complete for anyone with a saved vault, so only genuine first-runs are onboarded.

## Deferred (out of scope, untouched)
Resurfacing mount, Cmd-K agent (`core/ai/init.js`), 3,385-line Preferences collapse, PRs #536 / #442.
