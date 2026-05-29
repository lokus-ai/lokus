import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub editor-coupled deps so the panel renders in jsdom without a live editor.
vi.mock('./actionContext.js', () => ({
  buildActionContext: vi.fn(() => ({ surface: 'cmdK', workspacePath: '/w' })),
}));
vi.mock('./DiffPreview.js', () => ({
  previewWriteBuffer: vi.fn(() => true),
}));
// Mock the providers-owned module so the "provider unavailable" path is tested
// deterministically. The real ai-provider.js now exports a working aiProvider,
// so without this the unavailable-fallback test can't trigger. Tests that need a
// working provider inject one via setProvider() (checked first by getProvider()).
vi.mock('../../services/ai-provider.js', () => ({
  aiProvider: {}, // no complete() → PROVIDER_UNAVAILABLE in the lazy fallback
}));

import { setProvider } from './aiClient.js';
import AICmdK from './AICmdK.jsx';

function providerYielding(framesPerCall) {
  let call = 0;
  return {
    async *complete() {
      const frames = framesPerCall[Math.min(call, framesPerCall.length - 1)];
      call += 1;
      for (const f of frames) yield f;
    },
  };
}

function makeRegistry(actions = []) {
  return {
    getAll: () => actions,
    bySurface: (s) => actions.filter((a) => a.surfaces?.includes(s)),
    toToolSchema: () => [],
    exists: (id) => actions.some((a) => a.id === id),
    execute: vi.fn(),
  };
}

describe('AICmdK', () => {
  afterEach(() => setProvider(null));

  it('does not render when closed', () => {
    const { container } = render(<AICmdK open={false} onOpenChange={() => {}} registry={makeRegistry()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the input and a hint when open', () => {
    render(<AICmdK open onOpenChange={() => {}} registry={makeRegistry()} />);
    expect(screen.getByPlaceholderText(/Ask AI or type an instruction/i)).toBeInTheDocument();
    expect(screen.getByText(/summarize this note/i)).toBeInTheDocument();
  });

  it('Escape closes the panel', () => {
    const onOpenChange = vi.fn();
    render(<AICmdK open onOpenChange={onOpenChange} registry={makeRegistry()} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/Ask AI/i), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('routes a question (Tier 1 ask) to a streamed answer', async () => {
    setProvider(providerYielding([
      [{ type: 'text_delta', text: 'Paris is the capital.' }, { type: 'done' }],
    ]));
    render(<AICmdK open onOpenChange={() => {}} registry={makeRegistry()} />);
    const input = screen.getByPlaceholderText(/Ask AI/i);
    fireEvent.change(input, { target: { value: 'what is the capital of France' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Paris is the capital.')).toBeInTheDocument());
  });

  it('executes a Tier-0 action match and shows its text result', async () => {
    setProvider(null);
    const registry = makeRegistry([
      { id: 'open-graph', title: 'Open Graph View', description: 'graph', surfaces: ['palette'] },
    ]);
    registry.execute.mockResolvedValue({ type: 'text', content: 'Opened the graph.' });
    render(<AICmdK open onOpenChange={() => {}} registry={registry} />);
    const input = screen.getByPlaceholderText(/Ask AI/i);
    fireEvent.change(input, { target: { value: 'open graph view' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(registry.execute).toHaveBeenCalledWith('open-graph', {}, expect.any(Object)));
    await waitFor(() => expect(screen.getByText('Opened the graph.')).toBeInTheDocument());
  });

  it('renders a friendly message when the provider is unavailable', async () => {
    setProvider(null); // ai-provider.js is mocked without complete() → PROVIDER_UNAVAILABLE
    render(<AICmdK open onOpenChange={() => {}} registry={makeRegistry()} />);
    const input = screen.getByPlaceholderText(/Ask AI/i);
    fireEvent.change(input, { target: { value: 'explain this concept to me' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText(/still starting up/i)).toBeInTheDocument());
  });
});
