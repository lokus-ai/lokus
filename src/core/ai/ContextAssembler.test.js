import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mocks for the (non-AI) layer sources. We import, never modify, these. ---
// vi.mock factories are hoisted above imports, so the mutable state they close
// over must be created with vi.hoisted() (also hoisted) to avoid TDZ errors.
const { invokeMock, getRelatedNotesMock, loadMock, editorStub } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  getRelatedNotesMock: vi.fn(),
  loadMock: vi.fn(async () => {}),
  // Mutable editor stub so individual tests control L2/L3.
  editorStub: { editorInstance: null, getContent: vi.fn() },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a) => invokeMock(...a) }));
vi.mock('../../mcp-server/utils/graphIndex.js', () => ({
  getGraphIndex: () => ({ load: loadMock, getRelatedNotes: getRelatedNotesMock }),
}));
vi.mock('../../plugins/api/EditorAPI.js', () => ({ editorAPI: editorStub }));

import ContextAssembler, {
  contextAssembler,
  CACHE_BOUNDARY,
  SURFACE_BUDGETS,
} from './ContextAssembler.js';

const est = (t) => Math.ceil(t.length / 4);

describe('ContextAssembler', () => {
  let asm;
  beforeEach(() => {
    asm = new ContextAssembler();
    invokeMock.mockReset();
    getRelatedNotesMock.mockReset();
    loadMock.mockClear();
    editorStub.editorInstance = null;
    editorStub.getContent.mockReset();
  });

  describe('L1 + cache boundary', () => {
    it('always emits L1 and the cache boundary marker', async () => {
      const out = await asm.build({ instruction: 'Be concise.' });
      expect(out.stable).toContain('# System Instruction');
      expect(out.stable).toContain('Be concise.');
      expect(out.context).toContain(CACHE_BOUNDARY);
      expect(out.context.indexOf(CACHE_BOUNDARY)).toBe(out.stable.length);
    });

    it('build() returns a budgeted object that respects the budget', async () => {
      const out = await asm.build({ instruction: 'x'.repeat(100), maxTokens: 200 });
      expect(out).toMatchObject({
        budget: 200,
        cacheBoundary: CACHE_BOUNDARY,
      });
      expect(typeof out.tokensUsed).toBe('number');
      expect(out.withinBudget).toBe(true);
      expect(out.tokensUsed).toBeLessThanOrEqual(out.budget);
    });

    it('build() never exceeds budget even when every layer overflows', async () => {
      editorStub.editorInstance = {
        state: { selection: { from: 0, to: 5 }, doc: { textBetween: () => 'SELECTED'.repeat(500) } },
      };
      editorStub.getContent.mockResolvedValue('NOTE BODY '.repeat(2000));
      invokeMock.mockResolvedValue([
        { fileName: 'a.md', matches: [{ line: 1, text: 'm'.repeat(2000) }] },
      ]);
      getRelatedNotesMock.mockReturnValue({
        found: true,
        related: Array.from({ length: 10 }, (_, i) => ({ name: `N${i}`, direction: 'outgoing', connections: i })),
      });
      const out = await asm.build({
        instruction: 'sys',
        noteId: 'notes/Topic.md',
        searchQuery: 'foo',
        workspacePath: '/ws',
        agentState: { observations: ['obs '.repeat(1000)] },
        maxTokens: 1000,
      });
      expect(out.tokensUsed).toBeLessThanOrEqual(out.budget);
      expect(out.withinBudget).toBe(true);
    });
  });

  describe('L2 open note (stable prefix)', () => {
    it('includes note body before the boundary, titled from noteId', async () => {
      editorStub.editorInstance = { state: {} };
      editorStub.getContent.mockResolvedValue('Hello world body');
      const out = await asm.build({ instruction: 'sys', noteId: 'dir/My Note.md', maxTokens: 4096 });
      expect(out.stable).toContain('# Open Note: My Note');
      expect(out.stable).toContain('Hello world body');
      expect(out.dynamic).not.toContain('Hello world body');
    });

    it('skips L2 when useEditor is false', async () => {
      editorStub.editorInstance = { state: {} };
      editorStub.getContent.mockResolvedValue('should not appear');
      const out = await asm.build({ instruction: 'sys', useEditor: false });
      expect(out.context).not.toContain('should not appear');
      expect(editorStub.getContent).not.toHaveBeenCalled();
    });

    it('degrades gracefully when getContent throws', async () => {
      editorStub.editorInstance = { state: {} };
      editorStub.getContent.mockRejectedValue(new Error('not ready'));
      const out = await asm.build({ instruction: 'sys' });
      expect(out.stable).toContain('# System Instruction');
      expect(out.layers.l2).toBeUndefined();
    });
  });

  describe('L3 selection (dynamic suffix)', () => {
    it('uses explicit selection from the request', async () => {
      const out = await asm.build({ instruction: 'sys', selection: 'picked text' });
      expect(out.dynamic).toContain('# Selected Text');
      expect(out.dynamic).toContain('picked text');
    });

    it('reads selection from the editor when not provided', async () => {
      editorStub.editorInstance = {
        state: { selection: { from: 2, to: 8 }, doc: { textBetween: () => 'editor sel' } },
      };
      editorStub.getContent.mockResolvedValue('');
      const out = await asm.build({ instruction: 'sys' });
      expect(out.dynamic).toContain('editor sel');
    });
  });

  describe('L4 vault FTS (dynamic suffix)', () => {
    it('invokes search_in_files and formats matches', async () => {
      invokeMock.mockResolvedValue([
        { fileName: 'foo.md', matches: [{ line: 3, text: '  a match  ' }] },
      ]);
      const out = await asm.build({ instruction: 'sys', searchQuery: 'term', workspacePath: '/ws' });
      expect(invokeMock).toHaveBeenCalledWith('search_in_files', expect.objectContaining({
        query: 'term', workspacePath: '/ws',
      }));
      expect(out.dynamic).toContain('Related Notes (search: "term")');
      expect(out.dynamic).toContain('## foo.md');
      expect(out.dynamic).toContain('L3: a match');
    });

    it('skips L4 with no workspacePath and degrades if invoke throws', async () => {
      const noWs = await asm.build({ instruction: 'sys', searchQuery: 'term' });
      expect(invokeMock).not.toHaveBeenCalled();
      expect(noWs.dynamic).not.toContain('Related Notes');

      invokeMock.mockRejectedValue(new Error('no backend'));
      const out = await asm.build({ instruction: 'sys', searchQuery: 'term', workspacePath: '/ws' });
      expect(out.dynamic).not.toContain('Related Notes');
    });
  });

  describe('L5 graph neighbors (dynamic suffix)', () => {
    it('loads graph index and renders 1-hop neighbors with direction arrows', async () => {
      getRelatedNotesMock.mockReturnValue({
        found: true,
        related: [
          { name: 'Alpha', direction: 'outgoing', connections: 4 },
          { name: 'Beta', direction: 'incoming', connections: 2 },
        ],
      });
      const out = await asm.build({ instruction: 'sys', noteId: 'd/Topic.md', workspacePath: '/ws' });
      expect(loadMock).toHaveBeenCalled();
      expect(getRelatedNotesMock).toHaveBeenCalledWith('Topic', { depth: 1, direction: 'both', limit: 10 });
      expect(out.dynamic).toContain('Wiki-Link Neighbors (1-hop from "Topic")');
      expect(out.dynamic).toContain('→ [[Alpha]] — 4 connections');
      expect(out.dynamic).toContain('← [[Beta]] — 2 connections');
    });

    it('omits L5 when the note is not found in the graph', async () => {
      getRelatedNotesMock.mockReturnValue({ found: false, related: [] });
      const out = await asm.build({ instruction: 'sys', noteId: 'd/Topic.md', workspacePath: '/ws' });
      expect(out.dynamic).not.toContain('Wiki-Link Neighbors');
    });
  });

  describe('L6 agent observations', () => {
    it('includes only the last 5 observations', async () => {
      const observations = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6'];
      const out = await asm.build({ instruction: 'sys', agentState: { observations } });
      expect(out.dynamic).toContain('# Prior Agent Context');
      expect(out.dynamic).toContain('o6');
      expect(out.dynamic).not.toContain('o1');
    });
  });

  describe('assemble() caching', () => {
    it('returns a string and serves cached results within the TTL', async () => {
      editorStub.editorInstance = { state: {} };
      editorStub.getContent.mockResolvedValue('body');
      const first = await asm.assemble({ instruction: 'sys', noteId: 'n.md' });
      expect(typeof first).toBe('string');
      editorStub.getContent.mockResolvedValue('CHANGED');
      const second = await asm.assemble({ instruction: 'sys', noteId: 'n.md' });
      expect(second).toBe(first); // cache hit
    });

    it('invalidate() forces a rebuild', async () => {
      editorStub.editorInstance = { state: {} };
      editorStub.getContent.mockResolvedValue('body');
      const first = await asm.assemble({ instruction: 'sys', noteId: 'n.md' });
      asm.invalidate();
      editorStub.getContent.mockResolvedValue('NEWBODY');
      const second = await asm.assemble({ instruction: 'sys', noteId: 'n.md' });
      expect(second).not.toBe(first);
      expect(second).toContain('NEWBODY');
    });

    it('invalidateNote() drops only that note', async () => {
      editorStub.editorInstance = { state: {} };
      editorStub.getContent.mockResolvedValue('a');
      await asm.assemble({ instruction: 'sys', noteId: 'keep.md' });
      await asm.assemble({ instruction: 'sys', noteId: 'drop.md' });
      asm.invalidateNote('drop.md');
      editorStub.getContent.mockResolvedValue('b');
      const keep = await asm.assemble({ instruction: 'sys', noteId: 'keep.md' });
      const drop = await asm.assemble({ instruction: 'sys', noteId: 'drop.md' });
      expect(keep).toContain('a'); // still cached
      expect(drop).toContain('b'); // rebuilt
    });
  });

  it('exposes per-surface budgets and a shared singleton', () => {
    expect(SURFACE_BUDGETS.ambient).toBe(512);
    expect(SURFACE_BUDGETS.agent).toBe(16384);
    expect(contextAssembler).toBeInstanceOf(ContextAssembler);
  });
});
