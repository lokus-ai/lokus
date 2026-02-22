/**
 * Callout/Admonition converter for markdown compilation
 *
 * Post-processes rendered HTML to convert blockquotes starting with [!type]
 * into <div data-callout-type="type"> for TipTap's Callout extension.
 *
 * markdown-it renders > [!info] as a blockquote with [!info] as text.
 * This function detects that pattern and converts to proper callout HTML.
 */

/**
 * Convert callout blockquotes in rendered HTML to callout divs.
 *
 * @param {string} html - Rendered HTML from markdown-it
 * @returns {string} HTML with callout blockquotes converted to divs
 */
export function convertCalloutBlockquotes(html) {
  if (!html.includes('[!')) return html;

  // Match blockquotes whose first <p> starts with [!type]
  // The regex captures everything between <blockquote> and </blockquote>
  return html.replace(
    /<blockquote>\s*<p>\[!(\w+)\](-?)([\s\S]*?)<\/blockquote>/g,
    (match, type, collapsedFlag, rest) => {
      const calloutType = type.toLowerCase();
      const collapsed = collapsedFlag === '-';

      // rest contains everything after [!type]- up to (but not including) </blockquote>
      // Possible patterns from markdown-it:
      //   "</p>\n"                              → header only, no content
      //   "<br>\nLine 1<br>\nLine 2</p>\n"     → content in same paragraph (breaks: true)
      //   " Title</p>\n"                        → title only, no content
      //   " Title<br>\nContent</p>\n"           → title + content in same paragraph
      //   "</p>\n<p>Line 1</p>\n<p>Line 2</p>\n" → content in separate paragraphs

      let title = '';
      let contentHtml = '';

      // Check if there's a title (space followed by non-HTML text before <br> or </p>)
      const titleMatch = rest.match(/^ ([^<]+?)(?:<br\s*\/?>|<\/p>)/);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }

      // Now extract the actual content (everything after the [!type] line)
      if (rest.startsWith('</p>')) {
        // Case: [!info]</p> — header only, or content in later <p> tags
        // rest = "</p>\n" or "</p>\n<p>content</p>\n"
        contentHtml = rest.substring(4).trim(); // skip </p>
      } else if (rest.match(/^<br\s*\/?>/)) {
        // Case: [!info]<br>\nContent... — no title, content follows in same <p>
        // rest = "<br>\nLine 1<br>\nLine 2</p>\n"
        contentHtml = rest.replace(/^<br\s*\/?>[\s\n]*/, '');
        // contentHtml is now "Line 1<br>\nLine 2</p>\n" or similar
        // Wrap in <p> tag
        if (!contentHtml.startsWith('<p>')) {
          contentHtml = '<p>' + contentHtml;
        }
        // Remove trailing whitespace
        contentHtml = contentHtml.trim();
      } else if (titleMatch) {
        // Case: [!info] Title<br>\nContent or [!info] Title</p>
        const afterTitle = rest.substring(titleMatch[0].length - (titleMatch[0].endsWith('</p>') ? 4 : 0));

        if (titleMatch[0].endsWith('</p>')) {
          // Title was the only thing in first <p>
          // afterTitle might have more <p> tags
          contentHtml = afterTitle.trim();
        } else {
          // Title followed by <br>, content continues
          let remaining = afterTitle.replace(/^[\s\n]*/, '');
          if (remaining && !remaining.startsWith('<p>')) {
            remaining = '<p>' + remaining;
          }
          contentHtml = remaining.trim();
        }
      }

      // Ensure there's at least one <p> for TipTap's block+ content requirement
      if (!contentHtml || !contentHtml.includes('<p>')) {
        contentHtml = '<p></p>';
      }

      // Build the callout div
      const titleAttr = title ? ` data-callout-title="${escapeAttr(title)}"` : '';
      return `<div data-callout-type="${calloutType}" data-collapsed="${collapsed}"${titleAttr} class="callout callout-${calloutType}">${contentHtml}</div>`;
    }
  );
}

function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
