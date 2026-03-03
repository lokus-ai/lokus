import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMarkdownTablePastePlugin } from './MarkdownTablePaste.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal ProseMirror-style view mock.
 *
 * The real handlePaste does:
 *   const { state } = view
 *   state.selection.$from.parent.type.name  — to detect codeBlock context
 *   state.tr.replaceSelection(slice)        — builds the transaction
 *   view.dispatch(tr)                       — dispatches it
 *
 * It also calls:
 *   ProseMirrorDOMParser.fromSchema(state.schema).parseSlice(domNode)
 *
 * We mock the schema so fromSchema can run, and stub parseSlice to return a
 * recognisable sentinel value.
 */
function makeView({ inCodeBlock = false, dispatchSpy = vi.fn() } = {}) {
  const mockSlice = { type: 'slice', content: [] };

  // Minimal Slice-like transaction — replaceSelection returns itself (chainable)
  const mockTr = {
    replaceSelection: vi.fn().mockReturnThis(),
    _isMockTr: true,
  };

  const state = {
    selection: {
      $from: {
        parent: {
          type: { name: inCodeBlock ? 'codeBlock' : 'paragraph' },
        },
      },
    },
    tr: mockTr,
    schema: {
      // ProseMirrorDOMParser.fromSchema needs a schema object.
      // We mock the static method on the class directly in the test setup;
      // the schema value here just has to be a non-null object.
      _isMockSchema: true,
      nodes: {},
      marks: {},
    },
  };

  return { state, dispatch: dispatchSpy, _mockTr: mockTr, _mockSlice: mockSlice };
}

/**
 * Build a ClipboardEvent-like mock with the given text.
 */
function makeClipboardEvent(text) {
  return {
    clipboardData: {
      getData: vi.fn().mockReturnValue(text),
    },
    preventDefault: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Mock ProseMirrorDOMParser so we don't need jsdom to actually parse HTML
// ---------------------------------------------------------------------------
vi.mock('prosemirror-model', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    DOMParser: {
      fromSchema: vi.fn(() => ({
        parseSlice: vi.fn(() => ({ type: 'slice', content: [] })),
      })),
    },
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createMarkdownTablePastePlugin (ProseMirror plugin factory)', () => {
  let plugin;
  let handlePaste;

  beforeEach(() => {
    vi.clearAllMocks();
    plugin = createMarkdownTablePastePlugin();
    handlePaste = plugin.props.handlePaste;
  });

  // ── Plugin shape ─────────────────────────────────────────────────────────

  describe('Plugin shape', () => {
    it('returns an object with a props.handlePaste function', () => {
      expect(plugin).toBeDefined();
      expect(plugin.props).toBeDefined();
      expect(typeof plugin.props.handlePaste).toBe('function');
    });
  });

  // ── Valid markdown table → handled ───────────────────────────────────────

  describe('Valid markdown tables are accepted', () => {
    it('handles a simple pipe-delimited table', () => {
      const text = `| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |`;

      const view = makeView();
      const event = makeClipboardEvent(text);

      const result = handlePaste(view, event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(view.dispatch).toHaveBeenCalledWith(view._mockTr);
      expect(view._mockTr.replaceSelection).toHaveBeenCalled();
    });

    it('handles a table without leading/trailing pipe characters', () => {
      const text = `Header 1 | Header 2
--- | ---
Cell 1 | Cell 2`;

      const view = makeView();
      const event = makeClipboardEvent(text);

      const result = handlePaste(view, event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('handles a table with alignment indicators (:--- :---: ---:)', () => {
      const text = `| Left | Center | Right |
| :--- | :---: | ---: |
| L1 | C1 | R1 |`;

      const view = makeView();
      const event = makeClipboardEvent(text);

      const result = handlePaste(view, event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('handles a table with varying cell counts (pads / trims to header width)', () => {
      const text = `| H1 | H2 | H3 |
| --- | --- | --- |
| C1 | C2 |
| C3 | C4 | C5 | C6 |`;

      const view = makeView();
      const event = makeClipboardEvent(text);

      const result = handlePaste(view, event);

      expect(result).toBe(true);
    });

    it('handles a single-column table', () => {
      const text = `| Header |
| --- |
| Cell 1 |
| Cell 2 |`;

      const view = makeView();
      const event = makeClipboardEvent(text);

      const result = handlePaste(view, event);

      expect(result).toBe(true);
    });

    it('handles a table with empty cells', () => {
      const text = `| Header 1 | Header 2 | Header 3 |
| --- | --- | --- |
| Cell 1 |  | Cell 3 |
|  | Cell 2 |  |`;

      const view = makeView();
      const event = makeClipboardEvent(text);

      const result = handlePaste(view, event);

      expect(result).toBe(true);
    });

    it('handles a table with extra whitespace around cells', () => {
      const text = `|  Header 1  |  Header 2  |
|   ---   |   ---   |
|  Cell 1  |  Cell 2  |`;

      const view = makeView();
      const event = makeClipboardEvent(text);

      const result = handlePaste(view, event);

      expect(result).toBe(true);
    });

    it('handles a table containing HTML special characters (they get escaped)', () => {
      const text = `| Header | Content |
| --- | --- |
| Cell | <script>alert('xss')</script> |`;

      const view = makeView();
      const event = makeClipboardEvent(text);

      const result = handlePaste(view, event);

      expect(result).toBe(true);
    });

    it('handles a table with & < > characters', () => {
      const text = `| Header | Content |
| --- | --- |
| Cell | Content with & < > characters |`;

      const view = makeView();
      const event = makeClipboardEvent(text);

      const result = handlePaste(view, event);

      expect(result).toBe(true);
    });
  });

  // ── Invalid / non-table input → not handled ──────────────────────────────

  describe('Invalid input is rejected (returns false)', () => {
    it('rejects plain text that is not a table', () => {
      const view = makeView();
      const event = makeClipboardEvent('This is just regular text');

      const result = handlePaste(view, event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(view.dispatch).not.toHaveBeenCalled();
    });

    it('rejects a table that is missing its separator row', () => {
      // Two pipe rows but no ---/--- separator → not a valid markdown table
      const text = `| Header 1 | Header 2 |
| Cell 1 | Cell 2 |`;

      const view = makeView();
      const event = makeClipboardEvent(text);

      const result = handlePaste(view, event);

      expect(result).toBe(false);
    });

    it('rejects a table with an invalid separator (== instead of ---)', () => {
      const text = `| Header 1 | Header 2 |
| == | == |
| Cell 1 | Cell 2 |`;

      const view = makeView();
      const event = makeClipboardEvent(text);

      const result = handlePaste(view, event);

      expect(result).toBe(false);
    });

    it('rejects a table header + separator but no data rows', () => {
      const text = `| Header 1 | Header 2 |
| --- | --- |`;

      const view = makeView();
      const event = makeClipboardEvent(text);

      const result = handlePaste(view, event);

      expect(result).toBe(false);
    });

    it.each([null, undefined, '', '   '])(
      'rejects empty / blank clipboard text (%s)',
      (input) => {
        const view = makeView();
        const event = makeClipboardEvent(input);

        const result = handlePaste(view, event);

        expect(result).toBe(false);
        expect(view.dispatch).not.toHaveBeenCalled();
      }
    );
  });

  // ── codeBlock context ────────────────────────────────────────────────────

  describe('codeBlock context', () => {
    it('returns false without dispatching when pasting inside a codeBlock', () => {
      const text = `| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |`;

      // inCodeBlock = true makes $from.parent.type.name === 'codeBlock'
      const view = makeView({ inCodeBlock: true });
      const event = makeClipboardEvent(text);

      const result = handlePaste(view, event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(view.dispatch).not.toHaveBeenCalled();
    });
  });

  // ── Error handling ───────────────────────────────────────────────────────

  describe('Error handling', () => {
    it('returns false gracefully when clipboardData.getData throws', () => {
      const view = makeView();
      const event = {
        clipboardData: {
          getData: vi.fn(() => { throw new Error('Clipboard access error') }),
        },
        preventDefault: vi.fn(),
      };

      const result = handlePaste(view, event);

      expect(result).toBe(false);
    });

    it('returns false gracefully when dispatch throws', () => {
      const view = makeView({
        dispatchSpy: vi.fn(() => { throw new Error('dispatch error') }),
      });
      const event = makeClipboardEvent(`| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |`);

      const result = handlePaste(view, event);

      // The plugin catches errors in a try/catch and returns false
      expect(result).toBe(false);
    });
  });
});
