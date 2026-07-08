/**
 * Split pane must not destroy the editing session.
 *
 * Render audit R2: splitting remounts the editor, recreating the ProseMirror
 * view with a fresh history plugin — content is re-set from cache but the
 * undo stack is wiped. Expected behavior: content AND undo history survive.
 */

export default {
  id: '06-split-pane-undo',
  title: 'Content and undo history survive a pane split',
  expected: 'After Cmd+\\ split, the note text is intact and Cmd+Z still undoes the last edit.',

  async run(d, t) {
    await d.createVault('split');
    await d.newNote('split-undo');
    await d.type('First sentence stays.');
    await d.press('Enter');
    await d.type('UNDOME second sentence.');
    const before = await d.readEditor();
    await d.screenshot('before-split');

    const handled = await d.splitPane();
    const afterSplit = await d.readEditor();
    const shotSplit = await d.screenshot('after-split');

    t.expect(
      handled > 0,
      'Split shortcut is wired',
      'lokus:toggle-split-view (Cmd+\\) has a listener and splits the pane',
      `Listeners that handled the event: ${handled}`,
      shotSplit
    );
    t.expect(
      !!afterSplit?.text?.includes('First sentence stays'),
      'Content survives the split',
      'The note text is still shown after splitting',
      `Editor text after split: "${(afterSplit?.text || '<empty>').slice(0, 120)}"`,
      shotSplit
    );

    // Undo should remove the last typed sentence.
    await d.page.locator('.ProseMirror').first().click();
    await d.press('ControlOrMeta+z');
    await d.press('ControlOrMeta+z');
    await d.press('ControlOrMeta+z');
    const afterUndo = await d.readEditor();
    const shotUndo = await d.screenshot('after-undo');
    const undoWorked = afterUndo && afterUndo.text !== before.text;
    t.expect(
      undoWorked,
      'Undo history survives the split',
      'Cmd+Z after splitting undoes the typing done before the split',
      `Text before split: "${before?.text?.slice(0, 100)}" — after 3× Cmd+Z: "${afterUndo?.text?.slice(0, 100)}" (unchanged ⇒ the split remounted the editor and wiped the undo stack)`,
      shotUndo
    );
  },
};
