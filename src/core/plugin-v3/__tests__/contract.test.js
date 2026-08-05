import { describe, it, expect } from 'vitest';
import { validateManifest, parseActivation, isV3Manifest, CAPABILITY_IDS, API_VERSION } from '../contract.js';

const valid = {
  apiVersion: 3,
  id: 'dog-overlay',
  name: 'Running Dog',
  version: '1.0.0',
  main: 'index.js',
  capabilities: ['overlay', 'ui'],
  activation: ['startup'],
  contributes: {
    commands: [{ id: 'bark', title: 'Bark' }],
    panels: [{ id: 'den', title: 'Den', position: 'right', content: { type: 'webview', src: 'panel.html' } }],
    statusBar: [{ id: 'paws', text: '🐕' }],
    toolbar: [{ id: 'bone', icon: 'bone', tooltip: 'Give bone', command: 'bark' }],
    slashCommands: [{ name: 'dog', insert: '🐕' }],
    overlays: [{ id: 'dog', title: 'Dog', src: 'dog.html', width: 200, height: 150 }],
  },
};

describe('manifest v3 contract', () => {
  it('accepts a complete valid manifest', () => {
    const r = validateManifest(valid);
    expect(r.valid).toBe(true);
    expect(r.manifest.id).toBe('dog-overlay');
    expect(r.manifest.contributes.commands).toHaveLength(1);
  });

  it('fills defaults for optional fields', () => {
    const r = validateManifest({ apiVersion: 3, id: 'tiny-plugin', name: 'Tiny', version: '0.1.0' });
    expect(r.valid).toBe(true);
    expect(r.manifest.main).toBe('index.js');
    expect(r.manifest.capabilities).toEqual([]);
    expect(r.manifest.activation).toEqual(['startup']);
    expect(r.manifest.contributes.commands).toEqual([]);
  });

  it('rejects missing apiVersion (legacy plugins)', () => {
    const r = validateManifest({ id: 'old-one', name: 'Old', version: '1.0.0' });
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/apiVersion/);
  });

  it('rejects wrong apiVersion', () => {
    expect(validateManifest({ ...valid, apiVersion: 2 }).valid).toBe(false);
  });

  it('rejects unknown capabilities', () => {
    const r = validateManifest({ ...valid, capabilities: ['ui', 'readYourDiary'] });
    expect(r.valid).toBe(false);
  });

  it('accepts every declared capability', () => {
    const r = validateManifest({ ...valid, capabilities: CAPABILITY_IDS });
    expect(r.valid).toBe(true);
  });

  it('rejects bad ids', () => {
    for (const bad of ['', 'x', '-starts-with-dash', 'has space', 'a'.repeat(80), 'dots..inside']) {
      expect(validateManifest({ ...valid, id: bad }).valid).toBe(false);
    }
  });

  it('rejects panel webview src escaping the plugin folder', () => {
    const r = validateManifest({
      ...valid,
      contributes: { panels: [{ id: 'x', title: 'X', content: { type: 'webview', src: '../../etc/passwd' } }] },
    });
    expect(r.valid).toBe(false);
  });

  it('rejects too many panels', () => {
    const panels = Array.from({ length: 11 }, (_, i) => ({
      id: `p${i}`, title: `P${i}`, content: { type: 'webview', src: 'a.html' },
    }));
    expect(validateManifest({ ...valid, contributes: { panels } }).valid).toBe(false);
  });

  it('parses activation events', () => {
    expect(parseActivation('startup')).toEqual({ kind: 'startup' });
    expect(parseActivation('command:do-thing')).toEqual({ kind: 'command', value: 'do-thing' });
    expect(parseActivation('view:calendar')).toEqual({ kind: 'view', value: 'calendar' });
    expect(parseActivation('file:.canvas')).toEqual({ kind: 'file', value: '.canvas' });
    expect(parseActivation('nonsense')).toBeNull();
    expect(parseActivation('command:')).toBeNull();
    expect(parseActivation('weird:thing')).toBeNull();
  });

  it('detects v3 manifests', () => {
    expect(isV3Manifest({ apiVersion: API_VERSION })).toBe(true);
    expect(isV3Manifest({ apiVersion: 1 })).toBe(false);
    expect(isV3Manifest(null)).toBe(false);
  });
});
