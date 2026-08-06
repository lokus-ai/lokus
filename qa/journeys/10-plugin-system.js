/**
 * Plugin system v3, end to end:
 * discovery → enable → Ask Screen (permission approval) → activation →
 * contributed slash command, palette command (full RPC round-trip into the
 * worker and back into the editor), and panel rendering.
 *
 * Uses the bundled sample plugin (qa/fixtures/live-clock) — the same plugin
 * that ships as the docs example.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, '..', 'fixtures', 'live-clock');

async function installFixture(backend) {
  const dest = join(backend.pluginsDir(), 'live-clock');
  await fs.mkdir(dest, { recursive: true });
  for (const file of ['plugin.json', 'index.js', 'panel.html']) {
    await fs.copyFile(join(FIXTURE, file), join(dest, file));
  }
}

export default {
  id: '10-plugin-system',
  title: 'Plugin system v3: discovery, Ask Screen, and slots',
  expected:
    'The sample plugin is discovered from ~/.lokus/plugins; enabling it shows the Ask Screen; after approval its slash command inserts content, its palette command inserts a timestamp through the worker RPC, and its panel renders.',

  async run(d, t) {
    // Install the fixture BEFORE the app boots so host.init() discovers it.
    await installFixture(d.backend);
    await d.createVault('plugins');

    // ---- 1. Discovery: plugin appears in the Extensions sidebar ----
    await d.click('button[title="Extensions"]');
    await d.page.waitForTimeout(500);
    const shotList = await d.screenshot('extensions-list');
    const listed = (await d.page.locator('text=Live Clock').count()) > 0;
    t.expect(
      listed,
      'Installed plugin is discovered and listed',
      'A "Live Clock" card appears in the Extensions sidebar',
      `Live Clock visible: ${listed}`,
      shotList
    );
    if (!listed) return;

    // ---- 1b. Marketplace (Browse) tab renders and handles the registry ----
    // NOTE: the registry backend (lokusmd.com/api/v1/registry) is a known
    // missing server — every route 404s. The UI must degrade gracefully.
    await d.click('text=Browse');
    await d.page.waitForTimeout(2500);
    const shotMarket = await d.screenshot('marketplace');
    const errState = await d.page.locator('text=Failed to connect').count();
    const cards = await d.page.locator('button:has-text("Install")').count();
    t.expect(
      errState > 0 || cards > 0,
      'Marketplace UI handles the registry response gracefully',
      'Browse shows registry plugin cards, or a clean error state (registry API is a known missing backend)',
      `cards=${cards}, errorState=${errState}`,
      shotMarket
    );
    await d.click('text=Installed');
    await d.page.waitForTimeout(400);

    // ---- 2. Enable → Ask Screen appears before any code runs ----
    await d.click('button[title="Enable plugin"]');
    await d.page.waitForTimeout(500);
    const shotAsk = await d.screenshot('ask-screen');
    const askShown = (await d.page.locator('text=Allow & install').count()) > 0;
    t.expect(
      askShown,
      'Ask Screen requests approval before the plugin runs',
      'A dialog lists the requested capabilities with Allow / Cancel',
      `Ask Screen visible: ${askShown}`,
      shotAsk
    );
    if (!askShown) return;

    await d.click('text=Allow & install');
    await d.page.waitForTimeout(1200); // worker boots + activates
    const shotActive = await d.screenshot('plugin-active');
    const active = (await d.page.locator('text=Active').count()) > 0;
    t.expect(
      active,
      'Plugin activates after approval',
      'The plugin card shows an Active badge',
      `Active badge visible: ${active}`,
      shotActive
    );

    // ---- 3. Slash command slot (declared in the manifest) ----
    await d.click('button[title="Explorer"]');
    await d.page.waitForTimeout(300);
    await d.newNote('plugin-test');
    const menu = await d.openSlashMenu();
    const item = (menu.items || []).find((i) =>
      JSON.stringify(i).toLowerCase().includes('clock')
    );
    const shotSlash = await d.screenshot('slash-menu-clock');
    t.expect(
      !!item,
      'Contributed slash command appears in the menu',
      "Typing '/' shows the plugin's /clock entry",
      `Menu items: ${JSON.stringify((menu.items || []).slice(0, 20))}`,
      shotSlash
    );
    if (item) {
      await d.chooseSlashItem('clock');
      await d.page.waitForTimeout(400);
      const state = await d.readEditor();
      const inserted = (state?.text || '').includes('Time flies like an arrow');
      const shotAfterSlash = await d.screenshot('slash-inserted');
      t.expect(
        inserted,
        'Slash command inserts its content',
        'The clock divider text lands in the note',
        `Editor text: "${(state?.text || '').slice(0, 160)}"`,
        shotAfterSlash
      );
    }

    // ---- 4. Palette command → worker RPC → editor insert ----
    await d.press('Meta+k');
    await d.page.waitForTimeout(500);
    await d.type('Insert timestamp');
    await d.press('Enter');
    await d.page.waitForTimeout(1200); // RPC round-trip: host → worker → editor.insert
    const state2 = await d.readEditor();
    const stamped = (state2?.text || '').includes('🕐');
    const shotCmd = await d.screenshot('command-inserted-timestamp');
    t.expect(
      stamped,
      'Palette command round-trips through the plugin worker',
      'Running "Insert timestamp" inserts a timestamp via the gated RPC',
      `Editor text: "${(state2?.text || '').slice(0, 200)}"`,
      shotCmd
    );

    // ---- 5. Panel slot (webview panel in the right sidebar) ----
    // The right sidebar defaults to hidden; open it the way a user would.
    const showRightBtn = d.page.locator('button[title="Show Right Sidebar"]');
    if ((await showRightBtn.count()) > 0) {
      await showRightBtn.click();
      await d.page.waitForTimeout(500);
    }
    const panelShown = (await d.page.locator('text=live-clock').count()) > 0;
    const shotPanel = await d.screenshot('clock-panel');
    t.expect(
      panelShown,
      'Contributed panel renders in the right sidebar',
      'The Clock panel (pluginId "live-clock") is visible',
      `Panel visible: ${panelShown}`,
      shotPanel
    );

    // ---- 6. The plugin ran without console errors ----
    const pluginErrors = d.consoleErrors().filter((e) => e.text.includes('live-clock'));
    t.expect(
      pluginErrors.length === 0,
      'Plugin produces no console errors',
      'No console errors mentioning live-clock',
      pluginErrors.length ? pluginErrors.map((e) => e.text).join(' | ') : 'clean'
    );
  },
};
