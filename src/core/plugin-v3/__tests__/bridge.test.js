import { describe, it, expect, vi } from 'vitest';
import { createBridge, BridgeError } from '../bridge.js';
import { CapabilityGate } from '../gate.js';
import { ContributionRegistry } from '../contributions.js';

function setup(grants = []) {
  const contributions = new ContributionRegistry();
  const effects = {
    toast: vi.fn(),
    insertIntoEditor: vi.fn().mockResolvedValue(undefined),
    executeCommand: vi.fn().mockReturnValue(true),
    listNotes: vi.fn().mockResolvedValue(['a.md']),
    readNote: vi.fn().mockResolvedValue('# note'),
    writeNote: vi.fn().mockResolvedValue(true),
    storageGet: vi.fn().mockReturnValue('v'),
    storageSet: vi.fn().mockReturnValue(true),
    storageDelete: vi.fn().mockReturnValue(true),
    netFetch: vi.fn().mockResolvedValue({ status: 200, body: '' }),
    showOverlay: vi.fn().mockResolvedValue(true),
    hideOverlay: vi.fn().mockResolvedValue(true),
    workspaceInfo: vi.fn().mockReturnValue({ path: '/vault' }),
  };
  const gate = new CapabilityGate('dog', grants);
  const bridge = createBridge({ pluginId: 'dog', gate, effects, contributions });
  return { bridge, effects, gate, contributions };
}

describe('bridge dispatch', () => {
  it('denies calls without the required capability', async () => {
    const { bridge, effects } = setup([]);
    await expect(bridge.dispatch('notes.read', { path: 'a.md' })).rejects.toThrow(/permission denied/);
    expect(effects.readNote).not.toHaveBeenCalled();
  });

  it('allows calls with the capability granted', async () => {
    const { bridge, effects } = setup(['notes.read']);
    await expect(bridge.dispatch('notes.read', { path: 'a.md' })).resolves.toBe('# note');
    expect(effects.readNote).toHaveBeenCalledWith('dog', 'a.md');
  });

  it('rejects unknown methods', async () => {
    const { bridge } = setup(['ui', 'network', 'notes.write', 'overlay']);
    await expect(bridge.dispatch('self.destruct', {})).rejects.toThrow(/unknown API method/);
  });

  it('toasts through ui.notify', async () => {
    const { bridge, effects } = setup(['ui']);
    await bridge.dispatch('ui.notify', { message: 'hello', type: 'success' });
    expect(effects.toast).toHaveBeenCalledWith('hello', 'success', undefined);
  });

  it('only updates declared status bar items', async () => {
    const { bridge, contributions } = setup(['ui']);
    contributions.register('dog', { contributes: { statusBar: [{ id: 'paws', text: '🐕' }] } });
    await expect(bridge.dispatch('ui.statusbar', { itemId: 'paws', patch: { text: '🦴' } })).resolves.toBe(true);
    await expect(bridge.dispatch('ui.statusbar', { itemId: 'ghost', patch: {} })).rejects.toThrow(/not declared/);
  });

  it('routes editor, notes, storage, network, overlay through effects', async () => {
    const { bridge, effects } = setup([
      'editor', 'notes.read', 'notes.write', 'storage', 'network', 'overlay', 'commands',
    ]);
    await bridge.dispatch('editor.insert', { text: 'hi' });
    expect(effects.insertIntoEditor).toHaveBeenCalledWith('hi');

    await bridge.dispatch('notes.write', { path: 'b.md', content: 'x' });
    expect(effects.writeNote).toHaveBeenCalledWith('dog', 'b.md', 'x');

    await bridge.dispatch('storage.set', { key: 'k', value: 1 });
    expect(effects.storageSet).toHaveBeenCalledWith('dog', 'k', 1);

    await bridge.dispatch('network.fetch', { url: 'https://x.dev' });
    expect(effects.netFetch).toHaveBeenCalledWith('dog', 'https://x.dev', {});

    await bridge.dispatch('overlay.show', { overlayId: 'dog' });
    expect(effects.showOverlay).toHaveBeenCalledWith('dog', 'dog');

    await bridge.dispatch('commands.execute', { id: 'other.cmd', args: { a: 1 } });
    expect(effects.executeCommand).toHaveBeenCalledWith('other.cmd', { a: 1 });
  });

  it('always allows workspace.info', async () => {
    const { bridge, effects } = setup([]);
    await expect(bridge.dispatch('workspace.info', {})).resolves.toEqual({ path: '/vault' });
  });

  it('bridge errors carry a code', () => {
    const err = new BridgeError('x', 'denied');
    expect(err.code).toBe('denied');
  });
});
