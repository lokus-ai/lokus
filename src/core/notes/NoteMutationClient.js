import { invoke } from '@tauri-apps/api/core';
import { writeFileGuarded } from '../sync/guardedWrite';
import { useTabMetaStore } from '../../stores/tabMeta';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { getEditor } from '../../stores/editorRegistry';
import { teamCollaboration } from '../../stores/teamCollaboration';

const EDITOR_SOURCES = new Set(['editor-save', 'tab-saver']);

export function isSupportedNotePath(path) {
  return typeof path === 'string' && /\.(md|markdown|txt)$/i.test(path);
}

export class NoteMutationClient {
  constructor({
    foundationEnabled = () =>
      !!globalThis.__LOKUS_FEATURE_FLAGS__?.enable_note_engine_foundation,
  } = {}) {
    this.foundationEnabled = foundationEnabled;
    this.lastWrittenContent = new Map();
    this.remoteMutationLocks = new Map();
  }

  async writeNote({
    workspacePath,
    path,
    content,
    baseContent,
    source = 'unknown',
  }) {
    if (!isSupportedNotePath(path)) {
      throw new Error(`Unsupported note path: ${path}`);
    }
    this.assertNotRemoteLocked(path);
    if (!EDITOR_SOURCES.has(source) && hasDirtyTab(path)) {
      throw new Error(`open dirty tab blocks ${source}: ${path}`);
    }
    const pathKey = normalizedPathKey(path);
    if (baseContent !== undefined) {
      const knownContent = this.lastWrittenContent.get(pathKey);
      if (knownContent !== undefined && knownContent !== baseContent) {
        throw new Error(`stale note session: ${path}`);
      }
      if (knownContent === undefined) {
        this.lastWrittenContent.set(pathKey, baseContent);
      }
    }
    if (!this.foundationEnabled()) {
      await writeFileGuarded(path, content);
      this.lastWrittenContent.set(pathKey, content);
      return { legacy: true };
    }

    let identity;
    try {
      identity = await invoke('get_note_identity', { workspacePath, path });
    } catch (error) {
      if (!isMissingNoteIdentityError(error)) throw error;
      await invoke('initialize_note_engine', { workspacePath });
      try {
        identity = await invoke('get_note_identity', { workspacePath, path });
      } catch (retryError) {
        if (!isMissingNoteIdentityError(retryError) || baseContent !== undefined) {
          throw retryError;
        }
        const result = await invoke('create_note_content', {
          workspacePath,
          path,
          content,
          source,
        });
        notifyTeamQueued(result, workspacePath);
        this.lastWrittenContent.set(pathKey, content);
        return result;
      }
    }
    const result = await invoke('write_note_content', {
      workspacePath,
      path,
      content,
      expectedLocalGeneration: identity.local_generation,
      source,
    });
    notifyTeamQueued(result, workspacePath);
    this.lastWrittenContent.set(pathKey, content);
    return result;
  }

  async renameNote(path, newName, {
    workspacePath = globalThis.__WORKSPACE_PATH__,
    source = 'file-tree-rename',
  } = {}) {
    if (!isSupportedNotePath(path)) {
      throw new Error(`Unsupported note path: ${path}`);
    }
    this.assertNotRemoteLocked(path);
    if (!EDITOR_SOURCES.has(source) && hasDirtyTab(path)) {
      throw new Error(`open dirty tab blocks rename: ${path}`);
    }
    const targetPath = siblingPath(path, newName);
    if (this.foundationEnabled()) {
      if (!workspacePath) throw new Error('workspace path is required for note relocation');
      const result = await invoke('relocate_note_content', {
        workspacePath,
        sourcePath: path,
        targetPath,
        mutationKind: 'rename',
        source,
      });
      notifyTeamQueued(result, workspacePath);
    } else {
      await invoke('rename_file', { path, newName });
    }
    const oldKey = normalizedPathKey(path);
    if (this.lastWrittenContent.has(oldKey)) {
      const content = this.lastWrittenContent.get(oldKey);
      this.lastWrittenContent.delete(oldKey);
      this.lastWrittenContent.set(normalizedPathKey(targetPath), content);
    }
    return targetPath;
  }

  forgetPath(path) {
    this.lastWrittenContent.delete(normalizedPathKey(path));
  }

  acceptRemoteContent(path, content) {
    this.lastWrittenContent.set(normalizedPathKey(path), content);
  }

  hasDirtyPath(path) {
    return hasDirtyTab(path);
  }

  async removeNote({ workspacePath, path, source = 'unknown' }) {
    if (!isSupportedNotePath(path)) {
      throw new Error(`Unsupported note path: ${path}`);
    }
    this.assertNotRemoteLocked(path);
    if (hasDirtyTab(path)) {
      throw new Error(`open dirty tab blocks ${source}: ${path}`);
    }
    if (!this.foundationEnabled()) {
      await invoke('delete_file', { path });
      this.forgetPath(path);
      return { legacy: true };
    }
    const result = await invoke('tombstone_note_content', {
      workspacePath,
      path,
      source,
    });
    notifyTeamQueued(result, workspacePath);
    this.forgetPath(path);
    return result;
  }

  async moveNote(sourcePath, destinationDir, {
    workspacePath = globalThis.__WORKSPACE_PATH__,
    source = 'file-tree-move',
  } = {}) {
    if (!isSupportedNotePath(sourcePath)) {
      throw new Error(`Unsupported note path: ${sourcePath}`);
    }
    this.assertNotRemoteLocked(sourcePath);
    if (hasDirtyTab(sourcePath)) {
      throw new Error(`open dirty tab blocks move: ${sourcePath}`);
    }
    const separator = destinationDir.includes('\\') ? '\\' : '/';
    const filename = sourcePath.split(/[/\\]/).pop();
    const destinationPath = `${destinationDir}${separator}${filename}`;
    if (this.foundationEnabled()) {
      if (!workspacePath) throw new Error('workspace path is required for note relocation');
      const result = await invoke('relocate_note_content', {
        workspacePath,
        sourcePath,
        targetPath: destinationPath,
        mutationKind: 'move',
        source,
      });
      notifyTeamQueued(result, workspacePath);
    } else {
      await invoke('move_file', { sourcePath, destinationDir });
    }
    const oldKey = normalizedPathKey(sourcePath);
    if (this.lastWrittenContent.has(oldKey)) {
      const content = this.lastWrittenContent.get(oldKey);
      this.lastWrittenContent.delete(oldKey);
      this.lastWrittenContent.set(normalizedPathKey(destinationPath), content);
    }
    return destinationPath;
  }

  async restoreNote({
    workspacePath,
    noteId,
    source = 'user-restore',
  }) {
    if (!this.foundationEnabled()) {
      throw new Error('note restoration requires the note foundation');
    }
    const result = await invoke('restore_note_content', {
      workspacePath,
      noteId,
      source,
    });
    notifyTeamQueued(result, workspacePath);
    return result;
  }

  lockRemotePaths(paths) {
    const keys = [...new Set(paths.filter(Boolean).map(normalizedPathKey))];
    for (const path of paths) {
      if (path && hasDirtyTab(path)) {
        throw new Error(`dirty open note blocks team apply: ${path}`);
      }
    }
    for (const key of keys) {
      this.remoteMutationLocks.set(key, (this.remoteMutationLocks.get(key) ?? 0) + 1);
    }
    this.refreshEditorLocks(keys);
    return () => {
      for (const key of keys) {
        const remaining = (this.remoteMutationLocks.get(key) ?? 1) - 1;
        if (remaining <= 0) this.remoteMutationLocks.delete(key);
        else this.remoteMutationLocks.set(key, remaining);
      }
      this.refreshEditorLocks(keys);
    };
  }

  assertNotRemoteLocked(path) {
    if (this.isRemotePathLocked(path)) {
      throw new Error(`remote note mutation is in progress: ${path}`);
    }
  }

  isRemotePathLocked(path) {
    return !!path && (this.remoteMutationLocks.get(normalizedPathKey(path)) ?? 0) > 0;
  }

  refreshEditorLocks(keys) {
    for (const group of useEditorGroupStore.getState().getAllGroups()) {
      if (!group.activeTab || !keys.includes(normalizedPathKey(group.activeTab))) continue;
      const editor = getEditor(group.id);
      if (editor?.setProps) {
        editor.setProps({ editable: editor.props?.editable });
      }
    }
  }
}

export const noteMutationClient = new NoteMutationClient();

function normalizedPathKey(path) {
  return path.replace(/\\/g, '/').toLowerCase();
}

function isMissingNoteIdentityError(error) {
  const message = String(error?.message ?? error).toLowerCase();
  return message.includes('note identity not found')
    || message.includes('query returned no rows')
    || message.includes('no such file or directory')
    || message.includes('the system cannot find the file specified')
    || /\bos error 2\b/.test(message);
}

function siblingPath(path, newName) {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  if (slash === -1) return newName;
  return `${path.slice(0, slash + 1)}${newName}`;
}

function hasDirtyTab(path) {
  const target = normalizedPathKey(path);
  return Object.entries(useTabMetaStore.getState().tabs).some(([key, metadata]) => {
    if (!metadata?.dirty) return false;
    const separator = key.indexOf('\u0000');
    if (separator === -1) return false;
    return normalizedPathKey(key.slice(separator + 1)) === target;
  });
}

function notifyTeamQueued(result, workspacePath) {
  if (
    !result?.queued_for_sync
    || result.scope_kind !== 'team'
    || !result.scope_id
    || typeof globalThis.dispatchEvent !== 'function'
    || typeof globalThis.CustomEvent !== 'function'
  ) {
    return;
  }
  const current = teamCollaboration.get(result.scope_id, result.note_id);
  teamCollaboration.update(result.scope_id, result.note_id, {
    syncState: globalThis.navigator?.onLine === false ? 'offline' : 'idle',
    outboxCount: current.outboxCount + 1,
  });
  globalThis.dispatchEvent(new CustomEvent('lokus:team-note-queued', {
    detail: {
      workspacePath,
      spaceId: result.scope_id,
      noteId: result.note_id,
    },
  }));
}
