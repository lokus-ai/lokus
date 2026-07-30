/**
 * VS-Code-grade tab isolation.
 *
 * Each tab must be a sealed, independent world (VS Code model–view principle:
 * each file owns its model/EditorState; the persistent editor view just
 * re-points at the active tab's model):
 *   (a) a tab always shows ITS OWN content — never another tab's (no bleed),
 *       even when sampled immediately after the switch (the swap must be
 *       synchronous, not "eventually right"),
 *   (b) ⌘S writes the ACTIVE tab's content to the ACTIVE tab's file — and a
 *       save fired while the new tab is still loading from disk must never
 *       write the PREVIOUS tab's document into the new tab's file (this was
 *       the silent-corruption window),
 *   (c) undo history is per-tab,
 *   (d) switching tabs never remounts the editor/pane (no flicker, instant).
 *
 * The disk-latency knob (backend.setLatency) makes the async-load race window
 * deterministic instead of relying on lucky timing.
 */

export default {
  id: '09-tab-isolation',
  title: 'Tab isolation: no content bleed, save hits the right file, per-tab undo, no remount',
  expected:
    'Switching tabs N times always shows each tab’s own content (instantly); ' +
    '⌘S during a switch never writes tab A’s text into tab B’s file; undo is ' +
    'per-tab; the ProseMirror pane is not remounted by switches.',

  async run(d, t) {
    const vault = await d.createVault('tab-isolation');

    // ---- setup: two notes with unmistakable content ----
    await d.newNote('alpha');
    await d.type('ALPHA-ONLY-CONTENT');
    await d.save();
    await d.newNote('beta');
    await d.type('BETA-ONLY-CONTENT');
    await d.save();

    const clickTab = async (name) => {
      await d.rec.step('clickTab', name);
      await d.page.locator('.responsive-tab', { hasText: name }).first().click();
    };
    const editorText = async () => (await d.readEditor())?.text ?? '';

    // Editor DOM element identity — remount detector. A stable pane keeps the
    // exact same .ProseMirror element across every switch.
    await d.page.evaluate(() => {
      window.__qaEditorEl = document.querySelector('.ProseMirror');
    });

    // ---- (a) + (d): switch back and forth; sample content IMMEDIATELY ----
    let bleed = null;
    const SWITCHES = 10;
    for (let i = 0; i < SWITCHES; i++) {
      const name = i % 2 === 0 ? 'alpha' : 'beta';
      const want = name === 'alpha' ? 'ALPHA-ONLY-CONTENT' : 'BETA-ONLY-CONTENT';
      const other = name === 'alpha' ? 'BETA-ONLY-CONTENT' : 'ALPHA-ONLY-CONTENT';
      await clickTab(name);
      // No settle wait: the swap must be synchronous with the tab becoming
      // active — a stale frame here is exactly the "bleed" users see.
      const txt = await editorText();
      if (!txt.includes(want) || txt.includes(other)) {
        bleed = { switchNo: i + 1, tab: name, sawText: txt.slice(0, 160) };
        break;
      }
    }
    const shotSwitches = await d.screenshot('after-switch-loop');
    t.expect(
      !bleed,
      'Each tab always shows its own content across switches (sampled immediately)',
      `${SWITCHES} alternating switches all show the active tab's own text with no settle delay`,
      bleed
        ? `Bleed on switch #${bleed.switchNo} to "${bleed.tab}": editor showed ${JSON.stringify(bleed.sawText)}`
        : 'No bleed in any switch',
      shotSwitches
    );

    const sameEl = await d.page.evaluate(
      () => window.__qaEditorEl === document.querySelector('.ProseMirror')
    );
    t.expect(
      sameEl,
      'No pane remount during tab switches',
      'The .ProseMirror element is the SAME DOM node after all switches (view persists, state swaps)',
      sameEl ? 'Same element — view persisted' : 'Different element — the pane was rebuilt on switch',
      shotSwitches
    );

    // ---- (c): undo is per-tab ----
    await clickTab('alpha');
    await d.page.waitForTimeout(250);
    await d.type(' ALPHA-EDIT');
    await clickTab('beta');
    await d.page.waitForTimeout(250);
    await d.press('ControlOrMeta+z'); // undo in beta must NOT undo alpha's edit
    const betaAfterUndo = await editorText();
    await clickTab('alpha');
    await d.page.waitForTimeout(250);
    const alphaAfterBetaUndo = await editorText();
    const shotUndo = await d.screenshot('per-tab-undo');
    t.expect(
      alphaAfterBetaUndo.includes('ALPHA-EDIT') && !betaAfterUndo.includes('ALPHA'),
      'Undo history is per-tab',
      "Cmd+Z pressed in beta never undoes alpha's edit",
      `alpha after undo-in-beta: ${JSON.stringify(alphaAfterBetaUndo.slice(0, 80))}; beta after undo: ${JSON.stringify(betaAfterUndo.slice(0, 80))}`,
      shotUndo
    );
    await d.save(); // persist alpha's edit so later disk checks are stable

    // ---- (b): the silent-corruption window ----
    // gamma.md exists on disk but is NEVER opened before this — guaranteed to
    // have no in-memory model. Slow disk reads, open alpha (settle), then open
    // gamma and IMMEDIATELY type + ⌘S while gamma's disk read is in flight.
    // Isolation means gamma.md can never receive alpha's content and the gamma
    // tab can never DISPLAY alpha's content.
    await d.backend.handle('write_file_content', {
      path: `${vault}/gamma.md`,
      content: 'GAMMA-ONLY-CONTENT',
    });
    await d.forceReload();
    await d.page.waitForTimeout(1000);

    const fileBtn = (name) =>
      d.page.locator('.file-entry-container', { hasText: name }).first().locator('button').first();

    await d.rec.step('openFromTree', 'alpha.md, settle');
    await fileBtn('alpha').click();
    await d.page.waitForTimeout(1500);
    const alphaLoaded = await editorText();

    d.backend.setLatency('read_file_content', 600);
    await d.rec.step('openFromTree', 'gamma.md then type+⌘S INSIDE the 600ms load window');
    await fileBtn('gamma').click();
    await d.page.keyboard.type('POISON', { delay: 10 });
    await d.page.keyboard.press('ControlOrMeta+s');
    await d.page.waitForTimeout(2000);
    d.backend.setLatency('read_file_content', 0);

    const disk = await d.diskState(vault);
    const gammaOnDisk = disk['gamma.md'] ?? '';
    const alphaOnDisk = disk['alpha.md'] ?? '';
    const gammaShown = await editorText();
    const shotRace = await d.screenshot('race-window-save');

    t.expect(
      !gammaOnDisk.includes('ALPHA') && !alphaOnDisk.includes('GAMMA'),
      "Saving during a tab switch never writes the OLD tab's content into the NEW tab's file",
      '⌘S pressed while gamma is still loading must not serialize alpha’s doc into gamma.md',
      `gamma.md on disk: ${JSON.stringify(gammaOnDisk.slice(0, 120))}; alpha.md: ${JSON.stringify(alphaOnDisk.slice(0, 80))}`,
      shotRace
    );
    t.expect(
      gammaShown.includes('GAMMA-ONLY-CONTENT') && !gammaShown.includes('ALPHA'),
      'Typing during a tab switch never bleeds the old tab’s content into the new tab',
      'After the dust settles, the gamma tab shows gamma’s own content — never alpha’s',
      `gamma tab shows: ${JSON.stringify(gammaShown.slice(0, 160))} (alpha had loaded as: ${JSON.stringify(alphaLoaded.slice(0, 80))})`,
      shotRace
    );
  },
};
