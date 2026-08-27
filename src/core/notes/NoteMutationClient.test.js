import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));
vi.mock('../sync/guardedWrite', () => ({
  writeFileGuarded: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { writeFileGuarded } from '../sync/guardedWrite';
import { NoteMutationClient, isSupportedNotePath } from './NoteMutationClient';
import { useTabMetaStore } from '../../stores/tabMeta';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { registerEditor } from '../../stores/editorRegistry';

describe('NoteMutationClient', () => {
  beforeEach(() => {
    invoke.mockReset();
    writeFileGuarded.mockReset();
    useTabMetaStore.getState().clearAll();
  });

  it('classifies only supported note formats', () => {
    expect(isSupportedNotePath('/vault/a.md')).toBe(true);
    expect(isSupportedNotePath('/vault/a.markdown')).toBe(true);
    expect(isSupportedNotePath('/vault/a.txt')).toBe(true);
    expect(isSupportedNotePath('/vault/a.kanban')).toBe(false);
  });

  it('preserves the legacy guarded writer while the foundation flag is off', async () => {
    const client = new NoteMutationClient({ foundationEnabled: () => false });

    const result = await client.writeNote({
      workspacePath: '/vault',
      path: '/vault/note.md',
      content: 'hello',
      source: 'editor',
    });

    expect(writeFileGuarded).toHaveBeenCalledWith('/vault/note.md', 'hello');
    expect(invoke).not.toHaveBeenCalled();
    expect(result).toEqual({ legacy: true });
  });

  it('uses stable identity generation when the foundation flag is on', async () => {
    const client = new NoteMutationClient({ foundationEnabled: () => true });
    invoke
      .mockResolvedValueOnce({ note_id: 'note-1', local_generation: 4 })
      .mockResolvedValueOnce({
        op_id: 'op-1',
        note_id: 'note-1',
        local_generation: 5,
        queued_for_sync: false,
      });

    const result = await client.writeNote({
      workspacePath: '/vault',
      path: '/vault/note.md',
      content: 'hello',
      source: 'editor',
    });

    expect(invoke).toHaveBeenNthCalledWith(1, 'get_note_identity', {
      workspacePath: '/vault',
      path: '/vault/note.md',
    });
    expect(invoke).toHaveBeenNthCalledWith(2, 'write_note_content', {
      workspacePath: '/vault',
      path: '/vault/note.md',
      content: 'hello',
      expectedLocalGeneration: 4,
      source: 'editor',
    });
    expect(result.local_generation).toBe(5);
    expect(writeFileGuarded).not.toHaveBeenCalled();
  });

  it('emits the team scope after a durable local mutation queues', async () => {
    const client = new NoteMutationClient({ foundationEnabled: () => true });
    invoke
      .mockResolvedValueOnce({ note_id: 'note-1', local_generation: 4 })
      .mockResolvedValueOnce({
        op_id: 'op-1',
        note_id: 'note-1',
        local_generation: 5,
        queued_for_sync: true,
        scope_kind: 'team',
        scope_id: 'space-1',
      });
    const listener = vi.fn();
    window.addEventListener('lokus:team-note-queued', listener, { once: true });

    await client.writeNote({
      workspacePath: '/vault',
      path: '/vault/note.md',
      content: 'hello',
      source: 'editor-save',
    });

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      detail: {
        workspacePath: '/vault',
        spaceId: 'space-1',
        noteId: 'note-1',
      },
    }));
  });

  it('routes rename intent through one interface', async () => {
    const client = new NoteMutationClient();
    invoke.mockResolvedValue('/vault/Renamed.md');

    await expect(client.renameNote('/vault/note.md', 'Renamed.md'))
      .resolves.toBe('/vault/Renamed.md');
    expect(invoke).toHaveBeenCalledWith('rename_file', {
      path: '/vault/note.md',
      newName: 'Renamed.md',
    });
  });

  it('durably relocates a renamed note when the foundation is enabled', async () => {
    const client = new NoteMutationClient({ foundationEnabled: () => true });
    invoke.mockResolvedValue({ note_id: 'note-1', local_generation: 2 });

    await expect(client.renameNote(
      '/vault/note.md',
      'Renamed.md',
      { workspacePath: '/vault' },
    )).resolves.toBe('/vault/Renamed.md');

    expect(invoke).toHaveBeenCalledWith('relocate_note_content', {
      workspacePath: '/vault',
      sourcePath: '/vault/note.md',
      targetPath: '/vault/Renamed.md',
      mutationKind: 'rename',
      source: 'file-tree-rename',
    });
  });

  it('rejects a split-pane save whose loaded base is stale', async () => {
    const client = new NoteMutationClient({ foundationEnabled: () => false });

    await client.writeNote({
      workspacePath: '/vault',
      path: '/vault/note.md',
      content: 'pane A',
      baseContent: 'original',
      source: 'editor',
    });

    await expect(client.writeNote({
      workspacePath: '/vault',
      path: '/vault/note.md',
      content: 'pane B',
      baseContent: 'original',
      source: 'editor',
    })).rejects.toThrow('stale note session');
    expect(writeFileGuarded).toHaveBeenCalledTimes(1);
  });

  it('creates a new stable note when no identity exists yet', async () => {
    const client = new NoteMutationClient({ foundationEnabled: () => true });
    invoke
      .mockRejectedValueOnce(new Error('note identity not found'))
      .mockResolvedValueOnce({ created: 0, reused: 0 })
      .mockRejectedValueOnce(new Error('note identity not found'))
      .mockResolvedValueOnce({
        op_id: 'op-create',
        note_id: 'note-create',
        local_generation: 1,
        queued_for_sync: false,
      });

    const result = await client.writeNote({
      workspacePath: '/vault',
      path: '/vault/new.md',
      content: '# New',
      source: 'daily-note',
    });

    expect(invoke).toHaveBeenNthCalledWith(2, 'initialize_note_engine', {
      workspacePath: '/vault',
    });
    expect(invoke).toHaveBeenNthCalledWith(3, 'get_note_identity', {
      workspacePath: '/vault',
      path: '/vault/new.md',
    });
    expect(invoke).toHaveBeenNthCalledWith(4, 'create_note_content', {
      workspacePath: '/vault',
      path: '/vault/new.md',
      content: '# New',
      source: 'daily-note',
    });
    expect(result.note_id).toBe('note-create');
  });

  it('backfills an unindexed existing file before using a generation write', async () => {
    const client = new NoteMutationClient({ foundationEnabled: () => true });
    invoke
      .mockRejectedValueOnce(new Error('query returned no rows'))
      .mockResolvedValueOnce({ created: 1, reused: 0 })
      .mockResolvedValueOnce({ note_id: 'adopted-note', local_generation: 0 })
      .mockResolvedValueOnce({
        op_id: 'op-write',
        note_id: 'adopted-note',
        local_generation: 1,
        queued_for_sync: false,
      });

    const result = await client.writeNote({
      workspacePath: '/vault',
      path: '/vault/finder-drop.md',
      content: 'edited after import',
      source: 'editor-save',
    });

    expect(invoke).toHaveBeenNthCalledWith(2, 'initialize_note_engine', {
      workspacePath: '/vault',
    });
    expect(invoke).toHaveBeenNthCalledWith(3, 'get_note_identity', {
      workspacePath: '/vault',
      path: '/vault/finder-drop.md',
    });
    expect(invoke).toHaveBeenNthCalledWith(4, 'write_note_content', {
      workspacePath: '/vault',
      path: '/vault/finder-drop.md',
      content: 'edited after import',
      expectedLocalGeneration: 0,
      source: 'editor-save',
    });
    expect(invoke).not.toHaveBeenCalledWith('create_note_content', expect.anything());
    expect(result.note_id).toBe('adopted-note');
  });

  it('does not turn an arbitrary identity lookup failure into a create', async () => {
    const client = new NoteMutationClient({ foundationEnabled: () => true });
    invoke.mockRejectedValue(new Error('note engine is not initialized for workspace'));

    await expect(client.writeNote({
      workspacePath: '/vault',
      path: '/vault/note.md',
      content: 'content',
      source: 'editor-save',
    })).rejects.toThrow('note engine is not initialized');

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('get_note_identity', {
      workspacePath: '/vault',
      path: '/vault/note.md',
    });
  });

  it('blocks non-editor writers while any pane has unsaved changes', async () => {
    const client = new NoteMutationClient({ foundationEnabled: () => false });
    useTabMetaStore.getState().setDirty('group-1', '/vault/note.md', true);

    await expect(client.writeNote({
      workspacePath: '/vault',
      path: '/vault/note.md',
      content: 'plugin content',
      source: 'plugin',
    })).rejects.toThrow('open dirty tab');
    expect(writeFileGuarded).not.toHaveBeenCalled();
  });

  it('uses an explicit tombstone instead of deleting a foundation note', async () => {
    const client = new NoteMutationClient({ foundationEnabled: () => true });
    invoke.mockResolvedValue({ note_id: 'note-1', local_generation: 2 });

    await client.removeNote({
      workspacePath: '/vault',
      path: '/vault/note.md',
      source: 'file-tree-delete',
    });

    expect(invoke).toHaveBeenCalledWith('tombstone_note_content', {
      workspacePath: '/vault',
      path: '/vault/note.md',
      source: 'file-tree-delete',
    });
    expect(invoke).not.toHaveBeenCalledWith('delete_file', expect.anything());
  });

  it('routes note moves through the same interface', async () => {
    const client = new NoteMutationClient();
    invoke.mockResolvedValue(undefined);

    const result = await client.moveNote('/vault/note.md', '/vault/archive');

    expect(invoke).toHaveBeenCalledWith('move_file', {
      sourcePath: '/vault/note.md',
      destinationDir: '/vault/archive',
    });
    expect(result).toBe('/vault/archive/note.md');
  });

  it('durably relocates a moved note when the foundation is enabled', async () => {
    const client = new NoteMutationClient({ foundationEnabled: () => true });
    invoke.mockResolvedValue({ note_id: 'note-1', local_generation: 2 });

    const result = await client.moveNote(
      '/vault/note.md',
      '/vault/archive',
      { workspacePath: '/vault' },
    );

    expect(invoke).toHaveBeenCalledWith('relocate_note_content', {
      workspacePath: '/vault',
      sourcePath: '/vault/note.md',
      targetPath: '/vault/archive/note.md',
      mutationKind: 'move',
      source: 'file-tree-move',
    });
    expect(result).toBe('/vault/archive/note.md');
  });

  it('restores a tombstoned note through the durable lifecycle seam', async () => {
    const client = new NoteMutationClient({ foundationEnabled: () => true });
    invoke.mockResolvedValue({
      note_id: 'note-1',
      local_generation: 3,
      queued_for_sync: true,
      scope_kind: 'team',
      scope_id: 'space-1',
    });

    const result = await client.restoreNote({
      workspacePath: '/vault',
      noteId: 'note-1',
    });

    expect(invoke).toHaveBeenCalledWith('restore_note_content', {
      workspacePath: '/vault',
      noteId: 'note-1',
      source: 'user-restore',
    });
    expect(result.local_generation).toBe(3);
  });

  it('keeps overlapping remote path locks until every owner releases', () => {
    useEditorGroupStore.getState().initLayout([
      { path: '/vault/note.md', name: 'note.md' },
    ], '/vault/note.md');
    const groupId = useEditorGroupStore.getState().focusedGroupId;
    const editable = () => true;
    const editor = { props: { editable }, setProps: vi.fn() };
    registerEditor(groupId, editor);
    const client = new NoteMutationClient();

    const unlockA = client.lockRemotePaths(['/vault/note.md']);
    const unlockB = client.lockRemotePaths(['/vault/note.md']);
    expect(client.isRemotePathLocked('/vault/note.md')).toBe(true);
    unlockA();
    expect(client.isRemotePathLocked('/vault/note.md')).toBe(true);
    unlockB();
    expect(client.isRemotePathLocked('/vault/note.md')).toBe(false);
    expect(editor.setProps).toHaveBeenCalledWith({ editable });
    expect(editor.setProps).toHaveBeenCalledTimes(4);
    registerEditor(groupId, null);
  });
});
