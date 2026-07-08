/**
 * Markdown heading input rule: typing `# Hello` must become an H1
 * (and `## Sub` an H2) — the core markdown-editor affordance.
 */

export default {
  id: '02-heading-input-rule',
  title: 'Typing "# Hello" turns into an H1 heading',
  expected: '`# ` at line start converts to a heading node as you type (markdown input rule).',

  async run(d, t) {
    await d.createVault('headings');
    await d.newNote('headings');
    await d.type('# Hello World');
    await d.press('Enter');
    await d.type('## Section Two');
    await d.press('Enter');
    await d.type('Plain paragraph text.');
    const state = await d.readEditor();
    const shot = await d.screenshot('after-typing-headings');

    const h1 = state?.headings?.find((h) => h.tag === 'h1' && h.text.includes('Hello World'));
    const h2 = state?.headings?.find((h) => h.tag === 'h2' && h.text.includes('Section Two'));

    t.expect(
      !!h1,
      '"# " creates an H1',
      'Typing "# Hello World" renders an <h1>Hello World</h1>',
      `Headings found: ${JSON.stringify(state?.headings)}. Editor text: "${state?.text?.slice(0, 120)}"`,
      shot
    );
    t.expect(
      !!h2,
      '"## " creates an H2',
      'Typing "## Section Two" renders an <h2>',
      `Headings found: ${JSON.stringify(state?.headings)}`,
      shot
    );
  },
};
