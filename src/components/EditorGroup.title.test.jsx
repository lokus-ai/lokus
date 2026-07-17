import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve('# Note\n\nbody')),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn(() => Promise.resolve(false)),
  save: vi.fn(() => Promise.resolve(null)),
}));

// The persistent ProseMirror editor is irrelevant to the title input —
// replace it with an inert stub (handleEditorReady never fires).
vi.mock('../editor', () => ({
  default: React.forwardRef(() => null),
}));

vi.mock('../views/Canvas', () => ({ default: () => null }));

import { invoke } from '@tauri-apps/api/core';
import EditorGroup from './EditorGroup';
import { useEditorGroupStore } from '../stores/editorGroups';
import { useTabMetaStore, getTabMeta } from '../stores/tabMeta';

const GROUP = {
  id: 'group-title-test',
  type: 'group',
  tabs: [{ path: '/ws/note.md', name: 'note.md' }],
  activeTab: '/ws/note.md',
  contentByTab: {},
};

function renderGroup() {
  return render(
    <EditorGroup
      group={GROUP}
      isFocused={true}
      workspacePath="/ws"
      hideTabBar={true}
      onCreateFile={() => {}}
      onCreateFolder={() => {}}
      onCreateCanvas={() => {}}
      onOpenCommandPalette={() => {}}
      onFileOpen={() => {}}
    />
  );
}

describe('EditorGroup title input (local draft, commit on Enter/blur)', () => {
  beforeEach(async () => {
    useEditorGroupStore.getState().initLayout([], null);
    useTabMetaStore.getState().clearAll();
    renderGroup();
    // Let the async file load settle (it writes savedContent/title once).
    await waitFor(() => {
      expect(getTabMeta(GROUP.id, '/ws/note.md')?.savedContent).toBe('# Note\n\nbody');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the basename as the draft title', () => {
    const input = screen.getByPlaceholderText('Untitled');
    expect(input).toHaveValue('note');
  });

  it('typing produces zero store writes', () => {
    let tabMetaWrites = 0;
    let layoutWrites = 0;
    const unsubMeta = useTabMetaStore.subscribe(() => tabMetaWrites++);
    const unsubLayout = useEditorGroupStore.subscribe(() => layoutWrites++);

    const input = screen.getByPlaceholderText('Untitled');
    fireEvent.change(input, { target: { value: 'n' } });
    fireEvent.change(input, { target: { value: 'new' } });
    fireEvent.change(input, { target: { value: 'new title' } });

    expect(input).toHaveValue('new title'); // local draft updated
    expect(tabMetaWrites).toBe(0);
    expect(layoutWrites).toBe(0);
    unsubMeta();
    unsubLayout();
  });

  it('Enter commits once: one setTitle + one setDirty', () => {
    const setTitleSpy = vi.spyOn(useTabMetaStore.getState(), 'setTitle');
    const setDirtySpy = vi.spyOn(useTabMetaStore.getState(), 'setDirty');

    const input = screen.getByPlaceholderText('Untitled');
    fireEvent.change(input, { target: { value: 'new title' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(setTitleSpy).toHaveBeenCalledTimes(1);
    expect(setTitleSpy).toHaveBeenCalledWith(GROUP.id, '/ws/note.md', 'new title');
    expect(setDirtySpy).toHaveBeenCalledTimes(1);
    expect(setDirtySpy).toHaveBeenCalledWith(GROUP.id, '/ws/note.md', true);
    expect(getTabMeta(GROUP.id, '/ws/note.md')?.title).toBe('new title');
    expect(getTabMeta(GROUP.id, '/ws/note.md')?.dirty).toBe(true);
  });

  it('blur commits a changed draft', () => {
    const setTitleSpy = vi.spyOn(useTabMetaStore.getState(), 'setTitle');

    const input = screen.getByPlaceholderText('Untitled');
    fireEvent.change(input, { target: { value: 'blurred title' } });
    fireEvent.blur(input);

    expect(setTitleSpy).toHaveBeenCalledTimes(1);
    expect(setTitleSpy).toHaveBeenCalledWith(GROUP.id, '/ws/note.md', 'blurred title');
  });

  it('does not write when the draft is unchanged', () => {
    const setTitleSpy = vi.spyOn(useTabMetaStore.getState(), 'setTitle');
    const setDirtySpy = vi.spyOn(useTabMetaStore.getState(), 'setDirty');

    const input = screen.getByPlaceholderText('Untitled');
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);

    expect(setTitleSpy).not.toHaveBeenCalled();
    expect(setDirtySpy).not.toHaveBeenCalled();
  });
});
