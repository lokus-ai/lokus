import { describe, it, expect } from 'vitest';
import { lokusSchema } from '../editor/schema/lokus-schema.js';
import {
  isPlainTextNotePath,
  noteBasenameForTitle,
  plainTextStringToDoc,
  docToPlainTextString,
  plainTextDocToReadingHtml,
} from './plainTextNote.js';

describe('plainTextNote', () => {
  it('isPlainTextNotePath', () => {
    expect(isPlainTextNotePath('/x/note.txt')).toBe(true);
    expect(isPlainTextNotePath('C:\\a\\NOTE.TXT')).toBe(true);
    expect(isPlainTextNotePath('/x/note.md')).toBe(false);
    expect(isPlainTextNotePath(null)).toBe(false);
  });

  it('noteBasenameForTitle', () => {
    expect(noteBasenameForTitle('/vault/Readme.md')).toBe('Readme');
    expect(noteBasenameForTitle('C:\\d\\log.txt')).toBe('log');
  });

  it('round-trips multiline plain text through ProseMirror', () => {
    const raw = 'line one\n\nline three';
    const doc = plainTextStringToDoc(lokusSchema, raw);
    expect(docToPlainTextString(doc)).toBe(raw);
  });

  it('plainTextDocToReadingHtml escapes markup', () => {
    const doc = plainTextStringToDoc(lokusSchema, '<script>x</script>');
    const html = plainTextDocToReadingHtml(doc);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
