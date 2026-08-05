/**
 * QA disk backend — the Node side of the Tauri mock.
 *
 * The in-page mock (tauri-disk-mock.js) forwards Tauri `invoke` calls here via a
 * Playwright exposeBinding (`window.__qaInvoke`). Unlike the in-memory mock in
 * tests/e2e/mocks, every file operation hits a REAL temp vault folder on disk,
 * so persistence across reloads (autosave / data-loss journeys) is tested for real.
 *
 * All paths are jailed to `runRoot` — a per-run temp directory.
 */

import { promises as fs } from 'fs';
import fsSync from 'fs';
import { join, dirname, basename, resolve, sep } from 'path';
import { tmpdir } from 'os';

export class QaBackend {
  constructor() {
    this.runRoot = null;
    this.lastWorkspace = null;
    this.pickerQueue = []; // paths to return from the native folder-picker dialog
    this.invokeLog = [];   // { cmd, args, ts } — every invoke that reached the backend
    this.windowEvents = []; // close/hide/show requests recorded by the window plugin mock
    this.unknownCommands = new Set();
    this.vaultCounter = 0;
    this.pluginEnabled = [];      // plugin folder names currently enabled
    this.pluginPermissions = {};  // plugin folder name -> granted capabilities
  }

  async init() {
    this.runRoot = await fs.mkdtemp(join(tmpdir(), 'lokus-qa-run-'));
    return this.runRoot;
  }

  /** Fresh state between journeys (keeps runRoot). */
  resetSession() {
    this.lastWorkspace = null;
    this.pickerQueue = [];
    this.windowEvents = [];
    this.latency = {};
    this.pluginEnabled = [];
    this.pluginPermissions = {};
  }

  async createVault(name) {
    const safe = (name || `vault-${++this.vaultCounter}`).replace(/[^a-zA-Z0-9._-]/g, '-');
    const dir = join(this.runRoot, `${safe}-${Date.now().toString(36)}`);
    await fs.mkdir(dir, { recursive: true });
    await fs.mkdir(join(dir, '.lokus'), { recursive: true });
    return dir;
  }

  /** Queue a path for the next native folder-picker dialog. */
  queuePickerResult(path) {
    this.pickerQueue.push(path);
  }

  guard(p) {
    if (typeof p !== 'string' || !p) throw new Error(`Bad path: ${p}`);
    const r = resolve(p);
    if (!r.startsWith(this.runRoot + sep) && r !== this.runRoot) {
      throw new Error(`Path escapes QA sandbox: ${p}`);
    }
    return r;
  }

  /** Recursive tree in the shape read_workspace_files consumers expect. */
  async tree(dir) {
    const out = [];
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue; // hidden (incl. .lokus) not shown in file tree
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        out.push({ name: e.name, path: p, is_directory: true, is_file: false, children: await this.tree(p) });
      } else {
        out.push({ name: e.name, path: p, is_directory: false, is_file: true, children: null });
      }
    }
    // folders first, then files, alphabetical — matches typical tree ordering
    out.sort((a, b) => (a.is_directory === b.is_directory ? a.name.localeCompare(b.name) : a.is_directory ? -1 : 1));
    return out;
  }

  /** Flat snapshot of a vault dir for assertions: { relPath: content } */
  async diskState(vaultDir, { includeHidden = false } = {}) {
    const root = this.guard(vaultDir);
    const files = {};
    const walk = async (dir) => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (!includeHidden && e.name.startsWith('.')) continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else {
          const rel = p.slice(root.length + 1);
          try {
            const buf = await fs.readFile(p);
            files[rel] = buf.length > 100_000 ? `<binary/large: ${buf.length} bytes>` : buf.toString('utf-8');
          } catch (err) {
            files[rel] = `<unreadable: ${err.message}>`;
          }
        }
      }
    };
    await walk(root);
    return files;
  }

  sessionFile(workspacePath) {
    return join(this.guard(workspacePath), '.lokus', 'session.json');
  }

  /**
   * Handle a forwarded Tauri invoke. Returns { ok, value } or { ok:false, error }.
   */
  /**
   * Add artificial latency to a specific invoke command (ms). Used by
   * journeys to widen async race windows deterministically, e.g.
   * `backend.setLatency('read_file_content', 300)`. Reset in resetSession().
   */
  setLatency(cmd, ms) {
    this.latency = this.latency || {};
    if (ms > 0) this.latency[cmd] = ms;
    else delete this.latency[cmd];
  }

  async handle(cmd, args = {}) {
    this.invokeLog.push({ cmd, args, ts: Date.now() });
    try {
      const delay = this.latency?.[cmd];
      if (delay) await new Promise((r) => setTimeout(r, delay));
      const value = await this.dispatch(cmd, args);
      return { ok: true, value };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  }

  async dispatch(cmd, args) {
    switch (cmd) {
      // ---- files ----
      case 'read_file_content':
        return fs.readFile(this.guard(args.path), 'utf-8');
      case 'write_file_content':
      case 'write_file': {
        const p = this.guard(args.path);
        await fs.mkdir(dirname(p), { recursive: true });
        await fs.writeFile(p, args.content ?? '');
        return true;
      }
      case 'read_binary_file': {
        const buf = await fs.readFile(this.guard(args.path));
        return buf.toString('base64');
      }
      case 'path_exists':
        return fsSync.existsSync(this.guard(args.path));
      case 'is_directory':
        try {
          return (await fs.stat(this.guard(args.path))).isDirectory();
        } catch {
          return false;
        }
      case 'get_file_stats': {
        const st = await fs.stat(this.guard(args.path));
        return {
          size: st.size,
          modified: st.mtimeMs,
          created: st.birthtimeMs,
          is_directory: st.isDirectory(),
          is_file: st.isFile(),
        };
      }
      case 'create_directory':
        await fs.mkdir(this.guard(args.path), { recursive: true });
        return true;
      case 'create_file_in_workspace': {
        const name = args.name.endsWith('.md') || args.name.includes('.') ? args.name : `${args.name}.md`;
        const p = join(this.guard(args.workspacePath), name);
        await fs.mkdir(dirname(p), { recursive: true });
        await fs.writeFile(p, '', { flag: 'wx' }).catch(async (e) => {
          if (e.code !== 'EEXIST') throw e;
        });
        return p;
      }
      case 'create_folder_in_workspace': {
        const p = join(this.guard(args.workspacePath), args.name);
        await fs.mkdir(p, { recursive: true });
        return p;
      }
      case 'rename_file': {
        const from = this.guard(args.oldPath ?? args.path);
        const to = args.newPath ? this.guard(args.newPath) : join(dirname(from), args.newName);
        await fs.rename(from, this.guard(to));
        return to;
      }
      case 'move_file': {
        const to = this.guard(args.destPath ?? args.newPath);
        await fs.mkdir(dirname(to), { recursive: true });
        await fs.rename(this.guard(args.sourcePath ?? args.oldPath), to);
        return true;
      }
      case 'copy_file':
        await fs.copyFile(this.guard(args.sourcePath ?? args.path), this.guard(args.destPath ?? args.newPath));
        return true;
      case 'delete_file':
        await fs.rm(this.guard(args.path), { force: true });
        return true;
      case 'remove_directory':
        await fs.rm(this.guard(args.path), { recursive: true, force: true });
        return true;
      case 'read_directory':
      case 'list_directory': {
        const dir = this.guard(args.path);
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return entries.map((e) => ({
          name: e.name,
          path: join(dir, e.name),
          is_directory: e.isDirectory(),
          is_file: e.isFile(),
        }));
      }
      case 'read_workspace_files':
        return this.tree(this.guard(args.workspacePath));
      case 'read_all_files': {
        const out = {};
        for (const p of args.paths || []) {
          try {
            out[p] = await fs.readFile(this.guard(p), 'utf-8');
          } catch {
            /* skip */
          }
        }
        return out;
      }

      // ---- workspace / session ----
      case 'validate_workspace_path':
        return fsSync.existsSync(this.guard(args.path));
      case 'get_validated_workspace_path':
        return this.lastWorkspace;
      case 'save_last_workspace':
        this.lastWorkspace = args.path;
        return true;
      case 'clear_last_workspace':
        this.lastWorkspace = null;
        return true;
      case 'check_workspace_needs_reauth':
        return false;
      case 'api_set_workspace':
      case 'api_get_current_workspace':
        return this.lastWorkspace ?? true;
      case 'initialize_workspace_kanban':
        return true;
      case 'load_session_state': {
        try {
          const raw = await fs.readFile(this.sessionFile(args.workspacePath), 'utf-8');
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }
      case 'save_session_state': {
        // App sends camelCase; on load it expects snake_case fields.
        const snake = {
          open_tabs: args.openTabs ?? [],
          expanded_folders: args.expandedFolders ?? [],
          recent_files: args.recentFiles ?? [],
          editor_layout: args.editorLayout ?? null,
          layout: args.layout ?? null,
          current_view: args.currentView ?? 'editor',
        };
        const f = this.sessionFile(args.workspacePath);
        await fs.mkdir(dirname(f), { recursive: true });
        await fs.writeFile(f, JSON.stringify(snake, null, 2));
        return true;
      }
      case 'save_file_version_manual':
      case 'save_file_version': {
        const dir = join(this.guard(dirname(args.path)), '.lokus-versions');
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(join(dir, `${basename(args.path)}.${Date.now()}`), args.content ?? '');
        return true;
      }

      // ---- native dialogs / paths (plugin passthroughs from the page mock) ----
      case '__qa_dialog_open': {
        if (this.pickerQueue.length) return this.pickerQueue.shift();
        return this.createVault('picked-vault'); // AI user clicking "Open Folder" gets a real fresh vault
      }
      case '__qa_home_dir':
        return this.runRoot;
      case '__qa_path_join': {
        const parts = (Array.isArray(args?.paths) ? args.paths : []).filter(Boolean);
        return parts.join('/').replace(/\/+/g, '/');
      }
      case '__qa_read_bytes': {
        const buf = await fs.readFile(this.guard(args?.path));
        return Array.from(buf);
      }
      case '__qa_path_exists':
        try {
          await fs.access(this.guard(args?.path));
          return true;
        } catch {
          return false;
        }
      case '__qa_window_event':
        this.windowEvents.push({ ...args, ts: Date.now() });
        return true;
      case '__qa_get_window_events':
        return this.windowEvents;

      // ---- benign empties ----
      case 'list_kanban_boards':
      case 'get_all_tasks':
      case 'search_in_files':
      case 'git_status_summary':
        return [];
      // ---- plugin system v3 (reads {runRoot}/.lokus/plugins like the real app) ----
      case 'list_plugins':
        return this.listPlugins();
      case 'get_enabled_plugins':
        return [...this.pluginEnabled];
      case 'enable_plugin': {
        const folder = this.resolvePluginFolder(args?.name);
        if (folder && !this.pluginEnabled.includes(folder)) this.pluginEnabled.push(folder);
        return null;
      }
      case 'disable_plugin': {
        const folder = this.resolvePluginFolder(args?.name);
        this.pluginEnabled = this.pluginEnabled.filter((f) => f !== folder && f !== args?.name);
        return null;
      }
      case 'set_plugin_permission':
        this.pluginPermissions[args?.pluginName] = args?.permissions || [];
        return null;
      case 'get_plugin_permissions':
        return this.pluginPermissions[args?.pluginName] || [];
      case 'uninstall_plugin': {
        const folder = this.resolvePluginFolder(args?.name);
        if (folder) {
          await fs.rm(join(this.pluginsDir(), folder), { recursive: true, force: true });
        }
        this.pluginEnabled = this.pluginEnabled.filter((f) => f !== folder);
        delete this.pluginPermissions[folder];
        return null;
      }
      case 'open_kanban_board':
        return { columns: [], cards: [] };
      case 'is_development_mode':
        return true;

      default:
        this.unknownCommands.add(cmd);
        return null;
    }
  }

  // ---------- plugin system v3 helpers ----------

  pluginsDir() {
    return join(this.runRoot, '.lokus', 'plugins');
  }

  async listPlugins() {
    const dir = this.pluginsDir();
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const out = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const manifest = JSON.parse(
          await fs.readFile(join(dir, entry.name, 'plugin.json'), 'utf8')
        );
        out.push({
          manifest,
          path: join(dir, entry.name),
          enabled: this.pluginEnabled.includes(entry.name),
          installed_at: new Date().toISOString(),
          size: 0,
        });
      } catch {
        // folder without a readable manifest — skip, like the real installer would
      }
    }
    return out;
  }

  resolvePluginFolder(nameOrId) {
    if (!nameOrId) return null;
    if (fsSync.existsSync(join(this.pluginsDir(), nameOrId))) return nameOrId;
    const dir = this.pluginsDir();
    try {
      for (const entry of fsSync.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        try {
          const manifest = JSON.parse(
            fsSync.readFileSync(join(dir, entry.name, 'plugin.json'), 'utf8')
          );
          if (manifest.id === nameOrId || manifest.name === nameOrId) return entry.name;
        } catch {
          // unreadable manifest — not a match
        }
      }
    } catch {
      return null;
    }
    return null;
  }
}
