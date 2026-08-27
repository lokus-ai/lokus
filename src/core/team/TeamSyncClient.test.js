import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: webcrypto,
});

import { TeamSyncClient } from './TeamSyncClient';

const OP_ID = '20000000-0000-7000-8000-000000000201';

function keyBase64() {
  return btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
}

function setup({ pushResult = 'accepted', uploadError = null } = {}) {
  const entry = {
    op_id: OP_ID,
    note_id: '20000000-0000-7000-8000-000000000202',
    team_id: '20000000-0000-0000-0000-000000000203',
    space_id: '20000000-0000-0000-0000-000000000204',
    permission_epoch: 1,
    key_epoch: 1,
    client_sequence: 1,
    base_revision_id: null,
    relative_path: 'Projects/Secret.md',
    operation_kind: 'write',
    content: 'private team body',
    encrypted_payload_base64: null,
    claim_token: 'claim-1',
  };
  let terminal = false;
  let terminalState = 'pending';
  let lastErrorCode = null;
  const invokeFn = vi.fn(async (command, args) => {
    if (command === 'claim_next_team_note_outbox') return terminal ? [] : [entry];
    if (command === 'cache_team_note_ciphertext') {
      entry.encrypted_payload_base64 = args.ciphertextBase64;
      return args.ciphertextBase64;
    }
    if (command === 'secure_store_get') return keyBase64();
    if (command === 'get_note_path_by_id') return entry.relative_path;
    if (command === 'complete_team_note_push') {
      if (args.result !== 'conflict') {
        terminal = true;
        terminalState = args.result === 'accepted' ? 'accepted' : 'rejected';
        lastErrorCode = args.result === 'accepted' ? null : args.result;
      }
      return null;
    }
    if (command === 'finalize_team_note_conflict') {
      terminal = true;
      terminalState = 'conflicted';
      return null;
    }
    if (command === 'configure_note_team_scope') return OP_ID;
    if (command === 'rollback_rejected_team_share') {
      terminal = true;
      return null;
    }
    if (command === 'get_team_note_outbox_status') {
      return { state: terminalState, last_error_code: lastErrorCode };
    }
    throw new Error(`unexpected command ${command}: ${JSON.stringify(args)}`);
  });
  const rpc = vi.fn(async (name) => {
    if (name === 'can_write_team_space') return { data: true, error: null };
    if (name === 'begin_revision_upload') {
      return {
        data: `spaces/${entry.space_id}/notes/${entry.note_id}/revisions/${OP_ID}.bin`,
        error: null,
      };
    }
    if (name === 'push_note_revision') {
      return {
        data: [{
          result: pushResult,
          revision_id: pushResult === 'accepted' ? OP_ID : 'remote-head',
          action_sequence: pushResult === 'accepted' ? 8 : null,
          current_head_id: pushResult === 'accepted' ? OP_ID : 'remote-head',
        }],
        error: null,
      };
    }
    throw new Error(`unexpected RPC ${name}`);
  });
  const upload = vi.fn().mockResolvedValue({ data: null, error: uploadError });
  const supabaseClient = {
    rpc,
    storage: { from: vi.fn(() => ({ upload })) },
  };
  return { entry, invokeFn, rpc, upload, supabaseClient };
}

describe('TeamSyncClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('encrypts and uploads a claimed local snapshot before CAS push', async () => {
    const deps = setup();
    const client = new TeamSyncClient({
      supabaseClient: deps.supabaseClient,
      invokeFn: deps.invokeFn,
      deviceId: '20000000-0000-0000-0000-000000000205',
    });
    const result = await client.pushSpace('/workspace', deps.entry.space_id);

    expect(result).toEqual({ accepted: 1, conflicted: 0, retried: 0 });
    expect(deps.rpc.mock.calls.map(([name]) => name)).toEqual([
      'begin_revision_upload',
      'push_note_revision',
    ]);
    const uploaded = deps.upload.mock.calls[0][1];
    expect(uploaded).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(uploaded)).not.toContain('private team body');
    expect(deps.invokeFn).toHaveBeenCalledWith('complete_team_note_push', {
      workspacePath: '/workspace',
      opId: OP_ID,
      claimToken: 'claim-1',
      result: 'accepted',
      revisionId: OP_ID,
      actionSequence: 8,
    });
  });

  it('pushes the initial encrypted snapshot when a local note is shared', async () => {
    const deps = setup();
    const client = new TeamSyncClient({
      supabaseClient: deps.supabaseClient,
      invokeFn: deps.invokeFn,
      deviceId: '20000000-0000-0000-0000-000000000205',
    });

    const result = await client.shareNote({
      workspacePath: '/workspace',
      path: '/workspace/Projects/Secret.md',
      teamId: deps.entry.team_id,
      spaceId: deps.entry.space_id,
      permissionEpoch: 1,
      keyEpoch: 1,
    });

    expect(result.accepted).toBe(1);
    expect(deps.invokeFn).toHaveBeenCalledWith('configure_note_team_scope', {
      workspacePath: '/workspace',
      path: '/workspace/Projects/Secret.md',
      teamId: deps.entry.team_id,
      spaceId: deps.entry.space_id,
      permissionEpoch: 1,
      keyEpoch: 1,
    });
  });

  it('rolls a note back when authoritative share upload is rejected', async () => {
    const deps = setup();
    deps.rpc.mockImplementation(async (name) => {
      if (name === 'can_write_team_space') return { data: true, error: null };
      return {
        data: null,
        error: { code: '42501', message: 'space editor role required' },
      };
    });
    const client = new TeamSyncClient({
      supabaseClient: deps.supabaseClient,
      invokeFn: deps.invokeFn,
      deviceId: '20000000-0000-0000-0000-000000000205',
    });

    await expect(client.shareNote({
      workspacePath: '/workspace',
      path: '/workspace/Projects/Secret.md',
      teamId: deps.entry.team_id,
      spaceId: deps.entry.space_id,
      permissionEpoch: 1,
      keyEpoch: 1,
    })).rejects.toThrow('team access changed');

    expect(deps.invokeFn).toHaveBeenCalledWith('rollback_rejected_team_share', {
      workspacePath: '/workspace',
      opId: OP_ID,
    });
  });

  it('preserves a conflicting local branch through the Rust completion seam', async () => {
    const deps = setup({ pushResult: 'conflict' });
    const client = new TeamSyncClient({
      supabaseClient: deps.supabaseClient,
      invokeFn: deps.invokeFn,
      deviceId: '20000000-0000-0000-0000-000000000205',
    });
    const materialize = vi.spyOn(client, 'materializeConflict').mockResolvedValue();

    const result = await client.pushSpace('/workspace', deps.entry.space_id);

    expect(result).toEqual({ accepted: 0, conflicted: 1, retried: 0 });
    expect(deps.invokeFn).toHaveBeenCalledWith('complete_team_note_push', expect.objectContaining({
      result: 'conflict',
      revisionId: 'remote-head',
    }));
    expect(materialize).toHaveBeenCalledWith(
      '/workspace',
      deps.entry,
      expect.objectContaining({ current_head_id: 'remote-head' }),
    );
  });

  it('treats an immutable-object duplicate as an idempotent retry', async () => {
    const deps = setup({ uploadError: { statusCode: '409', message: 'already exists' } });
    const client = new TeamSyncClient({
      supabaseClient: deps.supabaseClient,
      invokeFn: deps.invokeFn,
      deviceId: '20000000-0000-0000-0000-000000000205',
    });

    const result = await client.pushSpace('/workspace', deps.entry.space_id);

    expect(result.accepted).toBe(1);
    expect(deps.rpc).toHaveBeenCalledWith('push_note_revision', expect.any(Object));
  });

  it('reuses identical durable ciphertext after an interrupted upload', async () => {
    const deps = setup();
    let pushAttempts = 0;
    deps.rpc.mockImplementation(async (name) => {
      if (name === 'can_write_team_space') return { data: true, error: null };
      if (name === 'begin_revision_upload') {
        return { data: 'spaces/space-1/revision.bin', error: null };
      }
      if (name === 'push_note_revision') {
        pushAttempts += 1;
        if (pushAttempts === 1) throw new Error('connection lost');
        return {
          data: [{
            result: 'accepted',
            revision_id: OP_ID,
            action_sequence: 8,
            current_head_id: OP_ID,
          }],
          error: null,
        };
      }
      throw new Error(`unexpected RPC ${name}`);
    });
    const client = new TeamSyncClient({
      supabaseClient: deps.supabaseClient,
      invokeFn: deps.invokeFn,
      deviceId: '20000000-0000-0000-0000-000000000205',
    });

    await expect(client.pushPending('/workspace')).rejects.toThrow('connection lost');
    await client.pushPending('/workspace');

    expect(deps.upload).toHaveBeenCalledTimes(2);
    expect(deps.upload.mock.calls[0][1]).toEqual(deps.upload.mock.calls[1][1]);
  });

  it('recovers a finalized receipt when the original response was lost', async () => {
    const deps = setup();
    deps.rpc.mockImplementation(async (name) => {
      if (name === 'begin_revision_upload') {
        return {
          data: null,
          error: { code: '23505', message: 'operation is already finalized' },
        };
      }
      if (name === 'get_mutation_receipt') {
        return {
          data: [{
            result: 'accepted',
            revision_id: OP_ID,
            action_sequence: 8,
            current_head_id: OP_ID,
          }],
          error: null,
        };
      }
      throw new Error(`unexpected RPC ${name}`);
    });
    const client = new TeamSyncClient({
      supabaseClient: deps.supabaseClient,
      invokeFn: deps.invokeFn,
      deviceId: '20000000-0000-0000-0000-000000000205',
    });

    const result = await client.pushSpace('/workspace', deps.entry.space_id);

    expect(result.accepted).toBe(1);
    expect(deps.upload).not.toHaveBeenCalled();
    expect(deps.rpc).toHaveBeenCalledWith('get_mutation_receipt', {
      p_device_id: '20000000-0000-0000-0000-000000000205',
      p_op_id: OP_ID,
    });
  });

  it('turns definitive authorization loss into a preserved rejected branch', async () => {
    const deps = setup();
    deps.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'space editor role required' },
    });
    const client = new TeamSyncClient({
      supabaseClient: deps.supabaseClient,
      invokeFn: deps.invokeFn,
      deviceId: '20000000-0000-0000-0000-000000000205',
    });

    await expect(client.pushSpace('/workspace', deps.entry.space_id))
      .rejects.toThrow('team access changed');
    expect(deps.invokeFn).toHaveBeenCalledWith('complete_team_note_push', {
      workspacePath: '/workspace',
      opId: OP_ID,
      claimToken: 'claim-1',
      result: 'rejected_access',
      revisionId: null,
      actionSequence: null,
    });
  });

  it('pulls, authenticates, decrypts, and durably applies ordered actions', async () => {
    const deps = setup();
    const client = new TeamSyncClient({
      supabaseClient: deps.supabaseClient,
      invokeFn: deps.invokeFn,
      deviceId: '20000000-0000-0000-0000-000000000205',
    });
    await client.pushSpace('/workspace', deps.entry.space_id);
    const encryptedObject = deps.upload.mock.calls[0][1];
    const hash = new Uint8Array(
      await crypto.subtle.digest('SHA-256', encryptedObject),
    );
    const hashHex = `\\x${Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    const objectKey = `spaces/${deps.entry.space_id}/notes/${deps.entry.note_id}/revisions/${OP_ID}.bin`;
    deps.rpc.mockImplementation(async (name) => {
      if (name === 'pull_sync_actions') {
        return {
          data: [{
            action_id: '20000000-0000-7000-8000-000000000221',
            action_sequence: 8,
            action_type: 'note_created',
            note_id: deps.entry.note_id,
            revision_id: OP_ID,
            permission_epoch: 1,
          }],
          error: null,
        };
      }
      if (name === 'report_replica_checkpoint') return { data: 8, error: null };
      throw new Error(`unexpected RPC ${name}`);
    });
    deps.supabaseClient.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              object_key: objectKey,
              key_epoch: 1,
              ciphertext_size: encryptedObject.byteLength,
              ciphertext_sha256: hashHex,
            },
            error: null,
          }),
        })),
      })),
    }));
    deps.supabaseClient.storage.from.mockReturnValue({
      download: vi.fn().mockResolvedValue({
        data: encryptedObject,
        error: null,
      }),
    });
    deps.invokeFn.mockImplementation(async (command) => {
      if (command === 'get_team_note_checkpoint') return 7;
      if (command === 'get_note_path_by_id') return deps.entry.relative_path;
      if (command === 'secure_store_get') return keyBase64();
      if (command === 'apply_team_note_remote_action') {
        return { status: 'applied', relative_path: deps.entry.relative_path };
      }
      throw new Error(`unexpected command ${command}`);
    });

    const result = await client.pullSpace(
      '/workspace',
      deps.entry.team_id,
      deps.entry.space_id,
    );

    expect(result).toEqual({ applied: 1, conflicted: 0, checkpoint: 8 });
    expect(deps.invokeFn).toHaveBeenCalledWith('apply_team_note_remote_action', {
      workspacePath: '/workspace',
      action: expect.objectContaining({
        noteId: deps.entry.note_id,
        relativePath: deps.entry.relative_path,
        content: deps.entry.content,
      }),
    });
    expect(deps.rpc).toHaveBeenCalledWith('report_replica_checkpoint', {
      p_device_id: '20000000-0000-0000-0000-000000000205',
      p_space_id: deps.entry.space_id,
      p_last_applied_sequence: 8,
    });
  });

  it('applies content-free moved-out actions without requesting a revision object', async () => {
    const invokeFn = vi.fn(async (command) => {
      if (command === 'get_team_note_checkpoint') return 4;
      if (command === 'get_note_path_by_id') return 'Shared/note.md';
      if (command === 'apply_team_note_remote_action') {
        return { status: 'applied', relative_path: 'Shared/note.md' };
      }
      throw new Error(`unexpected command ${command}`);
    });
    const rpc = vi.fn(async (name) => {
      if (name === 'pull_sync_actions') {
        return {
          data: [{
            action_id: '20000000-0000-7000-8000-000000000231',
            action_sequence: 5,
            action_type: 'note_moved_out',
            note_id: '20000000-0000-7000-8000-000000000232',
            revision_id: null,
            permission_epoch: 2,
          }],
          error: null,
        };
      }
      if (name === 'report_replica_checkpoint') return { data: 5, error: null };
      throw new Error(`unexpected RPC ${name}`);
    });
    const supabaseClient = {
      rpc,
      from: vi.fn(),
      storage: { from: vi.fn() },
    };
    const client = new TeamSyncClient({
      supabaseClient,
      invokeFn,
      deviceId: '20000000-0000-0000-0000-000000000205',
    });

    const result = await client.pullSpace('/workspace', 'team-1', 'space-1');

    expect(result.checkpoint).toBe(5);
    expect(supabaseClient.from).not.toHaveBeenCalled();
    expect(invokeFn).toHaveBeenCalledWith('apply_team_note_remote_action', {
      workspacePath: '/workspace',
      action: {
        actionId: '20000000-0000-7000-8000-000000000231',
        actionSequence: 5,
        actionType: 'note_moved_out',
        noteId: '20000000-0000-7000-8000-000000000232',
        revisionId: null,
        teamId: 'team-1',
        spaceId: 'space-1',
        permissionEpoch: 2,
        keyEpoch: 0,
        relativePath: '',
        content: null,
      },
    });
  });

  it('uses the atomic lifecycle RPC for queued cross-space moves', async () => {
    const deps = setup();
    deps.entry.operation_kind = 'move';
    deps.rpc.mockImplementation(async (name) => {
      if (name === 'begin_revision_upload') {
        return { data: 'spaces/target/revision.bin', error: null };
      }
      if (name === 'move_note_to_space') {
        return {
          data: [{
            result: 'accepted',
            revision_id: OP_ID,
            source_action_sequence: 4,
            target_action_sequence: 9,
            current_head_id: OP_ID,
          }],
          error: null,
        };
      }
      throw new Error(`unexpected RPC ${name}`);
    });
    const client = new TeamSyncClient({
      supabaseClient: deps.supabaseClient,
      invokeFn: deps.invokeFn,
      deviceId: '20000000-0000-0000-0000-000000000205',
    });

    const result = await client.pushSpace('/workspace', deps.entry.space_id);

    expect(result.accepted).toBe(1);
    expect(deps.rpc).toHaveBeenCalledWith('move_note_to_space', {
      p_op_id: OP_ID,
      p_expected_head_id: null,
      p_codec_version: 1,
    });
    expect(deps.invokeFn).toHaveBeenCalledWith('complete_team_note_push', {
      workspacePath: '/workspace',
      opId: OP_ID,
      claimToken: 'claim-1',
      result: 'accepted',
      revisionId: OP_ID,
      actionSequence: 9,
    });
  });

  it('exposes and resolves local three-snapshot conflicts', async () => {
    const invokeFn = vi.fn(async (command) => {
      if (command === 'get_team_note_conflict') {
        return [
          { kind: 'base', content: 'base' },
          { kind: 'local', content: 'local' },
          { kind: 'remote', content: 'remote' },
        ];
      }
      if (command === 'get_note_path_by_id') return 'note.md';
      if (command === 'resolve_team_note_conflict') {
        return {
          note_id: 'note-1',
          queued_for_sync: true,
          scope_kind: 'team',
          scope_id: 'space-1',
        };
      }
      throw new Error(`unexpected command ${command}`);
    });
    const client = new TeamSyncClient({
      supabaseClient: { rpc: vi.fn(), storage: { from: vi.fn() } },
      invokeFn,
      deviceId: 'device-1',
    });
    const queued = vi.fn();
    window.addEventListener('lokus:team-note-queued', queued, { once: true });

    const snapshots = await client.getConflict('/workspace', 'note-1');
    const result = await client.resolveConflict(
      '/workspace',
      'note-1',
      'merged',
    );

    expect(snapshots.map(({ kind }) => kind)).toEqual(['base', 'local', 'remote']);
    expect(result.queued_for_sync).toBe(true);
    expect(queued).toHaveBeenCalled();
  });
});
