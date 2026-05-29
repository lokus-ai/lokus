import { describe, it, expect, afterEach } from 'vitest';
import { setProvider } from './aiClient.js';
import { TRANSFORMS, getTransform, runTransform } from './transforms.js';

function providerCapturing() {
  const calls = [];
  return {
    calls,
    async *complete(messages, options) {
      calls.push({ messages, options });
      yield { type: 'text_delta', text: 'TRANSFORMED' };
      yield { type: 'done' };
    },
  };
}

describe('transforms', () => {
  afterEach(() => setProvider(null));

  it('exposes a catalog with the expected transforms', () => {
    const ids = TRANSFORMS.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['rewrite', 'simplify', 'expand', 'grammar', 'tone', 'translate']));
    expect(getTransform('rewrite')).toBeTruthy();
    expect(getTransform('nope')).toBeNull();
  });

  it('tone/translate are flagged needsArg with an arg label', () => {
    expect(getTransform('tone').needsArg).toBe(true);
    expect(getTransform('tone').argLabel).toBeTruthy();
    expect(getTransform('translate').needsArg).toBe(true);
  });

  it('runTransform streams the result with surface:selection', async () => {
    const provider = providerCapturing();
    setProvider(provider);
    const out = await runTransform('rewrite', 'hello');
    expect(out).toBe('TRANSFORMED');
    expect(provider.calls[0].options.surface).toBe('selection');
    expect(provider.calls[0].messages[0].content).toBe('hello');
    expect(provider.calls[0].options.system).toContain('Rewrite');
  });

  it('needsArg transforms inject the arg into the system prompt', async () => {
    const provider = providerCapturing();
    setProvider(provider);
    await runTransform('tone', 'hello', { arg: 'formal' });
    expect(provider.calls[0].options.system).toContain('formal');
    await runTransform('translate', 'hello', { arg: 'Spanish' });
    expect(provider.calls[1].options.system).toContain('Spanish');
  });

  it('throws on unknown transform or empty text', async () => {
    setProvider(providerCapturing());
    await expect(runTransform('nope', 'x')).rejects.toThrow(/Unknown transform/);
    await expect(runTransform('rewrite', '   ')).rejects.toThrow(/No text selected/);
  });

  it('forwards the onDelta callback', async () => {
    setProvider(providerCapturing());
    const deltas = [];
    await runTransform('simplify', 'hello', { onDelta: (d) => deltas.push(d) });
    expect(deltas).toEqual(['TRANSFORMED']);
  });
});
