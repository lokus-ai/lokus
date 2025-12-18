/**
 * Tests for UIAPI - UI methods for plugin system
 * Tests showQuickPick, showOpenDialog, showSaveDialog, withProgress, and createOutputChannel
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UIAPI } from '../../../src/plugins/api/LokusPluginAPI.js';

// Mock Tauri dialog plugin
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}));

describe('UIAPI', () => {
  let uiAPI;
  let mockNotificationsAPI;

  beforeEach(() => {
    mockNotificationsAPI = {
      show: vi.fn(),
      update: vi.fn(),
      hide: vi.fn()
    };

    uiAPI = new UIAPI(null, mockNotificationsAPI);
    uiAPI.currentPluginId = 'test-plugin';
  });

  describe('createOutputChannel', () => {
    it('creates an output channel with correct name', () => {
      const channel = uiAPI.createOutputChannel('Test Channel');
      expect(channel.name).toBe('Test Channel');
      expect(channel._lines).toEqual([]);
    });

    it('appends text to output channel', () => {
      const channel = uiAPI.createOutputChannel('Test');
      channel.append('Hello');
      channel.append(' World');

      expect(channel._lines).toEqual(['Hello World']);
    });

    it('appends lines to output channel', () => {
      const channel = uiAPI.createOutputChannel('Test');
      channel.appendLine('Line 1');
      channel.appendLine('Line 2');

      expect(channel._lines).toEqual(['Line 1', 'Line 2']);
    });

    it('replaces output channel content', () => {
      const channel = uiAPI.createOutputChannel('Test');
      channel.appendLine('Line 1');
      channel.appendLine('Line 2');
      channel.replace('New content');

      expect(channel._lines).toEqual(['New content']);
    });

    it('clears output channel', () => {
      const channel = uiAPI.createOutputChannel('Test');
      channel.appendLine('Line 1');
      channel.appendLine('Line 2');
      channel.clear();

      expect(channel._lines).toEqual([]);
    });

    it('emits events on output channel operations', () => {
      const updateSpy = vi.fn();
      const showSpy = vi.fn();
      const hideSpy = vi.fn();
      const disposeSpy = vi.fn();

      uiAPI.on('output-channel-update', updateSpy);
      uiAPI.on('output-channel-show', showSpy);
      uiAPI.on('output-channel-hide', hideSpy);
      uiAPI.on('output-channel-dispose', disposeSpy);

      const channel = uiAPI.createOutputChannel('Test');
      channel.appendLine('Hello');
      channel.show();
      channel.hide();
      channel.dispose();

      expect(updateSpy).toHaveBeenCalled();
      expect(showSpy).toHaveBeenCalledWith({ name: 'Test', preserveFocus: undefined });
      expect(hideSpy).toHaveBeenCalledWith({ name: 'Test' });
      expect(disposeSpy).toHaveBeenCalledWith({ name: 'Test' });
    });
  });

  describe('showQuickPick', () => {
    it('returns selected item', async () => {
      const items = [
        { label: 'Item 1' },
        { label: 'Item 2' },
        { label: 'Item 3' }
      ];

      // Set up event listener to auto-select
      uiAPI.once('show-quick-pick', (data) => {
        expect(data.items).toEqual(items);
        // Simulate user selecting item
        setTimeout(() => data.onSelect(items[1]), 0);
      });

      const result = await uiAPI.showQuickPick(items);
      expect(result).toEqual({ label: 'Item 2' });
    });

    it('returns undefined when cancelled', async () => {
      const items = [{ label: 'Item 1' }];

      uiAPI.once('show-quick-pick', (data) => {
        setTimeout(() => data.onCancel(), 0);
      });

      const result = await uiAPI.showQuickPick(items);
      expect(result).toBeUndefined();
    });

    it('supports multi-select with canPickMany', async () => {
      const items = [
        { label: 'Item 1' },
        { label: 'Item 2' },
        { label: 'Item 3' }
      ];

      uiAPI.once('show-quick-pick', (data) => {
        expect(data.options.canPickMany).toBe(true);
        setTimeout(() => data.onSelect([items[0], items[2]]), 0);
      });

      const result = await uiAPI.showQuickPick(items, { canPickMany: true });
      expect(result).toEqual([{ label: 'Item 1' }, { label: 'Item 3' }]);
    });

    it('emits show-quick-pick event with dialog data', async () => {
      const items = [{ label: 'Item 1' }];
      const showSpy = vi.fn();
      uiAPI.on('show-quick-pick', showSpy);

      uiAPI.once('show-quick-pick', (data) => {
        // Simulate selection after a brief delay
        setTimeout(() => data.onSelect(items[0]), 0);
      });

      await uiAPI.showQuickPick(items);
      expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'quickpick',
        items: items
      }));
    });
  });

  describe('showOpenDialog', () => {
    it('calls Tauri dialog with correct options', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      open.mockResolvedValue('/path/to/file.txt');

      const result = await uiAPI.showOpenDialog({
        title: 'Open File',
        canSelectMany: false,
        canSelectFolders: false,
        filters: {
          'Text Files': ['txt', 'md']
        }
      });

      expect(open).toHaveBeenCalledWith({
        title: 'Open File',
        multiple: false,
        directory: false,
        filters: [{ name: 'Text Files', extensions: ['txt', 'md'] }],
        defaultPath: undefined
      });
      expect(result).toEqual(['/path/to/file.txt']);
    });

    it('handles multiple file selection', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      open.mockResolvedValue(['/file1.txt', '/file2.txt']);

      const result = await uiAPI.showOpenDialog({
        canSelectMany: true
      });

      expect(result).toEqual(['/file1.txt', '/file2.txt']);
    });

    it('returns undefined when cancelled', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      open.mockResolvedValue(null);

      const result = await uiAPI.showOpenDialog();
      expect(result).toBeUndefined();
    });

    it('handles errors gracefully', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      open.mockRejectedValue(new Error('Dialog error'));

      const result = await uiAPI.showOpenDialog();
      expect(result).toBeUndefined();
    });
  });

  describe('showSaveDialog', () => {
    it('calls Tauri save dialog with correct options', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog');
      save.mockResolvedValue('/path/to/file.txt');

      const result = await uiAPI.showSaveDialog({
        title: 'Save File',
        filters: {
          'Text Files': ['txt', 'md']
        },
        defaultUri: '/default/path.txt'
      });

      expect(save).toHaveBeenCalledWith({
        title: 'Save File',
        filters: [{ name: 'Text Files', extensions: ['txt', 'md'] }],
        defaultPath: '/default/path.txt'
      });
      expect(result).toBe('/path/to/file.txt');
    });

    it('returns undefined when cancelled', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog');
      save.mockResolvedValue(null);

      const result = await uiAPI.showSaveDialog();
      expect(result).toBeUndefined();
    });

    it('handles errors gracefully', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog');
      save.mockRejectedValue(new Error('Dialog error'));

      const result = await uiAPI.showSaveDialog();
      expect(result).toBeUndefined();
    });
  });

  describe('withProgress', () => {
    it('reports progress updates', async () => {
      const progressStartSpy = vi.fn();
      const progressUpdateSpy = vi.fn();
      const progressEndSpy = vi.fn();

      uiAPI.on('progress-start', progressStartSpy);
      uiAPI.on('progress-update', progressUpdateSpy);
      uiAPI.on('progress-end', progressEndSpy);

      await uiAPI.withProgress(
        { title: 'Processing', location: 'notification' },
        async (progress) => {
          progress.report({ message: 'Step 1', increment: 33 });
          progress.report({ message: 'Step 2', increment: 66 });
          progress.report({ message: 'Complete', increment: 100 });
          return 'done';
        }
      );

      expect(progressStartSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Processing',
          location: 'notification',
          cancellable: false
        })
      );
      expect(progressUpdateSpy).toHaveBeenCalledTimes(3);
      expect(progressEndSpy).toHaveBeenCalled();
    });

    it('supports cancellation', async () => {
      let progressId;
      const cancelCallback = vi.fn();

      uiAPI.on('progress-start', (data) => {
        progressId = data.id;
        // Simulate immediate cancellation
        setTimeout(() => {
          uiAPI.emit('progress-cancelled-' + progressId);
        }, 10);
      });

      await uiAPI.withProgress(
        { title: 'Processing', cancellable: true },
        async (progress, token) => {
          token.onCancellationRequested(cancelCallback);

          // Wait for cancellation to be triggered
          await new Promise(resolve => setTimeout(resolve, 50));

          // Check if cancelled
          expect(token.isCancellationRequested).toBe(true);
          expect(cancelCallback).toHaveBeenCalled();
        }
      );
    });

    it('returns task result', async () => {
      const result = await uiAPI.withProgress(
        { title: 'Test' },
        async () => {
          return { success: true, data: 'result' };
        }
      );

      expect(result).toEqual({ success: true, data: 'result' });
    });

    it('handles task errors and still emits progress-end', async () => {
      const progressEndSpy = vi.fn();
      uiAPI.on('progress-end', progressEndSpy);

      await expect(
        uiAPI.withProgress(
          { title: 'Test' },
          async () => {
            throw new Error('Task failed');
          }
        )
      ).rejects.toThrow('Task failed');

      expect(progressEndSpy).toHaveBeenCalled();
    });

    it('supports different progress locations', async () => {
      const progressStartSpy = vi.fn();
      uiAPI.on('progress-start', progressStartSpy);

      await uiAPI.withProgress(
        { title: 'Test', location: 'window' },
        async () => 'done'
      );

      expect(progressStartSpy).toHaveBeenCalledWith(
        expect.objectContaining({ location: 'window' })
      );
    });
  });

  describe('showInformationMessage', () => {
    it('shows info notification', async () => {
      await uiAPI.showInformationMessage('Test message');

      expect(mockNotificationsAPI.show).toHaveBeenCalledWith({
        type: 'info',
        message: 'Test message',
        title: 'Info'
      });
    });
  });

  describe('showWarningMessage', () => {
    it('shows warning notification', async () => {
      await uiAPI.showWarningMessage('Warning message');

      expect(mockNotificationsAPI.show).toHaveBeenCalledWith({
        type: 'warning',
        message: 'Warning message',
        title: 'Warning'
      });
    });
  });

  describe('showErrorMessage', () => {
    it('shows error notification', async () => {
      await uiAPI.showErrorMessage('Error message');

      expect(mockNotificationsAPI.show).toHaveBeenCalledWith({
        type: 'error',
        message: 'Error message',
        title: 'Error'
      });
    });
  });

  describe('showNotification', () => {
    it('shows notification without actions', async () => {
      const result = await uiAPI.showNotification('Test notification');

      expect(mockNotificationsAPI.show).toHaveBeenCalledWith({
        type: 'info',
        message: 'Test notification',
        title: 'Info'
      });
      expect(result).toBeUndefined();
    });

    it('shows notification with custom type', async () => {
      await uiAPI.showNotification('Warning!', 'warning');

      expect(mockNotificationsAPI.show).toHaveBeenCalledWith({
        type: 'warning',
        message: 'Warning!',
        title: 'Warning'
      });
    });

    it('handles actions and returns selected action ID', async () => {
      const actions = [
        { id: 'yes', label: 'Yes', primary: true },
        { id: 'no', label: 'No' }
      ];

      uiAPI.once('show-notification-with-actions', (data) => {
        expect(data.actions).toEqual(actions);
        setTimeout(() => data.onAction('yes'), 0);
      });

      const result = await uiAPI.showNotification('Confirm?', 'question', actions);
      expect(result).toBe('yes');
    });

    it('returns undefined when notification closed without action', async () => {
      const actions = [{ id: 'ok', label: 'OK' }];

      uiAPI.once('show-notification-with-actions', (data) => {
        setTimeout(() => data.onClose(), 0);
      });

      const result = await uiAPI.showNotification('Message', 'info', actions);
      expect(result).toBeUndefined();
    });
  });

  describe('showDialog', () => {
    it('shows dialog with default button', async () => {
      const dialogSpy = vi.fn();
      uiAPI.on('show-dialog', dialogSpy);

      const dialogPromise = uiAPI.showDialog({
        title: 'Confirm',
        message: 'Are you sure?',
        type: 'question'
      });

      // Wait for dialog to be emitted
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(dialogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Confirm',
          message: 'Are you sure?',
          type: 'question',
          buttons: [{ id: 'ok', label: 'OK', primary: true }]
        })
      );

      // Simulate user clicking button
      const dialog = dialogSpy.mock.calls[0][0];
      dialog.onResult({ buttonId: 'ok' });

      const result = await dialogPromise;
      expect(result).toEqual({ buttonId: 'ok' });
    });

    it('shows dialog with custom buttons', async () => {
      const dialogSpy = vi.fn();
      uiAPI.on('show-dialog', dialogSpy);

      const buttons = [
        { id: 'yes', label: 'Yes', primary: true },
        { id: 'no', label: 'No' },
        { id: 'cancel', label: 'Cancel' }
      ];

      const dialogPromise = uiAPI.showDialog({
        title: 'Save changes?',
        message: 'Do you want to save?',
        buttons,
        defaultButton: 0,
        cancelButton: 2
      });

      await new Promise(resolve => setTimeout(resolve, 0));

      const dialog = dialogSpy.mock.calls[0][0];
      expect(dialog.buttons).toEqual(buttons);
      expect(dialog.defaultButton).toBe(0);
      expect(dialog.cancelButton).toBe(2);

      dialog.onResult({ buttonId: 'yes' });

      const result = await dialogPromise;
      expect(result).toEqual({ buttonId: 'yes' });
    });

    it('supports checkbox in dialog', async () => {
      const dialogSpy = vi.fn();
      uiAPI.on('show-dialog', dialogSpy);

      const dialogPromise = uiAPI.showDialog({
        title: 'Confirm',
        message: 'Delete file?',
        checkboxLabel: "Don't ask again",
        checkboxChecked: false
      });

      await new Promise(resolve => setTimeout(resolve, 0));

      const dialog = dialogSpy.mock.calls[0][0];
      expect(dialog.checkboxLabel).toBe("Don't ask again");
      expect(dialog.checkboxChecked).toBe(false);

      dialog.onResult({ buttonId: 'ok', checkboxChecked: true });

      const result = await dialogPromise;
      expect(result).toEqual({ buttonId: 'ok', checkboxChecked: true });
    });
  });

  describe('registerWebviewPanel', () => {
    it('registers webview panel', () => {
      const panel = {
        id: 'test-webview',
        title: 'Test Panel',
        html: '<h1>Hello</h1>'
      };

      const webview = uiAPI.registerWebviewPanel(panel);

      expect(webview.id).toBe('test-webview');
      expect(webview.title).toBe('Test Panel');
      expect(webview.html).toBe('<h1>Hello</h1>');
      expect(uiAPI.webviews.has('test-webview')).toBe(true);
    });

    it('throws error if webview already exists', () => {
      const panel = { id: 'duplicate', title: 'Test', html: '<div></div>' };
      uiAPI.registerWebviewPanel(panel);

      expect(() => {
        uiAPI.registerWebviewPanel(panel);
      }).toThrow("Webview panel 'duplicate' already exists");
    });

    it('supports posting messages to webview', () => {
      const panel = { id: 'test', title: 'Test', html: '<div></div>' };
      const webview = uiAPI.registerWebviewPanel(panel);

      const messageSpy = vi.fn();
      uiAPI.on('webview-post-message', messageSpy);

      webview.postMessage({ type: 'greeting', data: 'hello' });

      expect(messageSpy).toHaveBeenCalledWith({
        panelId: 'test',
        message: { type: 'greeting', data: 'hello' }
      });
    });

    it('supports receiving messages from webview', () => {
      const panel = { id: 'test', title: 'Test', html: '<div></div>' };
      const webview = uiAPI.registerWebviewPanel(panel);

      const handler = vi.fn();
      webview.onDidReceiveMessage(handler);

      webview._handleMessage({ type: 'response', data: 'world' });

      expect(handler).toHaveBeenCalledWith({ type: 'response', data: 'world' });
    });

    it('disposes webview and cleans up', () => {
      const panel = { id: 'test', title: 'Test', html: '<div></div>' };
      const webview = uiAPI.registerWebviewPanel(panel);

      const disposeSpy = vi.fn();
      uiAPI.on('webview-disposed', disposeSpy);

      webview.dispose();

      expect(uiAPI.webviews.has('test')).toBe(false);
      expect(disposeSpy).toHaveBeenCalledWith({ panelId: 'test' });
    });

    it('unsubscribes message handler via disposable', () => {
      const panel = { id: 'test', title: 'Test', html: '<div></div>' };
      const webview = uiAPI.registerWebviewPanel(panel);

      const handler = vi.fn();
      const disposable = webview.onDidReceiveMessage(handler);

      webview._handleMessage({ test: 1 });
      expect(handler).toHaveBeenCalledTimes(1);

      disposable.dispose();
      webview._handleMessage({ test: 2 });
      expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('registerMenu', () => {
    it('registers menu item', () => {
      const menu = {
        id: 'test-menu',
        label: 'Test Menu',
        command: 'test.command',
        group: 'navigation',
        order: 10
      };

      const disposable = uiAPI.registerMenu(menu);

      expect(uiAPI.menus.has('test-menu')).toBe(true);
      expect(uiAPI.menus.get('test-menu').label).toBe('Test Menu');
      expect(uiAPI.menus.get('test-menu').command).toBe('test.command');
      expect(disposable.dispose).toBeDefined();
    });

    it('throws error if menu already exists', () => {
      const menu = { id: 'duplicate', label: 'Test' };
      uiAPI.registerMenu(menu);

      expect(() => {
        uiAPI.registerMenu(menu);
      }).toThrow("Menu 'duplicate' already exists");
    });

    it('disposes menu item', () => {
      const menu = { id: 'test', label: 'Test' };
      const disposable = uiAPI.registerMenu(menu);

      const unregisterSpy = vi.fn();
      uiAPI.on('menu-unregistered', unregisterSpy);

      disposable.dispose();

      expect(uiAPI.menus.has('test')).toBe(false);
      expect(unregisterSpy).toHaveBeenCalledWith({ menuId: 'test' });
    });
  });

  describe('registerToolbar', () => {
    it('registers toolbar', () => {
      const toolbar = {
        id: 'test-toolbar',
        title: 'Test Toolbar',
        location: 'editor',
        items: [
          { id: 'btn1', label: 'Button 1', command: 'cmd1' },
          { id: 'btn2', label: 'Button 2', command: 'cmd2' }
        ]
      };

      const disposable = uiAPI.registerToolbar(toolbar);

      expect(uiAPI.toolbars.has('test-toolbar')).toBe(true);
      expect(uiAPI.toolbars.get('test-toolbar').title).toBe('Test Toolbar');
      expect(uiAPI.toolbars.get('test-toolbar').items).toHaveLength(2);
      expect(disposable.dispose).toBeDefined();
    });

    it('throws error if toolbar already exists', () => {
      const toolbar = { id: 'duplicate', title: 'Test', location: 'editor', items: [] };
      uiAPI.registerToolbar(toolbar);

      expect(() => {
        uiAPI.registerToolbar(toolbar);
      }).toThrow("Toolbar 'duplicate' already exists");
    });

    it('disposes toolbar', () => {
      const toolbar = { id: 'test', title: 'Test', location: 'editor', items: [] };
      const disposable = uiAPI.registerToolbar(toolbar);

      const unregisterSpy = vi.fn();
      uiAPI.on('toolbar-unregistered', unregisterSpy);

      disposable.dispose();

      expect(uiAPI.toolbars.has('test')).toBe(false);
      expect(unregisterSpy).toHaveBeenCalledWith({ toolbarId: 'test' });
    });
  });

  describe('createTerminal', () => {
    it('creates terminal with default options', () => {
      const terminal = uiAPI.createTerminal();

      expect(terminal.id).toBeDefined();
      expect(terminal.name).toBe('Terminal');
      expect(terminal.sendText).toBeDefined();
      expect(terminal.show).toBeDefined();
      expect(terminal.hide).toBeDefined();
      expect(terminal.dispose).toBeDefined();
    });

    it('creates terminal with custom options', () => {
      const options = {
        name: 'Custom Terminal',
        shellPath: '/bin/bash',
        shellArgs: ['-l'],
        cwd: '/home/user',
        env: { VAR: 'value' }
      };

      const terminal = uiAPI.createTerminal(options);

      expect(terminal.name).toBe('Custom Terminal');
      expect(terminal.shellPath).toBe('/bin/bash');
      expect(terminal.shellArgs).toEqual(['-l']);
      expect(terminal.cwd).toBe('/home/user');
      expect(terminal.env).toEqual({ VAR: 'value' });
    });

    it('sends text to terminal', () => {
      const terminal = uiAPI.createTerminal();
      const sendSpy = vi.fn();
      uiAPI.on('terminal-send-text', sendSpy);

      terminal.sendText('echo hello', true);

      expect(sendSpy).toHaveBeenCalledWith({
        terminalId: terminal.id,
        text: 'echo hello',
        addNewLine: true
      });
    });

    it('shows and hides terminal', () => {
      const terminal = uiAPI.createTerminal();
      const showSpy = vi.fn();
      const hideSpy = vi.fn();
      uiAPI.on('terminal-show', showSpy);
      uiAPI.on('terminal-hide', hideSpy);

      terminal.show();
      terminal.hide();

      expect(showSpy).toHaveBeenCalledWith({
        terminalId: terminal.id,
        preserveFocus: false
      });
      expect(hideSpy).toHaveBeenCalledWith({
        terminalId: terminal.id
      });
    });

    it('disposes terminal', () => {
      const terminal = uiAPI.createTerminal();
      const disposeSpy = vi.fn();
      uiAPI.on('terminal-dispose', disposeSpy);

      terminal.dispose();

      expect(disposeSpy).toHaveBeenCalledWith({
        terminalId: terminal.id
      });
    });
  });

  describe('cleanup methods', () => {
    it('removes all webviews for plugin', () => {
      uiAPI.registerWebviewPanel({ id: 'webview1', title: 'Test 1', html: '<div>1</div>' });
      uiAPI.registerWebviewPanel({ id: 'webview2', title: 'Test 2', html: '<div>2</div>' });

      expect(uiAPI.webviews.size).toBe(2);

      uiAPI.removeAllWebviews('test-plugin');

      expect(uiAPI.webviews.size).toBe(0);
    });

    it('removes all menus for plugin', () => {
      uiAPI.registerMenu({ id: 'menu1', label: 'Menu 1' });
      uiAPI.registerMenu({ id: 'menu2', label: 'Menu 2' });

      expect(uiAPI.menus.size).toBe(2);

      uiAPI.removeAllMenus('test-plugin');

      expect(uiAPI.menus.size).toBe(0);
    });

    it('removes all toolbars for plugin', () => {
      uiAPI.registerToolbar({ id: 'toolbar1', title: 'Toolbar 1', location: 'editor', items: [] });
      uiAPI.registerToolbar({ id: 'toolbar2', title: 'Toolbar 2', location: 'sidebar', items: [] });

      expect(uiAPI.toolbars.size).toBe(2);

      uiAPI.removeAllToolbars('test-plugin');

      expect(uiAPI.toolbars.size).toBe(0);
    });
  });
});
