/**
 * Happy path: Cmd+S writes the note to the real vault folder on disk,
 * and the content comes back after a reload.
 */

const TEXT = 'This note was saved with Cmd+S and must exist on disk.';

export default {
  id: '03-save-persists-to-disk',
  title: 'Cmd+S persists the note to the vault folder and it survives reload',
  expected: 'After Cmd+S the .md file in the vault contains the text; after reload the note reopens with it.',

  async run(d, t) {
    await d.createVault('save-path');
    await d.newNote('saved-note');
    await d.type(TEXT);
    await d.save();
    const disk = await d.diskState();
    const shotSaved = await d.screenshot('after-save');

    const fileWithText = Object.entries(disk).find(([, c]) => c.includes('saved with Cmd+S'));
    t.expect(
      !!fileWithText,
      'Cmd+S writes to disk',
      'A markdown file in the real vault folder contains the typed text after Cmd+S',
      `Vault disk state: ${JSON.stringify(disk)}`,
      shotSaved
    );

    // Give the (supposed) session persistence time to record the open tab.
    await d.page.waitForTimeout(2500);
    await d.forceReload();
    await d.page.waitForTimeout(1500);
    const after = await d.readEditor();
    const dom = await d.domSummary();
    const session = (await d.diskState(d.vaultDir, { includeHidden: true }))['.lokus/session.json'];
    const shotAfter = await d.screenshot('after-reload');
    t.expect(
      !!after?.text?.includes('saved with Cmd+S'),
      'Last open note restored after reload',
      'Reopening the workspace shows the note you were working on',
      `SESSION NOT RESTORED: after reload the app shows "${dom.bodyTextSample.slice(0, 60)}…" (Welcome screen) instead of the note. ` +
        `The note file IS on disk, but the persisted session is ${session ? `"${String(session).slice(0, 160)}"` : 'missing'} — ` +
        `the session save effect runs only once, 500ms after workspace mount (before any tab is open), so open tabs are never persisted.`,
      shotAfter
    );
  },
};
