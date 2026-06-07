import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { lokusSchema } from '../schema/lokus-schema.js';
import { createGhostTextPlugin, ghostTextKey } from './GhostText.js';

function createView(text, { enabled = false, fetchSuggestion, debounceMs = 400, minChars = 3 } = {}) {
  const { plugin, controller } = createGhostTextPlugin({ enabled, fetchSuggestion, debounceMs, minChars });
  const doc = lokusSchema.node('doc', null, [
    lokusSchema.node('paragraph', null, text ? [lokusSchema.text(text)] : []),
  ]);
  const state = EditorState.create({ schema: lokusSchema, doc, plugins: [plugin] });
  const view = new EditorView(document.createElement('div'), { state });
  return { view, controller };
}

function setCursorEnd(view) {
  const pos = view.state.doc.content.size - 1;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
  return pos;
}

function ghostState(view) {
  return ghostTextKey.getState(view.state);
}

describe('GhostText plugin', () => {
  let view;
  let controller;

  afterEach(() => {
    view?.destroy();
    vi.useRealTimers();
  });

  it('is DISABLED by default and renders no decoration', () => {
    ({ view, controller } = createView('Hello there friend'));
    expect(controller.isEnabled()).toBe(false);
    expect(ghostState(view).enabled).toBe(false);
    expect(ghostState(view).suggestion).toBeNull();
  });

  it('request() is inert while disabled (never calls the fetcher)', async () => {
    vi.useFakeTimers();
    const fetchSuggestion = vi.fn().mockResolvedValue(' world');
    ({ view, controller } = createView('Hello there', { enabled: false, fetchSuggestion }));
    setCursorEnd(view);
    controller.request(view);
    await vi.runAllTimersAsync();
    expect(fetchSuggestion).not.toHaveBeenCalled();
  });

  it('setEnabled(true) lets request() fetch + show a suggestion after debounce', async () => {
    vi.useFakeTimers();
    const fetchSuggestion = vi.fn().mockResolvedValue(' continuation');
    ({ view, controller } = createView('Hello there', { enabled: false, fetchSuggestion, debounceMs: 200 }));
    controller.setEnabled(view, true);
    expect(controller.isEnabled()).toBe(true);

    setCursorEnd(view);
    controller.request(view);
    expect(fetchSuggestion).not.toHaveBeenCalled(); // debounced
    await vi.advanceTimersByTimeAsync(200);
    expect(fetchSuggestion).toHaveBeenCalledTimes(1);
    expect(ghostState(view).suggestion).toBe(' continuation');
  });

  it('accept() inserts the suggestion as real text and clears the ghost', async () => {
    vi.useFakeTimers();
    ({ view, controller } = createView('Hello', { enabled: true, fetchSuggestion: () => Promise.resolve(' world'), debounceMs: 0 }));
    setCursorEnd(view);
    controller.request(view);
    await vi.advanceTimersByTimeAsync(0);
    expect(ghostState(view).suggestion).toBe(' world');

    const ok = controller.accept(view);
    expect(ok).toBe(true);
    expect(view.state.doc.textContent).toBe('Hello world');
    expect(ghostState(view).suggestion).toBeNull();
  });

  it('dismiss() clears the ghost without inserting', async () => {
    vi.useFakeTimers();
    ({ view, controller } = createView('Hello', { enabled: true, fetchSuggestion: () => Promise.resolve(' world'), debounceMs: 0 }));
    setCursorEnd(view);
    controller.request(view);
    await vi.advanceTimersByTimeAsync(0);
    expect(ghostState(view).suggestion).toBe(' world');

    controller.dismiss(view);
    expect(ghostState(view).suggestion).toBeNull();
    expect(view.state.doc.textContent).toBe('Hello');
  });

  it('a document edit clears a pending suggestion', async () => {
    vi.useFakeTimers();
    ({ view, controller } = createView('Hello', { enabled: true, fetchSuggestion: () => Promise.resolve(' world'), debounceMs: 0 }));
    const pos = setCursorEnd(view);
    controller.request(view);
    await vi.advanceTimersByTimeAsync(0);
    expect(ghostState(view).suggestion).toBe(' world');

    // User types a character.
    view.dispatch(view.state.tr.insertText('!', pos, pos));
    expect(ghostState(view).suggestion).toBeNull();
  });

  it('does not request when there is a non-empty selection', async () => {
    vi.useFakeTimers();
    const fetchSuggestion = vi.fn().mockResolvedValue(' x');
    ({ view, controller } = createView('Hello world', { enabled: true, fetchSuggestion, debounceMs: 0 }));
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 6)));
    controller.request(view);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSuggestion).not.toHaveBeenCalled();
  });

  it('does not request below minChars before the cursor', async () => {
    vi.useFakeTimers();
    const fetchSuggestion = vi.fn().mockResolvedValue(' x');
    ({ view, controller } = createView('ab', { enabled: true, fetchSuggestion, minChars: 5, debounceMs: 0 }));
    setCursorEnd(view);
    controller.request(view);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSuggestion).not.toHaveBeenCalled();
  });

  it('silently swallows a fetcher rejection (fire-and-forget)', async () => {
    vi.useFakeTimers();
    const fetchSuggestion = vi.fn().mockRejectedValue(new Error('ollama down'));
    ({ view, controller } = createView('Hello there', { enabled: true, fetchSuggestion, debounceMs: 0 }));
    setCursorEnd(view);
    controller.request(view);
    await vi.advanceTimersByTimeAsync(0);
    expect(ghostState(view).suggestion).toBeNull(); // no crash, no ghost
  });

  it('drops a stale response when a newer request supersedes it', async () => {
    vi.useFakeTimers();
    let resolveFirst;
    const fetchSuggestion = vi.fn()
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
      .mockImplementationOnce(() => Promise.resolve(' second'));
    ({ view, controller } = createView('Hello there', { enabled: true, fetchSuggestion, debounceMs: 0 }));
    setCursorEnd(view);
    controller.request(view); // first (pending)
    await vi.advanceTimersByTimeAsync(0);
    controller.request(view); // second supersedes
    await vi.advanceTimersByTimeAsync(0);
    resolveFirst(' first'); // resolve the stale one late
    await Promise.resolve();
    expect(ghostState(view).suggestion).toBe(' second');
  });
});
