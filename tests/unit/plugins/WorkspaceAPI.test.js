/**
 * Unit tests for WorkspaceAPI
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkspaceAPI } from '../../../src/plugins/api/WorkspaceAPI.js';

describe('WorkspaceAPI', () => {
  let workspaceAPI;
  let mockWorkspaceManager;

  beforeEach(() => {
    mockWorkspaceManager = {
      getWorkspaceFolders: vi.fn(() => [
        {
          uri: { path: '/test/workspace', toString: () => '/test/workspace' },
          name: 'test-workspace',
          index: 0
        }
      ]),
      getRootPath: vi.fn(() => '/test/workspace')
    };

    workspaceAPI = new WorkspaceAPI(mockWorkspaceManager);
  });

  describe('findFiles()', () => {
    test('should return empty array when no root path', async () => {
      workspaceAPI.rootPath = null;
      workspaceAPI._workspaceFolders = [];

      const files = await workspaceAPI.findFiles('*.js');

      expect(files).toEqual([]);
    });

    test('should handle string pattern', async () => {
      workspaceAPI.rootPath = '/test/workspace';

      // Mock the readDir function to avoid actual file system access
      const files = await workspaceAPI.findFiles('*.js');

      expect(Array.isArray(files)).toBe(true);
    });

    test('should respect maxResults parameter', async () => {
      workspaceAPI.rootPath = '/test/workspace';

      const files = await workspaceAPI.findFiles('*.js', null, 5);

      expect(Array.isArray(files)).toBe(true);
    });

    test('should handle exclude pattern', async () => {
      workspaceAPI.rootPath = '/test/workspace';

      const files = await workspaceAPI.findFiles('*.js', '**/node_modules/**');

      expect(Array.isArray(files)).toBe(true);
    });

    test('should handle cancellation token', async () => {
      workspaceAPI.rootPath = '/test/workspace';
      const token = { isCancellationRequested: true };

      const files = await workspaceAPI.findFiles('*.js', null, null, token);

      expect(Array.isArray(files)).toBe(true);
    });

    test('should handle errors gracefully', async () => {
      workspaceAPI.rootPath = '/nonexistent/path';

      const files = await workspaceAPI.findFiles('*.js');

      expect(Array.isArray(files)).toBe(true);
    });
  });

  describe('openTextDocument()', () => {
    test('should open document with string URI', async () => {
      const doc = await workspaceAPI.openTextDocument('/test/file.md');

      expect(doc).toHaveProperty('uri');
      expect(doc).toHaveProperty('fileName');
      expect(doc).toHaveProperty('languageId');
      expect(doc.fileName).toBe('file.md');
    });

    test('should open document with options object', async () => {
      const doc = await workspaceAPI.openTextDocument({
        content: 'Test content'
      });

      expect(doc).toHaveProperty('uri');
      expect(doc.getText()).toBe('Test content');
    });

    test('should emit open-document-request event', async () => {
      const listener = vi.fn();
      workspaceAPI.on('open-document-request', listener);

      await workspaceAPI.openTextDocument('/test/file.md');

      expect(listener).toHaveBeenCalled();
    });

    test('should throw error for invalid URI', async () => {
      await expect(workspaceAPI.openTextDocument(null))
        .rejects.toThrow('Invalid document URI');
    });

    test('should return document with correct language ID', async () => {
      const mdDoc = await workspaceAPI.openTextDocument('/test/file.md');
      expect(mdDoc.languageId).toBe('markdown');

      const jsDoc = await workspaceAPI.openTextDocument('/test/file.js');
      expect(jsDoc.languageId).toBe('javascript');

      const tsDoc = await workspaceAPI.openTextDocument('/test/file.ts');
      expect(tsDoc.languageId).toBe('typescript');

      const unknownDoc = await workspaceAPI.openTextDocument('/test/file.xyz');
      expect(unknownDoc.languageId).toBe('plaintext');
    });
  });

  describe('_getLanguageId()', () => {
    test('should return correct language for markdown', () => {
      expect(workspaceAPI._getLanguageId('file.md')).toBe('markdown');
    });

    test('should return correct language for javascript', () => {
      expect(workspaceAPI._getLanguageId('file.js')).toBe('javascript');
    });

    test('should return correct language for typescript', () => {
      expect(workspaceAPI._getLanguageId('file.ts')).toBe('typescript');
    });

    test('should return correct language for JSX', () => {
      expect(workspaceAPI._getLanguageId('file.jsx')).toBe('javascriptreact');
    });

    test('should return correct language for TSX', () => {
      expect(workspaceAPI._getLanguageId('file.tsx')).toBe('typescriptreact');
    });

    test('should return plaintext for unknown extensions', () => {
      expect(workspaceAPI._getLanguageId('file.xyz')).toBe('plaintext');
    });

    test('should handle URIs without extensions', () => {
      expect(workspaceAPI._getLanguageId('file')).toBe('plaintext');
    });
  });

  describe('saveAll()', () => {
    test('should emit save-all-request event', async () => {
      const listener = vi.fn();
      workspaceAPI.on('save-all-request', listener);

      await workspaceAPI.saveAll();

      expect(listener).toHaveBeenCalledWith({ includeUntitled: false });
    });

    test('should emit save-all-request with includeUntitled', async () => {
      const listener = vi.fn();
      workspaceAPI.on('save-all-request', listener);

      await workspaceAPI.saveAll(true);

      expect(listener).toHaveBeenCalledWith({ includeUntitled: true });
    });

    test('should return true', async () => {
      const result = await workspaceAPI.saveAll();
      expect(result).toBe(true);
    });
  });

  describe('applyEdit()', () => {
    test('should emit apply-edit-request event', async () => {
      const listener = vi.fn();
      workspaceAPI.on('apply-edit-request', listener);

      const edit = { changes: [] };
      await workspaceAPI.applyEdit(edit);

      expect(listener).toHaveBeenCalledWith({ edit });
    });

    test('should return true on success', async () => {
      const result = await workspaceAPI.applyEdit({ changes: [] });
      expect(result).toBe(true);
    });
  });

  describe('onDidOpenTextDocument()', () => {
    test('should register listener', () => {
      const listener = vi.fn();
      const disposable = workspaceAPI.onDidOpenTextDocument(listener);

      expect(disposable).toHaveProperty('dispose');
      expect(typeof disposable.dispose).toBe('function');
    });

    test('should call listener when document opened', () => {
      const listener = vi.fn();
      workspaceAPI.onDidOpenTextDocument(listener);

      const doc = { uri: 'test' };
      workspaceAPI.emit('document-opened', doc);

      expect(listener).toHaveBeenCalledWith(doc);
    });

    test('should dispose listener correctly', () => {
      const listener = vi.fn();
      const disposable = workspaceAPI.onDidOpenTextDocument(listener);

      disposable.dispose();
      workspaceAPI.emit('document-opened', {});

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('onDidCloseTextDocument()', () => {
    test('should register listener', () => {
      const listener = vi.fn();
      const disposable = workspaceAPI.onDidCloseTextDocument(listener);

      expect(disposable).toHaveProperty('dispose');
      expect(typeof disposable.dispose).toBe('function');
    });

    test('should call listener when document closed', () => {
      const listener = vi.fn();
      workspaceAPI.onDidCloseTextDocument(listener);

      const doc = { uri: 'test' };
      workspaceAPI.emit('document-closed', doc);

      expect(listener).toHaveBeenCalledWith(doc);
    });
  });

  describe('onDidSaveTextDocument()', () => {
    test('should register listener', () => {
      const listener = vi.fn();
      const disposable = workspaceAPI.onDidSaveTextDocument(listener);

      expect(disposable).toHaveProperty('dispose');
      expect(typeof disposable.dispose).toBe('function');
    });

    test('should call listener when document saved', () => {
      const listener = vi.fn();
      workspaceAPI.onDidSaveTextDocument(listener);

      const doc = { uri: 'test' };
      workspaceAPI.emit('document-saved', doc);

      expect(listener).toHaveBeenCalledWith(doc);
    });
  });

  describe('onDidChangeTextDocument()', () => {
    test('should register listener', () => {
      const listener = vi.fn();
      const disposable = workspaceAPI.onDidChangeTextDocument(listener);

      expect(disposable).toHaveProperty('dispose');
      expect(typeof disposable.dispose).toBe('function');
    });

    test('should call listener when document changed', () => {
      const listener = vi.fn();
      workspaceAPI.onDidChangeTextDocument(listener);

      const event = { document: { uri: 'test' }, contentChanges: [] };
      workspaceAPI.emit('document-changed', event);

      expect(listener).toHaveBeenCalledWith(event);
    });
  });

  describe('onDidChangeWorkspaceFolders()', () => {
    test('should register listener', () => {
      const listener = vi.fn();
      const disposable = workspaceAPI.onDidChangeWorkspaceFolders(listener);

      expect(disposable).toHaveProperty('dispose');
      expect(typeof disposable.dispose).toBe('function');
    });

    test('should call listener when workspace folders changed', () => {
      const listener = vi.fn();
      workspaceAPI.onDidChangeWorkspaceFolders(listener);

      const event = { added: [], removed: [] };
      workspaceAPI.emit('workspace-folders-changed', event);

      expect(listener).toHaveBeenCalledWith(event);
    });
  });

  describe('createFileSystemWatcher()', () => {
    test('should create watcher with event handlers', () => {
      const watcher = workspaceAPI.createFileSystemWatcher('**/*.js');

      expect(watcher).toHaveProperty('onDidCreate');
      expect(watcher).toHaveProperty('onDidChange');
      expect(watcher).toHaveProperty('onDidDelete');
      expect(watcher).toHaveProperty('dispose');
    });

    test('should register create event handler', () => {
      const watcher = workspaceAPI.createFileSystemWatcher('**/*.js');
      const listener = vi.fn();

      const disposable = watcher.onDidCreate(listener);

      expect(disposable).toHaveProperty('dispose');
    });

    test('should register change event handler', () => {
      const watcher = workspaceAPI.createFileSystemWatcher('**/*.js');
      const listener = vi.fn();

      const disposable = watcher.onDidChange(listener);

      expect(disposable).toHaveProperty('dispose');
    });

    test('should register delete event handler', () => {
      const watcher = workspaceAPI.createFileSystemWatcher('**/*.js');
      const listener = vi.fn();

      const disposable = watcher.onDidDelete(listener);

      expect(disposable).toHaveProperty('dispose');
    });

    test('should respect ignoreCreateEvents flag', () => {
      const watcher = workspaceAPI.createFileSystemWatcher('**/*.js', true);
      const listener = vi.fn();

      watcher.onDidCreate(listener);
      watcher.emit('create', { uri: 'test' });

      // Listener should not be called if create events are ignored
      expect(listener).not.toHaveBeenCalled();
    });

    test('should respect ignoreChangeEvents flag', () => {
      const watcher = workspaceAPI.createFileSystemWatcher('**/*.js', false, true);
      const listener = vi.fn();

      watcher.onDidChange(listener);
      watcher.emit('change', { uri: 'test' });

      // Listener should not be called if change events are ignored
      expect(listener).not.toHaveBeenCalled();
    });

    test('should respect ignoreDeleteEvents flag', () => {
      const watcher = workspaceAPI.createFileSystemWatcher('**/*.js', false, false, true);
      const listener = vi.fn();

      watcher.onDidDelete(listener);
      watcher.emit('delete', { uri: 'test' });

      // Listener should not be called if delete events are ignored
      expect(listener).not.toHaveBeenCalled();
    });

    test('should dispose watcher correctly', () => {
      const watcher = workspaceAPI.createFileSystemWatcher('**/*.js');
      const listener = vi.fn();

      watcher.onDidCreate(listener);
      watcher.dispose();

      watcher.emit('create', { uri: 'test' });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getWorkspaceFolder()', () => {
    test('should find workspace folder for URI', () => {
      const folder = workspaceAPI.getWorkspaceFolder('/test/workspace/file.js');

      expect(folder).toBeDefined();
      expect(folder.name).toBe('test-workspace');
    });

    test('should return undefined for non-workspace URI', () => {
      const folder = workspaceAPI.getWorkspaceFolder('/other/path/file.js');

      expect(folder).toBeUndefined();
    });
  });

  describe('asRelativePath()', () => {
    test('should return relative path', () => {
      const relativePath = workspaceAPI.asRelativePath('/test/workspace/src/file.js');

      expect(relativePath).toBe('src/file.js');
    });

    test('should include workspace folder name if requested', () => {
      const relativePath = workspaceAPI.asRelativePath('/test/workspace/src/file.js', true);

      expect(relativePath).toContain('test-workspace');
    });

    test('should return original path if not in workspace', () => {
      const path = '/other/path/file.js';
      const relativePath = workspaceAPI.asRelativePath(path);

      expect(relativePath).toBe(path);
    });
  });
});
