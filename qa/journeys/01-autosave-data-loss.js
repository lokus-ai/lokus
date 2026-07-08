/**
 * Data-loss / autosave journey.
 *
 * A user writes a note and the app crashes (or they quit) before hitting
 * Cmd+S. A note-taking app must not lose that text: it should autosave (or at
 * minimum flush on close). The backbone audit says Lokus has NO autosave —
 * so this journey is EXPECTED TO FAIL today; catching it proves the harness.
 */

const DRAFT = 'Meeting notes: shipped the Q3 roadmap, follow up with Dana about pricing.';

export default {
  id: '01-autosave-data-loss',
  title: 'Typed text must survive a crash/quit without manual save (autosave)',
  expected: 'After typing and a forced reload (simulated crash), the text is still there — in the editor or at least on disk.',

  async run(d, t) {
    await d.createVault('autosave');
    await d.newNote('crash-draft');
    await d.type(DRAFT);
    await d.page.waitForTimeout(4000); // generous window for any debounced autosave to fire
    const before = await d.readEditor();
    const shotBefore = await d.screenshot('typed-before-crash');
    t.expect(
      before?.text.includes('Meeting notes'),
      'Typing works',
      'Typed text appears in the editor',
      `Editor text: "${before?.text?.slice(0, 80)}"`,
      shotBefore
    );

    const diskBefore = await d.diskState();
    await d.forceReload();

    const after = await d.readEditor();
    const diskAfter = await d.diskState();
    const shotAfter = await d.screenshot('after-crash-reload');

    const onDisk = Object.values(diskAfter).some((c) => c.includes('Meeting notes'));
    const inEditor = !!after?.text?.includes('Meeting notes');

    t.expect(
      inEditor || onDisk,
      'No data loss on crash/quit (autosave)',
      `The draft text is preserved across a reload without manual Cmd+S (autosave or flush-on-close).`,
      `DATA LOST. Editor after reload: "${(after?.text || '<empty>').slice(0, 80)}". ` +
        `Disk before crash: ${JSON.stringify(diskBefore)}. Disk after: ${JSON.stringify(diskAfter)}. ` +
        `The note file exists but the typed content was never written — there is no autosave and no flush on unload.`,
      shotAfter
    );
  },
};
