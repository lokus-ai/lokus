import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  mkdir: vi.fn(),
  exists: vi.fn().mockResolvedValue(true),
  readDir: vi.fn().mockResolvedValue([]),
}));
vi.mock('../config/store.js', () => ({
  updateConfig: vi.fn(),
  readConfig: vi.fn().mockResolvedValue({}),
}));
vi.mock('../notes/NoteMutationClient', () => ({
  noteMutationClient: {
    writeNote: vi.fn().mockResolvedValue({ legacy: true }),
  },
}));

import { noteMutationClient } from '../notes/NoteMutationClient';
import { DailyNotesManager } from './manager';

describe('DailyNotesManager note mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates daily notes through the universal mutation seam', async () => {
    const manager = new DailyNotesManager({ workspacePath: '/vault' });

    const path = await manager.createDailyNote(new Date('2026-08-22T12:00:00Z'));

    expect(noteMutationClient.writeNote).toHaveBeenCalledWith({
      workspacePath: '/vault',
      path,
      content: expect.stringContaining('2026-08-22'),
      source: 'daily-note',
    });
  });
});
