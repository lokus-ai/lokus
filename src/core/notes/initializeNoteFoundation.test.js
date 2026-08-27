import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { initializeNoteFoundation } from './initializeNoteFoundation';

describe('initializeNoteFoundation', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('does nothing while the foundation flag is disabled', async () => {
    expect(await initializeNoteFoundation('/vault', false)).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('initializes and backfills the workspace when enabled', async () => {
    invoke.mockResolvedValue({ created: 2, reused: 3, skipped_symlinks: 1 });

    const result = await initializeNoteFoundation('/vault', true);

    expect(invoke).toHaveBeenCalledWith('initialize_note_engine', {
      workspacePath: '/vault',
    });
    expect(result).toEqual({ created: 2, reused: 3, skipped_symlinks: 1 });
  });
});
