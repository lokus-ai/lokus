import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

function parseMarkdownTable(text) {
  if (!text || typeof text !== 'string') return null;
  const raw = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (raw.length < 2) return null;

  // Find the header and separator lines
  const header = raw[0];
  const sep = raw[1];
  if (!/^\|?.*\|/.test(header)) return null;
  if (!/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(sep)) return null;

  const split = (line) => line
    .replace(/^\|\s*/, '')
    .replace(/\s*\|$/, '')
    .split('|')
    .map(s => s.trim());

  const headers = split(header);
  const rows = [];
  for (let i = 2; i < raw.length; i++) {
    const line = raw[i];
    if (!/^\|?.*\|.*$/.test(line)) break;
    const cells = split(line);
    if (cells.length) rows.push(cells);
  }
  if (!headers.length || !rows.length) return null;

  // Normalize rows: pad or trim to headers length
  const cols = headers.length;
  const normRows = rows.map(r => {
    if (r.length < cols) return r.concat(Array(cols - r.length).fill(''));
    if (r.length > cols) return r.slice(0, cols);
    return r;
  });

  return { headers, rows: normRows };
}

function tableToHTML({ headers, rows }) {
  const esc = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const thead = `<thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

const MarkdownTablePaste = Extension.create({
  name: 'markdownTablePaste',
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        props: {
          handlePaste(view, event) {
            try {
              const text = event.clipboardData?.getData('text/plain');
              const parsed = parseMarkdownTable(text);
              if (!parsed) return false;
              const html = tableToHTML(parsed);
              event.preventDefault();
              editor.chain().focus().insertContent(html).run();
              return true;
            } catch (e) {
              console.warn('[md-table] paste failed:', e);
              return false;
            }
          },
        },
      }),
    ];
  },
});

export default MarkdownTablePaste

