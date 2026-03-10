import { supabase } from '../auth/supabase';
import { COOLDOWN_MS } from './constants';

export class WorkspaceRegistry {
  /**
   * Get the user's registered workspace.
   * Returns { workspace_id, name, last_switched_at } or null.
   */
  async getRegistered(userId) {
    if (!userId) return null;
    try {
      const { data } = await supabase
        .from('user_workspaces')
        .select('workspace_id, name, last_switched_at')
        .eq('user_id', userId)
        .maybeSingle();
      return data || null;
    } catch {
      return null;
    }
  }

  /**
   * Register (upsert) a workspace for the user.
   * Sets last_switched_at to now.
   */
  async register(userId, workspaceId, name) {
    // Delete + insert (enforce 1 per user)
    await supabase.from('user_workspaces').delete().eq('user_id', userId);
    const { error } = await supabase.from('user_workspaces').insert({
      user_id: userId,
      workspace_id: workspaceId,
      name,
      last_switched_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  /**
   * Remove the user's workspace registration.
   */
  async unregister(userId) {
    const { error } = await supabase
      .from('user_workspaces')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  }

  /**
   * Check if the user can switch workspaces (6h cooldown).
   * Returns { canSwitch, remainingMs }.
   */
  async checkCooldown(userId) {
    const registered = await this.getRegistered(userId);
    if (!registered || !registered.last_switched_at) {
      return { canSwitch: true, remainingMs: 0 };
    }

    const switchedAt = new Date(registered.last_switched_at).getTime();
    const elapsed = Date.now() - switchedAt;
    const remaining = COOLDOWN_MS - elapsed;

    if (remaining <= 0) {
      return { canSwitch: true, remainingMs: 0 };
    }
    return { canSwitch: false, remainingMs: remaining };
  }
}

export const workspaceRegistry = new WorkspaceRegistry();
