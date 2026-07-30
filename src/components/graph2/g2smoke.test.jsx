import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd, args) => {
    if (cmd === 'read_all_files') {
      const out = {};
      for (const p of args.paths) out[p] = `content of ${p} [[b]]`;
      return out;
    }
    return null;
  }),
}));

import { useGraphStore } from '../../core/graph2/graphStore.js';
import { useFileTreeStore } from '../../stores/fileTree.js';
import GraphPanel from './GraphPanel.jsx';

describe('GraphPanel smoke', () => {
  it('boots and renders without crashing', async () => {
    useGraphStore.getState().reset();
    const fileTree = [
      { name: 'a.md', path: '/w/a.md', is_directory: false },
      { name: 'b.md', path: '/w/b.md', is_directory: false },
    ];
    useFileTreeStore.setState({ fileTree });
    let view;
    await act(async () => {
      view = render(<GraphPanel workspacePath="/w" focusPath="/w/a.md" onFileClick={() => {}} />);
    });
    await act(async () => { await new Promise(r => setTimeout(r, 300)); });
    expect(useGraphStore.getState().status).toBe('ready');
    expect(useGraphStore.getState().index.stats().files).toBe(2);
  });
});
