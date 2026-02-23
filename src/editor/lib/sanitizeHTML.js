/**
 * Per-block content recovery for ProseMirror setContent failures.
 *
 * Instead of dumping the whole file to source mode, this splits the HTML into
 * top-level blocks, tests each one, and converts only the failing blocks into
 * <pre><code> so they render as code in the rich editor. Everything else
 * renders normally.
 */

import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';

/**
 * Escape HTML entities for safe display inside <code>.
 */
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Split an HTML string into top-level block elements.
 * Uses the browser's DOMParser (very forgiving with malformed HTML).
 */
function splitIntoBlocks(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const body = doc.body;
  const blocks = [];

  for (const child of Array.from(body.childNodes)) {
    if (child.nodeType === 1) {
      blocks.push(child.outerHTML);
    } else if (child.nodeType === 3 && child.textContent.trim()) {
      blocks.push(`<p>${child.textContent}</p>`);
    }
  }

  return blocks;
}

/**
 * Test whether a single HTML block can be parsed by the editor's schema
 * without throwing.
 */
function canParse(blockHTML, schema) {
  try {
    const dom = new DOMParser().parseFromString(`<body>${blockHTML}</body>`, 'text/html').body;
    const parser = ProseMirrorDOMParser.fromSchema(schema);
    const node = parser.parse(dom);
    node.check();
    return true;
  } catch {
    return false;
  }
}

/**
 * Given HTML content that failed setContent(), split into blocks, test each
 * one individually against the ProseMirror schema, and convert failing blocks
 * into <pre><code> elements so they show as code in the rich editor.
 *
 * @param {string} html - The full HTML content that failed
 * @param {object} editor - The TipTap editor instance
 * @returns {string} HTML with bad blocks converted to code blocks
 */
export function recoverContent(html, editor) {
  if (!html || typeof html !== 'string') return '<p></p>';

  const blocks = splitIntoBlocks(html);
  if (blocks.length === 0) return '<p></p>';

  const schema = editor.schema;
  const recovered = [];

  for (const block of blocks) {
    if (canParse(block, schema)) {
      recovered.push(block);
    } else {
      // This block crashes the parser — show as code block so content isn't lost
      recovered.push(`<pre><code>${escapeHTML(block)}</code></pre>`);
    }
  }

  return recovered.join('');
}
