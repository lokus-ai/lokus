import { invoke } from '@tauri-apps/api/core';
import { supabase } from '../auth/supabase';
import { teamControlClient } from './TeamControlClient';
import { teamSyncClient } from './TeamSyncClient';

export class TeamRealtimeCoordinator {
  constructor({
    supabaseClient = supabase,
    invokeFn = invoke,
    controlClient = teamControlClient,
    syncClient = teamSyncClient,
    loadMembershipHints = null,
    loadSpaces = null,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
  } = {}) {
    this.supabase = supabaseClient;
    this.invoke = invokeFn;
    this.controlClient = controlClient;
    this.syncClient = syncClient;
    this.loadMembershipHints = loadMembershipHints
      ?? (() => this.queryMembershipHints());
    this.loadSpaces = loadSpaces ?? ((teamId) => this.querySpaces(teamId));
    this.setInterval = setIntervalFn;
    this.clearInterval = clearIntervalFn;
    this.setTimeout = setTimeoutFn;
    this.clearTimeout = clearTimeoutFn;
    this.channel = null;
    this.interval = null;
    this.workspacePath = null;
    this.userId = null;
    this.spaces = new Map();
    this.inFlightPulls = new Map();
    this.queuedPushes = new Map();
    this.localQueuedHandler = (event) => this.handleLocalQueued(event);
    this.lifecycleToken = 0;
  }

  async start(workspacePath, userId) {
    const token = ++this.lifecycleToken;
    await this.teardown();
    if (token !== this.lifecycleToken) return;
    this.workspacePath = workspacePath;
    this.userId = userId;
    this.channel = this.supabase
      .channel(`team-notes-hints:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_membership_realtime_hints',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => (
          token === this.lifecycleToken
            ? this.handleMembershipHint(payload.new, token)
            : undefined
        ),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'space_sync_counters',
        },
        (payload) => (
          token === this.lifecycleToken
            ? this.handleSpaceHint(payload.new, token)
            : undefined
        ),
      )
      .subscribe();
    globalThis.addEventListener?.('lokus:team-note-queued', this.localQueuedHandler);
    await this.refreshAll(token);
    if (token !== this.lifecycleToken) return;
    this.interval = this.setInterval(() => {
      this.refreshAll(token).catch((error) => {
        console.error('[TeamNotes] periodic reconciliation failed:', error);
      });
    }, 5 * 60 * 1000);
  }

  async stop() {
    this.lifecycleToken += 1;
    await this.teardown();
  }

  async teardown() {
    if (this.interval !== null) {
      this.clearInterval(this.interval);
      this.interval = null;
    }
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    globalThis.removeEventListener?.('lokus:team-note-queued', this.localQueuedHandler);
    for (const timeout of this.queuedPushes.values()) this.clearTimeout(timeout);
    this.queuedPushes.clear();
    this.spaces.clear();
    this.inFlightPulls.clear();
  }

  async refreshAll(token = this.lifecycleToken) {
    const hints = await this.loadMembershipHints(this.userId);
    for (const hint of hints) {
      if (token !== this.lifecycleToken) return;
      await this.handleMembershipHint(hint, token);
    }
  }

  async handleMembershipHint(hint, token = this.lifecycleToken) {
    if (!hint?.team_id || token !== this.lifecycleToken) return;
    const workspacePath = this.workspacePath;
    if (hint.membership_status === 'active') {
      try {
        await this.controlClient.provisionMissingDevices(hint.team_id);
        if (token !== this.lifecycleToken) return;
        await this.controlClient.getTeamKey(hint.team_id, hint.team_key_epoch);
      } catch (error) {
        if (token !== this.lifecycleToken) return;
        if (!isProvisioningPendingError(error)) throw error;
        await this.invoke('apply_team_membership_hint', {
          workspacePath,
          teamId: hint.team_id,
          membershipStatus: 'key_pending',
          permissionEpoch: hint.permission_epoch,
        });
        if (token !== this.lifecycleToken) return;
        globalThis.dispatchEvent?.(new CustomEvent('lokus:team-key-pending', {
          detail: { workspacePath, teamId: hint.team_id },
        }));
        return;
      }
      if (token !== this.lifecycleToken) return;
      const spaces = await this.loadSpaces(hint.team_id);
      if (token !== this.lifecycleToken) return;
      const readySpaces = [];
      for (const space of spaces) {
        if (token !== this.lifecycleToken) return;
        try {
          await this.controlClient.getSpaceKey(space.id, space.current_key_epoch);
        } catch (error) {
          if (token !== this.lifecycleToken) return;
          if (!isProvisioningPendingError(error)) throw error;
          this.spaces.delete(space.id);
          const queuedPush = this.queuedPushes.get(space.id);
          if (queuedPush !== undefined) {
            this.clearTimeout(queuedPush);
            this.queuedPushes.delete(space.id);
          }
          globalThis.dispatchEvent?.(new CustomEvent('lokus:team-key-pending', {
            detail: { workspacePath, teamId: hint.team_id, spaceId: space.id },
          }));
          continue;
        }
        if (token !== this.lifecycleToken) return;
        readySpaces.push(space);
      }
      if (token !== this.lifecycleToken) return;
      await this.invoke('apply_team_membership_hint', {
        workspacePath,
        teamId: hint.team_id,
        membershipStatus: hint.membership_status,
        permissionEpoch: hint.permission_epoch,
      });
      if (token !== this.lifecycleToken) return;
      for (const space of readySpaces) {
        if (token !== this.lifecycleToken) return;
        await this.invoke('refresh_team_note_scope', {
          workspacePath,
          teamId: hint.team_id,
          spaceId: space.id,
          permissionEpoch: hint.permission_epoch,
          keyEpoch: space.current_key_epoch,
        });
        if (token !== this.lifecycleToken) return;
        this.spaces.set(space.id, space);
        await this.syncClient.pushSpace(workspacePath, space.id);
        if (token !== this.lifecycleToken) return;
        await this.pullSpace(space, workspacePath, token);
      }
      return;
    }
    const scopes = await this.invoke('apply_team_membership_hint', {
      workspacePath,
      teamId: hint.team_id,
      membershipStatus: hint.membership_status,
      permissionEpoch: hint.permission_epoch,
    });
    if (token !== this.lifecycleToken) return;
    if (hint.membership_status === 'removed' || hint.membership_status === 'suspended') {
      await this.controlClient.deleteCachedTeamKeys(hint.team_id, scopes);
      if (token !== this.lifecycleToken) return;
      for (const [spaceId, space] of this.spaces) {
        if (space.team_id === hint.team_id) this.spaces.delete(spaceId);
      }
      return;
    }
  }

  async handleSpaceHint(hint, token = this.lifecycleToken) {
    const space = this.spaces.get(hint?.space_id);
    if (!space) return;
    await this.pullSpace(space, this.workspacePath, token);
  }

  handleLocalQueued(event) {
    const detail = event?.detail;
    if (
      detail?.workspacePath !== this.workspacePath
      || !this.spaces.has(detail?.spaceId)
    ) {
      return;
    }
    const existing = this.queuedPushes.get(detail.spaceId);
    if (existing !== undefined) this.clearTimeout(existing);
    const timeout = this.setTimeout(async () => {
      this.queuedPushes.delete(detail.spaceId);
      try {
        await this.syncClient.pushSpace(this.workspacePath, detail.spaceId);
      } catch (error) {
        console.error('[TeamNotes] queued push failed:', error);
      }
    }, 3_000);
    this.queuedPushes.set(detail.spaceId, timeout);
  }

  async pullSpace(
    space,
    workspacePath = this.workspacePath,
    token = this.lifecycleToken,
  ) {
    if (token !== this.lifecycleToken) return undefined;
    const existing = this.inFlightPulls.get(space.id);
    if (existing) return existing;
    const pull = this.syncClient
      .pullSpace(workspacePath, space.team_id, space.id)
      .finally(() => this.inFlightPulls.delete(space.id));
    this.inFlightPulls.set(space.id, pull);
    return pull;
  }

  async queryMembershipHints() {
    const { data, error } = await this.supabase
      .from('team_membership_realtime_hints')
      .select(
        'team_id,membership_status,membership_version,permission_epoch,team_key_epoch',
      )
      .eq('user_id', this.userId);
    if (error) throw error;
    return data ?? [];
  }

  async querySpaces(teamId) {
    const { data, error } = await this.supabase
      .from('spaces')
      .select('id,team_id,current_key_epoch')
      .eq('team_id', teamId)
      .is('deleted_at', null);
    if (error) throw error;
    return data ?? [];
  }
}

function isProvisioningPendingError(error) {
  return error?.code === 'TEAM_KEY_PENDING'
    || String(error?.message ?? error).includes('awaiting provisioning');
}

export const teamRealtimeCoordinator = new TeamRealtimeCoordinator();
