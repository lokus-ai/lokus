import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: webcrypto,
});

import { TeamControlClient } from './TeamControlClient';

function dependencies() {
  const rpc = vi.fn();
  const supabaseClient = { rpc };
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
  return { rpc, supabaseClient, keyManager, invokeFn };
}

function contentKeyBase64(value = 7) {
  return btoa(String.fromCharCode(...new Uint8Array(32).fill(value)));
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
