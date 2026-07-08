/**
 * LokusDriver — the human-level action API over the real Lokus frontend.
 *
 * Both the scripted journeys and the AI user call this layer. Every action is
 * logged to the Recorder; screenshots are saved next to the report.
 *
 * Runs the real Vite-served frontend in Chromium with the disk-backed Tauri
 * mock (see tauri-disk-mock.js + backend.js): file operations hit a REAL temp
 * vault folder, and `lokus:*` menu-accelerator events can be fired exactly as
 * the native menu would fire them.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCK_SCRIPT = readFileSync(join(__dirname, 'tauri-disk-mock.js'), 'utf-8');

export const SELECTORS = {
  editor: '.ProseMirror:visible',
  newNoteButton: '[data-tour="create-note"], button[title^="New File"]',
  newFileInput: 'input[placeholder="New file..."]',
  fileEntry: '.file-entry-container',
  slashMenu: '[data-tippy-root]',
  wikiLinkNode: '[data-type="wiki-link"]',
  graphCanvas: '.graph-container canvas',
  splitButton: '[data-tour="split-view"], button[title="Split View"]',
  workspaceReady: '[data-tour="create-note"], .ProseMirror, .file-entry-container, button[title^="New File"]',
};

export class LokusDriver {
  /**
   * @param {import('playwright').BrowserContext} context
   * @param {import('./backend.js').QaBackend} backend
   * @param {import('./recorder.js').Recorder} recorder
   * @param {{ baseURL: string }} opts
   */
  constructor(context, backend, recorder, opts = {}) {
    this.context = context;
    this.backend = backend;
    this.rec = recorder;
    this.baseURL = opts.baseURL || 'http://localhost:1420';
    this.page = null;
    this.vaultDir = null;
  }

  // ---------- lifecycle ----------

  async newPage() {
    const page = await this.context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('[QA mock]')) return;
        this.rec.console({ ts: Date.now(), type: 'console.error', text: text.slice(0, 500) });
      }
    });
    page.on('pageerror', (err) => {
      this.rec.console({ ts: Date.now(), type: 'pageerror', text: String(err).slice(0, 800) });
    });
    this.page = page;
    return page;
  }

  /**
   * Create a REAL temp vault folder on disk and open Lokus on it.
   * This is the standard entry point for journeys.
   */
  async createVault(name = 'vault') {
    this.vaultDir = await this.backend.createVault(name);
    await this.rec.step('createVault', `real temp folder ${this.vaultDir}`);
    if (!this.page) await this.newPage();
    await this.page.goto(
      `${this.baseURL}/?testMode=true&workspacePath=${encodeURIComponent(this.vaultDir)}`,
      { waitUntil: 'domcontentloaded' }
    );
    await this.waitForWorkspace();
    return this.vaultDir;
  }

  /** Open Lokus at the launcher (no workspace) — used by the AI "new user" persona. */
  async openLauncher() {
    this.backend.resetSession();
    await this.rec.step('openLauncher', 'boot app with no workspace');
    if (!this.page) await this.newPage();
    await this.page.goto(`${this.baseURL}/?forceWelcome=true`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(1500);
  }

  async waitForWorkspace(timeout = 20000) {
    await this.page.waitForSelector(SELECTORS.workspaceReady, { timeout });
    await this.page.waitForTimeout(600); // activation retries settle (useWorkspaceActivation)
  }

  /** Simulated crash/quit-without-save: hard reload, nothing is flushed. */
  async forceReload() {
    await this.rec.step('forceReload', 'simulated crash/quit: hard page reload (no save flushed)');
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.waitForWorkspace();
  }

  /**
   * Close the window the way the app does it (lokus:close-window ->
   * getCurrentWindow().close()). With the real Rust backend this hides the
   * window (hide-on-close, src-tauri/src/lib.rs) — the mock mirrors that.
   */
  async closeWindow() {
    await this.rec.step('closeWindow', 'emit lokus:close-window (menu path) -> window.close()');
    const handled = await this.emitTauriEvent('lokus:close-window');
    await this.page.waitForTimeout(500);
    return handled;
  }

  /**
   * Simulate clicking the dock icon after close. Returns what the app offers:
   * whether any frontend/backed path exists to re-show the window.
   */
  async reopenFromDock() {
    await this.rec.step('reopenFromDock', 'simulate macOS dock click after window close');
    // In real Tauri, dock click fires RunEvent::Reopen in Rust. The harness
    // asks the page whether the window came back on its own.
    await this.page.waitForTimeout(400);
    return this.page.evaluate(() => ({
      visible: window.__qaWindowState?.visible ?? true,
      closeRequests: window.__qaWindowState?.closeRequests ?? 0,
    }));
  }

  // ---------- notes & typing ----------

  /** Create a new note through the real UI (New File button -> inline name input -> Enter). */
  async newNote(name = 'my-note') {
    await this.rec.step('newNote', `via New File button, name "${name}"`);
    const btn = this.page.locator(SELECTORS.newNoteButton).first();
    await btn.waitFor({ state: 'visible', timeout: 8000 });
    await btn.click();
    const input = this.page.locator(SELECTORS.newFileInput);
    await input.waitFor({ state: 'visible', timeout: 5000 });
    await input.fill(name);
    await input.press('Enter');
    await this.page.waitForSelector(SELECTORS.editor, { timeout: 8000 });
    await this.page.waitForTimeout(400);
    return `${name}.md`;
  }

  /** Type into the focused editor like a human (keystroke by keystroke — triggers input rules). */
  async type(text) {
    await this.rec.step('type', JSON.stringify(text.length > 120 ? text.slice(0, 120) + '…' : text));
    const editor = this.page.locator(SELECTORS.editor).first();
    await editor.click();
    await this.page.keyboard.type(text, { delay: 15 });
  }

  /** Press a key combo, e.g. 'Enter', 'ControlOrMeta+z', 'ControlOrMeta+s'. */
  async press(keys) {
    await this.rec.step('press', keys);
    await this.page.keyboard.press(keys);
    await this.page.waitForTimeout(200);
  }

  /** Save via the real user shortcut (Cmd/Ctrl+S has a browser-mode keydown fallback). */
  async save() {
    await this.rec.step('save', 'ControlOrMeta+S');
    await this.page.keyboard.press('ControlOrMeta+s');
    await this.page.waitForTimeout(600);
  }

  /** Read editor content across ALL panes: plain text, HTML, headings, links. */
  async readEditor() {
    return this.page.evaluate(() => {
      const eds = [...document.querySelectorAll('.ProseMirror')];
      if (!eds.length) return null;
      const text = eds.map((e) => e.textContent || '').join('\n---pane---\n');
      const all = (sel) => eds.flatMap((e) => [...e.querySelectorAll(sel)]);
      return {
        panes: eds.length,
        text,
        html: eds[0].innerHTML.slice(0, 4000),
        headings: all('h1,h2,h3,h4,h5,h6').map((h) => ({
          tag: h.tagName.toLowerCase(),
          text: h.textContent,
        })),
        wikiLinks: all('[data-type="wiki-link"]').map((a) => a.textContent),
        isEmpty: !text.replace(/---pane---/g, '').trim(),
      };
    });
  }

  // ---------- menus & structures ----------

  /** Open the slash menu by typing '/' in the editor. Returns menu state. */
  async openSlashMenu() {
    await this.rec.step('openSlashMenu', "type '/' in editor");
    const editor = this.page.locator(SELECTORS.editor).first();
    await editor.click();
    await this.page.keyboard.type('/', { delay: 30 });
    try {
      await this.page.waitForSelector(SELECTORS.slashMenu, { timeout: 4000 });
    } catch {
      return { open: false, items: [] };
    }
    await this.page.waitForTimeout(300);
    const items = await this.page.evaluate(() => {
      const root = document.querySelector('[data-tippy-root]');
      if (!root) return [];
      return [...root.querySelectorAll('button, [role="option"], .cursor-pointer')]
        .map((el) => el.textContent.trim())
        .filter(Boolean)
        .slice(0, 30);
    });
    return { open: true, items };
  }

  /** Pick a slash-menu item by typing its name and pressing Enter. */
  async chooseSlashItem(query) {
    await this.rec.step('chooseSlashItem', query);
    await this.page.keyboard.type(query, { delay: 25 });
    await this.page.waitForTimeout(400);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(400);
  }

  /** Start a wiki link with '[[' and (optionally) complete it. */
  async link(target) {
    await this.rec.step('link', `[[${target}]]`);
    const editor = this.page.locator(SELECTORS.editor).first();
    await editor.click();
    await this.page.keyboard.type('[[', { delay: 40 });
    await this.page.waitForTimeout(500);
    await this.page.keyboard.type(target, { delay: 25 });
    await this.page.waitForTimeout(600);
    const popupOpen = await this.page.evaluate(
      () => !!document.querySelector('body > div[style*="2147483647"], body > div.fixed')
    );
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(500);
    return { popupOpen };
  }

  /** Split the editor pane exactly like the Cmd+\ menu accelerator does. */
  async splitPane() {
    await this.rec.step('splitPane', 'emit lokus:toggle-split-view (Cmd+\\ accelerator path)');
    const handled = await this.emitTauriEvent('lokus:toggle-split-view');
    await this.page.waitForTimeout(800);
    return handled;
  }

  /** Trigger the graph view exactly like the Cmd+Shift+G menu accelerator does. */
  async graphHotkey() {
    await this.rec.step('graphHotkey', 'emit lokus:graph-view (Cmd+Shift+G accelerator path)');
    const handled = await this.emitTauriEvent('lokus:graph-view');
    await this.page.waitForTimeout(1200);
    return handled;
  }

  /** Fire a lokus:* event through the mocked Tauri event system (= native menu accelerator). */
  async emitTauriEvent(event, payload = null) {
    return this.page.evaluate(
      ([e, p]) => window.__qaEmitTauriEvent(e, p),
      [event, payload]
    );
  }

  // ---------- generic interaction (AI user) ----------

  async click(selector) {
    await this.rec.step('click', selector);
    await this.page.locator(selector).first().click({ timeout: 5000 });
    await this.page.waitForTimeout(400);
  }

  async clickText(text) {
    await this.rec.step('clickText', text);
    await this.page.getByText(text, { exact: false }).first().click({ timeout: 5000 });
    await this.page.waitForTimeout(400);
  }

  /** Compact DOM summary for the AI user: visible interactive elements + landmarks. */
  async domSummary() {
    return this.page.evaluate(() => {
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
      };
      const els = [...document.querySelectorAll('button, a, input, [role="button"], [contenteditable="true"], [data-tour]')]
        .filter(vis)
        .slice(0, 80)
        .map((el) => {
          const label =
            el.getAttribute('title') ||
            el.getAttribute('aria-label') ||
            el.getAttribute('placeholder') ||
            (el.textContent || '').trim().slice(0, 60);
          const tour = el.getAttribute('data-tour');
          return {
            tag: el.tagName.toLowerCase(),
            label,
            tour: tour || undefined,
            editable: el.getAttribute('contenteditable') === 'true' || undefined,
          };
        })
        .filter((e) => e.label || e.tour || e.editable);
      const ed = document.querySelector('.ProseMirror');
      return {
        url: location.href,
        title: document.title,
        windowHidden: document.documentElement.hasAttribute('data-qa-window-hidden'),
        editorPresent: !!ed,
        editorText: ed ? (ed.textContent || '').slice(0, 400) : null,
        bodyTextSample: (document.body.innerText || '').slice(0, 800),
        interactive: els,
      };
    });
  }

  // ---------- observation ----------

  async screenshot(label) {
    const file = this.rec.shotName(label);
    try {
      await this.page.screenshot({ path: join(this.rec.dir, file), timeout: 8000 });
    } catch {
      return null;
    }
    this.rec.attachShotToLastStep(file);
    return file;
  }

  /** Real on-disk state of the vault folder — { relPath: content }. */
  async diskState(vaultDir = this.vaultDir, opts) {
    return this.backend.diskState(vaultDir, opts);
  }

  consoleErrors() {
    return this.rec.consoleErrors.slice();
  }

  async dispose() {
    if (this.page && !this.page.isClosed()) await this.page.close().catch(() => {});
    this.page = null;
  }
}

/**
 * Build a fresh Chromium context wired for the QA harness:
 * guest-mode auth bypass, tour disabled, mock init scripts, backend binding.
 */
export async function createQaContext(browser, backend) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.exposeBinding('__qaInvoke', async (_source, cmd, args) => backend.handle(cmd, args));
  // Order matters: config/localStorage first, then the mock.
  await context.addInitScript(() => {
    try {
      localStorage.setItem('lokus-guest-mode', 'true'); // bypass LoginScreen (AuthManager guest path)
      const cfg = JSON.parse(localStorage.getItem('lokus:config') || '{}');
      cfg.hasSeenProductTour = true; // no onboarding overlay
      localStorage.setItem('lokus:config', JSON.stringify(cfg));
    } catch {}
  });
  await context.addInitScript(MOCK_SCRIPT);
  return context;
}
