/**
 * Editor must not import Node builtins into the webview bundle.
 *
 * DISCOVERED BY THIS HARNESS on its first run: opening any note shows
 * "View crashed — Click to recover". The editor AI action context
 * (src/editor/ai/actionContext.js) statically imports
 * src/mcp-server/utils/graphIndex.js, which does
 * `import { readFile … } from 'fs/promises'` — a Node module that cannot
 * exist in the Tauri webview. Module evaluation throws and the whole
 * MainContent error-boundaries.
 *
 * The QA harness runs with a shim (QA_FS_SHIM) so the other journeys can
 * still exercise the app; THIS journey is the permanent, static reproduction
 * of the underlying bug — it fails until the import chain is fixed.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const NODE_BUILTINS = /from\s+['"](?:node:)?(fs\/promises|fs|path|os|child_process)['"]|import\(['"](?:node:)?(fs\/promises|fs)['"]\)/;

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(js|jsx)$/.test(e.name) && !/\.test\./.test(e.name)) acc.push(p);
  }
  return acc;
}

/** Resolve relative import specifiers one level deep to find Node-builtin importers reachable from client code. */
export default {
  id: '00-client-node-imports',
  title: 'Opening a note must not crash the editor (Node imports in client bundle)',
  expected: 'No module reachable from the editor imports Node builtins; opening a note renders the editor, not "View crashed".',

  async run(d, t, { repoRoot }) {
    // Dynamic half: without the QA shim, the editor crashes on note-open.
    // (The suite runs WITH the shim, so here we statically verify the import chain.)
    const offenders = [];
    const clientDirs = ['src/editor', 'src/core/ai', 'src/features', 'src/views'].map((p) => join(repoRoot, p));
    const mcpImportRe = /from\s+['"]([^'"]*mcp-server[^'"]*)['"]/g;

    for (const dir of clientDirs) {
      for (const f of walk(dir)) {
        const src = readFileSync(f, 'utf-8');
        let m;
        while ((m = mcpImportRe.exec(src))) {
          // client code importing mcp-server (a Node process) — check the target for Node builtins
          const rel = f.replace(repoRoot + '/', '');
          const targetRel = m[1];
          try {
            const targetPath = join(f, '..', targetRel) + (targetRel.endsWith('.js') ? '' : '.js');
            const targetSrc = readFileSync(targetPath, 'utf-8');
            if (NODE_BUILTINS.test(targetSrc)) {
              offenders.push(`${rel} → ${targetRel} (imports Node builtins)`);
            }
          } catch {
            offenders.push(`${rel} → ${targetRel} (mcp-server import from client code)`);
          }
        }
      }
    }

    // Live proof: the graphIndex module itself imports fs/promises.
    const graphIndex = readFileSync(join(repoRoot, 'src/mcp-server/utils/graphIndex.js'), 'utf-8');
    const graphIndexUsesFs = /from\s+['"]fs\/promises['"]/.test(graphIndex);

    t.expect(
      offenders.length === 0 || !graphIndexUsesFs,
      'Editor bundle is webview-safe',
      'Client-side editor code never pulls Node-only modules into the webview bundle',
      `EDITOR CRASHES ON NOTE OPEN ("View crashed — Click to recover"). ` +
        `Without the QA fs-shim, opening any note throws: Module "fs/promises" has been externalized for browser compatibility ` +
        `(at src/mcp-server/utils/graphIndex.js:8, reached from the editor AI action context). Offending import chains: ${JSON.stringify(offenders)}`,
      null
    );
  },
};
