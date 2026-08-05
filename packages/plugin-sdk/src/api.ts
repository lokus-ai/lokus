/**
 * The API surface a Lokus v3 plugin receives in `activate(api)`.
 *
 * Plugins run in a dedicated Worker: no DOM, no Tauri, no globals.
 * Every method below is an RPC into the host, checked against the
 * capabilities the user granted at enable time. Denied calls reject
 * with a permission error.
 */

export type NotifyType = 'info' | 'success' | 'error';

export interface NotifyOptions {
  message: string;
  type?: NotifyType;
  title?: string;
}

export interface StatusBarPatch {
  text?: string;
  tooltip?: string;
}

export interface FetchResult {
  status: number;
  body: string;
  truncated: boolean;
}

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface WorkspaceInfo {
  path: string | null;
}

export interface CommandEvent {
  id: string;
}

export type PluginEvent = 'command';

export interface LokusAPI {
  /** Requires capability: commands */
  commands: {
    execute(id: string, args?: Record<string, unknown>): Promise<unknown>;
  };
  /** Requires capability: ui */
  ui: {
    notify(options: NotifyOptions): Promise<boolean>;
    /** Update a status bar item declared in the manifest (by its id). */
    setStatusBarItem(itemId: string, patch: StatusBarPatch): Promise<boolean>;
  };
  /** Requires capability: editor */
  editor: {
    insert(text: string): Promise<boolean>;
  };
  /** Requires capabilities: notes.read / notes.write */
  notes: {
    list(options?: { limit?: number }): Promise<string[]>;
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<boolean>;
  };
  /** Requires capability: storage */
  storage: {
    get<T = unknown>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<boolean>;
    delete(key: string): Promise<boolean>;
  };
  /** Requires capability: network */
  network: {
    fetch(url: string, options?: FetchOptions): Promise<FetchResult>;
  };
  /** Requires capability: overlay */
  overlay: {
    show(overlayId: string): Promise<boolean>;
    hide(overlayId: string): Promise<boolean>;
  };
  /** Always allowed. */
  workspace: {
    info(): Promise<WorkspaceInfo>;
  };
  /** Subscribe to host events. Currently: 'command'. */
  on(event: PluginEvent, handler: (data: CommandEvent) => void): () => void;
}
