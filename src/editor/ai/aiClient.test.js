import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the providers-owned module so the "no complete()" guard is tested
// deterministically. The real ai-provider.js now exports a working aiProvider
// (providers' Wave-2 rewrite), so without this mock getProvider() would resolve
// to it instead of exercising the PROVIDER_UNAVAILABLE path. Every other test
// here injects a provider via setProvider() (which getProvider checks first), so
// this mock only matters for the lazy-import fallback case.
vi.mock('../../services/ai-provider.js', () => ({
  // Intentionally NO `complete` and NO default → simulates the unavailable state.
  aiProvider: {},
}));

import {
  AIClientError,
  setProvider,
  getProvider,
  completeTurn,
  streamText,
  runToolLoop,
  toolNameToActionId,
} from './aiClient.js';

/** Build a provider whose complete() yields the given frames. */
function providerYielding(frames) {
  return {
    // eslint-disable-next-line require-yield
    async *complete() {
      for (const f of frames) yield f;
    },
  };
}

/** Provider driven by a queue of frame-arrays (one array per complete() call). */
function scriptedProvider(scripts) {
  let call = 0;
  const calls = [];
  return {
    calls,
    async *complete(messages, options) {
      calls.push({ messages: JSON.parse(JSON.stringify(messages)), options });
      const frames = scripts[call] ?? [];
      call += 1;
      for (const f of frames) yield f;
    },
  };
}

describe('aiClient', () => {
  afterEach(() => setProvider(null));

  describe('getProvider', () => {
    it('returns an injected provider', async () => {
      const p = providerYielding([]);
      setProvider(p);
      await expect(getProvider()).resolves.toBe(p);
    });

    it('throws PROVIDER_UNAVAILABLE when ai-provider has no complete()', async () => {
      setProvider(null);
      // ai-provider.js is mocked (top of file) to export an aiProvider without
      // complete(), so the lazy-import fallback must surface the typed error.
      await expect(getProvider()).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    });
  });

  describe('completeTurn / streamText', () => {
    it('collects text deltas and calls onDelta', async () => {
      setProvider(providerYielding([
        { type: 'text_delta', text: 'Hello' },
        { type: 'text_delta', text: ' world' },
        { type: 'done', usage: { promptTokens: 3, completionTokens: 2 } },
      ]));
      const deltas = [];
      const text = await streamText('hi', { surface: 'cmdK' }, (d) => deltas.push(d));
      expect(text).toBe('Hello world');
      expect(deltas).toEqual(['Hello', ' world']);
    });

    it('returns usage + tool_use blocks from the terminal turn', async () => {
      setProvider(providerYielding([
        { type: 'tool_use', id: 't1', name: 'vault_search', input: { query: 'x' } },
        { type: 'done', usage: { promptTokens: 5, completionTokens: 0 } },
      ]));
      const res = await completeTurn([{ role: 'user', content: 'find x' }]);
      expect(res.toolUses).toHaveLength(1);
      expect(res.toolUses[0]).toMatchObject({ name: 'vault_search', input: { query: 'x' } });
      expect(res.usage.promptTokens).toBe(5);
    });

    it('throws AIClientError on an error frame', async () => {
      setProvider(providerYielding([
        { type: 'error', code: 'INSUFFICIENT_CREDITS', message: 'no credits', retryable: false },
      ]));
      await expect(streamText('hi')).rejects.toMatchObject({
        code: 'INSUFFICIENT_CREDITS',
        retryable: false,
      });
    });

    it('throws NO_TERMINAL_FRAME when the stream closes without done', async () => {
      setProvider(providerYielding([{ type: 'text_delta', text: 'partial' }]));
      await expect(streamText('hi')).rejects.toMatchObject({ code: 'NO_TERMINAL_FRAME' });
    });

    it('rejects a non-string/non-array prompt', async () => {
      setProvider(providerYielding([{ type: 'done' }]));
      await expect(streamText(42)).rejects.toBeInstanceOf(AIClientError);
    });
  });

  describe('toolNameToActionId', () => {
    const registry = { exists: (id) => ['vault.search', 'note.create'].includes(id) };
    it('maps underscore tool names back to dotted action ids', () => {
      expect(toolNameToActionId('vault_search', registry)).toBe('vault.search');
      expect(toolNameToActionId('note_create', registry)).toBe('note.create');
    });
    it('returns a verbatim id when it already exists', () => {
      const r = { exists: (id) => id === 'format_bold' };
      expect(toolNameToActionId('format_bold', r)).toBe('format_bold');
    });
  });

  describe('runToolLoop (client-side ReAct)', () => {
    it('executes a tool, feeds the result back, then finishes on a no-tool turn', async () => {
      const provider = scriptedProvider([
        // step 1: ask to search
        [{ type: 'tool_use', id: 't1', name: 'vault_search', input: { query: 'pricing' } },
         { type: 'done', usage: { promptTokens: 10, completionTokens: 1 } }],
        // step 2: final answer, no tools
        [{ type: 'text_delta', text: 'You wrote about pricing in March.' },
         { type: 'done', usage: { promptTokens: 20, completionTokens: 8 } }],
      ]);
      setProvider(provider);

      const execute = vi.fn().mockResolvedValue({ type: 'text', content: 'pricing.md: $12/mo' });
      const registry = { execute, exists: (id) => id === 'vault.search' };
      const onToolCall = vi.fn();
      const onToolResult = vi.fn();

      const res = await runToolLoop({
        query: 'what did I write about pricing?',
        options: { surface: 'agent' },
        registry,
        context: { workspacePath: '/w' },
        ui: { onToolCall, onToolResult },
      });

      expect(execute).toHaveBeenCalledWith('vault.search', { query: 'pricing' }, { workspacePath: '/w' });
      expect(res.answer).toBe('You wrote about pricing in March.');
      expect(res.steps).toBe(2);
      expect(onToolCall).toHaveBeenCalledTimes(1);
      expect(onToolResult).toHaveBeenCalledTimes(1);
      // The tool result was fed back as a `tool` message on the 2nd call.
      const secondCall = provider.calls[1];
      const toolMsg = secondCall.messages.find((m) => m.role === 'tool');
      expect(toolMsg).toBeTruthy();
      expect(toolMsg.content[0].tool_use_id).toBe('t1');
    });

    it('buffers write ops instead of applying them', async () => {
      const provider = scriptedProvider([
        [{ type: 'tool_use', id: 'w1', name: 'editor_rewrite', input: { tone: 'formal' } },
         { type: 'done' }],
        [{ type: 'text_delta', text: 'done' }, { type: 'done' }],
      ]);
      setProvider(provider);
      const registry = {
        execute: vi.fn().mockResolvedValue({ type: 'diff', diff: { before: 'a', after: 'b' } }),
        exists: () => true,
      };
      const res = await runToolLoop({ query: 'rewrite', registry, options: {} });
      expect(res.writeBuffer).toHaveLength(1);
      expect(res.writeBuffer[0].type).toBe('diff');
    });

    it('finalize sentinel flushes writes + answer and stops', async () => {
      const provider = scriptedProvider([
        [{ type: 'tool_use', id: 'f1', name: 'finalize', input: {
          answer: 'All set.',
          writes: [{ type: 'insert', text: 'X' }],
        } }, { type: 'done' }],
      ]);
      setProvider(provider);
      const registry = { execute: vi.fn(), exists: () => false };
      const res = await runToolLoop({ query: 'do it', registry, options: {} });
      expect(res.answer).toBe('All set.');
      expect(res.writeBuffer).toEqual([{ type: 'insert', text: 'X' }]);
      expect(registry.execute).not.toHaveBeenCalled(); // finalize is client-only
    });

    it('aborts when the signal is already aborted', async () => {
      setProvider(providerYielding([{ type: 'done' }]));
      const ac = new AbortController();
      ac.abort();
      await expect(
        runToolLoop({ query: 'x', registry: { execute: vi.fn(), exists: () => false }, options: { signal: ac.signal } }),
      ).rejects.toMatchObject({ code: 'ABORTED' });
    });

    it('captures a tool execution error as a tool_result is_error', async () => {
      const provider = scriptedProvider([
        [{ type: 'tool_use', id: 'e1', name: 'vault_search', input: {} }, { type: 'done' }],
        [{ type: 'text_delta', text: 'recovered' }, { type: 'done' }],
      ]);
      setProvider(provider);
      const registry = {
        execute: vi.fn().mockRejectedValue(new Error('boom')),
        exists: () => true,
      };
      const res = await runToolLoop({ query: 'x', registry, options: {} });
      const toolMsg = provider.calls[1].messages.find((m) => m.role === 'tool');
      expect(toolMsg.content[0].is_error).toBe(true);
      expect(res.answer).toBe('recovered');
    });
  });
});
