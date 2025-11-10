/**
 * Markdown-it plugin for Mermaid Diagrams
 * Preserves <mermaid-block> custom HTML tags during markdown compilation
 */

export default function markdownItMermaid(md) {
  // Block-level rule to recognize and preserve <mermaid-block> tags
  md.block.ruler.before('html_block', 'mermaid_block', (state, startLine, endLine, silent) => {
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];

    // Check if line starts with <mermaid-block
    const lineText = state.src.slice(pos, max);
    if (!lineText.trim().startsWith('<mermaid-block')) {
      return false;
    }

    // Collect the full mermaid-block content (may be multi-line for old format)
    let content = lineText;
    let currentLine = startLine;

    // Check if it's a self-closing tag (new format with data-code)
    // or multi-line with nested elements (old format)
    if (!content.includes('/>') && !content.includes('</mermaid-block>')) {
      // Multi-line block - scan until we find the closing tag
      currentLine++;
      while (currentLine < endLine) {
        const nextPos = state.bMarks[currentLine] + state.tShift[currentLine];
        const nextMax = state.eMarks[currentLine];
        const nextLine = state.src.slice(nextPos, nextMax);
        content += '\n' + nextLine;

        if (nextLine.includes('</mermaid-block>')) {
          break;
        }
        currentLine++;
      }
    }

    if (!silent) {
      const token = state.push('mermaid_block', 'mermaid-block', 0);
      token.content = content;
      token.map = [startLine, currentLine + 1];
      token.markup = 'mermaid-block';
    }

    state.line = currentLine + 1;
    return true;
  });

  // Renderer for mermaid blocks - pass through as-is
  md.renderer.rules.mermaid_block = (tokens, idx) => {
    const token = tokens[idx];
    return token.content + '\n';
  };

  // Also preserve mermaid-block in HTML blocks
  const defaultHtmlBlockRule = md.renderer.rules.html_block;
  md.renderer.rules.html_block = (tokens, idx, options, env, self) => {
    const token = tokens[idx];

    // If this is a mermaid-block, pass it through unchanged
    if (token.content && token.content.trim().startsWith('<mermaid-block')) {
      return token.content;
    }

    // Otherwise use default HTML block rendering
    return defaultHtmlBlockRule ? defaultHtmlBlockRule(tokens, idx, options, env, self) : token.content;
  };
}
