import { invoke } from '@tauri-apps/api/core';

export async function initializeNoteFoundation(workspacePath, enabled) {
  if (!enabled || !workspacePath) return null;
  return invoke('initialize_note_engine', { workspacePath });
}
