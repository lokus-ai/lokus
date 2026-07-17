import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Schema } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../core/sync/SyncScheduler', () => ({
  syncScheduler: { onFileSaved: vi.fn() },
}));

vi.mock('../../core/sync/guardedWrite', () => ({
  writeFileGuarded: vi.fn(() => Promise.resolve()),
}));

import { writeFileGuarded } from '../../core/sync/guardedWrite';
import { saveTab, flushAllDirtyTabs, registerTabStateProvider } from './tabSaver';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { useTabMetaStore, getTabMeta } from '../../stores/tabMeta';
import { setTabModel, getTabModel, getSavedDoc } from '../../stores/tabModels';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    text: {},
  },
});

const PATH = '/ws/note.txt';

function makeState(text) {
  return EditorState.create({
    schema,
    doc: schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined)),
  });
}

// The provider EditorGroup registers on mount.
const modelProvider = (groupId) => (path) => getTabModel(groupId, path)?.state ?? null;

describe('tabSaver autosave provider wiring', () => {
  let groupId;

  beforeEach(() => {
    useEditorGroupStore.getState().initLayout([{ path: PATH, name: 'note.txt' }], PATH);
    groupId = useEditorGroupStore.getState().focusedGroupId;
    writeFileGuarded.mockClear();
  });

  afterEach(() => {
    registerTabStateProvider(groupId, null);
  });

  it('saveTab bails for a ProseMirror tab when no provider is registered', async () => {
    setTabModel(groupId, PATH, makeState('hello'), 0);
    useTabMetaStore.getState().setDirty(groupId, PATH, true);

    expect(await saveTab(groupId, PATH)).toBe(false);
    expect(writeFileGuarded).not.toHaveBeenCalled();
    expect(getTabMeta(groupId, PATH)?.dirty).toBe(true);
  });

  it('flushAllDirtyTabs is a no-op without a registered provider', async () => {
    setTabModel(groupId, PATH, makeState('hello'), 0);
    useTabMetaStore.getState().setDirty(groupId, PATH, true);

    await flushAllDirtyTabs();

    expect(writeFileGuarded).not.toHaveBeenCalled();
    expect(getTabMeta(groupId, PATH)?.dirty).toBe(true);
  });

  it('with a provider registered, flushAllDirtyTabs writes the dirty tab and clears the flag', async () => {
    const state = makeState('hello');
    setTabModel(groupId, PATH, state, 0);
    useTabMetaStore.getState().setDirty(groupId, PATH, true);
    registerTabStateProvider(groupId, modelProvider(groupId));

    await flushAllDirtyTabs();

    expect(writeFileGuarded).toHaveBeenCalledTimes(1);
    expect(writeFileGuarded).toHaveBeenCalledWith(PATH, 'hello');
    expect(getTabMeta(groupId, PATH)?.dirty).toBe(false);
    // The written doc becomes the saved doc (O(1) dirty identity stays clean).
    expect(getSavedDoc(groupId, PATH)).toBe(state.doc);
    // savedContent is kept for save-path equality checks.
    expect(getTabMeta(groupId, PATH)?.savedContent).toBe('hello');
  });

  it('skips clean tabs during a flush', async () => {
    setTabModel(groupId, PATH, makeState('hello'), 0);
    registerTabStateProvider(groupId, modelProvider(groupId));

    await flushAllDirtyTabs();

    expect(writeFileGuarded).not.toHaveBeenCalled();
  });

  it('does not rewrite when content matches savedContent', async () => {
    const state = makeState('hello');
    setTabModel(groupId, PATH, state, 0);
    useTabMetaStore.getState().setDirty(groupId, PATH, true);
    useTabMetaStore.getState().setSaved(groupId, PATH, 'hello');
    registerTabStateProvider(groupId, modelProvider(groupId));

    expect(await saveTab(groupId, PATH)).toBe(true);
    expect(writeFileGuarded).not.toHaveBeenCalled();
    expect(getTabMeta(groupId, PATH)?.dirty).toBe(false);
  });
});
