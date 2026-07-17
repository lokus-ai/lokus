import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Schema } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn(() => Promise.resolve(false)),
  save: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('../../../core/sync/SyncScheduler', () => ({
  syncScheduler: { onFileSaved: vi.fn() },
}));

vi.mock('../../../core/sync/guardedWrite', () => ({
  writeFileGuarded: vi.fn(() => Promise.resolve()),
}));

import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { writeFileGuarded } from '../../../core/sync/guardedWrite';
import { useSave } from './useSave';
import { useEditorGroupStore } from '../../../stores/editorGroups';
import { useTabMetaStore, getTabMeta } from '../../../stores/tabMeta';
import { setTabModel, getTabModel, getSavedDoc } from '../../../stores/tabModels';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    text: {},
  },
});

const PATH = '/ws/original.txt';

function setupTab({ title } = {}) {
  const groupId = useEditorGroupStore.getState().focusedGroupId;
  const state = EditorState.create({ schema });
  setTabModel(groupId, PATH, state, 0);
  if (title !== undefined) {
    useTabMetaStore.getState().setTitle(groupId, PATH, title);
  }
  return { groupId, state };
}

function renderUseSave() {
  return renderHook(() =>
    useSave({ workspacePath: '/ws', graphProcessorRef: { current: null }, onRefreshFiles: vi.fn() })
  );
}

describe('useSave rename-on-title-change', () => {
  beforeEach(() => {
    useEditorGroupStore.getState().initLayout([{ path: PATH, name: 'original.txt' }], PATH);
    invoke.mockClear();
    writeFileGuarded.mockClear();
    toast.error.mockClear();
  });

  it('invokes rename_file with { path, newName } including the original extension', async () => {
    const { groupId } = setupTab({ title: 'Renamed' });
    const { result } = renderUseSave();

    await result.current.handleSave({}, PATH, groupId);

    expect(invoke).toHaveBeenCalledWith('rename_file', { path: PATH, newName: 'Renamed.txt' });
    // Tab path + metadata follow the rename, and the write goes to the new path.
    expect(writeFileGuarded).toHaveBeenCalledWith('/ws/Renamed.txt', expect.any(String));
    expect(getTabMeta(groupId, '/ws/Renamed.txt')?.title).toBe('Renamed');
    expect(getTabMeta(groupId, PATH)).toBeNull();
  });

  it('records savedDoc and clears dirty after a successful save', async () => {
    const { groupId, state } = setupTab({ title: 'Renamed' });
    useTabMetaStore.getState().setDirty(groupId, PATH, true);
    const { result } = renderUseSave();

    await result.current.handleSave({}, PATH, groupId);

    expect(getSavedDoc(groupId, '/ws/Renamed.txt')).toBe(state.doc);
    expect(getTabMeta(groupId, '/ws/Renamed.txt')?.dirty).toBe(false);
  });

  it('does not rename when the title matches the file name', async () => {
    const { groupId } = setupTab({ title: 'original' });
    const { result } = renderUseSave();

    await result.current.handleSave({}, PATH, groupId);

    expect(invoke).not.toHaveBeenCalledWith('rename_file', expect.anything());
    expect(writeFileGuarded).toHaveBeenCalledWith(PATH, expect.any(String));
  });

  it('surfaces a toast and still saves to the original path when rename fails', async () => {
    const { groupId } = setupTab({ title: 'Renamed' });
    invoke.mockImplementation((cmd) =>
      cmd === 'rename_file' ? Promise.reject(new Error('destination exists')) : Promise.resolve()
    );
    const { result } = renderUseSave();

    await result.current.handleSave({}, PATH, groupId);

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('destination exists'));
    expect(writeFileGuarded).toHaveBeenCalledWith(PATH, expect.any(String));
    expect(getTabModel(groupId, PATH)).not.toBeNull();
  });
});
