import { describe, expect, it } from 'vitest';

import { normalizeWatcherPayload } from './reconcileWatcherPayload';

describe('normalizeWatcherPayload', () => {
  it('preserves native event kinds and rename path pairs', () => {
    expect(normalizeWatcherPayload({
      sequence: 7,
      paths: ['/vault/old.md', '/vault/new.md'],
      changes: [{ kind: 'rename', paths: ['/vault/old.md', '/vault/new.md'] }],
    })).toEqual({
      sequence: 7,
      changes: [{ kind: 'rename', paths: ['/vault/old.md', '/vault/new.md'] }],
      paths: ['/vault/old.md', '/vault/new.md'],
    });
  });

  it('keeps compatibility with path-only watcher payloads', () => {
    expect(normalizeWatcherPayload({ paths: ['/vault/a.md'] })).toEqual({
      sequence: 0,
      changes: [{ kind: 'other', paths: ['/vault/a.md'] }],
      paths: ['/vault/a.md'],
    });
  });
});
