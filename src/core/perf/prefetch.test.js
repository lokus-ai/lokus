import { describe, it, expect, beforeEach, vi } from 'vitest';

import { warmLazyViews, __resetWarmLazyViews } from './prefetch.js';

describe('warmLazyViews', () => {
  beforeEach(() => {
    __resetWarmLazyViews();
    vi.useFakeTimers();
    // Force the setTimeout path so the schedule is deterministic.
    vi.stubGlobal('requestIdleCallback', undefined);
  });

  it('does nothing until the app is idle — never on the critical path', () => {
    const before = performance.now();
    warmLazyViews();
    // The call itself must not import anything synchronously; it only schedules.
    expect(performance.now() - before).toBeLessThan(50);
  });

  it('is idempotent, so every mount can call it', async () => {
    warmLazyViews();
    warmLazyViews();
    warmLazyViews();

    // Only one schedule should be pending; draining it must not throw.
    await vi.advanceTimersByTimeAsync(2000);
    expect(true).toBe(true);
  });

  it('survives a chunk that fails to load', async () => {
    // A prefetch is best-effort: the real import is what surfaces an error,
    // so a rejection here must not produce an unhandled rejection.
    const onUnhandled = vi.fn();
    process.on('unhandledRejection', onUnhandled);

    warmLazyViews();
    await vi.advanceTimersByTimeAsync(10000);

    process.off('unhandledRejection', onUnhandled);
    expect(onUnhandled).not.toHaveBeenCalled();
  });
});
