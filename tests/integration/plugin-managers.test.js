/**
 * Plugin Manager Integration Tests
 *
 * Tests that verify different plugin managers work together correctly
 * and that data flows properly between managers and APIs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LokusPluginAPI } from '../../src/plugins/api/LokusPluginAPI.js';
import terminalManager from '../../src/plugins/managers/TerminalManager.js';
import outputChannelManager from '../../src/plugins/managers/OutputChannelManager.js';

describe('Plugin Manager Integration', () => {
  let api;
  let pluginId;

  beforeEach(() => {
    pluginId = 'test-plugin-manager';

    api = new LokusPluginAPI({
      terminal: terminalManager,
      outputChannel: outputChannelManager
    });

    api.setPluginContext(pluginId, {
      id: pluginId,
      manifest: {
        name: 'Test Plugin Manager',
        version: '1.0.0',
        permissions: ['terminal', 'ui']
      }
    });
  });

  afterEach(async () => {
    await api.cleanup(pluginId);
    terminalManager.cleanupPlugin(pluginId);
    outputChannelManager.cleanupPlugin(pluginId);
  });

  describe('TerminalManager and TerminalAPI Integration', () => {
    it('should create terminal via API and track in manager', () => {
      const terminal = api.terminal.createTerminal({
        name: 'Integration Test Terminal',
        shellPath: '/bin/bash',
        cwd: '/test'
      });

      expect(terminal).toBeDefined();
      expect(terminal.name).toBe('Integration Test Terminal');

      // Verify terminal is tracked by manager
      const managerTerminal = terminalManager.getTerminal(terminal.id);
      expect(managerTerminal).toBeDefined();
      expect(managerTerminal.name).toBe('Integration Test Terminal');
      expect(managerTerminal.shellPath).toBe('/bin/bash');
      expect(managerTerminal.cwd).toBe('/test');
    });

    it('should send text through terminal and track output', () => {
      const terminal = api.terminal.createTerminal({
        name: 'Output Test'
      });

      // Send text
      terminal.sendText('echo test', true);

      // Verify output is tracked
      const managerTerminal = terminalManager.getTerminal(terminal.id);
      expect(managerTerminal.output).toHaveLength(1);
      expect(managerTerminal.output[0].text).toBe('echo test\n');
      expect(managerTerminal.output[0].type).toBe('input');
    });

    it('should manage terminal visibility state', () => {
      const terminal = api.terminal.createTerminal({
        name: 'Visibility Test'
      });

      // Initially should be visible (created as active)
      let state = terminalManager.getTerminal(terminal.id);
      expect(state.visible).toBe(false);

      // Show terminal
      terminal.show();
      state = terminalManager.getTerminal(terminal.id);
      expect(state.visible).toBe(true);

      // Hide terminal
      terminal.hide();
      state = terminalManager.getTerminal(terminal.id);
      expect(state.visible).toBe(false);
    });

    it('should track active terminal changes', () => {
      const terminal1 = api.terminal.createTerminal({ name: 'Terminal 1' });
      const terminal2 = api.terminal.createTerminal({ name: 'Terminal 2' });

      // Terminal 2 should be active (last created)
      let activeTerminal = terminalManager.getActiveTerminal();
      expect(activeTerminal.id).toBe(terminal2.id);

      // Show terminal 1
      terminal1.show();
      activeTerminal = terminalManager.getActiveTerminal();
      expect(activeTerminal.id).toBe(terminal1.id);
    });

    it('should dispose terminal and remove from manager', () => {
      const terminal = api.terminal.createTerminal({
        name: 'Dispose Test'
      });

      expect(terminalManager.getTerminal(terminal.id)).toBeDefined();

      // Dispose
      terminal.dispose();

      expect(terminalManager.getTerminal(terminal.id)).toBeUndefined();
    });

    it('should emit terminal events through manager', () => {
      const createdSpy = vi.fn();
      const shownSpy = vi.fn();
      const hiddenSpy = vi.fn();

      terminalManager.on('terminal-created', createdSpy);
      terminalManager.on('terminal-shown', shownSpy);
      terminalManager.on('terminal-hidden', hiddenSpy);

      const terminal = api.terminal.createTerminal({ name: 'Event Test' });
      terminal.show();
      terminal.hide();

      expect(createdSpy).toHaveBeenCalled();
      expect(shownSpy).toHaveBeenCalled();
      expect(hiddenSpy).toHaveBeenCalled();
    });

    it('should write simulated output to terminal', () => {
      const terminal = api.terminal.createTerminal({
        name: 'Output Test'
      });

      // Simulate command output
      terminalManager.writeOutput(terminal.id, 'Command output', 'stdout');
      terminalManager.writeOutput(terminal.id, 'Error output', 'stderr');

      const state = terminalManager.getTerminal(terminal.id);
      expect(state.output).toHaveLength(2);
      expect(state.output[0].text).toBe('Command output');
      expect(state.output[0].type).toBe('stdout');
      expect(state.output[1].text).toBe('Error output');
      expect(state.output[1].type).toBe('stderr');
    });

    it('should clear terminal output', () => {
      const terminal = api.terminal.createTerminal({
        name: 'Clear Test'
      });

      terminal.sendText('line 1');
      terminal.sendText('line 2');

      let state = terminalManager.getTerminal(terminal.id);
      expect(state.output.length).toBeGreaterThan(0);

      // Clear
      terminalManager.clearTerminal(terminal.id);

      state = terminalManager.getTerminal(terminal.id);
      expect(state.output).toHaveLength(0);
    });
  });

  describe('OutputChannelManager and UIAPI Integration', () => {
    it('should create output channel via API and track in manager', () => {
      const channel = api.ui.createOutputChannel('Integration Test Channel');

      expect(channel).toBeDefined();
      expect(channel.name).toBe('Integration Test Channel');

      // Verify channel is tracked by manager
      const managerChannel = outputChannelManager.getChannel('Integration Test Channel');
      expect(managerChannel).toBeDefined();
      expect(managerChannel.name).toBe('Integration Test Channel');
    });

    it('should append content and sync with manager', () => {
      const channel = api.ui.createOutputChannel('Content Test');

      channel.appendLine('Line 1');
      channel.append('Part 1 ');
      channel.append('Part 2');

      // Verify content is tracked
      const managerChannel = outputChannelManager.getChannel('Content Test');
      const output = outputChannelManager.getChannelOutput('Content Test');
      expect(output).toBe('Line 1\nPart 1 Part 2');
    });

    it('should emit events when channel is updated', () => {
      const updateSpy = vi.fn();
      outputChannelManager.on('channel-updated', updateSpy);

      const channel = api.ui.createOutputChannel('Event Test');
      channel.appendLine('Test content');

      expect(updateSpy).toHaveBeenCalled();
      const callArgs = updateSpy.mock.calls[0][0];
      expect(callArgs.name).toBe('Event Test');
    });

    it('should show and hide output channel', () => {
      const showSpy = vi.fn();
      const hideSpy = vi.fn();

      outputChannelManager.on('channel-shown', showSpy);
      outputChannelManager.on('channel-hidden', hideSpy);

      const channel = api.ui.createOutputChannel('Visibility Test');

      channel.show();
      expect(showSpy).toHaveBeenCalled();

      channel.hide();
      expect(hideSpy).toHaveBeenCalled();
    });

    it('should clear channel content', () => {
      const channel = api.ui.createOutputChannel('Clear Test');

      channel.appendLine('Line 1');
      channel.appendLine('Line 2');

      let managerChannel = outputChannelManager.getChannel('Clear Test');
      expect(managerChannel.output.length).toBeGreaterThan(0);

      channel.clear();

      managerChannel = outputChannelManager.getChannel('Clear Test');
      expect(managerChannel.output).toHaveLength(0);
    });

    it('should replace channel content', () => {
      const channel = api.ui.createOutputChannel('Replace Test');

      channel.appendLine('Old line 1');
      channel.appendLine('Old line 2');
      channel.replace('New content');

      const managerChannel = outputChannelManager.getChannel('Replace Test');
      const output = outputChannelManager.getChannelOutput('Replace Test');
      expect(output).toBe('New content');
    });

    it('should dispose channel and remove from manager', () => {
      const disposeSpy = vi.fn();
      outputChannelManager.on('channel-disposed', disposeSpy);

      const channel = api.ui.createOutputChannel('Dispose Test');

      expect(outputChannelManager.getChannel('Dispose Test')).toBeDefined();

      channel.dispose();

      expect(disposeSpy).toHaveBeenCalled();
      expect(outputChannelManager.getChannel('Dispose Test')).toBeUndefined();
    });

    it('should track active channel', () => {
      const channel1 = api.ui.createOutputChannel('Channel 1');
      const channel2 = api.ui.createOutputChannel('Channel 2');

      channel1.show();
      let activeChannel = outputChannelManager.getActiveChannel();
      expect(activeChannel.name).toBe('Channel 1');

      channel2.show();
      activeChannel = outputChannelManager.getActiveChannel();
      expect(activeChannel.name).toBe('Channel 2');
    });

    it('should get all channels from manager', () => {
      api.ui.createOutputChannel('Channel A');
      api.ui.createOutputChannel('Channel B');
      api.ui.createOutputChannel('Channel C');

      const allChannels = outputChannelManager.getChannels();
      const channelNames = allChannels.map(c => c.name);

      expect(channelNames).toContain('Channel A');
      expect(channelNames).toContain('Channel B');
      expect(channelNames).toContain('Channel C');
    });
  });

  describe('Cross-Manager Integration', () => {
    it('should manage both terminals and output channels independently', () => {
      // Create terminal
      const terminal = api.terminal.createTerminal({
        name: 'Cross Test Terminal'
      });

      // Create output channel
      const channel = api.ui.createOutputChannel('Cross Test Channel');

      // Both should exist independently
      expect(terminalManager.getTerminal(terminal.id)).toBeDefined();
      expect(outputChannelManager.getChannel('Cross Test Channel')).toBeDefined();

      // Operations on one shouldn't affect the other
      terminal.sendText('terminal text');
      channel.appendLine('channel text');

      const terminalState = terminalManager.getTerminal(terminal.id);
      const channelState = outputChannelManager.getChannel('Cross Test Channel');

      expect(terminalState.output[0].text).toContain('terminal text');
      const channelOutput = outputChannelManager.getChannelOutput('Cross Test Channel');
      expect(channelOutput).toBe('channel text\n');
    });

    it('should clean up managers independently', async () => {
      // Create resources
      const terminal = api.terminal.createTerminal({ name: 'Terminal' });
      const channel = api.ui.createOutputChannel('Channel');

      // Clean up terminal manager only
      terminalManager.cleanupPlugin(pluginId);

      // Terminal should be gone, channel should remain
      expect(terminalManager.getTerminal(terminal.id)).toBeUndefined();
      expect(outputChannelManager.getChannel('Channel')).toBeDefined();

      // Clean up output channel manager
      outputChannelManager.cleanupPlugin(pluginId);

      // Now channel should be gone too
      expect(outputChannelManager.getChannel('Channel')).toBeUndefined();
    });

    it('should handle concurrent operations across managers', () => {
      const terminal1 = api.terminal.createTerminal({ name: 'T1' });
      const channel1 = api.ui.createOutputChannel('C1');
      const terminal2 = api.terminal.createTerminal({ name: 'T2' });
      const channel2 = api.ui.createOutputChannel('C2');

      // Perform operations concurrently
      terminal1.sendText('t1 text');
      channel1.appendLine('c1 text');
      terminal2.sendText('t2 text');
      channel2.appendLine('c2 text');

      // All operations should succeed
      expect(terminalManager.getTerminal(terminal1.id).output).toHaveLength(1);
      expect(terminalManager.getTerminal(terminal2.id).output).toHaveLength(1);
      expect(outputChannelManager.getChannel('C1').output).toHaveLength(1);
      expect(outputChannelManager.getChannel('C2').output).toHaveLength(1);
    });
  });

  describe('Manager Event Forwarding', () => {
    it('should forward terminal events from manager to API', () => {
      return new Promise((resolve) => {
        const eventSpy = vi.fn();

        // Listen on the manager, not the API
        terminalManager.on('terminal-created', eventSpy);

        const terminal = api.terminal.createTerminal({
          name: 'Event Forward Test'
        });

        // Give events time to propagate
        setTimeout(() => {
          expect(eventSpy).toHaveBeenCalled();
          terminal.dispose();
          resolve();
        }, 50);
      });
    });

    it('should forward output channel events from manager to UI API', () => {
      return new Promise((resolve) => {
        const updateSpy = vi.fn();

        // Listen on the manager directly
        outputChannelManager.on('channel-updated', updateSpy);

        const channel = api.ui.createOutputChannel('Event Forward Test');
        channel.appendLine('Test content');

        // Give events time to propagate
        setTimeout(() => {
          expect(updateSpy).toHaveBeenCalled();
          channel.dispose();
          resolve();
        }, 50);
      });
    });
  });

  describe('Manager State Consistency', () => {
    it('should maintain consistent state between API and manager for terminals', () => {
      const terminal = api.terminal.createTerminal({
        name: 'Consistency Test',
        cwd: '/test/path'
      });

      // Get state from manager
      const managerState = terminalManager.getTerminal(terminal.id);

      // Verify consistency
      expect(terminal.id).toBe(managerState.id);
      expect(terminal.name).toBe(managerState.name);
      expect(terminal.cwd).toBe(managerState.cwd);
      expect(terminal.pluginId).toBe(managerState.pluginId);
    });

    it('should maintain consistent state between API and manager for output channels', () => {
      const channel = api.ui.createOutputChannel('Consistency Test');

      channel.appendLine('Line 1');
      channel.appendLine('Line 2');

      // Get state from manager
      const managerChannel = outputChannelManager.getChannel('Consistency Test');

      // Verify consistency
      expect(channel.name).toBe(managerChannel.name);
      // Channel API doesn't expose internal lines, so verify through manager
      const output = outputChannelManager.getChannelOutput('Consistency Test');
      expect(output).toBe('Line 1\nLine 2\n');
    });
  });

  describe('Error Handling', () => {
    it('should handle terminal operations on disposed terminal gracefully', () => {
      const terminal = api.terminal.createTerminal({ name: 'Error Test' });

      terminal.dispose();

      // Operations should not throw
      expect(() => {
        terminal.sendText('test');
        terminal.show();
        terminal.hide();
      }).not.toThrow();
    });

    it('should handle channel operations on disposed channel gracefully', () => {
      const channel = api.ui.createOutputChannel('Error Test');

      channel.dispose();

      // Operations should not throw (though they may not have effect)
      expect(() => {
        channel.appendLine('test');
        channel.show();
        channel.hide();
      }).not.toThrow();
    });

    it('should handle operations on non-existent terminal', () => {
      expect(() => {
        terminalManager.sendText('non-existent-id', 'test');
        terminalManager.showTerminal('non-existent-id');
        terminalManager.hideTerminal('non-existent-id');
      }).not.toThrow();
    });

    it('should handle operations on non-existent channel', () => {
      expect(() => {
        const channel = outputChannelManager.getChannel('non-existent');
        // Should return undefined
        expect(channel).toBeUndefined();
      }).not.toThrow();
    });
  });
});
