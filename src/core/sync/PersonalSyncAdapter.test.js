import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../notes/NoteMutationClient', () => ({
  isSupportedNotePath: (path) => /\.(md|markdown|txt)$/i.test(path),
  noteMutationClient: {
    hasDirtyPath: vi.fn(() => false),
    acceptRemoteContent: vi.fn(),
  },
}));

import { invoke } from '@tauri-apps/api/core';
import { noteMutationClient } from '../notes/NoteMutationClient';
import { PersonalSyncAdapter } from './PersonalSyncAdapter';

describe('PersonalSyncAdapter', () => {
  beforeEach(() => {
    invoke.mockReset();
    noteMutationClient.hasDirtyPath.mockReset().mockReturnValue(false);
    noteMutationClient.acceptRemoteContent.mockReset();
  });

  it('keeps legacy writes while the foundation is disabled', async () => {
    const adapter = new PersonalSyncAdapter({ foundationEnabled: () => false });

    await adapter.applyTextFile({
      workspacePath: '/vault',
      workspaceId: 'workspace-1',
      path: '/vault/note.md',
      content: 'remote',
      remoteRevisionId: 'hash-1',
    });

    expect(invoke).toHaveBeenCalledWith('write_file_content', {
      path: '/vault/note.md',
      content: 'remote',
    });
  });

  it('applies remote notes without creating a local outbox echo', async () => {
    const adapter = new PersonalSyncAdapter({ foundationEnabled: () => true });
    invoke.mockResolvedValue({ queued_for_sync: false });

    await adapter.applyTextFile({
      workspacePath: '/vault',
      workspaceId: 'workspace-1',
      path: '/vault/note.md',
      content: 'remote',
      remoteRevisionId: 'hash-1',
    });

    expect(invoke).toHaveBeenNthCalledWith(1, 'initialize_note_engine', {
      workspacePath: '/vault',
    });
    expect(invoke).toHaveBeenNthCalledWith(3, 'apply_remote_note_content', {
      workspacePath: '/vault',
      path: '/vault/note.md',
      content: 'remote',
      personalScopeId: 'workspace-1',
      remoteRevisionId: 'hash-1',
      remoteSequence: null,
    });
    expect(noteMutationClient.acceptRemoteContent).toHaveBeenCalledWith(
      '/vault/note.md',
      'remote',
    );
  });

  it('never overwrites a dirty open note', async () => {
    const adapter = new PersonalSyncAdapter({ foundationEnabled: () => true });
    noteMutationClient.hasDirtyPath.mockReturnValue(true);

    await expect(adapter.applyTextFile({
      workspacePath: '/vault',
      workspaceId: 'workspace-1',
      path: '/vault/note.md',
      content: 'remote',
      remoteRevisionId: 'hash-1',
    })).rejects.toThrow('dirty open note');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('acknowledges successful manifest uploads in the local ledger', async () => {
    const adapter = new PersonalSyncAdapter({ foundationEnabled: () => true });
    invoke.mockResolvedValue(1);

    await adapter.acknowledgeUpload({
      workspacePath: '/vault',
      workspaceId: 'workspace-1',
      path: '/vault/note.md',
      remoteRevisionId: 'hash-2',
    });

    expect(invoke).toHaveBeenNthCalledWith(2, 'acknowledge_personal_note_sync', {
      workspacePath: '/vault',
      personalScopeId: 'workspace-1',
      path: '/vault/note.md',
      remoteRevisionId: 'hash-2',
    });
  });

  it('rejects personal ownership of an existing team note', async () => {
    const adapter = new PersonalSyncAdapter({ foundationEnabled: () => true });
    invoke
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ scope_kind: 'team' });

    await expect(adapter.applyTextFile({
      workspacePath: '/vault',
      workspaceId: 'workspace-1',
      path: '/vault/note.md',
      content: 'stale personal copy',
      remoteRevisionId: 'hash-1',
    })).rejects.toThrow('personal sync cannot own team note');
  });
});
