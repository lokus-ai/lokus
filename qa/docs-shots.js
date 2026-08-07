#!/usr/bin/env node
/**
 * Docs screenshots — drives the real Lokus frontend via the QA harness and
 * captures the screens the docs site shows. Output: ../docs-repo/public/shots/.
 *
 *   node qa/docs-shots.js
 */

import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { QaBackend } from './harness/backend.js';
import { LokusDriver, createQaContext } from './harness/driver.js';
import { Recorder } from './harness/recorder.js';
import { ensureDevServer } from './harness/server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const OUT = join(repoRoot, '..', 'docs-repo', 'public', 'shots');
const FIXTURE = join(__dirname, 'fixtures', 'live-clock');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const server = await ensureDevServer({ cwd: repoRoot });
  const backend = new QaBackend();
  await backend.init();

  // Seed the sample plugin so the Extensions shots have content.
  const pluginDest = join(backend.pluginsDir(), 'live-clock');
  await fs.mkdir(pluginDest, { recursive: true });
  for (const f of ['plugin.json', 'index.js', 'panel.html']) {
    await fs.copyFile(join(FIXTURE, f), join(pluginDest, f));
  }

  // Seed a vault with rich content BEFORE the app opens it.
  const vaultDir = await backend.createVault('docs');
  await fs.writeFile(join(vaultDir, 'Projects.md'), `# Projects

Everything I'm building. See also [[Welcome]].

## Lokus

- [x] Ship plugin system v3
- [ ] Write the docs
- [!] Fix the sync edge cases

> [!tip] Docs rule
> If it isn't in the docs, it doesn't exist.
`);
  await fs.writeFile(join(vaultDir, 'Welcome.md'), `# Welcome

Lokus is a local-first knowledge OS. Open [[Projects]] to see what's cooking.

\`\`\`js
const idea = "plain markdown files";
\`\`\`
`);
  await fs.writeFile(join(vaultDir, 'Tracker.base'), JSON.stringify({
    name: 'Tracker',
    source: { type: 'folder', path: '/', recursive: true },
    views: { default: { type: 'table', name: 'All notes' } },
  }, null, 2));

  const browser = await chromium.launch({ headless: true });
  const context = await createQaContext(browser, backend);
  const rec = new Recorder(join(repoRoot, 'qa', 'reports', 'docs-shots'), 'docs');
  await rec.init();
  const d = new LokusDriver(context, backend, rec, { baseURL: server.url });
  d.vaultDir = vaultDir;
  await d.newPage();
  d.page.setViewportSize({ width: 1440, height: 900 });
  await d.page.goto(
    `${server.url}/?testMode=true&workspacePath=${encodeURIComponent(vaultDir)}`,
    { waitUntil: 'domcontentloaded' }
  );
  await d.waitForWorkspace();
  await wait(1200);

  const shot = async (name) => {
    await d.page.screenshot({ path: join(OUT, `${name}.png`) });
    console.log(`shot: ${name}.png`);
  };

  // 1. Editor with a rich note open (also shows backlinks-capable sidebar)
  await d.click('text=Projects');
  await wait(1200);
  await shot('editor');

  // 2. Wiki links / backlinks (open Welcome, which links to Projects)
  await d.click('text=Welcome');
  await wait(1000);
  await shot('wiki-links');

  // 3. Command palette
  await d.press('Meta+k');
  await wait(700);
  await shot('command-palette');
  await d.press('Escape');
  await wait(400);

  // 4. Global search
  await d.press('Meta+Shift+f');
  await wait(700);
  await d.type('plugin');
  await wait(700);
  await shot('search');
  await d.press('Escape');
  await wait(400);

  // 5. Graph view
  await d.click('button[title="Graph View"]');
  await wait(1500);
  await shot('graph');

  // 6. Kanban
  await d.press('Meta+Shift+k');
  await wait(1200);
  await shot('kanban');

  // 7. Calendar
  await d.click('button[title="Calendar"]');
  await wait(1200);
  await shot('calendar');

  // 8. Bases
  await d.click('button[title="Bases"]');
  await wait(1200);
  await shot('bases');

  // 9. Daily notes panel
  await d.click('button[title="Daily Notes"]');
  await wait(1200);
  await shot('daily-notes');

  // 10. Split editor
  await d.click('button[title="Explorer"]');
  await wait(600);
  await d.click('text=Projects');
  await wait(800);
  await d.press('Meta+\\');
  await wait(800);
  await d.click('text=Welcome');
  await wait(800);
  await shot('split');

  // 11. Canvas
  await d.press('Meta+Shift+c');
  await wait(1800);
  await shot('canvas');

  // 12. Extensions + Ask Screen
  await d.click('button[title="Extensions"]');
  await wait(900);
  await shot('extensions');
  await d.click('button[title="Enable plugin"]');
  await wait(800);
  await shot('ask-screen');
  await d.click('text=Allow & install');
  await wait(1200);

  // 13. Preferences / themes
  await d.press('Meta+,');
  await wait(1000);
  await shot('themes');

  await browser.close();
  console.log('done — shots in', OUT);
  process.exit(0);
}

main().catch((e) => {
  console.error('docs-shots failed:', e);
  process.exit(1);
});
