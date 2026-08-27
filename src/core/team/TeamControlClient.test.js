import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: webcrypto,
});

import { buildTeamInviteUrl, TeamControlClient } from './TeamControlClient';

function dependencies() {
  const rpc = vi.fn();
  const from = vi.fn();
  const supabaseClient = { from, rpc };
  const keyManager = {
    initialize: vi.fn().mockResolvedValue({
      deviceId: '20000000-0000-0000-0000-000000000901',
      publicKey: new Uint8Array(32).fill(1),
      publicKeyFingerprint: new Uint8Array(32).fill(2),
    }),
    wrapKeyForDevice: vi.fn().mockResolvedValue({
      wrappedKey: new Uint8Array([1, 2, 3]),
      nonce: new Uint8Array(12).fill(4),
      algorithm: 'x25519-hkdf-aesgcm-v1',
    }),
  };
  const invokeFn = vi.fn().mockResolvedValue(null);
  const nowFn = vi.fn(() => Date.parse('2026-08-27T05:00:00.000Z'));
  return {
    from,
    rpc,
    supabaseClient,
    keyManager,
    invokeFn,
    nowFn,
  };
}

function contentKeyBase64(value = 7) {
  return btoa(String.fromCharCode(...new Uint8Array(32).fill(value)));
}

function pgBytea(bytes) {
  return `\\x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function encryptedMetadata(name, keyValue, nonceValue = 3) {
  const keyBytes = new Uint8Array(32).fill(keyValue);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const nonce = new Uint8Array(12).fill(nonceValue);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    new TextEncoder().encode(name),
  ));
  return {
    name_ciphertext: pgBytea(ciphertext),
    name_nonce: pgBytea(nonce),
  };
}

function queryResult(data, error = null) {
  const query = {};
  for (const method of ['select', 'eq', 'neq', 'in', 'is', 'gt']) {
    query[method] = vi.fn(() => query);
  }
  query.then = (onFulfilled, onRejected) => (
    Promise.resolve({ data, error }).then(onFulfilled, onRejected)
  );
  return query;
}

describe('TeamControlClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('registers the OS-backed device identity', async () => {
    const deps = dependencies();
    deps.rpc.mockResolvedValue({ data: 'device-id', error: null });
    const client = new TeamControlClient(deps);

    await client.initialize('user-1');

    expect(deps.rpc).toHaveBeenCalledWith('register_device', {
      p_device_id: '20000000-0000-0000-0000-000000000901',
      p_client_instance_id: expect.any(String),
      p_public_key: expect.stringMatching(/^\\x[0-9a-f]+$/),
      p_public_key_fingerprint: expect.stringMatching(/^\\x[0-9a-f]+$/),
      p_key_algorithm: 'x25519',
    });
  });

  it('creates a team with encrypted default metadata and wrapped keys', async () => {
    const deps = dependencies();
    deps.rpc
      .mockResolvedValueOnce({ data: 'device-id', error: null })
      .mockResolvedValueOnce({
        data: [{
          team_id: 'team-1',
          space_id: 'space-1',
          everyone_group_id: 'group-1',
        }],
        error: null,
      });
    const client = new TeamControlClient(deps);
    await client.initialize('user-1');

    const result = await client.createTeam('Lokus');

    expect(deps.rpc).toHaveBeenLastCalledWith('create_team', {
      p_name: 'Lokus',
      p_team_id: expect.any(String),
      p_default_space_id: expect.any(String),
      p_everyone_group_id: expect.any(String),
      p_creator_device_id: '20000000-0000-0000-0000-000000000901',
      p_everyone_name_ciphertext: expect.stringMatching(/^\\x[0-9a-f]+$/),
      p_everyone_name_nonce: expect.stringMatching(/^\\x[0-9a-f]+$/),
      p_space_name_ciphertext: expect.stringMatching(/^\\x[0-9a-f]+$/),
      p_space_name_nonce: expect.stringMatching(/^\\x[0-9a-f]+$/),
      p_team_wrapped_key: '\\x010203',
      p_team_wrapping_nonce: `\\x${'04'.repeat(12)}`,
      p_space_wrapped_key: '\\x010203',
      p_space_wrapping_nonce: `\\x${'04'.repeat(12)}`,
      p_algorithm: 'x25519-hkdf-aesgcm-v1',
    });
    expect(result.team_id).toBe('team-1');
    expect(deps.invokeFn).toHaveBeenCalledWith('secure_store_set', expect.objectContaining({
      key: expect.stringContaining('team-key:team-1:1'),
    }));
  });

  it('lists every readable space with decrypted names and write capabilities', async () => {
    const deps = dependencies();
    const readerMetadata = await encryptedMetadata('Read only', 7);
    const writerMetadata = await encryptedMetadata('Writers', 8, 4);
    const membershipQuery = queryResult([{
      team_id: 'team-1',
      role: 'member',
      status: 'active',
    }]);
    const teamQuery = queryResult([{
      id: 'team-1',
      name: 'Lokus',
      current_permission_epoch: 4,
      current_key_epoch: 2,
    }]);
    const spaceQuery = queryResult([
      {
        id: 'space-reader',
        team_id: 'team-1',
        kind: 'restricted',
        current_key_epoch: 3,
        ...readerMetadata,
      },
      {
        id: 'space-writer',
        team_id: 'team-1',
        kind: 'team',
        current_key_epoch: 5,
        ...writerMetadata,
      },
    ]);
    deps.from.mockImplementation((table) => ({
      team_memberships: membershipQuery,
      teams: teamQuery,
      spaces: spaceQuery,
    })[table]);
    deps.rpc.mockImplementation(async (name) => {
      if (name === 'register_device') return { data: 'device-id', error: null };
      if (name === 'list_writable_team_spaces') {
        return { data: [{ space_id: 'space-writer' }], error: null };
      }
      throw new Error(`unexpected RPC ${name}`);
    });
    deps.invokeFn.mockImplementation(async (command, { key }) => {
      if (command !== 'secure_store_get') {
        throw new Error(`unexpected secure command ${command}`);
      }
      if (key === 'space-key:space-reader:3') return contentKeyBase64(7);
      if (key === 'space-key:space-writer:5') return contentKeyBase64(8);
      throw new Error(`unexpected secure key ${key}`);
    });
    const client = new TeamControlClient(deps);
    await client.initialize('user-1');

    const teams = await client.listTeams('user-1');

    expect(teams).toEqual([{
      id: 'team-1',
      name: 'Lokus',
      current_permission_epoch: 4,
      current_key_epoch: 2,
      membership: {
        team_id: 'team-1',
        role: 'member',
        status: 'active',
      },
      spaces: [
        {
          id: 'space-reader',
          team_id: 'team-1',
          kind: 'restricted',
          current_key_epoch: 3,
          can_write: false,
          name: 'Read only',
          key_pending: false,
        },
        {
          id: 'space-writer',
          team_id: 'team-1',
          kind: 'team',
          current_key_epoch: 5,
          can_write: true,
          name: 'Writers',
          key_pending: false,
        },
      ],
    }]);
    expect(spaceQuery.select).toHaveBeenCalledWith(
      'id,team_id,kind,name_ciphertext,name_nonce,current_key_epoch',
    );
    expect(teamQuery.is).toHaveBeenCalledWith('deleted_at', null);
    expect(spaceQuery.is).toHaveBeenCalledWith('deleted_at', null);
    expect(deps.rpc).toHaveBeenCalledWith('list_writable_team_spaces', {
      p_team_id: 'team-1',
    });
  });

  it('represents spaces awaiting a key without inventing a name', async () => {
    const deps = dependencies();
    const membershipQuery = queryResult([{
      team_id: 'team-1',
      role: 'member',
      status: 'active',
    }]);
    const teamQuery = queryResult([{
      id: 'team-1',
      name: 'Lokus',
      current_permission_epoch: 1,
      current_key_epoch: 1,
    }]);
    const spaceQuery = queryResult([{
      id: 'space-pending',
      team_id: 'team-1',
      kind: 'restricted',
      current_key_epoch: 9,
      name_ciphertext: '\\x01',
      name_nonce: '\\x02',
    }]);
    deps.from.mockImplementation((table) => ({
      team_memberships: membershipQuery,
      teams: teamQuery,
      spaces: spaceQuery,
    })[table]);
    deps.rpc.mockImplementation(async (name) => {
      if (name === 'register_device') return { data: 'device-id', error: null };
      if (name === 'list_writable_team_spaces') return { data: [], error: null };
      if (name === 'get_recipient_key_envelope') return { data: null, error: null };
      throw new Error(`unexpected RPC ${name}`);
    });
    deps.invokeFn.mockResolvedValue(null);
    const client = new TeamControlClient(deps);
    await client.initialize('user-1');

    const [team] = await client.listTeams('user-1');

    expect(team.spaces).toEqual([{
      id: 'space-pending',
      team_id: 'team-1',
      kind: 'restricted',
      current_key_epoch: 9,
      can_write: false,
      name: null,
      key_pending: true,
    }]);
    expect(deps.rpc).toHaveBeenCalledWith('get_recipient_key_envelope', {
      p_scope_kind: 'space',
      p_scope_id: 'space-pending',
      p_epoch: 9,
      p_recipient_device_id: '20000000-0000-0000-0000-000000000901',
    });
  });

  it('does not disguise metadata authentication failures as key-pending spaces', async () => {
    const deps = dependencies();
    const metadata = await encryptedMetadata('Authentic name', 7);
    const membershipQuery = queryResult([{
      team_id: 'team-1',
      role: 'member',
      status: 'active',
    }]);
    const teamQuery = queryResult([{
      id: 'team-1',
      name: 'Lokus',
      current_permission_epoch: 1,
      current_key_epoch: 1,
    }]);
    const spaceQuery = queryResult([{
      id: 'space-1',
      team_id: 'team-1',
      kind: 'team',
      current_key_epoch: 1,
      ...metadata,
    }]);
    deps.from.mockImplementation((table) => ({
      team_memberships: membershipQuery,
      teams: teamQuery,
      spaces: spaceQuery,
    })[table]);
    deps.rpc.mockImplementation(async (name) => {
      if (name === 'register_device') return { data: 'device-id', error: null };
      if (name === 'list_writable_team_spaces') return { data: [], error: null };
      throw new Error(`unexpected RPC ${name}`);
    });
    deps.invokeFn.mockResolvedValue(contentKeyBase64(8));
    const client = new TeamControlClient(deps);
    await client.initialize('user-1');

    await expect(client.listTeams('user-1')).rejects.toMatchObject({
      name: 'OperationError',
    });
  });

  it('hydrates a missing space epoch from its device envelope', async () => {
    const deps = dependencies();
    deps.rpc
      .mockResolvedValueOnce({ data: 'device-id', error: null })
      .mockResolvedValueOnce({
        data: [{
          wrapped_key: '\\x010203',
          wrapping_nonce: `\\x${'04'.repeat(12)}`,
          algorithm: 'x25519-hkdf-aesgcm-v1',
          sender_device_id: 'sender-device',
          sender_public_key: `\\x${'05'.repeat(32)}`,
        }],
        error: null,
      });
    deps.invokeFn.mockImplementation(async (command) => {
      if (command === 'secure_store_get') return null;
      if (command === 'secure_store_set') return null;
      throw new Error(`unexpected command ${command}`);
    });
    deps.keyManager.unwrapKeyEnvelope = vi.fn().mockResolvedValue(
      new Uint8Array(32).fill(9),
    );
    const client = new TeamControlClient(deps);
    await client.initialize('user-1');

    const key = await client.getSpaceKey('space-1', 2);

    expect(key).toEqual(new Uint8Array(32).fill(9));
    expect(deps.keyManager.unwrapKeyEnvelope).toHaveBeenCalled();
    expect(deps.invokeFn).toHaveBeenCalledWith('secure_store_set', expect.objectContaining({
      key: 'space-key:space-1:2',
    }));
  });

  it('deletes every indexed team and space key after revocation', async () => {
    const deps = dependencies();
    const client = new TeamControlClient(deps);
    await client.storeContentKey('team-key:team-1:1', new Uint8Array(32));
    await client.storeContentKey('space-key:space-1:3', new Uint8Array(32));

    await client.deleteCachedTeamKeys('team-1', [
      { space_id: 'space-1', key_epoch: 3 },
    ]);

    expect(deps.invokeFn).toHaveBeenCalledWith('secure_store_delete', {
      key: 'team-key:team-1:1',
    });
    expect(deps.invokeFn).toHaveBeenCalledWith('secure_store_delete', {
      key: 'space-key:space-1:3',
    });
  });

  it('resolves member profiles into display-ready fields', async () => {
    const deps = dependencies();
    const membershipQuery = queryResult([
      {
        user_id: 'user-1',
        role: 'owner',
        status: 'active',
        membership_version: 3,
      },
      {
        user_id: 'user-2',
        role: 'member',
        status: 'key_pending',
        membership_version: 1,
      },
    ]);
    const profileQuery = queryResult([{
      id: 'user-1',
      display_name: 'Ada Lovelace',
      avatar_url: 'https://example.com/ada.png',
    }]);
    deps.from.mockImplementation((table) => ({
      team_memberships: membershipQuery,
      profiles: profileQuery,
    })[table]);
    const client = new TeamControlClient(deps);

    const members = await client.listTeamMembers('team-1');

    expect(members).toEqual([
      {
        user_id: 'user-1',
        role: 'owner',
        status: 'active',
        membership_version: 3,
        display_name: 'Ada Lovelace',
        email: null,
        avatar_url: 'https://example.com/ada.png',
      },
      {
        user_id: 'user-2',
        role: 'member',
        status: 'key_pending',
        membership_version: 1,
        display_name: null,
        email: null,
        avatar_url: null,
      },
    ]);
    expect(profileQuery.select).toHaveBeenCalledWith('id,display_name,avatar_url');
    expect(profileQuery.in).toHaveBeenCalledWith('id', ['user-1', 'user-2']);
  });

  it('does not query profiles when a team has no visible members', async () => {
    const deps = dependencies();
    deps.from.mockReturnValue(queryResult([]));
    const client = new TeamControlClient(deps);

    await expect(client.listTeamMembers('team-1')).resolves.toEqual([]);

    expect(deps.from).toHaveBeenCalledTimes(1);
    expect(deps.from).toHaveBeenCalledWith('team_memberships');
  });

  it('lists only active pending invites without exposing bearer hashes', async () => {
    const deps = dependencies();
    const inviteQuery = queryResult([{
      id: 'invite-1',
      team_id: 'team-1',
      email_normalized: 'member@example.com',
      role: 'member',
      invited_by: 'owner-1',
      expires_at: '2026-09-03T05:00:00.000Z',
      accepted_by: null,
      accepted_at: null,
      revoked_at: null,
      created_at: '2026-08-27T05:00:00.000Z',
    }]);
    deps.from.mockImplementation((table) => {
      if (table === 'team_invites') return inviteQuery;
      throw new Error(`unexpected table ${table}`);
    });
    const client = new TeamControlClient(deps);

    const invites = await client.listPendingInvites('team-1');

    expect(invites).toEqual([{
      id: 'invite-1',
      team_id: 'team-1',
      email_normalized: 'member@example.com',
      email: 'member@example.com',
      role: 'member',
      invited_by: 'owner-1',
      expires_at: '2026-09-03T05:00:00.000Z',
      accepted_by: null,
      accepted_at: null,
      revoked_at: null,
      created_at: '2026-08-27T05:00:00.000Z',
    }]);
    expect(inviteQuery.select).toHaveBeenCalledWith(
      'id,team_id,email_normalized,role,invited_by,expires_at,accepted_by,accepted_at,revoked_at,created_at',
    );
    expect(inviteQuery.eq).toHaveBeenCalledWith('team_id', 'team-1');
    expect(inviteQuery.is).toHaveBeenNthCalledWith(1, 'accepted_at', null);
    expect(inviteQuery.is).toHaveBeenNthCalledWith(2, 'revoked_at', null);
    expect(inviteQuery.gt).toHaveBeenCalledWith(
      'expires_at',
      '2026-08-27T05:00:00.000Z',
    );
  });

  it('revokes an invite through the dedicated control RPC', async () => {
    const deps = dependencies();
    deps.rpc.mockResolvedValue({ data: true, error: null });
    const client = new TeamControlClient(deps);

    await expect(client.revokeInvite('invite-1')).resolves.toBe(true);

    expect(deps.rpc).toHaveBeenCalledWith('revoke_team_invite', {
      p_invite_id: 'invite-1',
    });
  });

  it('propagates invite revocation failures', async () => {
    const deps = dependencies();
    const failure = new Error('not authorized');
    deps.rpc.mockResolvedValue({ data: null, error: failure });
    const client = new TeamControlClient(deps);

    await expect(client.revokeInvite('invite-1')).rejects.toBe(failure);
  });

  it('provisions a pending member device with every granted key', async () => {
    const deps = dependencies();
    deps.invokeFn.mockImplementation(async (command, { key }) => {
      if (command === 'secure_store_get' && key.startsWith('team-key:')) {
        return contentKeyBase64(7);
      }
      if (command === 'secure_store_get' && key.startsWith('space-key:')) {
        return contentKeyBase64(8);
      }
      if (command === 'secure_store_set') return null;
      throw new Error(`unexpected secure command ${command}`);
    });
    deps.rpc
      .mockResolvedValueOnce({ data: 'device-id', error: null })
      .mockResolvedValueOnce({
        data: {
          team_key_epochs: [1, 2],
          target_public_key_hex: '09'.repeat(32),
          spaces: [{ space_id: 'space-1', key_epochs: [1, 3] }],
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: 'active', error: null });
    const client = new TeamControlClient(deps);
    await client.initialize('owner');

    const status = await client.provisionMemberKeys({
      teamId: 'team-1',
      targetUserId: 'user-2',
      targetDeviceId: 'device-2',
    });

    expect(status).toBe('active');
    expect(deps.rpc).toHaveBeenLastCalledWith('provision_member_key_history', {
      p_team_id: 'team-1',
      p_target_user_id: 'user-2',
      p_target_device_id: 'device-2',
      p_actor_device_id: '20000000-0000-0000-0000-000000000901',
      p_team_envelopes: [
        {
          epoch: 1,
          wrapped_key_hex: '010203',
          nonce_hex: '04'.repeat(12),
          algorithm: 'x25519-hkdf-aesgcm-v1',
        },
        {
          epoch: 2,
          wrapped_key_hex: '010203',
          nonce_hex: '04'.repeat(12),
          algorithm: 'x25519-hkdf-aesgcm-v1',
        },
      ],
      p_space_envelopes: [
        {
          space_id: 'space-1',
          epoch: 1,
          wrapped_key_hex: '010203',
          nonce_hex: '04'.repeat(12),
          algorithm: 'x25519-hkdf-aesgcm-v1',
        },
        {
          space_id: 'space-1',
          epoch: 3,
          wrapped_key_hex: '010203',
          nonce_hex: '04'.repeat(12),
          algorithm: 'x25519-hkdf-aesgcm-v1',
        },
      ],
    });
  });

  it('rotates team and affected space keys before removing a member', async () => {
    const deps = dependencies();
    deps.rpc
      .mockResolvedValueOnce({ data: 'device-id', error: null })
      .mockResolvedValueOnce({
        data: {
          next_team_key_epoch: 2,
          team_recipients: [{
            device_id: 'device-owner',
            public_key_hex: '0a'.repeat(32),
          }],
          spaces: [{
            space_id: 'space-1',
            next_key_epoch: 4,
            recipients: [{
              device_id: 'device-owner',
              public_key_hex: '0a'.repeat(32),
            }],
          }],
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: 'removed', error: null });
    const client = new TeamControlClient(deps);
    await client.initialize('owner');

    const status = await client.removeMember({
      teamId: 'team-1',
      targetUserId: 'user-2',
    });

    expect(status).toBe('removed');
    expect(deps.rpc).toHaveBeenLastCalledWith('remove_member', {
      p_team_id: 'team-1',
      p_target_user_id: 'user-2',
      p_actor_device_id: '20000000-0000-0000-0000-000000000901',
      p_team_envelopes: [{
        device_id: 'device-owner',
        wrapped_key_hex: '010203',
        nonce_hex: '04'.repeat(12),
        algorithm: 'x25519-hkdf-aesgcm-v1',
      }],
      p_space_rotations: [{
        space_id: 'space-1',
        envelopes: [{
          device_id: 'device-owner',
          wrapped_key_hex: '010203',
          nonce_hex: '04'.repeat(12),
          algorithm: 'x25519-hkdf-aesgcm-v1',
        }],
      }],
    });
    expect(deps.invokeFn).toHaveBeenCalledWith('secure_store_set', expect.objectContaining({
      key: 'team-key:team-1:2',
    }));
    expect(deps.invokeFn).toHaveBeenCalledWith('secure_store_set', expect.objectContaining({
      key: 'space-key:space-1:4',
    }));
  });

  it('wraps ownership and archive lifecycle RPCs with the active device', async () => {
    const deps = dependencies();
    deps.rpc.mockResolvedValue({ data: true, error: null });
    const client = new TeamControlClient(deps);
    await client.initialize('owner');

    await expect(client.transferOwnership('team-1', 'user-2')).resolves.toBe(true);
    await expect(
      client.archiveTeam('team-1', '2026-09-27T05:00:00.000Z'),
    ).resolves.toBe(true);
    await expect(client.restoreTeam('team-1')).resolves.toBe(true);
    await expect(
      client.archiveSpace('team-1', 'space-1', '2026-09-27T05:00:00.000Z'),
    ).resolves.toBe(true);
    await expect(client.restoreSpace('team-1', 'space-1')).resolves.toBe(true);

    const actorDeviceId = '20000000-0000-0000-0000-000000000901';
    expect(deps.rpc).toHaveBeenNthCalledWith(2, 'transfer_ownership', {
      p_team_id: 'team-1',
      p_new_owner_user_id: 'user-2',
      p_actor_device_id: actorDeviceId,
    });
    expect(deps.rpc).toHaveBeenNthCalledWith(3, 'archive_team', {
      p_team_id: 'team-1',
      p_actor_device_id: actorDeviceId,
      p_retention_expires_at: '2026-09-27T05:00:00.000Z',
    });
    expect(deps.rpc).toHaveBeenNthCalledWith(4, 'restore_team', {
      p_team_id: 'team-1',
      p_actor_device_id: actorDeviceId,
    });
    expect(deps.rpc).toHaveBeenNthCalledWith(5, 'archive_space', {
      p_team_id: 'team-1',
      p_space_id: 'space-1',
      p_actor_device_id: actorDeviceId,
      p_retention_expires_at: '2026-09-27T05:00:00.000Z',
    });
    expect(deps.rpc).toHaveBeenNthCalledWith(6, 'restore_space', {
      p_team_id: 'team-1',
      p_space_id: 'space-1',
      p_actor_device_id: actorDeviceId,
    });
  });

  it('requires initialization for device-authorized lifecycle controls', async () => {
    const deps = dependencies();
    const client = new TeamControlClient(deps);

    await expect(client.restoreTeam('team-1')).rejects.toThrow(
      'team control client is not initialized',
    );
    expect(deps.rpc).not.toHaveBeenCalled();
  });

  it('builds encoded deep links without logging the bearer token', () => {
    const deps = dependencies();
    const client = new TeamControlClient(deps);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const direct = buildTeamInviteUrl('invite/id', 'secret+&=?');
    const throughClient = client.buildInviteUrl('invite/id', 'secret+&=?');

    expect(direct).toBe(
      'lokus://team-invite?invite_id=invite%2Fid&token=secret%2B%26%3D%3F',
    );
    expect(throughClient).toBe(direct);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    log.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });

  it('rejects incomplete team invite deep links', () => {
    expect(() => buildTeamInviteUrl('', 'token')).toThrow('invite id is required');
    expect(() => buildTeamInviteUrl('invite-1', '')).toThrow(
      'invite token is required',
    );
  });

  it('creates bearer-token invites and accepts them through the registered device', async () => {
    const deps = dependencies();
    deps.rpc
      .mockResolvedValueOnce({ data: 'device-id', error: null })
      .mockResolvedValueOnce({ data: 'invite-1', error: null })
      .mockResolvedValueOnce({ data: 'key_pending', error: null });
    const client = new TeamControlClient(deps);
    await client.initialize('owner');

    const invite = await client.createInvite({
      teamId: 'team-1',
      email: 'member@example.com',
      role: 'member',
      grants: [{ space_id: 'space-1', role: 'editor' }],
    });
    const status = await client.acceptInvite(invite.inviteId, invite.token);

    expect(invite.inviteId).toBe('invite-1');
    expect(invite.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(deps.rpc).toHaveBeenNthCalledWith(2, 'create_invite', {
      p_invite_id: expect.any(String),
      p_team_id: 'team-1',
      p_email: 'member@example.com',
      p_token_hash: expect.stringMatching(/^\\x[0-9a-f]{64}$/),
      p_role: 'member',
      p_expires_at: expect.any(String),
      p_initial_grants: [{ space_id: 'space-1', role: 'editor' }],
    });
    expect(deps.rpc).toHaveBeenLastCalledWith('accept_invite', {
      p_invite_id: 'invite-1',
      p_token: invite.token,
      p_device_id: '20000000-0000-0000-0000-000000000901',
    });
    expect(status).toBe('key_pending');
  });
});
