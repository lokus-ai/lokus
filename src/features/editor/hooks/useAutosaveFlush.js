import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { flushAllDirtyTabs } from '../tabSaver';

/**
 * useAutosaveFlush — workspace-level "never lose an edit" flush triggers.
 *
 * Flushes every dirty tab when:
 *  - the Rust side emits `lokus:flush-dirty` (window CloseRequested / app
 *    ExitRequested — the webview keeps running while hidden, so writes finish)
 *  - the document becomes hidden (window hidden / minimized / app switched)
 *  - pagehide (webview teardown, e.g. reload)
 *
 * Per-keystroke debounced autosave lives in EditorGroup; this is the
 * belt-and-braces layer for abnormal exits.
 */
export function useAutosaveFlush() {
  useEffect(() => {
    const unlisten = listen('lokus:flush-dirty', () => {
      flushAllDirtyTabs();
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushAllDirtyTabs();
    };
    const onPageHide = () => {
      flushAllDirtyTabs();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      unlisten.then((fn) => fn()).catch(() => {});
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);
}
