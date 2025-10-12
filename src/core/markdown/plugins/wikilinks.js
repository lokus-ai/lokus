/**
 * Markdown-it plugin for WikiLinks
 * Converts [[Page Name]] to proper HTML for TipTap
 */

export default function markdownItWikiLinks(md) {
  // Inline rule for [[...]]
  md.inline.ruler.before('link', 'wikilink', (state, silent) => {
    const start = state.pos;
    const max = state.posMax;

    // Check if we're at [[
    if (state.src.charCodeAt(start) !== 0x5B /* [ */ ||
        state.src.charCodeAt(start + 1) !== 0x5B /* [ */) {
      return false;
    }

    // Find the closing ]]
    let pos = start + 2;
    let found = false;

    while (pos < max - 1) {
      if (state.src.charCodeAt(pos) === 0x5D /* ] */ &&
          state.src.charCodeAt(pos + 1) === 0x5D /* ] */) {
        found = true;
        break;
      }
      pos++;
    }

    if (!found) {
      return false;
    }

    // Extract the link text
    const content = state.src.slice(start + 2, pos);

    if (!silent) {
      const token = state.push('wikilink_open', 'span', 1);
      token.attrs = [
        ['data-type', 'wiki-link'],
        ['class', 'wiki-link'],
        ['href', content],
        ['target', content]
      ];

      const textToken = state.push('text', '', 0);
      textToken.content = content;

      state.push('wikilink_close', 'span', -1);
    }

    state.pos = pos + 2;
    return true;
  });

  // Renderer for wiki links
  md.renderer.rules.wikilink_open = (tokens, idx) => {
    const token = tokens[idx];
    const href = token.attrGet('href');
    const target = token.attrGet('target');

    return `<span data-type="wiki-link" class="wiki-link" href="${md.utils.escapeHtml(href)}" target="${md.utils.escapeHtml(target)}">`;
  };

  md.renderer.rules.wikilink_close = () => {
    return '</span>';
  };
}
