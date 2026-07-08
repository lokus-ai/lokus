/**
 * Window lifecycle: close -> reopen from the dock.
 *
 * The real Rust backend hides the window on close (CloseRequested ->
 * window.hide() + prevent_close, src-tauri/src/lib.rs) — so the app keeps
 * running with an invisible window. On macOS, clicking the dock icon fires
 * RunEvent::Reopen; if nothing handles it, the window never comes back.
 *
 * The browser harness simulates the close exactly like the app performs it
 * (lokus:close-window -> getCurrentWindow().close(), mock mirrors
 * hide-on-close), and STATICALLY verifies the Rust side has a Reopen handler.
 * tauri-driver can't run on macOS, so the Rust half is checked at source level.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

function rustSources(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && e.name !== 'target') rustSources(p, acc);
    else if (e.name.endsWith('.rs')) acc.push(p);
  }
  return acc;
}

export default {
  id: '08-window-lifecycle',
  title: 'Closed window can be reopened from the dock',
  expected: 'Closing the window hides the app (by design); clicking the dock icon must bring it back.',

  async run(d, t, { repoRoot }) {
    await d.createVault('lifecycle');
    await d.newNote('lifecycle');
    await d.type('window lifecycle test');
    await d.save();
    await d.screenshot('before-close');

    const handled = await d.closeWindow();
    const shotClosed = await d.screenshot('after-close-window-hidden');
    t.expect(
      handled > 0,
      'Close-window path is wired',
      'lokus:close-window has a listener that calls window.close()',
      `Listeners that handled the event: ${handled}`,
      shotClosed
    );

    const state = await d.reopenFromDock();
    t.expect(
      state.closeRequests > 0,
      'Close request reaches the window layer (hide-on-close)',
      'window.close() is requested; the real backend hides the window and keeps the app alive',
      JSON.stringify(state),
      shotClosed
    );

    // Static probe of the Rust side: is there ANY dock-reopen handler?
    const srcTauri = join(repoRoot, 'src-tauri', 'src');
    const files = rustSources(srcTauri);
    let hidesOnClose = false;
    let hasReopenHandler = false;
    const evidence = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf-8');
      if (/CloseRequested/.test(src) && /(prevent_close|\.hide\(\))/.test(src)) {
        hidesOnClose = true;
        const line = src.split('\n').findIndex((l) => l.includes('CloseRequested')) + 1;
        evidence.push(`${f.replace(repoRoot + '/', '')}:${line} — CloseRequested → hide()+prevent_close`);
      }
      if (/RunEvent::Reopen|ApplicationShouldHandleReopen|handle_reopen/i.test(src)) {
        hasReopenHandler = true;
        evidence.push(`${f.replace(repoRoot + '/', '')} — reopen handler found`);
      }
    }

    t.expect(
      !hidesOnClose || hasReopenHandler,
      'Dock click can restore the hidden window',
      'If close hides the window (it does), the Rust side must handle macOS RunEvent::Reopen (dock click) and re-show it',
      `NO REOPEN HANDLER: the window is hidden on close but no RunEvent::Reopen / reopen handling exists anywhere in src-tauri — ` +
        `after closing the window, clicking the dock icon can never bring it back. Evidence: ${evidence.join('; ') || 'none found'}. ` +
        `Simulated window state after dock click: ${JSON.stringify(state)}`,
      shotClosed
    );
  },
};
