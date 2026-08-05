import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';

import { FileTreeView } from './FileTreeView.jsx';
import { useFileTreeStore } from '../../stores/fileTree';

// dnd-kit needs layout APIs jsdom doesn't provide; the drag behaviour is not
// what these tests are about.
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }) => <>{children}</>,
  DragOverlay: () => null,
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, isDragging: false }),
  useSensor: () => ({}),
  useSensors: () => [],
  PointerSensor: class {},
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }) => <>{children}</>,
  motion: { div: ({ children, ...p }) => <div {...p}>{children}</div> },
}));

// The worker client constructs a Worker at import time, which jsdom has no
// implementation for.
vi.mock('../../workers/referenceWorkerClient.js', () => ({
  default: { getBacklinksForFile: () => [], buildIndex: () => Promise.resolve() },
}));

const invoke = vi.fn(() => Promise.resolve(''));
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a) => invoke(...a) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn(() => Promise.resolve(true)),
  open: vi.fn(() => Promise.resolve(null)),
}));

const TREE = [
  {
    name: 'projects', path: '/w/projects', is_directory: true,
    children: [
      { name: 'atlas.md', path: '/w/projects/atlas.md', is_directory: false },
      { name: 'beta.md', path: '/w/projects/beta.md', is_directory: false },
    ],
  },
  { name: 'notes.md', path: '/w/notes.md', is_directory: false },
  { name: 'todo.md', path: '/w/todo.md', is_directory: false },
];

const setup = (props = {}) => {
  const onAction = vi.fn();
  const utils = render(
    <FileTreeView
      entries={TREE}
      onFileClick={vi.fn()}
      activeFile={null}
      onRefresh={vi.fn()}
      toggleFolder={(p) => useFileTreeStore.getState().toggleFolder(p)}
      creatingItem={null}
      onCreateConfirm={vi.fn()}
      setRenamingPath={vi.fn()}
      onViewHistory={vi.fn()}
      setTagModalFile={vi.fn()}
      setUseSplitView={vi.fn()}
      setRightPaneFile={vi.fn()}
      setRightPaneTitle={vi.fn()}
      setRightPaneContent={vi.fn()}
      isExternalDragActive={false}
      toast={{ success: vi.fn(), error: vi.fn(), info: vi.fn() }}
      onCheckReferences={null}
      workspacePath="/w"
      onUpdateTabPath={vi.fn()}
      {...props}
    />,
  );
  return { onAction, ...utils };
};

const resetStore = () =>
  useFileTreeStore.setState({
    expandedFolders: new Set(),
    activePath: null,
    renamingPath: null,
    hoveredFolder: null,
    creatingItem: null,
  });

beforeEach(resetStore);
afterEach(cleanup);

describe('FileTreeView', () => {
  it('renders a row per top-level entry', () => {
    const { container } = setup();
    expect(container.querySelectorAll('li[data-path]').length).toBe(TREE.length);
    expect(screen.getByText('projects')).toBeTruthy();
    // The .md extension is stripped for display.
    expect(screen.getByText('notes')).toBeTruthy();
  });

  it('mounts ONE context menu for the whole tree, not one per row', () => {
    const { container } = setup();

    // Radix marks each ContextMenu.Trigger. One per tree — the old code
    // mounted one per row, along with ~100 menu elements each.
    const triggers = container.querySelectorAll('[data-state][data-slot], [id^="radix-"]');
    const rows = container.querySelectorAll('li[data-path]');
    expect(rows.length).toBeGreaterThan(1);

    // Nothing is open, so no menu content is in the document at rest.
    expect(screen.queryByText('Rename')).toBeNull();
    expect(triggers.length).toBeLessThan(rows.length);
  });

  it('opens the menu against the row that was right-clicked', () => {
    const { container } = setup();

    const todoRow = container.querySelector('li[data-path="/w/todo.md"]');
    fireEvent.contextMenu(todoRow.querySelector('button'));

    // The menu is now open and scoped to that file.
    expect(screen.getByText('Rename')).toBeTruthy();
  });

  it('routes a menu action to the row just right-clicked, not a stale one', async () => {
    // The single shared menu means the target is state, not a closure — so
    // the case that matters is right-clicking one row and then another.
    invoke.mockClear();
    const { container } = setup();

    fireEvent.contextMenu(container.querySelector('li[data-path="/w/notes.md"] button'));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.contextMenu(container.querySelector('li[data-path="/w/todo.md"] button'));

    fireEvent.click(screen.getByText(/Reveal in Finder|Reveal in File Explorer|Show in File Manager/));
    await Promise.resolve();

    expect(invoke).toHaveBeenCalledWith('platform_reveal_in_file_manager', { path: '/w/todo.md' });
    expect(invoke).not.toHaveBeenCalledWith('platform_reveal_in_file_manager', { path: '/w/notes.md' });
  });

  it('expanding a folder reveals its children', () => {
    const { container } = setup();
    expect(container.querySelector('li[data-path="/w/projects/atlas.md"]')).toBeNull();

    fireEvent.click(screen.getByText('projects'));

    expect(container.querySelector('li[data-path="/w/projects/atlas.md"]')).toBeTruthy();
    expect(screen.getByText('atlas')).toBeTruthy();
  });

  it('marks the active row from the store, not from a prop', () => {
    const { container } = setup();
    const row = () => container.querySelector('li[data-path="/w/todo.md"] button');
    expect(row().className).not.toContain('active');

    // A row reads its own highlight, so publishing the path is enough.
    act(() => { useFileTreeStore.getState().setActivePath('/w/todo.md'); });

    expect(row().className).toContain('active');
  });

  it('renders a file-type icon (svg) for plain file rows', () => {
    const { container } = setup();
    const fileRows = Array.from(container.querySelectorAll('.file-leaf'));
    expect(fileRows.length).toBeGreaterThan(0);
    const withIcon = fileRows.filter((row) => row.querySelector('svg'));
    expect(withIcon.length).toBe(fileRows.length);
  });
});
