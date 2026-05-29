import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history } from 'prosemirror-history';
import { lokusSchema } from '../schema/lokus-schema.js';
import {
  createDiffPreviewPlugin,
  previewWriteBuffer,
  acceptPreview,
  rejectPreview,
  hasPendingPreview,
  appendAuditLine,
  diffPreviewKey,
} from './DiffPreview.js';

// ---------------------------------------------------------------------------
// Test helper: a PM EditorView with history() (required for reject/undo) and
// the diff-preview plugin. Seeds the doc with a paragraph of text.
// ---------------------------------------------------------------------------

function createTestView(text = 'Hello world') {
  const doc = lokusSchema.node('doc', null, [
    lokusSchema.node('paragraph', null, text ? [lokusSchema.text(text)] : []),
  ]);
  const state = EditorState.create({
    schema: lokusSchema,
    doc,
    plugins: [history(), createDiffPreviewPlugin()],
  });
  const view = new EditorView(document.createElement('div'), { state });
  return view;
}

function docText(view) {
  return view.state.doc.textContent;
}

function setCursor(view, pos) {
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
}

describe('DiffPreview primitive', () => {
  let view;

  beforeEach(() => {
    view = createTestView();
  });

  afterEach(() => {
    view.destroy();
  });

  it('exports the plugin factory and helpers', () => {
    expect(typeof createDiffPreviewPlugin).toBe('function');
    expect(typeof previewWriteBuffer).toBe('function');
    expect(typeof acceptPreview).toBe('function');
    expect(typeof rejectPreview).toBe('function');
    expect(typeof hasPendingPreview).toBe('function');
  });

  it('starts with no pending preview', () => {
    expect(hasPendingPreview(view)).toBe(false);
    const s = diffPreviewKey.getState(view.state);
    expect(s.steps).toBe(0);
    expect(s.ranges).toEqual([]);
  });

  it('previewWriteBuffer stages an insert and marks it pending', () => {
    setCursor(view, view.state.doc.content.size - 1); // end of "Hello world"
    const staged = previewWriteBuffer(view, [{ type: 'insert', text: ' AI' }]);
    expect(staged).toBe(true);
    expect(hasPendingPreview(view)).toBe(true);
    expect(docText(view)).toContain('AI');
    const s = diffPreviewKey.getState(view.state);
    expect(s.ranges.length).toBe(1);
    expect(s.decorations.find().length).toBe(1);
  });

  it('acceptPreview keeps the content and clears pending state', () => {
    setCursor(view, view.state.doc.content.size - 1);
    previewWriteBuffer(view, [{ type: 'insert', text: ' accepted' }]);
    expect(docText(view)).toContain('accepted');

    const ok = acceptPreview(view);
    expect(ok).toBe(true);
    expect(hasPendingPreview(view)).toBe(false);
    expect(docText(view)).toContain('accepted'); // content stays
    expect(diffPreviewKey.getState(view.state).decorations.find().length).toBe(0);
  });

  it('rejectPreview undoes the staged insert', () => {
    const before = docText(view);
    setCursor(view, view.state.doc.content.size - 1);
    previewWriteBuffer(view, [{ type: 'insert', text: ' rejected' }]);
    expect(docText(view)).toContain('rejected');

    const ok = rejectPreview(view);
    expect(ok).toBe(true);
    expect(hasPendingPreview(view)).toBe(false);
    expect(docText(view)).toBe(before); // content reverted via history undo
  });

  it('replace op replaces a range and reject restores the original', () => {
    // Replace "world" (positions: "Hello " = 1..6, "world" = 7..12 in PM coords)
    const from = view.state.doc.textContent.indexOf('world') + 1;
    const to = from + 'world'.length;
    const before = docText(view);

    const staged = previewWriteBuffer(view, [
      { type: 'replace', from, to, text: 'there' },
    ]);
    expect(staged).toBe(true);
    expect(docText(view)).toBe('Hello there');

    rejectPreview(view);
    expect(docText(view)).toBe(before);
  });

  it('replaceSelection op replaces the active selection', () => {
    const from = view.state.doc.textContent.indexOf('world') + 1;
    const to = from + 'world'.length;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));

    const staged = previewWriteBuffer(view, [
      { type: 'replaceSelection', text: 'everyone' },
    ]);
    expect(staged).toBe(true);
    expect(docText(view)).toBe('Hello everyone');
  });

  it('staging a second preview rejects the first (one preview at a time)', () => {
    const before = docText(view);
    setCursor(view, view.state.doc.content.size - 1);
    previewWriteBuffer(view, [{ type: 'insert', text: ' first' }]);
    expect(docText(view)).toContain('first');

    setCursor(view, view.state.doc.content.size - 1);
    previewWriteBuffer(view, [{ type: 'insert', text: ' second' }]);
    expect(docText(view)).not.toContain('first'); // first was undone
    expect(docText(view)).toContain('second');
    expect(before).toBe('Hello world');
  });

  it('previewWriteBuffer returns false for empty / invalid ops', () => {
    expect(previewWriteBuffer(view, [])).toBe(false);
    expect(previewWriteBuffer(view, null)).toBe(false);
    expect(previewWriteBuffer(view, [{ type: 'insert', text: '' }])).toBe(false);
  });

  it('accept / reject are no-ops when there is no pending preview', () => {
    expect(acceptPreview(view)).toBe(false);
    expect(rejectPreview(view)).toBe(false);
  });

  it('decorations stay anchored as the user types after staging', () => {
    setCursor(view, view.state.doc.content.size - 1);
    previewWriteBuffer(view, [{ type: 'insert', text: ' AI' }]);
    const decosBefore = diffPreviewKey.getState(view.state).decorations.find().length;
    expect(decosBefore).toBe(1);

    // Simulate a user keystroke at the start of the doc.
    setCursor(view, 1);
    view.dispatch(view.state.tr.insertText('X', 1, 1));
    const decosAfter = diffPreviewKey.getState(view.state).decorations.find().length;
    expect(decosAfter).toBe(1); // mapped through, still present
  });

  describe('appendAuditLine', () => {
    afterEach(() => {
      delete globalThis.__TAURI__;
    });

    it('never throws when Tauri is unavailable', async () => {
      await expect(appendAuditLine({ outcome: 'accepted' })).resolves.toBeUndefined();
    });

    it('invokes append_audit_log with an NDJSON line when Tauri is present', async () => {
      const invoke = vi.fn().mockResolvedValue(undefined);
      globalThis.__TAURI__ = { core: { invoke } };
      await appendAuditLine({ outcome: 'rejected', surface: 'cmdK' });
      expect(invoke).toHaveBeenCalledWith('append_audit_log', expect.objectContaining({
        line: expect.stringContaining('"outcome":"rejected"'),
      }));
      const arg = JSON.parse(invoke.mock.calls[0][1].line);
      expect(arg.surface).toBe('cmdK');
      expect(arg.ts).toBeTruthy();
    });

    it('swallows invoke errors (audit failure never breaks writes)', async () => {
      const invoke = vi.fn().mockRejectedValue(new Error('command not found'));
      globalThis.__TAURI__ = { core: { invoke } };
      await expect(appendAuditLine({ outcome: 'accepted' })).resolves.toBeUndefined();
    });
  });
});
