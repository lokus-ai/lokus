import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => '{}'),
  writeTextFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
}));
vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn(async (...parts) => parts.join('/')),
}));
// The frame draws to a canvas — out of scope here, and jsdom has no 2d context.
vi.mock('./GraphFrame.jsx', () => ({
  default: ({ variant, className }) => (
    <div data-testid="graph-frame" data-variant={variant} className={className} />
  ),
}));

import GraphView from './GraphView.jsx';
import { useGraphStore } from '../../core/graph2/graphStore.js';
import { useGraphConfig, getDefaultConfig } from '../../core/graph2/graphConfig.js';
import { resetGraphEngine } from '../../core/graph2/graphEngine.js';

function setStore(status, stats = { files: 3, links: 2, phantoms: 1 }) {
  useGraphStore.setState({
    status,
    version: 1,
    index: { stats: () => stats, nodes: () => [], links: () => [] },
  });
}

async function mount(props = {}) {
  let view;
  await act(async () => {
    view = render(<GraphView workspacePath="/w" focusPath="/w/a.md" onFileClick={() => {}} {...props} />);
  });
  return view;
}

beforeEach(() => {
  useGraphStore.getState().reset();
  useGraphConfig.setState({ workspacePath: null, config: getDefaultConfig(), loaded: false });
});

afterEach(() => {
  resetGraphEngine();
});

describe('GraphView', () => {
  it('mounts a full frame with the settings rail', async () => {
    setStore('ready');
    await mount();

    expect(screen.getByTestId('graph-frame')).toHaveAttribute('data-variant', 'full');
    expect(screen.getByText('Graph Settings')).toBeInTheDocument();
    expect(screen.getByText('3 files · 2 links')).toBeInTheDocument();
  });

  it('search writes config.search', async () => {
    setStore('ready');
    await mount();

    fireEvent.change(screen.getByPlaceholderText('Search the graph…'), { target: { value: 'alpha' } });
    expect(useGraphConfig.getState().config.search).toBe('alpha');
  });

  it('toggles the settings rail', async () => {
    setStore('ready');
    await mount();

    fireEvent.click(screen.getByLabelText('Hide graph settings'));
    expect(screen.queryByText('Graph Settings')).not.toBeInTheDocument();
    expect(screen.getByTestId('graph-frame')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Show graph settings'));
    expect(screen.getByText('Graph Settings')).toBeInTheDocument();
  });

  it('shows boot, error and empty states instead of the frame', async () => {
    setStore('booting');
    const booting = await mount();
    expect(screen.getByText('Building graph…')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-frame')).not.toBeInTheDocument();
    booting.unmount();

    setStore('error');
    const errored = await mount();
    expect(screen.getByText('Graph failed to load')).toBeInTheDocument();
    errored.unmount();

    setStore('ready', { files: 0, links: 0, phantoms: 0 });
    await mount();
    expect(screen.getByText('No files yet')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-frame')).not.toBeInTheDocument();
  });

  it('loads the workspace config on mount', async () => {
    setStore('ready');
    await mount();

    expect(useGraphConfig.getState().workspacePath).toBe('/w');
    expect(useGraphConfig.getState().loaded).toBe(true);
  });
});
