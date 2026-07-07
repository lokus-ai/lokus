# Phase 0 — Wiring Checklist

Rule: every item is **imported AND rendered/called AND reachable on a real user path**. No dead ends.

Legend: ✅ wired + proven · ⛔ deferred (out of scope)

---

## 1. Onboarding wizard — WIRED ✅

- **Import:** `src/App.jsx:4` → `import { OnboardingWizard } from "./components/onboarding/OnboardingWizard.jsx"`
- **Render:** `src/App.jsx:252` → `{!isPrefsWindow && <OnboardingWizard />}` inside `.app-content` (main window only).
- **Gate:** `OnboardingWizard` self-gates via `useOnboarding()` which reads `hasCompletedOnboarding` from the global config store. Shows for `!hasCompletedOnboarding`.
- **First-run only:** `src/hooks/useOnboarding.js:29-37` — if not completed AND `detectExistingUser()` is true (a saved vault exists), it marks onboarding complete and skips, so existing users are **not** re-onboarded.
- **Reachable path:** fresh user → main window → guest (see #2) → Launcher renders → `<OnboardingWizard/>` mounts → `useOnboarding` sees no config → `phase="wizard"` → Radix dialog opens over the app.
- **Proof:** `src/hooks/useOnboarding.test.js` (4 tests) — new user → `phase==='wizard'`; completed → `phase===null`; complete/skip persist `hasCompletedOnboarding`. Grep confirms it was previously mounted nowhere; now mounted at `App.jsx:252`.

## 2. Guest / local default (auth demoted) — WIRED ✅

- **Extracted:** `src/core/auth/AuthGate.jsx` (was an inline `const` in App; now its own testable module, imported at `src/App.jsx:3` and rendered at `App.jsx:227`).
- **No auth wall:** `AuthGate` no longer returns `<LoginScreen/>`. When not signed in and not already a guest (main window only), it calls `continueAsGuest()` and renders the app immediately.
- **Sign-in preserved (demoted, not deleted):** the full sign-in flow lives in **Preferences → Account** (`src/views/Preferences.jsx` Account section — inline Google/Apple/email form + the guest "Sign In" card). The Preferences window never auto-guests, so a guest can sign in there; signing in clears guest mode (`AuthManager` `onAuthStateChange`).
- **Reachable path:** fresh user opens app → `AuthGate` auto-enters guest → Launcher/Workspace (no login screen). Sign-in reachable via Preferences → Account.
- **Proof:** `src/core/auth/AuthGate.test.jsx` (5 tests) — auto-guest + render in main window; no auto-guest in prefs window; no re-guest when guest/authed; loading fallback while resolving. `LoginScreen` no longer imported anywhere except its own file (grep clean).

## 3. "Simple" feature-flag default — WIRED ✅

- **Defaults flipped:** `src/contexts/RemoteConfigContext.jsx` `DEFAULT_CONFIG.feature_flags` — core (`enable_daily_notes`, `enable_backlinks`, `enable_import_export`) stay `true`; the **13 advanced flags default `false`**.
- **Single source of truth:** `ADVANCED_FEATURE_FLAGS` (exported) lists the 13 hidden flags: ai_assistant, sync, plugins, canvas, graph, kanban, bases, calendar, meetings, templates, mcp, terminal, version_history.
- **Effective flags:** `useFeatureFlags()` now returns computed flags — advanced flags forced OFF in Simple mode (client wins even over a remote config), forced ON when Advanced is enabled. All existing `featureFlags.enable_*` consumers (IconSidebar, CommandPalette, Workspace, Toolbar, EditorGroup, …) pick this up unchanged.
- **The ONE toggle (obvious):** Preferences → **General → "Advanced features"** switch (`src/views/Preferences.jsx`, re-enabled `General` sidebar entry + new toggle card). Off by default; drives `useAdvancedFeatures()` → persisted to `localStorage['lokus-advanced-features']`.
- **Existing users keep access:** on first load, if the pref is undecided, `detectExistingUser()` (saved workspace/vault via Tauri `get_validated_workspace_path`) defaults **existing users → Advanced ON**, fresh installs → Simple.
- **Reachable path:** new user → Simple workspace (Editor + Files + Search + palette, no cockpit). Preferences → General → toggle → all panels appear.
- **Proof:** `src/contexts/RemoteConfigContext.test.jsx` (5 tests) — advanced flags off + core on by default; toggle reveals them and persists; persisted pref respected on load; `ADVANCED_FEATURE_FLAGS` length 13; `detectExistingUser()` false outside Tauri.

## 4. README honesty — DONE ✅ (`README.md`)

- "Zero telemetry" → "Anonymous product analytics, opt-out anytime in Preferences (crash reporting off by default)". Verified: PostHog defaults enabled/opt-out (`services/posthog.js:56-59`); Sentry gated on `VITE_ENABLE_CRASH_REPORTS==='true'` (`main.jsx:16`).
- "No account required" → "No account required — guest/local by default" (now matches the guest default).
- "P2P sync (coming soon)" → "Optional encrypted cloud sync (Supabase)" + added "Encrypted cloud sync (Supabase)" to the shipped Roadmap; P2P (Iroh) stays a future item.
- "40+ slash commands" → "~30 slash commands".
- "TipTap 3" / "TipTap (ProseMirror)" / "TipTap editor" → "ProseMirror (raw)" across Tech Stack + project structure.

---

## Deferred (explicitly out of scope) ⛔
- Resurfacing feature mount, Cmd-K agent (`core/ai/init.js`), collapsing the 3,385-line Preferences, merging PRs #536 / #442.
- `npm run build` client-bundle bug (`graphIndex` pulling `fs/path` into the client) — PR #536's job; see report for verification approach.
