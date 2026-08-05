import { describe, it, expect } from 'vitest';
import { ContributionRegistry } from '../contributions.js';

const manifest = (over = {}) => ({
  contributes: {
    commands: [{ id: 'run', title: 'Run' }],
    statusBar: [{ id: 'status', text: 'ok' }],
    ...over,
  },
});

describe('ContributionRegistry', () => {
  it('flattens contributions with qualified ids', () => {
    const reg = new ContributionRegistry();
    reg.register('dog', manifest());
    const commands = reg.commands();
    expect(commands).toHaveLength(1);
    expect(commands[0].qualifiedId).toBe('dog.run');
    expect(commands[0].pluginId).toBe('dog');
    reg.unregister('dog');
    expect(reg.commands()).toHaveLength(0);
  });

  it('finds commands by qualified id', () => {
    const reg = new ContributionRegistry();
    reg.register('dog', manifest());
    expect(reg.findCommand('dog.run')).not.toBeNull();
    expect(reg.findCommand('dog.nope')).toBeNull();
  });

  it('keeps plugins isolated and notifies subscribers', () => {
    const reg = new ContributionRegistry();
    let calls = 0;
    const unsub = reg.subscribe(() => { calls += 1; });
    reg.register('a', manifest());
    reg.register('b', manifest({ statusBar: [] }));
    expect(reg.commands()).toHaveLength(2);
    expect(calls).toBe(2);
    unsub();
    reg.unregister('a');
    expect(calls).toBe(2);
  });

  it('supports runtime contributions without duplicating manifest ones', () => {
    const reg = new ContributionRegistry();
    reg.register('dog', manifest());
    reg.addRuntime('dog', 'statusBar', { id: 'live', text: 'live' });
    expect(reg.statusBar().map((i) => i.qualifiedId)).toEqual(['dog.status', 'dog.live']);
    reg.addRuntime('dog', 'statusBar', { id: 'live', text: 'replaced' });
    expect(reg.statusBar()).toHaveLength(2);
  });

  it('updates runtime items', () => {
    const reg = new ContributionRegistry();
    reg.register('dog', manifest());
    reg.addRuntime('dog', 'statusBar', { id: 'live', text: 'a' });
    expect(reg.updateRuntime('dog', 'statusBar', 'live', { text: 'b' })).toBe(true);
    expect(reg.statusBar().find((i) => i.id === 'live').text).toBe('b');
    expect(reg.updateRuntime('dog', 'statusBar', 'missing', { text: 'x' })).toBe(false);
    expect(reg.updateRuntime('ghost', 'statusBar', 'live', { text: 'x' })).toBe(false);
  });

  it('drops everything on unregister and clear', () => {
    const reg = new ContributionRegistry();
    reg.register('dog', manifest());
    reg.addRuntime('dog', 'statusBar', { id: 'live', text: 'x' });
    reg.unregister('dog');
    expect(reg.statusBar()).toHaveLength(0);
    reg.register('dog', manifest());
    reg.clear();
    expect(reg.commands()).toHaveLength(0);
  });
});
