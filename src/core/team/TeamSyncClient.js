import { invoke } from '@tauri-apps/api/core';
import { supabase } from '../auth/supabase';
import { noteMutationClient } from '../notes/NoteMutationClient';
import { teamCollaboration } from '../../stores/teamCollaboration';
import { teamControlClient } from './TeamControlClient';

const REVISION_CODEC_VERSION = 1;
const REVISION_BUCKET = 'team-note-revisions';

export class TeamSyncClient {
  constructor({
    supabaseClient = supabase,
    invokeFn = invoke,
    deviceId = null,
    keyResolver = (spaceId, keyEpoch) =>
      teamControlClient.getSpaceKey(spaceId, keyEpoch),
  } = {}) {
    this.supabase = supabaseClient;
    this.invoke = invokeFn;
    this.deviceId = deviceId;
    this.keyResolver = keyResolver;
    this.pushPromise = null;
  }

  setDeviceId(deviceId) {
    this.deviceId = deviceId;
  }

  async initializeSequence(workspacePath) {
    if (!this.deviceId) throw new Error('team sync device is not initialized');
    const { data, error } = await this.supabase.rpc(
      'get_device_sequence_high_water',
      { p_device_id: this.deviceId },
    );
    if (error) throw error;
    return this.invoke('set_team_note_sequence_floor', {
      workspacePath,
      finalizedSequence: Number(data ?? 0),
    });
  }

  async shareNote({
    workspacePath,
    path,
    teamId,
    spaceId,
    permissionEpoch,
    keyEpoch,
  }) {
    if (noteMutationClient.hasDirtyPath(path)) {
      throw new Error(`save the note before sharing: ${path}`);
    }
    await this.assertSpaceWritable(spaceId);
    const opId = await this.invoke('configure_note_team_scope', {
      workspacePath,
      path,
      teamId,
      spaceId,
      permissionEpoch,
      keyEpoch,
    });
    const identity = await this.invoke('get_note_identity', {
      workspacePath,
      path,
    });
    emitTeamQueued({
      queued_for_sync: true,
      scope_kind: 'team',
      scope_id: spaceId,
      note_id: identity.note_id,
    }, workspacePath);
    try {
      const result = await this.waitForOperation(workspacePath, opId);
      if (
        typeof globalThis.dispatchEvent === 'function'
        && typeof globalThis.CustomEvent === 'function'
      ) {
        globalThis.dispatchEvent(new CustomEvent('lokus:team-note-promoted', {
          detail: { workspacePath, path },
        }));
      }
      return result;
    } catch (error) {
      if (error?.opId === opId) {
        await this.invoke('rollback_rejected_team_share', {
          workspacePath,
          opId,
        });
        globalThis.dispatchEvent?.(new CustomEvent('lokus:team-note-promoted', {
          detail: { workspacePath, path },
        }));
      }
      throw error;
    }
  }

  async moveNoteToSpace({
    workspacePath,
    path,
    teamId,
    targetSpaceId,
    permissionEpoch,
    keyEpoch,
  }) {
    if (noteMutationClient.hasDirtyPath(path)) {
      throw new Error(`save the note before moving it: ${path}`);
    }
    await this.assertSpaceWritable(targetSpaceId);
    const opId = await this.invoke('queue_team_note_space_move', {
      workspacePath,
      path,
      teamId,
      targetSpaceId,
      permissionEpoch,
      keyEpoch,
    });
    const identity = await this.invoke('get_note_identity', {
      workspacePath,
      path,
    });
    emitTeamQueued({
      queued_for_sync: true,
      scope_kind: 'team',
      scope_id: targetSpaceId,
      note_id: identity.note_id,
    }, workspacePath);
    return this.waitForOperation(workspacePath, opId);
  }

  async getConflict(workspacePath, noteId) {
    return this.invoke('get_team_note_conflict', {
      workspacePath,
      noteId,
    });
  }

  async resolveConflict(workspacePath, noteId, resolutionContent) {
    const path = await this.assertNoteClean(workspacePath, noteId);
    const unlock = noteMutationClient.lockRemotePaths([path]);
    let result;
    try {
      result = await this.invoke('resolve_team_note_conflict', {
        workspacePath,
        noteId,
        resolutionContent,
      });
    } finally {
      unlock();
    }
    if (path) noteMutationClient.acceptRemoteContent(path, resolutionContent);
    emitTeamQueued(result, workspacePath);
    return result;
  }

  async resolveRecovery(workspacePath, noteId, kind, resolutionContent) {
    const path = await this.assertNoteClean(workspacePath, noteId);
    const unlock = noteMutationClient.lockRemotePaths([path]);
    let result;
    try {
      result = await this.invoke('resolve_local_note_recovery', {
        workspacePath,
        noteId,
        kind,
        resolutionContent,
      });
    } finally {
      unlock();
    }
    if (path) noteMutationClient.acceptRemoteContent(path, resolutionContent);
    emitTeamQueued(result, workspacePath);
    return result;
  }

  async pushSpace(workspacePath, spaceId) {
    return this.pushPending(workspacePath);
  }

  async waitForOperation(workspacePath, opId) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (attempt === 0 || attempt % 4 === 0) {
        try {
          await this.pushPending(workspacePath);
        } catch (error) {
          if (error?.opId === opId) throw error;
        }
      }
      const status = await this.invoke('get_team_note_outbox_status', {
        workspacePath,
        opId,
      });
      if (status.state === 'accepted') {
        return { accepted: 1, conflicted: 0, retried: 0 };
      }
      if (status.state === 'conflicted') {
        const error = new Error('team note has a sync conflict');
        error.opId = opId;
        error.result = 'conflict';
        throw error;
      }
      if (status.state === 'rejected') {
        const error = new Error(status.last_error_code || 'team note was rejected');
        error.opId = opId;
        error.result = status.last_error_code;
        throw error;
      }
      if (globalThis.navigator?.onLine === false) {
        return { accepted: 0, conflicted: 0, retried: 0, queued: 1 };
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return { accepted: 0, conflicted: 0, retried: 0, queued: 1 };
  }

  async pushPending(workspacePath) {
    if (this.pushPromise) return this.pushPromise;
    this.pushPromise = this.runPushPending(workspacePath)
      .finally(() => {
        this.pushPromise = null;
      });
    return this.pushPromise;
  }

  async runPushPending(workspacePath) {
    if (!this.deviceId) throw new Error('team sync device is not initialized');
    const summary = { accepted: 0, conflicted: 0, retried: 0 };
    for (let processed = 0; processed < 100; processed += 1) {
      const entries = await this.invoke('claim_next_team_note_outbox', {
        workspacePath,
        limit: 1,
      });
      if (!entries.length) break;
      const entry = entries[0];
      markSyncing(entry);
      let result;
      try {
        result = await this.pushEntry(workspacePath, entry);
      } catch (error) {
        const rejection = classifyPushRejection(error);
        if (!rejection) {
          markSyncError(entry, error);
          throw error;
        }
        result = {
          result: rejection,
          revision_id: null,
          current_head_id: null,
          action_sequence: null,
        };
      }
      await this.invoke('complete_team_note_push', {
        workspacePath,
        opId: entry.op_id,
        claimToken: entry.claim_token,
        result: result.result,
        revisionId: result.revision_id ?? result.current_head_id ?? null,
        actionSequence: result.action_sequence ?? null,
      });
      if (result.result === 'conflict') {
        markPushResult(entry, result);
        await this.materializeConflict(workspacePath, entry, result);
        await this.invoke('finalize_team_note_conflict', {
          workspacePath,
          opId: entry.op_id,
          claimToken: entry.claim_token,
        });
      } else if (result.result === 'rejected_access' || result.result === 'rejected_epoch') {
        markPushResult(entry, result);
        emitRecoveryRequired(workspacePath, entry.note_id);
        const rejection = new Error(
          result.result === 'rejected_epoch'
            ? 'team key epoch changed before upload'
            : 'team access changed before upload',
        );
        rejection.opId = entry.op_id;
        rejection.result = result.result;
        throw rejection;
      }
      markPushResult(entry, result);
      if (result.result === 'accepted') summary.accepted += 1;
      else if (result.result === 'conflict') summary.conflicted += 1;
      else summary.retried += 1;
      if (result.result === 'retry_predecessor') break;
    }
    return summary;
  }

  async pushEntry(workspacePath, entry) {
    let objectBytes;
    if (entry.encrypted_payload_base64) {
      objectBytes = fromBase64(entry.encrypted_payload_base64);
    } else {
      const key = await this.loadSpaceKey(entry.space_id, entry.key_epoch);
      const encrypted = await encryptRevision(key, entry);
      const ciphertextBase64 = await this.invoke('cache_team_note_ciphertext', {
        workspacePath,
        opId: entry.op_id,
        keyEpoch: entry.key_epoch,
        claimToken: entry.claim_token,
        ciphertextBase64: toBase64(encrypted),
      });
      objectBytes = fromBase64(ciphertextBase64);
    }
    const digest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', objectBytes),
    );
    const { data: objectKey, error: beginError } = await this.supabase.rpc(
      'begin_revision_upload',
      {
        p_op_id: entry.op_id,
        p_revision_id: entry.op_id,
        p_team_id: entry.team_id,
        p_space_id: entry.space_id,
        p_note_id: entry.note_id,
        p_device_id: this.deviceId,
        p_client_sequence: entry.client_sequence,
        p_key_epoch: entry.key_epoch,
        p_ciphertext_size: objectBytes.byteLength,
        p_ciphertext_sha256: pgBytea(digest),
        p_operation_kind: entry.operation_kind,
      },
    );
    if (beginError) {
      if (
        String(beginError.code) === '23505'
        && String(beginError.message).includes('already finalized')
      ) {
        return this.getMutationReceipt(entry.op_id);
      }
      throw beginError;
    }
    const { error: uploadError } = await this.supabase.storage
      .from(REVISION_BUCKET)
      .upload(objectKey, objectBytes, {
        contentType: 'application/octet-stream',
        upsert: false,
      });
    if (uploadError && !isAlreadyUploaded(uploadError)) throw uploadError;

    const rpcName = {
      tombstone: 'tombstone_note',
      restore: 'restore_tombstoned_note',
      move: 'move_note_to_space',
      write: 'push_note_revision',
    }[entry.operation_kind] ?? 'push_note_revision';
    const rpcArgs = entry.operation_kind === 'tombstone'
      ? {
          p_op_id: entry.op_id,
          p_expected_head_id: entry.base_revision_id,
          p_codec_version: REVISION_CODEC_VERSION,
          p_retention_expires_at: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        }
      : entry.operation_kind === 'restore'
        ? {
            p_op_id: entry.op_id,
            p_expected_tombstone_revision_id: entry.base_revision_id,
            p_codec_version: REVISION_CODEC_VERSION,
          }
      : {
          p_op_id: entry.op_id,
          p_expected_head_id: entry.base_revision_id,
          p_codec_version: REVISION_CODEC_VERSION,
        };
    const { data, error } = await this.supabase.rpc(rpcName, rpcArgs);
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.result) throw new Error(`${rpcName} returned an invalid response`);
    return {
      ...result,
      action_sequence: result.action_sequence ?? result.target_action_sequence ?? null,
    };
  }

  async getMutationReceipt(opId) {
    const { data, error } = await this.supabase.rpc('get_mutation_receipt', {
      p_device_id: this.deviceId,
      p_op_id: opId,
    });
    if (error) throw error;
    const receipt = Array.isArray(data) ? data[0] : data;
    if (!receipt?.result) throw new Error('finalized mutation receipt is missing');
    return receipt;
  }

  async pullSpace(workspacePath, teamId, spaceId) {
    if (!this.deviceId) throw new Error('team sync device is not initialized');
    let checkpoint = await this.invoke('get_team_note_checkpoint', {
      workspacePath,
      spaceId,
    });
    const summary = { applied: 0, conflicted: 0, checkpoint };
    let hasMore = true;
    while (hasMore) {
      const { data: actions, error } = await this.supabase.rpc(
        'pull_sync_actions',
        {
          p_device_id: this.deviceId,
          p_space_id: spaceId,
          p_since_sequence: checkpoint,
          p_limit: 500,
        },
      );
      if (error) throw error;
      for (const action of actions ?? []) {
        markPulling(spaceId, action.note_id);
        let decoded = { relative_path: '', content: null };
        let keyEpoch = 0;
        const currentPath = await this.assertNoteClean(workspacePath, action.note_id);
        if (action.action_type !== 'note_moved_out') {
          const revision = await this.downloadRevision(action.revision_id);
          keyEpoch = revision.key_epoch;
          const revisionSpaceId = revision.space_id ?? spaceId;
          const key = await this.loadSpaceKey(revisionSpaceId, keyEpoch);
          decoded = await decryptRevision(key, revision.bytes, {
            spaceId: revisionSpaceId,
            noteId: action.note_id,
            keyEpoch,
          });
          const absolutePath = joinPath(workspacePath, decoded.relative_path);
          if (noteMutationClient.hasDirtyPath(absolutePath)) {
            throw new Error(`dirty open note blocks team apply: ${absolutePath}`);
          }
        }
        const targetPath = decoded.relative_path
          ? joinPath(workspacePath, decoded.relative_path)
          : null;
        const unlock = noteMutationClient.lockRemotePaths([currentPath, targetPath]);
        let outcome;
        try {
          outcome = await this.invoke('apply_team_note_remote_action', {
            workspacePath,
            action: {
              actionId: action.action_id,
              actionSequence: action.action_sequence,
              actionType: action.action_type,
              noteId: action.note_id,
              revisionId: action.revision_id,
              teamId,
              spaceId,
              permissionEpoch: action.permission_epoch,
              keyEpoch,
              relativePath: decoded.relative_path,
              content: decoded.content,
            },
          });
        } finally {
          unlock();
        }
        if (decoded.relative_path && outcome.status !== 'conflict') {
          noteMutationClient.acceptRemoteContent(targetPath, decoded.content);
          if (currentPath && currentPath !== targetPath) {
            noteMutationClient.acceptRemoteContent(currentPath, decoded.content);
          }
        }
        checkpoint = action.action_sequence;
        summary.checkpoint = checkpoint;
        if (outcome.status === 'conflict') summary.conflicted += 1;
        else if (outcome.status === 'applied') summary.applied += 1;
        markPullResult(spaceId, action.note_id, outcome);
      }
      hasMore = (actions?.length ?? 0) === 500;
    }
    if (summary.checkpoint > 0) {
      const { error } = await this.supabase.rpc('report_replica_checkpoint', {
        p_device_id: this.deviceId,
        p_space_id: spaceId,
        p_last_applied_sequence: summary.checkpoint,
      });
      if (error) throw error;
    }
    return summary;
  }

  async downloadRevision(revisionId) {
    if (!revisionId) throw new Error('sync action has no revision');
    const { data: revision, error: revisionError } = await this.supabase
      .from('note_revisions')
      .select('space_id,object_key,key_epoch,ciphertext_size,ciphertext_sha256')
      .eq('id', revisionId)
      .single();
    if (revisionError) throw revisionError;
    const { data, error } = await this.supabase.storage
      .from(REVISION_BUCKET)
      .download(revision.object_key);
    if (error) throw error;
    const bytes = await binaryData(data);
    if (bytes.byteLength !== Number(revision.ciphertext_size)) {
      throw new Error('team revision ciphertext size mismatch');
    }
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    if (!equalBytes(digest, fromPgBytea(revision.ciphertext_sha256))) {
      throw new Error('team revision ciphertext hash mismatch');
    }
    return {
      bytes,
      key_epoch: revision.key_epoch,
      space_id: revision.space_id,
    };
  }

  async assertNoteClean(workspacePath, noteId) {
    const relativePath = await this.invoke('get_note_path_by_id', {
      workspacePath,
      noteId,
    });
    if (!relativePath) return null;
    const absolutePath = joinPath(workspacePath, relativePath);
    if (noteMutationClient.hasDirtyPath(absolutePath)) {
      throw new Error(`dirty open note blocks team apply: ${absolutePath}`);
    }
    return absolutePath;
  }

  async assertSpaceWritable(spaceId) {
    if (!this.deviceId) throw new Error('team sync device is not initialized');
    const { data, error } = await this.supabase.rpc('can_write_team_space', {
      p_space_id: spaceId,
      p_device_id: this.deviceId,
    });
    if (error) throw error;
    if (data !== true) throw new Error('team space is read-only');
  }

  async materializeConflict(workspacePath, entry, result) {
    const remoteRevisionId = result.current_head_id ?? result.revision_id;
    if (!remoteRevisionId) throw new Error('conflict response has no remote head');
    const remoteRevision = await this.downloadRevision(remoteRevisionId);
    const remoteSpaceId = remoteRevision.space_id ?? entry.space_id;
    const remoteKey = await this.loadSpaceKey(
      remoteSpaceId,
      remoteRevision.key_epoch,
    );
    const remote = await decryptRevision(remoteKey, remoteRevision.bytes, {
      spaceId: remoteSpaceId,
      noteId: entry.note_id,
      keyEpoch: remoteRevision.key_epoch,
    });
    let baseContent = '';
    if (entry.base_revision_id) {
      const baseRevision = await this.downloadRevision(entry.base_revision_id);
      const baseSpaceId = baseRevision.space_id ?? entry.space_id;
      const baseKey = await this.loadSpaceKey(
        baseSpaceId,
        baseRevision.key_epoch,
      );
      const base = await decryptRevision(baseKey, baseRevision.bytes, {
        spaceId: baseSpaceId,
        noteId: entry.note_id,
        keyEpoch: baseRevision.key_epoch,
      });
      baseContent = base.content;
    }
    await this.invoke('stage_team_note_conflict', {
      workspacePath,
      noteId: entry.note_id,
      baseRevisionId: entry.base_revision_id,
      baseContent,
      remoteRevisionId,
      remoteContent: remote.content,
    });
    globalThis.dispatchEvent?.(new CustomEvent('lokus:team-conflict', {
      detail: {
        workspacePath,
        noteId: entry.note_id,
      },
    }));
  }

  async loadSpaceKey(spaceId, keyEpoch) {
    const encoded = await this.invoke('secure_store_get', {
      key: `space-key:${spaceId}:${keyEpoch}`,
    });
    if (!encoded) return this.keyResolver(spaceId, keyEpoch);
    const bytes = fromBase64(encoded);
    if (bytes.length !== 32) throw new Error('invalid space key');
    return bytes;
  }
}

async function encryptRevision(keyBytes, entry) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(
    `${entry.space_id}:${entry.note_id}:${entry.key_epoch}:${REVISION_CODEC_VERSION}`,
  );
  const plaintext = new TextEncoder().encode(JSON.stringify({
    version: REVISION_CODEC_VERSION,
    note_id: entry.note_id,
    relative_path: entry.relative_path,
    operation: entry.operation_kind,
    content: entry.content,
  }));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData },
    key,
    plaintext,
  ));
  const object = new Uint8Array(1 + nonce.length + ciphertext.length);
  object[0] = REVISION_CODEC_VERSION;
  object.set(nonce, 1);
  object.set(ciphertext, 13);
  return object;
}

async function decryptRevision(keyBytes, objectBytes, {
  spaceId,
  noteId,
  keyEpoch,
}) {
  if (objectBytes[0] !== REVISION_CODEC_VERSION || objectBytes.length < 30) {
    throw new Error('unsupported team revision codec');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const nonce = objectBytes.slice(1, 13);
  const additionalData = new TextEncoder().encode(
    `${spaceId}:${noteId}:${keyEpoch}:${REVISION_CODEC_VERSION}`,
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, additionalData },
    key,
    objectBytes.slice(13),
  );
  const decoded = JSON.parse(new TextDecoder().decode(plaintext));
  if (
    decoded.version !== REVISION_CODEC_VERSION
    || decoded.note_id !== noteId
    || typeof decoded.relative_path !== 'string'
    || typeof decoded.content !== 'string'
  ) {
    throw new Error('invalid team revision payload');
  }
  return decoded;
}

function isAlreadyUploaded(error) {
  return String(error?.statusCode ?? error?.status ?? '') === '409';
}

function classifyPushRejection(error) {
  if (
    String(error?.code) !== '42501'
    && String(error?.statusCode ?? error?.status) !== '403'
  ) {
    return null;
  }
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('epoch') || message.includes('key')
    ? 'rejected_epoch'
    : 'rejected_access';
}

function pgBytea(bytes) {
  return `\\x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromPgBytea(value) {
  if (value instanceof Uint8Array) return value;
  if (typeof value !== 'string' || !value.startsWith('\\x')) {
    throw new Error('invalid bytea value');
  }
  const hex = value.slice(2);
  if (hex.length % 2 !== 0) throw new Error('invalid bytea value');
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function binaryData(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value?.arrayBuffer === 'function') {
    return new Uint8Array(await value.arrayBuffer());
  }
  throw new Error('invalid revision download');
}

function equalBytes(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function joinPath(parent, child) {
  const separator = parent.includes('\\') ? '\\' : '/';
  return `${parent.replace(/[\\/]+$/, '')}${separator}${child.replace(/^[\\/]+/, '')}`;
}

function emitTeamQueued(result, workspacePath) {
  if (
    !result?.queued_for_sync
    || result.scope_kind !== 'team'
    || !result.scope_id
    || typeof globalThis.dispatchEvent !== 'function'
    || typeof globalThis.CustomEvent !== 'function'
  ) {
    return;
  }
  const current = teamCollaboration.get(result.scope_id, result.note_id);
  teamCollaboration.update(result.scope_id, result.note_id, {
    syncState: globalThis.navigator?.onLine === false ? 'offline' : 'idle',
    outboxCount: current.outboxCount + 1,
  });
  globalThis.dispatchEvent(new CustomEvent('lokus:team-note-queued', {
    detail: {
      workspacePath,
      spaceId: result.scope_id,
      noteId: result.note_id,
    },
  }));
}

function markSyncing(entry) {
  const current = teamCollaboration.get(entry.space_id, entry.note_id);
  teamCollaboration.update(entry.space_id, entry.note_id, {
    syncState: 'syncing',
    outboxCount: Math.max(1, current.outboxCount),
  });
}

function markSyncError(entry) {
  const current = teamCollaboration.get(entry.space_id, entry.note_id);
  teamCollaboration.update(entry.space_id, entry.note_id, {
    syncState: globalThis.navigator?.onLine === false ? 'offline' : 'error',
    outboxCount: Math.max(1, current.outboxCount),
  });
}

function markPushResult(entry, result) {
  const current = teamCollaboration.get(entry.space_id, entry.note_id);
  if (result.result === 'accepted') {
    const outboxCount = Math.max(0, current.outboxCount - 1);
    teamCollaboration.update(entry.space_id, entry.note_id, {
      syncState: outboxCount ? 'idle' : 'synced',
      outboxCount,
      lastSyncedAt: Date.now(),
    });
    return;
  }
  if (result.result === 'conflict') {
    teamCollaboration.update(entry.space_id, entry.note_id, {
      syncState: 'conflict',
      outboxCount: Math.max(1, current.outboxCount),
    });
    return;
  }
  if (result.result === 'rejected_epoch') {
    teamCollaboration.update(entry.space_id, entry.note_id, {
      syncState: 'key_pending',
      outboxCount: Math.max(1, current.outboxCount),
    });
    return;
  }
  if (result.result === 'rejected_access') {
    teamCollaboration.update(entry.space_id, entry.note_id, {
      syncState: 'error',
      outboxCount: Math.max(1, current.outboxCount),
    });
  }
}

function markPulling(spaceId, noteId) {
  teamCollaboration.update(spaceId, noteId, { syncState: 'syncing' });
}

function markPullResult(spaceId, noteId, outcome) {
  teamCollaboration.update(spaceId, noteId, {
    syncState: outcome.status === 'conflict' ? 'conflict' : 'synced',
    lastSyncedAt: Date.now(),
  });
  if (outcome.status === 'applied') {
    globalThis.dispatchEvent?.(new CustomEvent('lokus:team-note-applied', {
      detail: { spaceId, noteId },
    }));
  }
}

function emitRecoveryRequired(workspacePath, noteId) {
  if (
    typeof globalThis.dispatchEvent !== 'function'
    || typeof globalThis.CustomEvent !== 'function'
  ) {
    return;
  }
  globalThis.dispatchEvent(new CustomEvent('lokus:team-conflict', {
    detail: { workspacePath, noteId },
  }));
}

export const teamSyncClient = new TeamSyncClient();
