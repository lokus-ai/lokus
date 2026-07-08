/**
 * Graph hotkey must not blank the workspace.
 *
 * Render audit R3: Cmd+Shift+G fires lokus:graph-view -> switchView('graph'),
 * but MainContent has no 'graph' branch, so the center renders NOTHING.
 * Expected behavior: the hotkey shows the graph (like the sidebar button's
 * __graph__ tab does) — or at minimum never leaves the user staring at a
 * blank pane.
 */

export default {
  id: '07-graph-hotkey',
  title: 'Graph hotkey (Cmd+Shift+G) shows the graph — never a blank center',
  expected: 'After the graph shortcut, the center pane renders a graph canvas (or stays on the editor); it must not go blank.',

  async run(d, t) {
    await d.createVault('graph');
    await d.newNote('note-a');
    await d.type('# Node A\nlinks make graphs');
    await d.save();
    await d.screenshot('editor-before-hotkey');

    const handled = await d.graphHotkey();
    const dom = await d.domSummary();
    const centerState = await d.page.evaluate(() => {
      const graph = document.querySelector('.graph-view, .graph-container canvas');
      const editor = document.querySelector('.ProseMirror');
      // main content region = everything that's not sidebars/titlebar
      const main = document.querySelector('main') || document.body;
      return {
        hasGraph: !!graph,
        hasEditor: !!editor,
        mainTextLength: (main.innerText || '').trim().length,
      };
    });
    const shot = await d.screenshot('after-graph-hotkey');

    t.expect(
      handled > 0,
      'Graph shortcut is wired',
      'lokus:graph-view (Cmd+Shift+G) has a listener',
      `Listeners that handled the event: ${handled}`,
      shot
    );
    t.expect(
      centerState.hasGraph || centerState.hasEditor,
      'Center still renders after graph hotkey',
      'The center pane shows the graph view (canvas) or keeps the editor visible',
      `BLANK CENTER: graph rendered: ${centerState.hasGraph}, editor rendered: ${centerState.hasEditor}. ` +
        `The shortcut switches currentView to 'graph' but MainContent has no branch for 'graph', so nothing is rendered. ` +
        `DOM summary: editorPresent=${dom.editorPresent}, bodyText="${dom.bodyTextSample.slice(0, 100)}"`,
      shot
    );
  },
};
