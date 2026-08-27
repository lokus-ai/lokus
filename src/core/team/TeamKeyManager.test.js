import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: webcrypto,
});

import { TeamKeyManager } from './TeamKeyManager';

function secureStore() {
  const values = new Map();
  return vi.fn(async (command, { key, value }) => {
    if (command === 'secure_store_set') {
      values.set(key, value);
      return null;
    }
    if (command === 'secure_store_get') return values.get(key) ?? null;
    if (command === 'secure_store_delete') {
      values.delete(key);
      return null;
    }
    throw new Error(`unexpected command ${command}`);
  });
}

describe('TeamKeyManager', () => {
  beforeEach(() => localStorage.clear());

  it('creates a persistent X25519 device identity', async () => {
    const invoke = secureStore();
    const manager = new TeamKeyManager({ invokeFn: invoke });

    const first = await manager.initialize('user-1');
    const second = await new TeamKeyManager({ invokeFn: invoke }).initialize('user-1');

    expect(first.deviceId).toBe(second.deviceId);
    expect(first.publicKey).toEqual(second.publicKey);
    expect(first.publicKey).toHaveLength(32);
    expect(first.publicKeyFingerprint).toHaveLength(32);
    expect(invoke).toHaveBeenCalledWith('secure_store_set', expect.objectContaining({
      key: 'team-device-private:user-1',
    }));
  });

  it('wraps and unwraps a space key between two devices', async () => {
    const alice = new TeamKeyManager({ invokeFn: secureStore() });
    const bob = new TeamKeyManager({ invokeFn: secureStore() });
    const aliceIdentity = await alice.initialize('alice');
    const bobIdentity = await bob.initialize('bob');
    const spaceKey = crypto.getRandomValues(new Uint8Array(32));

    const context = {
      scopeKind: 'space',
      scopeId: 'space-1',
      epoch: 1,
      recipientDeviceId: bobIdentity.deviceId,
    };
    const envelope = await alice.wrapKeyForDevice(
      spaceKey,
      bobIdentity.publicKey,
      context,
    );
    const unwrapped = await bob.unwrapKeyEnvelope(
      envelope,
      aliceIdentity.publicKey,
      {
        ...context,
        senderDeviceId: aliceIdentity.deviceId,
      },
    );

    expect(unwrapped).toEqual(spaceKey);
    expect(envelope.algorithm).toBe('x25519-hkdf-aesgcm-v1');
  });

  it('serializes concurrent initialization to one persisted keypair', async () => {
    const invoke = secureStore();
    const manager = new TeamKeyManager({ invokeFn: invoke });

    const [first, second] = await Promise.all([
      manager.initialize('user-1'),
      manager.initialize('user-1'),
    ]);

    expect(first).toEqual(second);
    expect(invoke.mock.calls.filter(([command]) => command === 'secure_store_set'))
      .toHaveLength(1);
  });
});
