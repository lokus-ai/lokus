import { supabase } from '../auth/supabase';

export const TEAM_PRESENCE_STATUSES = Object.freeze({
  IDLE: 'idle',
  CONNECTING: 'connecting',
  SUBSCRIBED: 'subscribed',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',
});

export const TEAM_PRESENCE_MODES = Object.freeze({
  VIEWING: 'viewing',
  EDITING: 'editing',
});

const ALLOWED_EVENTS = new Set([
  'status',
  'collaborators',
  'pointer',
  'selection',
  'error',
]);
const ALLOWED_MODES = new Set(Object.values(TEAM_PRESENCE_MODES));
const SUCCESS_RESULTS = new Set([undefined, null, 'ok']);

export class TeamPresenceClient {
  constructor({
    supabaseClient = supabase,
    broadcastEnabled = true,
    broadcastThrottleMs = 80,
    now = () => Date.now(),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
  } = {}) {
    if (!supabaseClient?.channel) {
      throw new TypeError('TeamPresenceClient requires a Supabase client');
    }

    this.supabase = supabaseClient;
    this.broadcastEnabled = broadcastEnabled;
    this.broadcastThrottleMs = Math.max(0, Number(broadcastThrottleMs) || 0);
    this.now = now;
    this.setTimeout = setTimeoutFn;
    this.clearTimeout = clearTimeoutFn;

    this.channel = null;
    this.scope = null;
    this.identity = null;
    this.topic = null;
    this.status = TEAM_PRESENCE_STATUSES.IDLE;
    this.collaborators = [];
    this.subscribed = false;
    this.wasSubscribed = false;
    this.lifecycle = 0;
    this.subscriptionEpoch = 0;

    this.listeners = new Map(
      [...ALLOWED_EVENTS].map((event) => [event, new Set()]),
    );
    this.broadcastTimers = new Map();
    this.pendingBroadcasts = new Map();
    this.lastBroadcastAt = new Map();
  }

  on(event, listener) {
    if (!ALLOWED_EVENTS.has(event)) {
      throw new TypeError(`Unsupported team presence event: ${event}`);
    }
    if (typeof listener !== 'function') {
      throw new TypeError('Team presence listener must be a function');
    }
    this.listeners.get(event).add(listener);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    this.listeners.get(event)?.delete(listener);
  }

  getSnapshot() {
    return {
      status: this.status,
      topic: this.topic,
      collaborators: this.collaborators.map((collaborator) => ({ ...collaborator })),
    };
  }

  async join({ spaceId, noteId, identity }) {
    const safeSpaceId = normalizeChannelSegment(spaceId, 'spaceId');
    const safeNoteId = normalizeChannelSegment(noteId, 'noteId');
    const safeIdentity = normalizeIdentity(identity);
    const topic = `team-note:${safeSpaceId}:${safeNoteId}`;
    const lifecycle = ++this.lifecycle;
    const previous = this.detachChannel();

    this.clearBroadcastQueue();
    this.setCollaborators([]);
    this.scope = { spaceId: safeSpaceId, noteId: safeNoteId };
    this.identity = safeIdentity;
    this.topic = topic;
    this.wasSubscribed = false;
    this.setStatus(TEAM_PRESENCE_STATUSES.CONNECTING);

    await this.disposeChannel(previous);
    if (lifecycle !== this.lifecycle) return null;

    let channel;
    try {
      channel = this.supabase.channel(topic, {
        config: {
          private: true,
          presence: { key: safeIdentity.id },
          ...(this.broadcastEnabled
            ? { broadcast: { self: false, ack: false } }
            : {}),
        },
      });
      this.channel = channel;

      channel.on('presence', { event: 'sync' }, () => {
        if (this.isCurrent(channel, lifecycle)) this.refreshCollaborators();
      });

      if (this.broadcastEnabled) {
        channel
          .on('broadcast', { event: 'pointer' }, (payload) => {
            if (this.isCurrent(channel, lifecycle)) {
              this.handleIncomingBroadcast('pointer', payload);
            }
          })
          .on('broadcast', { event: 'selection' }, (payload) => {
            if (this.isCurrent(channel, lifecycle)) {
              this.handleIncomingBroadcast('selection', payload);
            }
          });
      }

      channel.subscribe((status, error) => {
        void this.handleSubscriptionStatus(
          channel,
          lifecycle,
          status,
          error,
        );
      });
    } catch (error) {
      const safeError = normalizeError(error, 'Could not join team presence');
      if (lifecycle === this.lifecycle) {
        this.channel = null;
        this.subscribed = false;
        this.setStatus(TEAM_PRESENCE_STATUSES.ERROR, {
          reason: 'CHANNEL_SETUP_ERROR',
          error: safeError,
        });
        this.emitError('subscribe', safeError);
      }
      await this.disposeChannel({ channel, subscribed: false });
      throw safeError;
    }

    return { topic };
  }

  async reconnect() {
    if (!this.scope || !this.identity) return null;
    return this.join({
      ...this.scope,
      identity: this.identity,
    });
  }

  async updatePresence(update = {}) {
    if (!this.identity) {
      throw new Error('Join a team note before updating presence');
    }
    if (
      Object.prototype.hasOwnProperty.call(update, 'mode')
      && !ALLOWED_MODES.has(update.mode)
    ) {
      throw new TypeError('Team presence mode must be viewing or editing');
    }

    const nextIdentity = normalizeIdentity({
      ...this.identity,
      ...update,
      id: this.identity.id,
    });
    if (sameIdentity(this.identity, nextIdentity)) return false;
    this.identity = nextIdentity;

    if (this.channel && this.subscribed) {
      await this.trackPresence(this.channel, this.lifecycle);
    }
    return true;
  }

  setMode(mode) {
    return this.updatePresence({ mode });
  }

  sendPointer(pointer) {
    return this.queueBroadcast('pointer', normalizePointer(pointer));
  }

  sendSelection(selection) {
    return this.queueBroadcast('selection', normalizeSelection(selection));
  }

  async leave() {
    const lifecycle = ++this.lifecycle;
    const previous = this.detachChannel();

    this.clearBroadcastQueue();
    this.setCollaborators([]);
    this.scope = null;
    this.identity = null;
    this.topic = null;
    this.wasSubscribed = false;

    await this.disposeChannel(previous);
    if (lifecycle === this.lifecycle) {
      this.setStatus(TEAM_PRESENCE_STATUSES.IDLE);
    }
  }

  async destroy() {
    await this.leave();
    for (const listeners of this.listeners.values()) listeners.clear();
  }

  detachChannel() {
    const previous = {
      channel: this.channel,
      subscribed: this.subscribed,
    };
    this.channel = null;
    this.subscribed = false;
    return previous;
  }

  async disposeChannel({ channel, subscribed } = {}) {
    if (!channel) return;

    if (subscribed && typeof channel.untrack === 'function') {
      try {
        await channel.untrack();
      } catch (error) {
        this.emitError(
          'teardown',
          normalizeError(error, 'Could not clear team presence'),
        );
      }
    }

    try {
      if (typeof this.supabase.removeChannel === 'function') {
        await this.supabase.removeChannel(channel);
      } else if (typeof channel.unsubscribe === 'function') {
        await channel.unsubscribe();
      }
    } catch (error) {
      if (typeof channel.unsubscribe === 'function') {
        try {
          await channel.unsubscribe();
        } catch {
          // Local references are already detached; report the original failure.
        }
      }
      this.emitError(
        'teardown',
        normalizeError(error, 'Could not leave team presence'),
      );
    }
  }

  async handleSubscriptionStatus(channel, lifecycle, rawStatus, error) {
    if (!this.isCurrent(channel, lifecycle)) return;

    if (rawStatus === 'SUBSCRIBED') {
      const subscriptionEpoch = ++this.subscriptionEpoch;
      this.subscribed = true;
      this.wasSubscribed = true;
      this.setStatus(TEAM_PRESENCE_STATUSES.SUBSCRIBED, {
        reason: rawStatus,
      });
      await this.trackPresence(channel, lifecycle);
      if (
        this.isCurrent(channel, lifecycle)
        && this.subscribed
        && this.subscriptionEpoch === subscriptionEpoch
      ) {
        this.refreshCollaborators();
      }
      return;
    }

    if (rawStatus === 'CHANNEL_ERROR' || rawStatus === 'TIMED_OUT') {
      const safeError = normalizeError(
        error,
        rawStatus === 'TIMED_OUT'
          ? 'Team presence connection timed out'
          : 'Team presence connection failed',
      );
      this.subscribed = false;
      this.subscriptionEpoch += 1;
      this.clearBroadcastQueue();
      this.setCollaborators([]);
      this.setStatus(
        this.wasSubscribed
          ? TEAM_PRESENCE_STATUSES.RECONNECTING
          : TEAM_PRESENCE_STATUSES.ERROR,
        { reason: rawStatus, error: safeError },
      );
      this.emitError('subscribe', safeError);
      return;
    }

    if (rawStatus === 'CLOSED') {
      const safeError = normalizeError(error, 'Team presence channel closed');
      this.subscribed = false;
      this.subscriptionEpoch += 1;
      this.clearBroadcastQueue();
      this.setCollaborators([]);
      this.setStatus(TEAM_PRESENCE_STATUSES.ERROR, {
        reason: rawStatus,
        error: safeError,
      });
      this.emitError('subscribe', safeError);
    }
  }

  async trackPresence(channel, lifecycle) {
    if (!this.identity || !this.isCurrent(channel, lifecycle)) return;

    try {
      const result = await channel.track({
        user_id: this.identity.id,
        display_name: this.identity.name,
        avatar_url: this.identity.avatarUrl,
        mode: this.identity.mode,
        updated_at: new Date(this.now()).toISOString(),
      });
      if (!SUCCESS_RESULTS.has(result)) {
        throw new Error(`Presence track returned ${String(result)}`);
      }
    } catch (error) {
      if (!this.isCurrent(channel, lifecycle)) return;
      const safeError = normalizeError(error, 'Could not publish team presence');
      this.subscribed = false;
      this.subscriptionEpoch += 1;
      this.clearBroadcastQueue();
      this.setCollaborators([]);
      this.setStatus(TEAM_PRESENCE_STATUSES.ERROR, {
        reason: 'PRESENCE_TRACK_ERROR',
        error: safeError,
      });
      this.emitError('presence', safeError);
    }
  }

  refreshCollaborators() {
    if (!this.channel) return;
    try {
      const state = this.channel.presenceState?.() ?? {};
      this.setCollaborators(
        normalizePresenceCollaborators(state, this.identity?.id),
      );
    } catch (error) {
      this.setCollaborators([]);
      this.emitError(
        'presence',
        normalizeError(error, 'Could not read team presence'),
      );
    }
  }

  queueBroadcast(kind, data) {
    if (
      !this.broadcastEnabled
      || !data
      || !this.channel
      || !this.subscribed
      || !this.identity
    ) {
      return false;
    }

    const now = this.now();
    const lastSentAt = this.lastBroadcastAt.get(kind);
    if (
      lastSentAt === undefined
      || now - lastSentAt >= this.broadcastThrottleMs
    ) {
      this.dispatchBroadcast(kind, data);
      return true;
    }

    this.pendingBroadcasts.set(kind, data);
    if (!this.broadcastTimers.has(kind)) {
      const wait = this.broadcastThrottleMs - (now - lastSentAt);
      const timer = this.setTimeout(() => {
        this.broadcastTimers.delete(kind);
        const pending = this.pendingBroadcasts.get(kind);
        this.pendingBroadcasts.delete(kind);
        if (pending && this.channel && this.subscribed) {
          this.dispatchBroadcast(kind, pending);
        }
      }, wait);
      this.broadcastTimers.set(kind, timer);
    }
    return true;
  }

  dispatchBroadcast(kind, data) {
    const channel = this.channel;
    const lifecycle = this.lifecycle;
    if (!channel || !this.identity) return;

    this.lastBroadcastAt.set(kind, this.now());
    const payload = {
      userId: this.identity.id,
      data,
      sentAt: new Date(this.now()).toISOString(),
    };

    Promise.resolve(channel.send({
      type: 'broadcast',
      event: kind,
      payload,
    })).then((result) => {
      if (this.isCurrent(channel, lifecycle) && !SUCCESS_RESULTS.has(result)) {
        this.emitError(
          'broadcast',
          new Error(`Team ${kind} broadcast returned ${String(result)}`),
        );
      }
    }).catch((error) => {
      if (this.isCurrent(channel, lifecycle)) {
        this.emitError(
          'broadcast',
          normalizeError(error, `Could not broadcast team ${kind}`),
        );
      }
    });
  }

  handleIncomingBroadcast(kind, payload) {
    const envelope = payload?.payload ?? payload;
    if (!envelope || typeof envelope !== 'object') return;

    const userId = safeString(envelope.userId, 128);
    const data = kind === 'pointer'
      ? normalizePointer(envelope.data)
      : normalizeSelection(envelope.data);
    if (!userId || !data) return;

    this.emit(kind, {
      userId,
      data,
      sentAt: validIsoDate(envelope.sentAt),
      isSelf: userId === this.identity?.id,
    });
  }

  clearBroadcastQueue() {
    for (const timer of this.broadcastTimers.values()) {
      this.clearTimeout(timer);
    }
    this.broadcastTimers.clear();
    this.pendingBroadcasts.clear();
    this.lastBroadcastAt.clear();
  }

  isCurrent(channel, lifecycle) {
    return this.channel === channel && this.lifecycle === lifecycle;
  }

  setStatus(status, detail = {}) {
    const changed = this.status !== status;
    this.status = status;
    if (changed || detail.reason || detail.error) {
      this.emit('status', {
        status,
        topic: this.topic,
        reason: detail.reason ?? null,
        error: detail.error ?? null,
      });
    }
  }

  setCollaborators(collaborators) {
    if (JSON.stringify(this.collaborators) === JSON.stringify(collaborators)) {
      return;
    }
    this.collaborators = collaborators;
    this.emit(
      'collaborators',
      collaborators.map((collaborator) => ({ ...collaborator })),
    );
  }

  emitError(phase, error) {
    this.emit('error', { phase, error });
  }

  emit(event, payload) {
    for (const listener of this.listeners.get(event) ?? []) {
      try {
        listener(payload);
      } catch {
        // A consumer listener must not interrupt Realtime lifecycle handling.
      }
    }
  }
}

export function normalizePresenceCollaborators(state, selfId = null) {
  const collaborators = new Map();

  for (const [presenceKey, rawEntries] of Object.entries(state ?? {})) {
    const entries = Array.isArray(rawEntries) ? rawEntries : [rawEntries];
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const id = safeString(
        entry.user_id ?? entry.userId ?? entry.id ?? presenceKey,
        128,
      );
      if (!id) continue;

      const next = {
        id,
        name: safeString(
          entry.display_name ?? entry.displayName ?? entry.name,
          80,
        ) ?? 'Teammate',
        avatarUrl: safeAvatarUrl(entry.avatar_url ?? entry.avatarUrl),
        mode: ALLOWED_MODES.has(entry.mode)
          ? entry.mode
          : TEAM_PRESENCE_MODES.VIEWING,
        isSelf: id === selfId,
      };
      const current = collaborators.get(id);
      if (!current) {
        collaborators.set(id, next);
      } else {
        collaborators.set(id, {
          ...current,
          name: current.name === 'Teammate' ? next.name : current.name,
          avatarUrl: current.avatarUrl ?? next.avatarUrl,
          mode:
            current.mode === TEAM_PRESENCE_MODES.EDITING
            || next.mode === TEAM_PRESENCE_MODES.EDITING
              ? TEAM_PRESENCE_MODES.EDITING
              : TEAM_PRESENCE_MODES.VIEWING,
        });
      }
    }
  }

  return [...collaborators.values()].sort((left, right) => {
    if (left.isSelf !== right.isSelf) return left.isSelf ? -1 : 1;
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
  });
}

function normalizeIdentity(identity) {
  if (!identity || typeof identity !== 'object') {
    throw new TypeError('Team presence identity is required');
  }
  const id = safeString(identity.id ?? identity.userId, 128);
  if (!id) throw new TypeError('Team presence identity requires an id');

  return {
    id,
    name:
      safeString(
        identity.displayName ?? identity.display_name ?? identity.name,
        80,
      ) ?? 'Teammate',
    avatarUrl: safeAvatarUrl(identity.avatarUrl ?? identity.avatar_url),
    mode: ALLOWED_MODES.has(identity.mode)
      ? identity.mode
      : TEAM_PRESENCE_MODES.VIEWING,
  };
}

function normalizeChannelSegment(value, field) {
  const segment = safeString(value, 256);
  if (!segment || segment.includes(':') || /[\u0000-\u001f\u007f]/.test(segment)) {
    throw new TypeError(`${field} is not a valid team presence channel segment`);
  }
  return segment;
}

function normalizePointer(pointer) {
  if (
    !pointer
    || typeof pointer !== 'object'
    || !Number.isFinite(pointer.x)
    || !Number.isFinite(pointer.y)
  ) {
    return null;
  }
  return compactObject({
    x: pointer.x,
    y: pointer.y,
    surface: safeString(pointer.surface ?? pointer.context, 64),
    pointerType: safeString(pointer.pointerType, 24),
  });
}

function normalizeSelection(selection) {
  if (!selection || typeof selection !== 'object') return null;
  const normalized = compactObject({
    anchor: safeSelectionPoint(selection.anchor),
    head: safeSelectionPoint(selection.head),
    from: safeSelectionPoint(selection.from),
    to: safeSelectionPoint(selection.to),
    surface: safeString(selection.surface ?? selection.context, 64),
  });
  if (Array.isArray(selection.itemIds)) {
    normalized.itemIds = [
      ...new Set(
        selection.itemIds
          .slice(0, 50)
          .map((value) => safeString(value, 128))
          .filter(Boolean),
      ),
    ];
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

function safeSelectionPoint(value) {
  if (Number.isFinite(value)) return value;
  return safeString(value, 128);
}

function safeString(value, maxLength) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function safeAvatarUrl(value) {
  const url = safeString(value, 2048);
  if (!url) return null;
  try {
    const parsed = new URL(
      url,
      globalThis.location?.origin ?? 'https://lokus.local',
    );
    return ['http:', 'https:', 'blob:'].includes(parsed.protocol) ? url : null;
  } catch {
    return null;
  }
}

function validIsoDate(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    return null;
  }
  return new Date(value).toISOString();
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined),
  );
}

function sameIdentity(left, right) {
  return left.id === right.id
    && left.name === right.name
    && left.avatarUrl === right.avatarUrl
    && left.mode === right.mode;
}

function normalizeError(error, fallbackMessage) {
  const message = safeString(error?.message, 300) ?? fallbackMessage;
  return new Error(message);
}

export const teamPresenceClient = new TeamPresenceClient();
