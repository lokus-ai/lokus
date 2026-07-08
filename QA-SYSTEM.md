# Lokus AI-QA — an AI that uses the app like a real user and reports what breaks

One command drives the **real Lokus frontend** like a human — creates a real vault
folder on disk, types, uses `#`/slash menus/`[[links]]`, splits panes, fires the
real menu-accelerator shortcuts, simulates crash/quit and window close — and emits
a QA report with screenshots, expected-vs-actual, and repro steps for every bug.

```bash
npm run qa            # everything: scripted journeys + AI user + monkey pass
npm run qa:journeys   # deterministic journeys only
npm run qa:ai         # AI user + monkey only
node qa/run.js --filter 01        # one journey
node qa/run.js --headed           # watch it drive the app
node qa/run.js --update-baseline  # accept current failures as known bugs
```

Output: `qa/reports/run-<timestamp>/report.html` (self-contained, screenshots
embedded), `report.md`, `results.json`, and `shots/*.png`. A real run is checked
in at **`qa/reports/sample-report/`** — open `report.html`.

## What it caught on its first real run (3 pass · 8 fail)

| # | Bug | Evidence |
|---|-----|----------|
| 00 | **Opening any note crashes the editor** ("View crashed — Click to recover"): `src/editor/ai/actionContext.js` → `src/mcp-server/utils/graphIndex.js` imports Node `fs/promises`/`path` into the webview bundle | discovered live by the harness; permanent static probe |
| 01 | **Data loss / no autosave**: type → crash/quit → text gone; the `.md` on disk stays empty | screenshots before/after + real disk state |
| 03 | **Session never restored**: even after Cmd+S, reopening shows the Welcome screen — the session-save effect runs once, 500 ms after mount (deps `[workspacePath]`), before any tab is open | screenshot + `.lokus/session.json` contents |
| 06 | **Split pane destroys unsaved content + undo history**: after Cmd+\ the note text is gone in both panes ("1 unsaved" with an empty editor) | before/after screenshots |
| 07 | **Graph hotkey blanks the center**: `lokus:graph-view` → `switchView('graph')` but `MainContent` has no `graph` branch | screenshot of the blank pane |
| 08 | **Closed window can never be reopened from the dock**: Rust hides on close (`lib.rs` CloseRequested → `hide()` + `prevent_close`) but no `RunEvent::Reopen` handler exists anywhere | static probe with file:line evidence + simulated close |
| ai-user | The AI user independently hit the **data-loss** bug ("my slash-menu heading is gone after restart") | its own step log + screenshots |
| ai-monkey | Hotkey hammering makes the **editor disappear entirely** (graph-blank + session bugs compound) | screenshot |

Passing: `#`/`##` heading input rules, slash menu insert, `[[wiki-link]]` popup +
node creation, Cmd+S writes the real file to disk.

## Architecture

```
qa/
  run.js                 CLI: starts vite, runs journeys + AI pass, writes report, exit code for CI
  harness/
    backend.js           Node disk backend: every Tauri fs command hits a REAL temp vault folder
    tauri-disk-mock.js   in-page __TAURI_INTERNALS__: invoke→backend, full event plugin (listen/emit),
                         window plugin simulating Rust hide-on-close
    driver.js            LokusDriver — the human-level action API (below) + createQaContext
    recorder.js          steps, screenshots, console errors, findings per journey
    server.js            reuse/spawn `npm run dev` (with QA_FS_SHIM=1)
    node-shims/          fs-promises + path browser shims (QA only; see bug 00)
  journeys/              00–08 deterministic critical journeys
  ai-user/
    agent.js             observe(screenshot+DOM) → decide → act loop
    llm.js               Anthropic Messages API (ANTHROPIC_API_KEY) or documented stub persona
    monkey.js            seeded chaos: huge paste, rapid keys, weird unicode, hotkey hammering
  reporter/report.js     Markdown + self-contained HTML
  baseline.json          known-failing journeys (CI gate = NEW failures only)
```

### The action API (what journeys and the AI both call)

`createVault` · `openLauncher` · `newNote(name)` · `type(text)` · `press(keys)` ·
`save()` · `openSlashMenu()` / `chooseSlashItem(q)` · `link('[[target')` ·
`splitPane()` · `graphHotkey()` · `closeWindow()` · `reopenFromDock()` ·
`forceReload()` (simulated crash/quit) · `screenshot(label)` · `readEditor()`
(all panes: text/headings/wiki-links) · `diskState()` (real files in the vault) ·
`domSummary()` · `consoleErrors()` · `emitTauriEvent('lokus:*')`.

### Runner choice: Playwright + real frontend + disk-backed Tauri mock (not tauri-driver)

- **Why not tauri-driver:** it has no macOS support (WKWebView exposes no
  WebDriver), and this is a macOS project. It would also make per-run fresh
  vaults and crash simulation much slower.
- **What we run instead:** the real Vite-served frontend in Chromium, with
  `window.__TAURI_INTERNALS__` replaced by a mock that forwards every file/
  session command to a **real temp folder on disk** (not the in-memory mock from
  `tests/e2e/mocks` — that one can't test persistence across reloads). The mock
  also implements the Tauri v2 **event plugin**, so `lokus:*` menu-accelerator
  events (graph, split, close-window…) fire exactly like the native menu fires
  them, and a **window plugin** that mirrors the Rust hide-on-close behavior.
- **Trade-off:** true native concerns (menu registration itself, dock events,
  updater, multi-window) can't be exercised in a browser. Those are covered by
  **static probes** against `src-tauri/` (journey 08 proves the missing
  `RunEvent::Reopen` handler with file:line evidence). If Linux CI ever matters,
  the same journeys can be pointed at tauri-driver there.
- Auth/login is bypassed with guest mode (`lokus-guest-mode` in localStorage);
  workspace opens via `?testMode=true&workspacePath=…` — the same hook the
  existing e2e suite uses.

### The AI user

`qa/ai-user/agent.js` runs the loop: screenshot + DOM summary + console errors +
last-action result → LLM decides ONE action (JSON) → driver executes → repeat.
It files `report_issue` findings the moment it sees something broken, confusing,
or lossy, and verifies outcomes (did the text survive the restart?).

- With `ANTHROPIC_API_KEY` set: real LLM decisions (`QA_LLM_MODEL`, default
  `claude-sonnet-5`), vision included.
- Without a key: a **stub persona** — the same loop and verification logic with
  a deterministic decision script that still *reacts to observations* (it filed
  the data-loss blocker in the sample run). This keeps `npm run qa` useful in CI
  without a key; set the key to get true exploratory behavior.

The **monkey pass** (`monkey.js`, seeded so runs are reproducible) does what
users do at their worst: 40k-char pastes, 30× Enter + 30× undo with zero delay,
RTL/emoji/`<script>` text, slash-menu Escape spam, random rapid clicks, hotkey
hammering, reload mid-typing — and checks invariants after every burst (no
unhandled page errors, app not blank, editor still reachable).

## Adding a journey

Create `qa/journeys/09-my-flow.js`:

```js
export default {
  id: '09-my-flow',
  title: 'What the user expects, in one sentence',
  expected: 'The real expected behavior (assert THIS, not current behavior)',
  async run(d, t, { repoRoot }) {
    await d.createVault('my-flow');
    await d.newNote('note');
    await d.type('hello');
    const shot = await d.screenshot('after-typing');
    t.expect(cond, 'Assertion title', 'expected…', 'actual…', shot); // soft assert → finding
  },
};
```

Register it in `qa/journeys/index.js`. Write assertions for the behavior users
deserve — if the app is broken, the journey **should fail**; that's the product
backlog. `t.expect` records a finding and keeps going; throwing marks a crash.

## CI

`node qa/run.js` exits **1 only for failures not listed in `qa/baseline.json`**
(the 8 known bugs above are baselined). Fix a bug → remove its id from the
baseline → the journey becomes a regression guard. `--update-baseline` rewrites
the list from the current run.
