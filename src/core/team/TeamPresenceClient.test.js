import { describe, expect, it, vi } from 'vitest';

vi.mock('../auth/supabase', () => ({
  supabase: { channel: vi.fn() },
}));

import {
  TEAM_PRESENCE_STATUSES,
  TeamPresenceClient,
} from './TeamPresenceClient';

function createHarness() {
  const handlers = new Map();
  let subscribeHandler = null;
  let presenceState = {};
  const channel = {
    on: vi.fn((type, filter, handler) => {
      handlers.set(`${type}:${filter.event}`, handler);
      return channel;
    }),
    subscribe: vi.fn((handler) => {
      subscribeHandler = handler;
      return channel;
    }),
    track: vi.fn().mockResolvedValue('ok'),
    untrack: vi.fn().mockResolvedValue('ok'),
    unsubscribe: vi.fn().mockResolvedValue('ok'),
    send: vi.fn().mockResolvedValue('ok'),
    presenceState: vi.fn(() => presenceState),
  };
  const supabaseClient = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn().mockResolvedValue('ok'),
  };

  return {
    channel,
    supabaseClient,
    setPresenceState(nextState) {
      presenceState = nextState;
    },
    emitStatus(status, error) {
      subscribeHandler?.(status, error);
    },
    emit(type, event, payload) {
      handlers.get(`${type}:${event}`)?.(payload);
    },
  };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('TeamPresenceClient', () => {
  it('joins the exact private note channel and tracks only safe, slow-changing identity', async () => {
    const harness = createHarness();
    const client = new TeamPresenceClient({
      supabaseClient: harness.supabaseClient,
      now: () => Date.parse('2026-08-27T05:00:00.000Z'),
    });
    const statuses = [];
    client.on('status', (event) => statuses.push(event.status));

    await client.join({
      spaceId: 'space-1',
      noteId: 'note-9',
      identity: {
        id: 'user-1',
        name: 'Ada Lovelace',
        avatarUrl: 'https://example.com/ada.png',
        mode: 'editing',
        inviteToken: 'must-not-leak',
        spaceKey: 'must-not-leak',
      },
    });

    expect(harness.supabaseClient.channel).toHaveBeenCalledWith(
      'team-note:space-1:note-9',
      {
        config: {
          private: true,
          presence: { key: 'user-1' },
          broadcast: { self: false, ack: false },
        },
      },
    );
    expect(harness.channel.on.mock.calls.map(([type, filter]) => (
      `${type}:${filter.event}`
    ))).toEqual([
      'presence:sync',
      'broadcast:pointer',
      'broadcast:selection',
    ]);

    harness.emitStatus('SUBSCRIBED');
    await vi.waitFor(() => expect(harness.channel.track).toHaveBeenCalledTimes(1));

    const tracked = harness.channel.track.mock.calls[0][0];
    expect(tracked).toEqual({
      user_id: 'user-1',
      display_name: 'Ada Lovelace',
      avatar_url: 'https://example.com/ada.png',
      mode: 'editing',
      updated_at: '2026-08-27T05:00:00.000Z',
    });
    expect(JSON.stringify(tracked)).not.toMatch(/invite|spaceKey|must-not-leak/i);
    expect(statuses).toEqual([
      TEAM_PRESENCE_STATUSES.CONNECTING,
      TEAM_PRESENCE_STATUSES.SUBSCRIBED,
    ]);
  });

  it('emits deduplicated collaborators without presence refs or secret material', async () => {
    const harness = createHarness();
    harness.setPresenceState({
      'user-1': [
        {
          user_id: 'user-1',
          display_name: 'Ada Lovelace',
          mode: 'viewing',
          presence_ref: 'private-ref',
          invite_token: 'private-invite',
        },
        {
          user_id: 'user-1',
          mode: 'editing',
          space_key: 'private-key',
        },
      ],
      'user-2': [{
        user_id: 'user-2',
        display_name: 'Grace Hopper',
        avatar_url: 'javascript:alert(1)',
        mode: 'unknown',
        email: 'grace@example.com',
      }],
    });
    const client = new TeamPresenceClient({
      supabaseClient: harness.supabaseClient,
    });
    const emissions = [];
    client.on('collaborators', (collaborators) => emissions.push(collaborators));

    await client.join({
      spaceId: 'space-1',
      noteId: 'note-1',
      identity: { id: 'user-1', name: 'Ada Lovelace' },
    });
    harness.emitStatus('SUBSCRIBED');

    await vi.waitFor(() => expect(emissions).toHaveLength(1));
    expect(emissions[0]).toEqual([
      {
        id: 'user-1',
        name: 'Ada Lovelace',
        avatarUrl: null,
        mode: 'editing',
        isSelf: true,
      },
      {
        id: 'user-2',
        name: 'Grace Hopper',
        avatarUrl: null,
        mode: 'viewing',
        isSelf: false,
      },
    ]);
    expect(JSON.stringify(emissions[0])).not.toMatch(
      /presence_ref|invite|space_key|email|private/i,
    );
  });

  it('clears stale collaborators on errors and re-tracks after Supabase reconnects', async () => {
    const harness = createHarness();
    harness.setPresenceState({
      other: [{ user_id: 'other', display_name: 'Other Person' }],
    });
    const client = new TeamPresenceClient({
      supabaseClient: harness.supabaseClient,
    });
    const statuses = [];
    const collaborators = [];
    client.on('status', ({ status }) => statuses.push(status));
    client.on('collaborators', (next) => collaborators.push(next));

    await client.join({
      spaceId: 'space',
      noteId: 'note',
      identity: { id: 'self', name: 'Self' },
    });
    harness.emitStatus('SUBSCRIBED');
    await vi.waitFor(() => expect(harness.channel.track).toHaveBeenCalledTimes(1));

    harness.emitStatus('CHANNEL_ERROR', new Error('socket unavailable'));
    await settle();
    expect(client.getSnapshot().status).toBe(
      TEAM_PRESENCE_STATUSES.RECONNECTING,
    );
    expect(client.getSnapshot().collaborators).toEqual([]);

    harness.emitStatus('SUBSCRIBED');
    await vi.waitFor(() => expect(harness.channel.track).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(client.getSnapshot().collaborators).toHaveLength(1));
    expect(client.getSnapshot().status).toBe(
      TEAM_PRESENCE_STATUSES.SUBSCRIBED,
    );
    expect(statuses).toEqual([
      'connecting',
      'subscribed',
      'reconnecting',
      'subscribed',
    ]);
    expect(collaborators.at(-1)).toEqual([{
      id: 'other',
      name: 'Other Person',
      avatarUrl: null,
      mode: 'viewing',
      isSelf: false,
    }]);
  });

  it('throttles pointer and selection broadcasts without putting them in Presence', async () => {
    const harness = createHarness();
    let now = 0;
    let nextTimer = 1;
    const timers = new Map();
    const client = new TeamPresenceClient({
      supabaseClient: harness.supabaseClient,
      broadcastThrottleMs: 80,
      now: () => now,
      setTimeoutFn: vi.fn((callback, delay) => {
        const id = nextTimer;
        nextTimer += 1;
        timers.set(id, { callback, delay });
        return id;
      }),
      clearTimeoutFn: vi.fn((id) => timers.delete(id)),
    });
    const selections = [];
    client.on('selection', (selection) => selections.push(selection));

    await client.join({
      spaceId: 'space',
      noteId: 'note',
      identity: { id: 'self', name: 'Self', mode: 'editing' },
    });
    harness.emitStatus('SUBSCRIBED');
    await vi.waitFor(() => expect(harness.channel.track).toHaveBeenCalledTimes(1));

    expect(client.sendPointer({
      x: 1,
      y: 2,
      surface: 'canvas',
      inviteToken: 'secret',
    })).toBe(true);
    now = 10;
    client.sendPointer({ x: 3, y: 4, surface: 'canvas' });
    now = 20;
    client.sendPointer({ x: 5, y: 6, surface: 'canvas' });

    expect(harness.channel.send).toHaveBeenCalledTimes(1);
    expect(timers.size).toBe(1);
    now = 80;
    [...timers.values()][0].callback();
    await settle();

    expect(harness.channel.send).toHaveBeenCalledTimes(2);
    expect(harness.channel.send.mock.calls[1][0]).toEqual({
      type: 'broadcast',
      event: 'pointer',
      payload: {
        userId: 'self',
        data: { x: 5, y: 6, surface: 'canvas' },
        sentAt: '1970-01-01T00:00:00.080Z',
      },
    });
    expect(JSON.stringify(harness.channel.send.mock.calls)).not.toMatch(
      /inviteToken|secret/i,
    );
    expect(harness.channel.track).toHaveBeenCalledTimes(1);

    harness.emit('broadcast', 'selection', {
      payload: {
        userId: 'other',
        data: {
          from: 4,
          to: 12,
          surface: 'editor',
          itemIds: ['ignored-for-editor'],
          keyMaterial: 'secret',
        },
        sentAt: '2026-08-27T05:00:00Z',
        inviteToken: 'secret',
      },
    });
    expect(selections).toEqual([{
      userId: 'other',
      data: {
        from: 4,
        to: 12,
        surface: 'editor',
        itemIds: ['ignored-for-editor'],
      },
      sentAt: '2026-08-27T05:00:00.000Z',
      isSelf: false,
    }]);
    expect(JSON.stringify(selections)).not.toMatch(/keyMaterial|inviteToken|secret/i);
  });

  it('updates mode safely and tears down the ephemeral channel completely', async () => {
    const harness = createHarness();
    const clearedTimers = [];
    const client = new TeamPresenceClient({
      supabaseClient: harness.supabaseClient,
      now: () => 100,
      setTimeoutFn: vi.fn(() => 77),
      clearTimeoutFn: vi.fn((timer) => clearedTimers.push(timer)),
    });
    const collaborators = [];
    client.on('collaborators', (next) => collaborators.push(next));

    await client.join({
      spaceId: 'space',
      noteId: 'note',
      identity: { id: 'self', name: 'Self' },
    });
    harness.emitStatus('SUBSCRIBED');
    await vi.waitFor(() => expect(harness.channel.track).toHaveBeenCalledTimes(1));

    await client.updatePresence({
      mode: 'editing',
      inviteToken: 'secret',
      teamKey: 'secret',
    });
    expect(harness.channel.track).toHaveBeenCalledTimes(2);
    expect(harness.channel.track.mock.calls[1][0]).toMatchObject({
      user_id: 'self',
      mode: 'editing',
    });
    expect(JSON.stringify(harness.channel.track.mock.calls[1][0])).not.toMatch(
      /invite|teamKey|secret/i,
    );

    client.sendPointer({ x: 0, y: 0 });
    client.sendPointer({ x: 1, y: 1 });
    await client.leave();

    expect(clearedTimers).toContain(77);
    expect(harness.channel.untrack).toHaveBeenCalledTimes(1);
    expect(harness.supabaseClient.removeChannel).toHaveBeenCalledWith(
      harness.channel,
    );
    expect(client.getSnapshot()).toEqual({
      status: 'idle',
      topic: null,
      collaborators: [],
    });

    harness.emitStatus('SUBSCRIBED');
    harness.emit('presence', 'sync');
    await settle();
    expect(harness.channel.track).toHaveBeenCalledTimes(2);
  });

  it('can disable optional broadcasts while retaining private Presence', async () => {
    const harness = createHarness();
    const client = new TeamPresenceClient({
      supabaseClient: harness.supabaseClient,
      broadcastEnabled: false,
    });

    await client.join({
      spaceId: 'space',
      noteId: 'note',
      identity: { id: 'self', name: 'Self' },
    });
    expect(harness.supabaseClient.channel).toHaveBeenCalledWith(
      'team-note:space:note',
      {
        config: {
          private: true,
          presence: { key: 'self' },
        },
      },
    );
    expect(harness.channel.on).toHaveBeenCalledTimes(1);
    expect(client.sendPointer({ x: 1, y: 2 })).toBe(false);
    expect(client.sendSelection({ from: 1, to: 2 })).toBe(false);
  });
});
