import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setProvider } from './aiClient.js';
import {
  buildActionContext,
  getWorkspacePath,
  getActiveNoteId,
} from './actionContext.js';

function providerYielding(frames) {
  return {
    async *complete() {
      for (const f of frames) yield f;
    },
  };
}

describe('actionContext', () => {
  afterEach(() => {
    delete globalThis.__LOKUS_WORKSPACE_PATH__;
    delete globalThis.__LOKUS_ACTIVE_FILE__;
    if (typeof window !== 'undefined') delete window.__WORKSPACE_PATH__;
    setProvider(null);
  });

  describe('global resolution', () => {
    it('resolves workspace path from __LOKUS_WORKSPACE_PATH__', () => {
      globalThis.__LOKUS_WORKSPACE_PATH__ = '/vault';
      expect(getWorkspacePath()).toBe('/vault');
    });

    it('falls back to window.__WORKSPACE_PATH__', () => {
      window.__WORKSPACE_PATH__ = '/win-vault';
      expect(getWorkspacePath()).toBe('/win-vault');
    });

    it('resolves active note id from __LOKUS_ACTIVE_FILE__', () => {
      globalThis.__LOKUS_ACTIVE_FILE__ = { path: '/vault/note.md', name: 'note.md' };
      expect(getActiveNoteId()).toBe('/vault/note.md');
    });

    it('returns undefined when no globals are set', () => {
      expect(getWorkspacePath()).toBeUndefined();
      expect(getActiveNoteId()).toBeUndefined();
    });
  });

  describe('buildActionContext', () => {
    it('includes editorAPI, sessionId, graphIndex and an agentState', () => {
      globalThis.__LOKUS_WORKSPACE_PATH__ = '/vault';
      const ctx = buildActionContext();
      expect(ctx.editorAPI).toBeTruthy();
      expect(ctx.workspacePath).toBe('/vault');
      expect(typeof ctx.sessionId).toBe('string');
      expect(ctx.sessionId.length).toBeGreaterThan(0);
      expect(ctx.graphIndex).toBeTruthy();
      expect(ctx.agentState).toEqual({ observations: [] });
      expect(typeof ctx.callLLM).toBe('function');
    });

    it('null graphIndex when no workspace path', () => {
      const ctx = buildActionContext();
      expect(ctx.graphIndex).toBeNull();
    });

    it('overrides win over resolved globals', () => {
      globalThis.__LOKUS_WORKSPACE_PATH__ = '/vault';
      const signal = new AbortController().signal;
      const ctx = buildActionContext({ workspacePath: '/other', noteId: 'x.md', surface: 'agent', signal });
      expect(ctx.workspacePath).toBe('/other');
      expect(ctx.noteId).toBe('x.md');
      expect(ctx.surface).toBe('agent');
      expect(ctx.signal).toBe(signal);
    });

    it('passes through unknown override keys', () => {
      const ctx = buildActionContext({ supabaseToken: 'jwt-123' });
      expect(ctx.supabaseToken).toBe('jwt-123');
    });

    it('callLLM streams via the provider with the context surface', async () => {
      setProvider(providerYielding([
        { type: 'text_delta', text: 'rewritten' },
        { type: 'done' },
      ]));
      const ctx = buildActionContext({ surface: 'selection' });
      const out = await ctx.callLLM({ system: 'You rewrite.', user: 'make it formal' });
      expect(out).toBe('rewritten');
    });

    it('each context gets a distinct sessionId', () => {
      const a = buildActionContext();
      const b = buildActionContext();
      expect(a.sessionId).not.toBe(b.sessionId);
    });
  });
});
