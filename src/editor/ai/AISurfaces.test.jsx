import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub the panel + editor-coupled modules; we test the event wiring here.
vi.mock('./AICmdK.jsx', () => ({
  default: ({ open, initialQuery }) => (open ? <div data-testid="cmdk" data-query={initialQuery} /> : null),
}));
vi.mock('./transforms.js', () => ({
  getTransform: vi.fn((id) => ({ id, label: id, needsArg: id === 'tone' || id === 'translate', argLabel: 'arg' })),
  runTransform: vi.fn(() => Promise.resolve('TRANSFORMED')),
}));
vi.mock('./DiffPreview.js', () => ({
  previewWriteBuffer: vi.fn(() => true),
  hasPendingPreview: vi.fn(() => false),
}));

import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { lokusSchema } from '../schema/lokus-schema.js';
import { runTransform } from './transforms.js';
import { previewWriteBuffer } from './DiffPreview.js';
import AISurfaces from './AISurfaces.jsx';

/** A real PM EditorView so TextSelection.create / dispatch behave correctly. */
function fakeView({ from = 1, to = 6, text = 'hello world' } = {}) {
  const doc = lokusSchema.node('doc', null, [
    lokusSchema.node('paragraph', null, [lokusSchema.text(text)]),
  ]);
  const state = EditorState.create({ schema: lokusSchema, doc });
  const view = new EditorView(document.createElement('div'), { state });
  if (from !== to) {
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
  } else {
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from)));
  }
  return view;
}

describe('AISurfaces', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens the Cmd-K panel on lokus:open-ai-cmdk with the query', async () => {
    render(<AISurfaces view={fakeView()} />);
    expect(screen.queryByTestId('cmdk')).toBeNull();
    act(() => {
      window.dispatchEvent(new CustomEvent('lokus:open-ai-cmdk', { detail: { query: 'summarize this' } }));
    });
    await waitFor(() => expect(screen.getByTestId('cmdk')).toBeInTheDocument());
    expect(screen.getByTestId('cmdk').getAttribute('data-query')).toBe('summarize this');
  });

  it('runs a selection transform on lokus:ai-transform and stages the result', async () => {
    const view = fakeView();
    render(<AISurfaces view={view} />);
    act(() => {
      window.dispatchEvent(new CustomEvent('lokus:ai-transform', { detail: { view, transformId: 'rewrite' } }));
    });
    await waitFor(() => expect(runTransform).toHaveBeenCalledWith('rewrite', expect.any(String), expect.objectContaining({ signal: expect.any(Object) })));
    await waitFor(() => expect(previewWriteBuffer).toHaveBeenCalled());
  });

  it('ignores a transform when there is no selection', async () => {
    const view = fakeView({ from: 3, to: 3 });
    render(<AISurfaces view={view} />);
    act(() => {
      window.dispatchEvent(new CustomEvent('lokus:ai-transform', { detail: { view, transformId: 'rewrite' } }));
    });
    // give the handler a tick
    await act(async () => { await Promise.resolve(); });
    expect(runTransform).not.toHaveBeenCalled();
  });

  it('prompts for an argument on needsArg transforms (tone) and cancels cleanly', async () => {
    const view = fakeView();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null); // user cancels
    render(<AISurfaces view={view} />);
    act(() => {
      window.dispatchEvent(new CustomEvent('lokus:ai-transform', { detail: { view, transformId: 'tone' } }));
    });
    await act(async () => { await Promise.resolve(); });
    expect(promptSpy).toHaveBeenCalled();
    expect(runTransform).not.toHaveBeenCalled(); // cancelled
    promptSpy.mockRestore();
  });
});
