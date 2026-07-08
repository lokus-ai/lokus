/**
 * Wiki links: '[[' should suggest existing notes and produce a real
 * wiki-link node that links the notes together.
 */

export default {
  id: '05-wikilink',
  title: "'[[' links to another note",
  expected: "Typing '[[Target' suggests the existing note and Enter inserts a wiki-link node.",

  async run(d, t) {
    await d.createVault('links');
    await d.newNote('Target Note');
    await d.type('I am the target.');
    await d.save();

    await d.newNote('Source Note');
    await d.type('Linking to ');
    const { popupOpen } = await d.link('Target');
    const state = await d.readEditor();
    const shot = await d.screenshot('after-wikilink');

    t.expect(
      popupOpen,
      "'[[' opens the link suggestion popup",
      'A suggestion popup listing existing notes appears after typing [[',
      `Popup detected: ${popupOpen}`,
      shot
    );
    const linked = (state?.wikiLinks || []).some((l) => l.toLowerCase().includes('target'));
    const rawFallback = state?.text?.includes('[[');
    t.expect(
      linked,
      'Wiki-link node is created',
      'The editor contains a [data-type="wiki-link"] node pointing at Target Note',
      `wikiLinks: ${JSON.stringify(state?.wikiLinks)}; raw text still contains "[[": ${rawFallback}; text: "${state?.text?.slice(0, 120)}"`,
      shot
    );
  },
};
