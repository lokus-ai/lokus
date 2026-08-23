import { invoke } from '@tauri-apps/api/core';
import { supabase } from '../auth/supabase';
import { teamKeyManager } from './TeamKeyManager';

const CACHED_KEY_INDEX = 'lokus-team-cached-key-index';

export class TeamControlClient {
  constructor({
    supabaseClient = supabase,
    keyManager = teamKeyManager,
    invokeFn = invoke,
  } = {}) {
    this.supabase = supabaseClient;
    this.keyManager = keyManager;
    this.invoke = invokeFn;
    this.identity = null;
  }

  async initialize(userId) {
    this.identity = await this.keyManager.initialize(userId);
    let clientInstanceId = localStorage.getItem('lokus-team-client-instance-id');
    if (!clientInstanceId) {
      clientInstanceId = crypto.randomUUID();
      localStorage.setItem('lokus-team-client-instance-id', clientInstanceId);
    }
    const { error } = await this.supabase.rpc('register_device', {
      p_device_id: this.identity.deviceId,
      p_client_instance_id: clientInstanceId,
      p_public_key: pgBytea(this.identity.publicKey),
      p_public_key_fingerprint: pgBytea(this.identity.publicKeyFingerprint),
      p_key_algorithm: 'x25519',
    });
    if (error) throw error;
    return this.identity;
  }

  async createTeam(name) {
    this.assertInitialized();
    const teamId = crypto.randomUUID();
    const defaultSpaceId = crypto.randomUUID();
    const everyoneGroupId = crypto.randomUUID();
    const teamKey = crypto.getRandomValues(new Uint8Array(32));
    const spaceKey = crypto.getRandomValues(new Uint8Array(32));
    const [
      everyoneName,
      spaceName,
      teamEnvelope,
      spaceEnvelope,
    ] = await Promise.all([
      encryptMetadata(teamKey, 'Everyone'),
      encryptMetadata(spaceKey, 'General'),
      this.keyManager.wrapKeyForDevice(teamKey, this.identity.publicKey, {
        scopeKind: 'team',
        scopeId: teamId,
        epoch: 1,
        recipientDeviceId: this.identity.deviceId,
      }),
      this.keyManager.wrapKeyForDevice(spaceKey, this.identity.publicKey, {
        scopeKind: 'space',
        scopeId: defaultSpaceId,
        epoch: 1,
        recipientDeviceId: this.identity.deviceId,
      }),
    ]);
    const { data, error } = await this.supabase.rpc('create_team', {
      p_team_id: teamId,
      p_default_space_id: defaultSpaceId,
      p_everyone_group_id: everyoneGroupId,
      p_name: name,
      p_creator_device_id: this.identity.deviceId,
      p_everyone_name_ciphertext: pgBytea(everyoneName.ciphertext),
      p_everyone_name_nonce: pgBytea(everyoneName.nonce),
      p_space_name_ciphertext: pgBytea(spaceName.ciphertext),
      p_space_name_nonce: pgBytea(spaceName.nonce),
      p_team_wrapped_key: pgBytea(teamEnvelope.wrappedKey),
      p_team_wrapping_nonce: pgBytea(teamEnvelope.nonce),
      p_space_wrapped_key: pgBytea(spaceEnvelope.wrappedKey),
      p_space_wrapping_nonce: pgBytea(spaceEnvelope.nonce),
      p_algorithm: teamEnvelope.algorithm,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.team_id || !result?.space_id) {
      throw new Error('create_team returned an invalid response');
    }
    await Promise.all([
      this.storeContentKey(`team-key:${result.team_id}:1`, teamKey),
      this.storeContentKey(`space-key:${result.space_id}:1`, spaceKey),
    ]);
    return result;
  }

  async listTeams(userId) {
    const { data: memberships, error: membershipError } = await this.supabase
      .from('team_memberships')
      .select('team_id,role,status')
      .eq('user_id', userId)
      .neq('status', 'removed');
    if (membershipError) throw membershipError;
    const teamIds = [...new Set((memberships ?? []).map(({ team_id }) => team_id))];
    if (!teamIds.length) return [];
    const [{ data: teams, error: teamError }, { data: spaces, error: spaceError }] =
      await Promise.all([
        this.supabase
          .from('teams')
          .select('id,name,current_permission_epoch,current_key_epoch')
          .in('id', teamIds),
        this.supabase
          .from('spaces')
          .select('id,team_id,current_key_epoch')
          .in('team_id', teamIds)
          .is('deleted_at', null),
      ]);
    if (teamError) throw teamError;
    if (spaceError) throw spaceError;
    const writableByTeam = new Map(await Promise.all(teamIds.map(async (teamId) => {
      const { data, error } = await this.supabase.rpc(
        'list_writable_team_spaces',
        { p_team_id: teamId },
      );
      if (error) throw error;
      return [teamId, new Set((data ?? []).map(({ space_id }) => space_id))];
    })));
    return (teams ?? []).map((team) => ({
      ...team,
      membership: memberships.find(({ team_id }) => team_id === team.id),
      spaces: (spaces ?? []).filter(({ team_id, id }) => (
        team_id === team.id && writableByTeam.get(team.id)?.has(id)
      )),
    }));
  }

  async listTeamMembers(teamId) {
    const { data, error } = await this.supabase
      .from('team_memberships')
      .select('user_id,role,status,membership_version')
      .eq('team_id', teamId)
      .neq('status', 'removed');
    if (error) throw error;
    return data ?? [];
  }

  async createInvite({
    teamId,
    email,
    role = 'member',
    grants = [],
    expiresInDays = 7,
  }) {
    this.assertInitialized();
    if (!['member', 'admin'].includes(role)) {
      throw new Error('invite role must be member or admin');
    }
    const inviteId = crypto.randomUUID();
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = toBase64(tokenBytes)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const tokenHash = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)),
    );
    const { data, error } = await this.supabase.rpc('create_invite', {
      p_invite_id: inviteId,
      p_team_id: teamId,
      p_email: email,
      p_token_hash: pgBytea(tokenHash),
      p_role: role,
      p_expires_at: new Date(
        Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
      p_initial_grants: grants,
    });
    if (error) throw error;
    return { inviteId: data ?? inviteId, token };
  }

  async acceptInvite(inviteId, token) {
    this.assertInitialized();
    const { data, error } = await this.supabase.rpc('accept_invite', {
      p_invite_id: inviteId,
      p_token: token,
      p_device_id: this.identity.deviceId,
    });
    if (error) throw error;
    return data;
  }

  async storeContentKey(key, bytes) {
    await this.invoke('secure_store_set', {
      key,
      value: toBase64(bytes),
    });
    const index = cachedKeyIndex();
    index.add(key);
    localStorage.setItem(CACHED_KEY_INDEX, JSON.stringify([...index].sort()));
  }

  async getSpaceKey(spaceId, keyEpoch) {
    this.assertInitialized();
    const storageKey = `space-key:${spaceId}:${keyEpoch}`;
    const stored = await this.invoke('secure_store_get', { key: storageKey });
    if (stored) {
      const bytes = fromBase64(stored);
      if (bytes.length !== 32) throw new Error('invalid stored space key');
      return bytes;
    }
    const { data, error: envelopeError } = await this.supabase.rpc(
      'get_recipient_key_envelope',
      {
        p_scope_kind: 'space',
        p_scope_id: spaceId,
        p_epoch: keyEpoch,
        p_recipient_device_id: this.identity.deviceId,
      },
    );
    if (envelopeError) throw envelopeError;
    const envelope = Array.isArray(data) ? data[0] : data;
    if (!envelope) throw new Error(`space key epoch ${keyEpoch} is awaiting provisioning`);
    const key = await this.keyManager.unwrapKeyEnvelope(
      {
        wrappedKey: fromPgBytea(envelope.wrapped_key),
        nonce: fromPgBytea(envelope.wrapping_nonce),
        algorithm: envelope.algorithm,
      },
      fromPgBytea(envelope.sender_public_key),
      {
        scopeKind: 'space',
        scopeId: spaceId,
        epoch: keyEpoch,
        senderDeviceId: envelope.sender_device_id,
      },
    );
    if (key.length !== 32) throw new Error('invalid unwrapped space key');
    await this.storeContentKey(storageKey, key);
    return key;
  }

  async getTeamKey(teamId, keyEpoch) {
    this.assertInitialized();
    const storageKey = `team-key:${teamId}:${keyEpoch}`;
    const stored = await this.invoke('secure_store_get', { key: storageKey });
    if (stored) {
      const bytes = fromBase64(stored);
      if (bytes.length !== 32) throw new Error('invalid stored team key');
      return bytes;
    }
    const { data, error: envelopeError } = await this.supabase.rpc(
      'get_recipient_key_envelope',
      {
        p_scope_kind: 'team',
        p_scope_id: teamId,
        p_epoch: keyEpoch,
        p_recipient_device_id: this.identity.deviceId,
      },
    );
    if (envelopeError) throw envelopeError;
    const envelope = Array.isArray(data) ? data[0] : data;
    if (!envelope) throw new Error(`team key epoch ${keyEpoch} is awaiting provisioning`);
    const key = await this.keyManager.unwrapKeyEnvelope(
      {
        wrappedKey: fromPgBytea(envelope.wrapped_key),
        nonce: fromPgBytea(envelope.wrapping_nonce),
        algorithm: envelope.algorithm,
      },
      fromPgBytea(envelope.sender_public_key),
      {
        scopeKind: 'team',
        scopeId: teamId,
        epoch: keyEpoch,
        senderDeviceId: envelope.sender_device_id,
      },
    );
    if (key.length !== 32) throw new Error('invalid unwrapped team key');
    await this.storeContentKey(storageKey, key);
    return key;
  }

  async provisionMemberKeys({ teamId, targetUserId, targetDeviceId }) {
    this.assertInitialized();
    const { data: plan, error: planError } = await this.supabase.rpc(
      'get_member_key_history_plan',
      {
        p_team_id: teamId,
        p_target_user_id: targetUserId,
        p_target_device_id: targetDeviceId,
      },
    );
    if (planError) throw planError;
    const targetPublicKey = fromHex(plan.target_public_key_hex);
    const teamEnvelopes = [];
    for (const epoch of plan.team_key_epochs) {
      const teamKey = await this.getTeamKey(teamId, epoch);
      const envelope = await this.keyManager.wrapKeyForDevice(
        teamKey,
        targetPublicKey,
        {
          scopeKind: 'team',
          scopeId: teamId,
          epoch,
          recipientDeviceId: targetDeviceId,
        },
      );
      teamEnvelopes.push({
        epoch,
        wrapped_key_hex: toHex(envelope.wrappedKey),
        nonce_hex: toHex(envelope.nonce),
        algorithm: envelope.algorithm,
      });
    }
    const spaceEnvelopes = [];
    for (const space of plan.spaces) {
      for (const epoch of space.key_epochs) {
        const spaceKey = await this.getSpaceKey(space.space_id, epoch);
        const envelope = await this.keyManager.wrapKeyForDevice(
          spaceKey,
          targetPublicKey,
          {
            scopeKind: 'space',
            scopeId: space.space_id,
            epoch,
            recipientDeviceId: targetDeviceId,
          },
        );
        spaceEnvelopes.push({
          space_id: space.space_id,
          epoch,
          wrapped_key_hex: toHex(envelope.wrappedKey),
          nonce_hex: toHex(envelope.nonce),
          algorithm: envelope.algorithm,
        });
      }
    }
    const { data, error } = await this.supabase.rpc('provision_member_key_history', {
      p_team_id: teamId,
      p_target_user_id: targetUserId,
      p_target_device_id: targetDeviceId,
      p_actor_device_id: this.identity.deviceId,
      p_team_envelopes: teamEnvelopes,
      p_space_envelopes: spaceEnvelopes,
    });
    if (error) throw error;
    return data;
  }

  async provisionMissingDevices(teamId) {
    this.assertInitialized();
    const { data, error } = await this.supabase.rpc(
      'list_key_provisioning_targets',
      { p_team_id: teamId },
    );
    if (error) throw error;
    const provisioned = [];
    for (const target of data ?? []) {
      if (target.target_device_id === this.identity.deviceId) continue;
      await this.provisionMemberKeys({
        teamId,
        targetUserId: target.target_user_id,
        targetDeviceId: target.target_device_id,
      });
      provisioned.push(target.target_device_id);
    }
    return provisioned;
  }

  async removeMember({ teamId, targetUserId }) {
    this.assertInitialized();
    const { data: plan, error: planError } = await this.supabase.rpc(
      'get_member_removal_key_plan',
      {
        p_team_id: teamId,
        p_target_user_id: targetUserId,
      },
    );
    if (planError) throw planError;
    const nextTeamKey = crypto.getRandomValues(new Uint8Array(32));
    const teamEnvelopes = [];
    for (const recipient of plan.team_recipients) {
      const envelope = await this.keyManager.wrapKeyForDevice(
        nextTeamKey,
        fromHex(recipient.public_key_hex),
        {
          scopeKind: 'team',
          scopeId: teamId,
          epoch: plan.next_team_key_epoch,
          recipientDeviceId: recipient.device_id,
        },
      );
      teamEnvelopes.push(recipientEnvelopeJson(recipient.device_id, envelope));
    }
    const generatedSpaceKeys = new Map();
    const spaceRotations = [];
    for (const space of plan.spaces) {
      const nextSpaceKey = crypto.getRandomValues(new Uint8Array(32));
      generatedSpaceKeys.set(space.space_id, {
        epoch: space.next_key_epoch,
        key: nextSpaceKey,
      });
      const envelopes = [];
      for (const recipient of space.recipients) {
        const envelope = await this.keyManager.wrapKeyForDevice(
          nextSpaceKey,
          fromHex(recipient.public_key_hex),
          {
            scopeKind: 'space',
            scopeId: space.space_id,
            epoch: space.next_key_epoch,
            recipientDeviceId: recipient.device_id,
          },
        );
        envelopes.push(recipientEnvelopeJson(recipient.device_id, envelope));
      }
      spaceRotations.push({ space_id: space.space_id, envelopes });
    }
    const { data, error } = await this.supabase.rpc('remove_member', {
      p_team_id: teamId,
      p_target_user_id: targetUserId,
      p_actor_device_id: this.identity.deviceId,
      p_team_envelopes: teamEnvelopes,
      p_space_rotations: spaceRotations,
    });
    if (error) throw error;
    await this.storeContentKey(
      `team-key:${teamId}:${plan.next_team_key_epoch}`,
      nextTeamKey,
    );
    for (const [spaceId, generated] of generatedSpaceKeys) {
      await this.storeContentKey(
        `space-key:${spaceId}:${generated.epoch}`,
        generated.key,
      );
    }
    return data;
  }

  async deleteCachedTeamKeys(teamId, scopes) {
    const index = cachedKeyIndex();
    const candidates = new Set(
      [...index].filter((key) => key.startsWith(`team-key:${teamId}:`)),
    );
    for (const scope of scopes) {
      const prefix = `space-key:${scope.space_id}:`;
      candidates.add(`${prefix}${scope.key_epoch}`);
      for (const key of index) {
        if (key.startsWith(prefix)) candidates.add(key);
      }
    }
    for (const key of candidates) {
      await this.invoke('secure_store_delete', { key });
      index.delete(key);
    }
    localStorage.setItem(CACHED_KEY_INDEX, JSON.stringify([...index].sort()));
  }

  assertInitialized() {
    if (!this.identity) throw new Error('team control client is not initialized');
  }
}

async function encryptMetadata(keyBytes, text) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    new TextEncoder().encode(text),
  ));
  return { ciphertext, nonce };
}

function pgBytea(bytes) {
  return `\\x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function fromPgBytea(value) {
  if (value instanceof Uint8Array) return value;
  if (typeof value !== 'string' || !/^\\x(?:[0-9a-f]{2})+$/i.test(value)) {
    throw new Error('invalid bytea value');
  }
  const hex = value.slice(2);
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function cachedKeyIndex() {
  try {
    const value = JSON.parse(localStorage.getItem(CACHED_KEY_INDEX) ?? '[]');
    return new Set(Array.isArray(value) ? value.filter((key) => typeof key === 'string') : []);
  } catch {
    return new Set();
  }
}

function envelopeJson(spaceId, envelope) {
  return {
    space_id: spaceId,
    wrapped_key_hex: toHex(envelope.wrappedKey),
    nonce_hex: toHex(envelope.nonce),
    algorithm: envelope.algorithm,
  };
}

function recipientEnvelopeJson(deviceId, envelope) {
  return {
    device_id: deviceId,
    wrapped_key_hex: toHex(envelope.wrappedKey),
    nonce_hex: toHex(envelope.nonce),
    algorithm: envelope.algorithm,
  };
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(value) {
  if (typeof value !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(value)) {
    throw new Error('invalid hexadecimal key');
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export const teamControlClient = new TeamControlClient();
