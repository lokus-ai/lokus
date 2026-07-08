import { describe, it, expect, vi } from 'vitest';

// ManifestManager imports the supabase client at module load — stub it since
// diff() (the unit under test) never touches the network.
vi.mock('../auth/supabase', () => ({ supabase: {} }));

import { ManifestManager } from './ManifestManager';

// Minimal SyncCache stand-in: only get()/has() are used by diff().
function makeCache(entries = {}) {
  const store = { ...entries };
  return {
    get: (p) => store[p] || null,
    has: (p) => p in store,
    set: (p, hash) => { store[p] = { hash }; },
    delete: (p) => { delete store[p]; },
  };
}

const mm = new ManifestManager();

// Every scan-miss test needs a verifier; default to "confirmed gone".
const alwaysDeleted = { verifyDeleted: async () => true };

describe('ManifestManager.diff — conflict + delete safety', () => {
  it('keeps BOTH copies on a true concurrent conflict (nothing discarded)', async () => {
    // Both sides diverged from the last-synced baseline "BASE".
    const local = new Map([
      ['a.md', { hash: 'L', size: 1, isBinary: false, modifiedAt: '2026-01-02T00:00:00Z' }],
    ]);
    const remote = { files: { 'a.md': { hash: 'R', modified_at: '2026-01-01T00:00:00Z', size: 1 } } };
    const cache = makeCache({ 'a.md': { hash: 'BASE' } });

    const res = await mm.diff(local, remote, cache, alwaysDeleted);

    expect(res.conflict).toHaveLength(1);
    expect(res.conflict[0]).toMatchObject({ path: 'a.md', primary: 'local' }); // local is newer
    // Primary local stays under its name; nothing is dropped from either side.
    expect(res.upload).toContain('a.md');
    expect(res.download).not.toContain('a.md');
    expect(res.delete).toHaveLength(0);
  });

  it('picks remote as primary when remote is newer, still keeping both', async () => {
    const local = new Map([
      ['a.md', { hash: 'L', size: 1, isBinary: false, modifiedAt: '2026-01-01T00:00:00Z' }],
    ]);
    const remote = { files: { 'a.md': { hash: 'R', modified_at: '2026-06-01T00:00:00Z', size: 1 } } };
    const cache = makeCache({ 'a.md': { hash: 'BASE' } });

    const res = await mm.diff(local, remote, cache, alwaysDeleted);

    expect(res.conflict[0]).toMatchObject({ path: 'a.md', primary: 'remote' });
    expect(res.download).toContain('a.md');
    expect(res.upload).not.toContain('a.md');
  });

  it('one-sided LOCAL change → upload fast path even when remote mtime is newer', async () => {
    // Regression guard for clock-skew clobber: old code compared raw wall clocks
    // and would DOWNLOAD (discard local) because remote.modified_at is newer.
    const local = new Map([
      ['c.md', { hash: 'L', size: 1, isBinary: false, modifiedAt: '2026-01-01T00:00:00Z' }],
    ]);
    const remote = { files: { 'c.md': { hash: 'R0', modified_at: '2026-06-01T00:00:00Z', size: 1 } } };
    // Remote hash equals the last-synced baseline → remote did NOT change.
    const cache = makeCache({ 'c.md': { hash: 'R0' } });

    const res = await mm.diff(local, remote, cache, alwaysDeleted);

    expect(res.upload).toContain('c.md');
    expect(res.download).not.toContain('c.md');
    expect(res.conflict).toHaveLength(0);
  });

  it('one-sided REMOTE change → download fast path', async () => {
    const local = new Map([
      ['d.md', { hash: 'R0', size: 1, isBinary: false, modifiedAt: '2026-06-01T00:00:00Z' }],
    ]);
    const remote = { files: { 'd.md': { hash: 'R1', modified_at: '2026-01-01T00:00:00Z', size: 1 } } };
    const cache = makeCache({ 'd.md': { hash: 'R0' } }); // local unchanged since last sync

    const res = await mm.diff(local, remote, cache, alwaysDeleted);

    expect(res.download).toContain('d.md');
    expect(res.upload).not.toContain('d.md');
    expect(res.conflict).toHaveLength(0);
  });

  it('scan-miss + existence check ERROR → no delete (transient miss, not a deletion)', async () => {
    const local = new Map(); // file absent from this scan
    const remote = { files: { 'b.md': { hash: 'R', modified_at: '2026-01-01T00:00:00Z', size: 1 } } };
    const cache = makeCache({ 'b.md': { hash: 'R' } }); // was synced before

    const res = await mm.diff(local, remote, cache, {
      verifyDeleted: async () => { throw new Error('EACCES'); },
    });

    expect(res.delete).toHaveLength(0);
    expect(res.download).not.toContain('b.md'); // must NOT overwrite either
  });

  it('scan-miss but file actually still exists → no delete', async () => {
    const local = new Map();
    const remote = { files: { 'b.md': { hash: 'R', modified_at: '2026-01-01T00:00:00Z', size: 1 } } };
    const cache = makeCache({ 'b.md': { hash: 'R' } });

    const res = await mm.diff(local, remote, cache, { verifyDeleted: async () => false });

    expect(res.delete).toHaveLength(0);
    expect(res.skip).toContain('b.md');
  });

  it('scan-miss + confirmed gone → delete', async () => {
    const local = new Map();
    const remote = { files: { 'b.md': { hash: 'R', modified_at: '2026-01-01T00:00:00Z', size: 1 } } };
    const cache = makeCache({ 'b.md': { hash: 'R' } });

    const res = await mm.diff(local, remote, cache, { verifyDeleted: async () => true });

    expect(res.delete).toContain('b.md');
  });

  it('no verifier supplied → never deletes (safe default)', async () => {
    const local = new Map();
    const remote = { files: { 'b.md': { hash: 'R', modified_at: '2026-01-01T00:00:00Z', size: 1 } } };
    const cache = makeCache({ 'b.md': { hash: 'R' } });

    const res = await mm.diff(local, remote, cache); // no options

    expect(res.delete).toHaveLength(0);
  });

  it('remote file never seen locally (not in cache) → download as new file', async () => {
    const local = new Map();
    const remote = { files: { 'new.md': { hash: 'R', modified_at: '2026-01-01T00:00:00Z', size: 1 } } };
    const cache = makeCache({}); // not previously synced

    const res = await mm.diff(local, remote, cache, alwaysDeleted);

    expect(res.download).toContain('new.md');
    expect(res.delete).toHaveLength(0);
  });

  it('identical hashes → skip', async () => {
    const local = new Map([
      ['x.md', { hash: 'H', size: 1, isBinary: false, modifiedAt: '2026-01-01T00:00:00Z' }],
    ]);
    const remote = { files: { 'x.md': { hash: 'H', modified_at: '2026-01-01T00:00:00Z', size: 1 } } };
    const cache = makeCache({ 'x.md': { hash: 'H' } });

    const res = await mm.diff(local, remote, cache, alwaysDeleted);

    expect(res.skip).toContain('x.md');
    expect(res.upload).toHaveLength(0);
    expect(res.download).toHaveLength(0);
  });
});
