import { describe, it, expect, vi } from 'vitest';
import { request, response, evt, logMsg, isValidMessage, PendingRequests } from '../rpc.js';

describe('rpc envelopes', () => {
  it('builds request envelopes with unique ids', () => {
    const a = request('ui.notify', { message: 'hi' });
    const b = request('ui.notify', {});
    expect(a.kind).toBe('req');
    expect(a.v).toBe(3);
    expect(a.method).toBe('ui.notify');
    expect(a.args).toEqual({ message: 'hi' });
    expect(a.id).not.toBe(b.id);
  });

  it('builds response/event/log envelopes', () => {
    expect(response('w1', true, 42)).toMatchObject({ kind: 'res', id: 'w1', ok: true, result: 42 });
    expect(evt('command', { id: 'x' })).toMatchObject({ kind: 'evt', event: 'command' });
    expect(logMsg('info', 'hello')).toMatchObject({ kind: 'log', level: 'info', message: 'hello' });
  });

  it('validates messages', () => {
    expect(isValidMessage({ v: 3, kind: 'req' })).toBe(true);
    expect(isValidMessage({ v: 2, kind: 'req' })).toBe(false);
    expect(isValidMessage(null)).toBe(false);
    expect(isValidMessage({})).toBe(false);
  });
});

describe('PendingRequests', () => {
  it('settles matching ids', async () => {
    const p = new PendingRequests();
    const promise = new Promise((res, rej) => p.track('w1', res, rej));
    expect(p.settle('w1', true, 'done')).toBe(true);
    await expect(promise).resolves.toBe('done');
    expect(p.size).toBe(0);
  });

  it('rejects on error responses', async () => {
    const p = new PendingRequests();
    const promise = new Promise((res, rej) => p.track('w1', res, rej));
    p.settle('w1', false, null, 'denied');
    await expect(promise).rejects.toThrow('denied');
  });

  it('ignores unknown ids', () => {
    const p = new PendingRequests();
    expect(p.settle('nope', true, 1)).toBe(false);
  });

  it('times out stale requests', async () => {
    vi.useFakeTimers();
    const p = new PendingRequests(50);
    const promise = new Promise((res, rej) => p.track('w1', res, rej));
    vi.advanceTimersByTime(60);
    await expect(promise).rejects.toThrow(/timed out/);
    vi.useRealTimers();
  });

  it('rejects everything on teardown', async () => {
    const p = new PendingRequests();
    const a = new Promise((res, rej) => p.track('w1', res, rej));
    const b = new Promise((res, rej) => p.track('w2', res, rej));
    p.rejectAll('gone');
    await expect(a).rejects.toThrow('gone');
    await expect(b).rejects.toThrow('gone');
  });
});
