/**
 * Monkey / explorer pass — deterministic chaos (seeded PRNG) to surface
 * crashes: huge paste, rapid-fire keys, weird unicode, empty states,
 * hammering shortcuts, reload mid-edit. After every burst it checks
 * invariants: page alive, editor/body rendered, no unhandled page errors.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEIRD_TEXT = [
  '𝔘𝔫𝔦𝔠𝔬𝔡𝔢 🧨🔥💥 ',
  'مرحبا بالعالم שלום עולם ',
  '<script>alert(1)</script> ',
  '][[[]]][[[[ ',
  '#'.repeat(50) + ' not a heading ',
  '\\$\\$\\int broken math $$x^2$$ ',
];

export async function runMonkey(driver, rec, { seed = 42, bursts = 10 } = {}) {
  const rnd = mulberry32(seed);
  await rec.step('monkey:start', `seed=${seed}, ${bursts} chaos bursts`);
  await driver.createVault('monkey');
  await driver.newNote('chaos');

  let errCountBefore = rec.consoleErrors.filter((e) => e.type === 'pageerror').length;

  const actions = [
    async () => {
      // huge paste (~40k chars) via insertText — a real clipboard-size paste
      await rec.step('monkey:huge-paste', '~40k chars in one insert');
      await driver.page.locator('.ProseMirror:visible').first().click({ timeout: 5000 });
      const blob = ('Lorem ipsum dolor sit amet '.repeat(50) + '\n').repeat(28);
      await driver.page.keyboard.insertText(blob);
    },
    async () => {
      await rec.step('monkey:rapid-enter-undo', '30x Enter + 30x undo, no delays');
      const ed = driver.page.locator('.ProseMirror:visible').first();
      await ed.click({ timeout: 5000 });
      for (let i = 0; i < 30; i++) await driver.page.keyboard.press('Enter', { delay: 0 });
      for (let i = 0; i < 30; i++) await driver.page.keyboard.press('ControlOrMeta+z', { delay: 0 });
    },
    async () => {
      const txt = WEIRD_TEXT[Math.floor(rnd() * WEIRD_TEXT.length)];
      await rec.step('monkey:weird-text', JSON.stringify(txt));
      await driver.page.locator('.ProseMirror:visible').first().click({ timeout: 5000 });
      await driver.page.keyboard.type(txt, { delay: 1 });
    },
    async () => {
      await rec.step('monkey:slash-escape-spam', 'open slash menu, Escape spam, repeat 5x');
      const ed = driver.page.locator('.ProseMirror:visible').first();
      await ed.click({ timeout: 5000 });
      for (let i = 0; i < 5; i++) {
        await driver.page.keyboard.type('/', { delay: 5 });
        await driver.page.keyboard.press('Escape', { delay: 0 });
        await driver.page.keyboard.press('Escape', { delay: 0 });
      }
    },
    async () => {
      await rec.step('monkey:hotkey-hammer', 'split/graph/save/sidebar shortcuts back to back');
      await driver.emitTauriEvent('lokus:toggle-split-view');
      await driver.emitTauriEvent('lokus:graph-view');
      await driver.emitTauriEvent('lokus:toggle-sidebar');
      await driver.emitTauriEvent('lokus:toggle-split-view');
      await driver.page.keyboard.press('ControlOrMeta+s');
      await driver.page.waitForTimeout(500);
    },
    async () => {
      await rec.step('monkey:rapid-clicks', '15 rapid clicks on random visible buttons');
      const count = await driver.page.locator('button:visible').count();
      for (let i = 0; i < 15 && count > 0; i++) {
        const idx = Math.floor(rnd() * count);
        await driver.page
          .locator('button:visible')
          .nth(idx)
          .click({ timeout: 1000, force: true })
          .catch(() => {});
        // close anything modal it may have opened
        await driver.page.keyboard.press('Escape').catch(() => {});
      }
    },
    async () => {
      await rec.step('monkey:reload-mid-edit', 'reload while typing (no save)');
      await driver.page.locator('.ProseMirror:visible').first().click().catch(() => {});
      await driver.page.keyboard.type('typing right up to the crash', { delay: 2 }).catch(() => {});
      await driver.forceReload();
      await driver.page.locator('.ProseMirror:visible').first().click().catch(() => {});
    },
  ];

  let editorGoneReported = false;
  for (let b = 1; b <= bursts; b++) {
    // If earlier chaos removed the editor entirely, that's a finding — then recover.
    const visibleEditor = () => driver.page.locator('.ProseMirror:visible').count();
    const editorAlive = (await visibleEditor()) > 0;
    if (!editorAlive) {
      const shot = await driver.screenshot(`monkey-burst-${b}-editor-gone`);
      if (!editorGoneReported) {
        editorGoneReported = true;
        rec.aiIssue({
          title: 'Editor disappeared during chaotic-but-legal input',
          expected: 'The editing surface survives rapid hotkeys/clicks (or comes back on its own)',
          actual: 'No .ProseMirror on screen after a chaos burst — the user has no way to keep typing',
          screenshot: shot,
          severity: 'major',
        });
      }
      await rec.step('monkey:recover', 'reload + reopen note to continue the chaos run');
      await driver.forceReload().catch(() => {});
      if ((await visibleEditor()) === 0) {
        await driver.newNote(`chaos-recover-${b}`).catch(() => {});
      }
    }
    const act = actions[Math.floor(rnd() * actions.length)];
    try {
      await act();
    } catch (err) {
      const shot = await driver.screenshot(`monkey-burst-${b}-failed`);
      rec.aiIssue({
        title: `Monkey burst ${b} — action itself failed`,
        expected: 'Chaotic-but-legal input never makes basic interaction impossible',
        actual: String(err).slice(0, 300),
        screenshot: shot,
        severity: 'major',
      });
    }
    await driver.page.waitForTimeout(300);

    // ---- invariants ----
    const pageErrs = rec.consoleErrors.filter((e) => e.type === 'pageerror');
    if (pageErrs.length > errCountBefore) {
      const fresh = pageErrs.slice(errCountBefore);
      const shot = await driver.screenshot(`monkey-burst-${b}-pageerror`);
      rec.crash({
        title: `Unhandled page error during monkey burst ${b}`,
        actual: fresh.map((e) => e.text).join(' | ').slice(0, 500),
        screenshot: shot,
      });
      errCountBefore = pageErrs.length;
    }
    const alive = await driver.page
      .evaluate(() => ({
        bodyLen: (document.body.innerText || '').trim().length,
        hasRoot: !!document.querySelector('#root, .app-root, [data-tauri-drag-region]'),
      }))
      .catch(() => null);
    if (!alive || (!alive.hasRoot && alive.bodyLen === 0)) {
      const shot = await driver.screenshot(`monkey-burst-${b}-blank`);
      rec.crash({
        title: `App went blank during monkey burst ${b}`,
        actual: `Page state: ${JSON.stringify(alive)}`,
        screenshot: shot,
      });
    }
  }
  await driver.screenshot('monkey-final-state');
  rec.pass('Monkey pass finished', `${bursts} chaos bursts executed`);
}
