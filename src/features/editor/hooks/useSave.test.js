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

vi.mock('../../../core/notes/NoteMutationClient', () => ({
  isSupportedNotePath: (path) => /\.(md|markdown|txt)$/i.test(path),
  noteMutationClient: {
    writeNote: vi.fn(() => Promise.resolve({ legacy: true })),
    renameNote: vi.fn(() => Promise.resolve()),
  },
}));

import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import { noteMutationClient } from '../../../core/notes/NoteMutationClient';
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
    noteMutationClient.writeNote.mockClear();
    noteMutationClient.renameNote.mockClear();
    save.mockReset();
    save.mockResolvedValue(null);
    toast.error.mockClear();
  });

  it('invokes rename_file with { path, newName } including the original extension', async () => {
    const { groupId } = setupTab({ title: 'Renamed' });
    const { result } = renderUseSave();

    await result.current.handleSave({}, PATH, groupId);

    expect(noteMutationClient.renameNote).toHaveBeenCalledWith(PATH, 'Renamed.txt', {
      workspacePath: '/ws',
      source: 'editor-save',
    });
    // Tab path + metadata follow the rename, and the write goes to the new path.
    expect(noteMutationClient.writeNote).toHaveBeenCalledWith({
      workspacePath: '/ws',
      path: '/ws/Renamed.txt',
      content: expect.any(String),
      baseContent: undefined,
      source: 'editor-save',
    });
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

    expect(noteMutationClient.renameNote).not.toHaveBeenCalled();
    expect(noteMutationClient.writeNote).toHaveBeenCalledWith({
      workspacePath: '/ws',
      path: PATH,
      content: expect.any(String),
      baseContent: undefined,
      source: 'editor-save',
    });
  });

  it('surfaces a toast and still saves to the original path when rename fails', async () => {
    const { groupId } = setupTab({ title: 'Renamed' });
    noteMutationClient.renameNote.mockRejectedValueOnce(new Error('destination exists'));
    const { result } = renderUseSave();

    await result.current.handleSave({}, PATH, groupId);

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('destination exists'));
    expect(noteMutationClient.writeNote).toHaveBeenCalledWith({
      workspacePath: '/ws',
      path: PATH,
      content: expect.any(String),
      baseContent: undefined,
      source: 'editor-save',
    });
    expect(getTabModel(groupId, PATH)).not.toBeNull();
  });

  it('keeps the tab dirty and surfaces a stale-session save rejection', async () => {
    const { groupId } = setupTab({ title: 'original' });
    useTabMetaStore.getState().setDirty(groupId, PATH, true);
    noteMutationClient.writeNote.mockRejectedValueOnce(new Error('stale note session'));
    const { result } = renderUseSave();

    await result.current.handleSave({}, PATH, groupId);

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('stale note session'));
    expect(getTabMeta(groupId, PATH)?.dirty).toBe(true);
  });

  it('routes Save As note files through the universal mutation seam', async () => {
    setupTab({ title: 'original' });
    save.mockResolvedValue('/ws/copy.md');
    const { result } = renderUseSave();

    await result.current.handleSaveAs(null, PATH);

    expect(noteMutationClient.writeNote).toHaveBeenCalledWith({
      workspacePath: '/ws',
      path: '/ws/copy.md',
      content: expect.any(String),
      source: 'editor-save-as',
    });
    expect(invoke).not.toHaveBeenCalledWith(
      'write_file_content',
      expect.objectContaining({ path: '/ws/copy.md' }),
    );
  });
});
