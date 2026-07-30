import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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
// The frame draws to a canvas — out of scope here, and jsdom has no 2d context.
vi.mock('./GraphFrame.jsx', () => ({
  default: ({ variant, className }) => (
    <div data-testid="graph-frame" data-variant={variant} className={className} />
  ),
}));

import { useGraphStore } from '../../core/graph2/graphStore.js';
import { resetGraphEngine } from '../../core/graph2/graphEngine.js';
import GraphPanel from './GraphPanel.jsx';

const FILE_TREE = [
  { name: 'a.md', path: '/w/a.md', is_directory: false },
  { name: 'b.md', path: '/w/b.md', is_directory: false },
];

beforeEach(() => {
  useGraphStore.getState().reset();
});

afterEach(() => {
  resetGraphEngine();
});

describe('GraphPanel', () => {
  it('renders the preview frame once the workspace index is booted', async () => {
    await act(async () => {
      await useGraphStore.getState().boot('/w', FILE_TREE);
    });
    expect(useGraphStore.getState().status).toBe('ready');
    expect(useGraphStore.getState().index.stats().files).toBe(2);

    await act(async () => {
      render(<GraphPanel focusPath="/w/a.md" onFileClick={() => {}} />);
    });

    expect(screen.getByTestId('graph-frame')).toHaveAttribute('data-variant', 'preview');
    expect(screen.getByText('Graph')).toBeInTheDocument();
    const { links } = useGraphStore.getState().index.stats();
    expect(screen.getByText(`2 files · ${links} ${links === 1 ? 'link' : 'links'}`)).toBeInTheDocument();
  });

  it('does not boot the index itself', async () => {
    await act(async () => {
      render(<GraphPanel focusPath="/w/a.md" onFileClick={() => {}} />);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(useGraphStore.getState().status).toBe('idle');
    expect(screen.getByText('Building graph…')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-frame')).not.toBeInTheDocument();
  });

  it('hides its header on request', async () => {
    await act(async () => {
      await useGraphStore.getState().boot('/w', FILE_TREE);
    });
    await act(async () => {
      render(<GraphPanel hideHeader onFileClick={() => {}} />);
    });

    expect(screen.queryByText('Graph')).not.toBeInTheDocument();
    expect(screen.getByTestId('graph-frame')).toBeInTheDocument();
  });
});
