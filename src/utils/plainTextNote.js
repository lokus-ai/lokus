/**
 * Plain-text note helpers (.txt): load/save and compare without markdown parsing.
 */

/**
 * @param {string | null | undefined} path
 * @returns {boolean}
 */
export function isPlainTextNotePath(path) {
  if (!path || typeof path !== 'string') return false;
  return path.toLowerCase().endsWith('.txt');
}

/**
 * Filename for the title field (strip .md / .markdown / .txt).
 * @param {string} path
 * @returns {string}
 */
export function noteBasenameForTitle(path) {
  const name = path.split(/[/\\]/).pop() || '';
  return name.replace(/\.(md|markdown|txt)$/i, '') || name;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build a ProseMirror doc from raw file bytes as plain lines (no markdown).
 * @param {import('prosemirror-model').Schema} schema
 * @param {string} raw
 */
export function plainTextStringToDoc(schema, raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  const paragraphs = lines.map((line) =>
    schema.nodes.paragraph.create(null, line ? schema.text(line) : undefined),
  );
  if (paragraphs.length === 0) {
    return schema.nodes.doc.create(null, schema.nodes.paragraph.create());
  }
  return schema.nodes.doc.create(null, paragraphs);
}

/**
 * Serialize document to plain text (one line per textblock, pre-order).
 * @param {import('prosemirror-model').Node} doc
 * @returns {string}
 */
export function docToPlainTextString(doc) {
  const lines = [];
  doc.descendants((node) => {
    if (node.isTextblock) {
      lines.push(node.textContent);
    }
  });
  return lines.join('\n');
}

/**
 * HTML fragment for reading mode (sanitized container expects HTML string).
 * @param {import('prosemirror-model').Node} doc
 * @returns {string}
 */
export function plainTextDocToReadingHtml(doc) {
  const text = docToPlainTextString(doc);
  return `<pre class="lokus-plain-text-reading" style="white-space:pre-wrap;word-break:break-word;tab-size:4;-moz-tab-size:4">${escapeHtml(text)}</pre>`;
}
