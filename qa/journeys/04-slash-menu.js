/**
 * Slash menu: typing '/' opens the command menu and picking an item
 * inserts the block.
 */

export default {
  id: '04-slash-menu',
  title: 'Slash menu opens and inserts a block',
  expected: "Typing '/' pops the command menu; choosing 'Heading 1' inserts an H1 block.",

  async run(d, t) {
    await d.createVault('slash');
    await d.newNote('slash-menu');
    const menu = await d.openSlashMenu();
    const shotMenu = await d.screenshot('slash-menu-open');
    t.expect(
      menu.open && menu.items.length > 0,
      "'/' opens the slash menu",
      'A command menu with items appears next to the cursor',
      `Menu open: ${menu.open}, items: ${JSON.stringify(menu.items.slice(0, 10))}`,
      shotMenu
    );
    if (!menu.open) return;

    await d.chooseSlashItem('head');
    await d.type('Inserted via slash');
    const state = await d.readEditor();
    const shotAfter = await d.screenshot('after-slash-insert');
    const gotHeading = state?.headings?.some((h) => h.text.includes('Inserted via slash'));
    t.expect(
      gotHeading,
      'Slash item inserts the block',
      "Choosing the heading command turns the current block into a heading",
      `Headings: ${JSON.stringify(state?.headings)}. Text: "${state?.text?.slice(0, 120)}"`,
      shotAfter
    );
  },
};
