import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-deep-link', () => ({
  onOpenUrl: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { parseLokusDeepLink } from './useDeepLink';

describe('parseLokusDeepLink', () => {
  it('parses plugin install links', () => {
    expect(parseLokusDeepLink('lokus://install/example-plugin')).toEqual({
      type: 'plugin-install',
      slug: 'example-plugin',
    });
  });

  it('parses team invite links without decoding secrets into logs', () => {
    expect(
      parseLokusDeepLink('lokus://team-invite?invite_id=invite-1&token=a%2Bb%2Fc'),
    ).toEqual({
      type: 'team-invite',
      inviteId: 'invite-1',
      token: 'a+b/c',
    });
  });

  it('rejects incomplete and unrelated links', () => {
    expect(() => parseLokusDeepLink('lokus://team-invite?invite_id=invite-1'))
      .toThrow('incomplete');
    expect(() => parseLokusDeepLink('https://example.com'))
      .toThrow('Unsupported');
    expect(() => parseLokusDeepLink('lokus://unknown'))
      .toThrow('Unknown');
  });
});
