import { invoke } from '@tauri-apps/api/core';
import { isSupportedNotePath, noteMutationClient } from '../notes/NoteMutationClient.js';

export class PersonalSyncAdapter {
  constructor({
    foundationEnabled = () =>
      !!globalThis.__LOKUS_FEATURE_FLAGS__?.enable_note_engine_foundation,
  } = {}) {
    this.foundationEnabled = foundationEnabled;
    this.initializedWorkspaces = new Set();
  }

  async applyTextFile({
    workspacePath,
    workspaceId,
    path,
    content,
    remoteRevisionId,
    remoteSequence = null,
  }) {
    if (isSupportedNotePath(path) && noteMutationClient.hasDirtyPath(path)) {
      throw new Error(`dirty open note blocks remote apply: ${path}`);
    }
    if (!this.foundationEnabled() || !isSupportedNotePath(path)) {
      await invoke('write_file_content', { path, content });
      return { legacy: true };
    }
    await this.ensureInitialized(workspacePath);
    try {
      const identity = await invoke('get_note_identity', { workspacePath, path });
      if (identity.scope_kind === 'team') {
        throw new Error(`personal sync cannot own team note: ${path}`);
      }
    } catch (error) {
      if (String(error?.message ?? error).includes('personal sync cannot own')) throw error;
      const message = String(error?.message ?? error).toLowerCase();
      if (
        !message.includes('no such')
        && !message.includes('not found')
        && !message.includes('query returned no rows')
      ) {
        throw error;
      }
    }
    const result = await invoke('apply_remote_note_content', {
      workspacePath,
      path,
      content,
      personalScopeId: workspaceId,
      remoteRevisionId,
      remoteSequence,
    });
    noteMutationClient.acceptRemoteContent(path, content);
    return result;
  }

  async acknowledgeUpload({
    workspacePath,
    workspaceId,
    path,
    remoteRevisionId,
  }) {
    if (!this.foundationEnabled() || !isSupportedNotePath(path)) return 0;
    await this.ensureInitialized(workspacePath);
    return invoke('acknowledge_personal_note_sync', {
      workspacePath,
      personalScopeId: workspaceId,
      path,
      remoteRevisionId,
    });
  }

  async ensureInitialized(workspacePath) {
    if (this.initializedWorkspaces.has(workspacePath)) return;
    await invoke('initialize_note_engine', { workspacePath });
    this.initializedWorkspaces.add(workspacePath);
  }

  async excludeTeamNotes(workspacePath, files) {
    if (!this.foundationEnabled() || !files?.size) return files;
    await this.ensureInitialized(workspacePath);
    const teamPaths = await invoke('get_team_note_paths', { workspacePath });
    const excluded = new Set(teamPaths.map(normalizedPathKey));
    return new Map(
      [...files].filter(([path]) => !excluded.has(normalizedPathKey(path))),
    );
  }
}

export const personalSyncAdapter = new PersonalSyncAdapter();

function normalizedPathKey(path) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}
