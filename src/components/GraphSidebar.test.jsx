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

import GraphSidebar from './GraphSidebar.jsx';
import { useGraphConfig, getDefaultConfig } from '../core/graph2/graphConfig.js';
import { getGraphEngine, resetGraphEngine } from '../core/graph2/graphEngine.js';

/** Minimal linkIndex stand-in — the engine only needs these three. */
function fakeIndex(nodes, links = []) {
  return {
    nodes: () => nodes,
    links: () => links,
    subscribe: () => () => {},
  };
}

const NODES = [
  { id: 'projects/a.md', title: 'a', type: 'file', tags: ['x'] },
  { id: 'projects/b.md', title: 'b', type: 'file', tags: [] },
  { id: 'notes/c.md', title: 'c', type: 'file', tags: [] },
  { id: 'Ghost', title: 'Ghost', type: 'phantom', phantom: true, folder: '' },
];
const LINKS = [{ source: 'projects/a.md', target: 'projects/b.md' }];

function statValue(label) {
  const card = screen.getByText(label).closest('.bg-app-bg');
  return card.querySelector('.text-xl').textContent;
}

beforeEach(() => {
  useGraphConfig.setState({ workspacePath: null, config: getDefaultConfig(), loaded: false });
  getGraphEngine().setConfig(getDefaultConfig());
});

afterEach(() => {
  resetGraphEngine(); // stops the simulation so it can't tick past the test
});

describe('GraphSidebar', () => {
  it('renders every section and drops the old animation tour', () => {
    render(<GraphSidebar />);

    expect(screen.getByText('Graph Settings')).toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Display')).toBeInTheDocument();
    expect(screen.getByText('Forces')).toBeInTheDocument();
    expect(screen.getByText('Color Groups')).toBeInTheDocument();
    expect(screen.getByText('Background')).toBeInTheDocument();
    expect(screen.getByText('Statistics')).toBeInTheDocument();

    expect(screen.queryByText('Animation Tour')).not.toBeInTheDocument();
    expect(screen.queryByText('Start Tour')).not.toBeInTheDocument();
    expect(screen.queryByText('FPS')).not.toBeInTheDocument();
  });

  it('collapsing a section writes the collapse key', () => {
    render(<GraphSidebar />);

    expect(useGraphConfig.getState().config['collapse-filter']).toBe(false);
    fireEvent.click(screen.getByText('Filters'));
    expect(useGraphConfig.getState().config['collapse-filter']).toBe(true);
    expect(screen.queryByPlaceholderText('Highlight nodes…')).not.toBeInTheDocument();
  });

  it('filter controls write straight to the config store', () => {
    render(<GraphSidebar />);

    fireEvent.click(screen.getByLabelText('Show Tags'));
    expect(useGraphConfig.getState().config.showTags).toBe(false);

    fireEvent.click(screen.getByLabelText('Hide Unresolved (placeholders)'));
    expect(useGraphConfig.getState().config.hideUnresolved).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('Highlight nodes…'), { target: { value: 'proj' } });
    expect(useGraphConfig.getState().config.search).toBe('proj');
  });

  it('local graph reveals the depth slider and warns when nothing is focused', () => {
    render(<GraphSidebar />);

    expect(screen.queryByLabelText('Depth')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Local graph'));
    expect(useGraphConfig.getState().config.localMode).toBe(true);

    const depth = screen.getByLabelText('Depth');
    expect(depth).toBeInTheDocument();
    expect(screen.getByText(/No active file/)).toBeInTheDocument();

    fireEvent.change(depth, { target: { value: '3' } });
    expect(useGraphConfig.getState().config.localDepth).toBe(3);
  });

  it('exposes the new display toggles', () => {
    render(<GraphSidebar />);

    fireEvent.click(screen.getByLabelText('Highlight neighbors on hover'));
    expect(useGraphConfig.getState().config.highlightNeighbors).toBe(false);

    fireEvent.click(screen.getByLabelText('Follow active file'));
    expect(useGraphConfig.getState().config.followFocus).toBe(false);
  });

  it('force sliders write to the config store', () => {
    useGraphConfig.getState().update({ 'collapse-forces': false });
    render(<GraphSidebar />);

    fireEvent.change(screen.getByLabelText('Link Distance'), { target: { value: '150' } });
    expect(useGraphConfig.getState().config.linkDistance).toBe(150);

    fireEvent.change(screen.getByLabelText('Repel Force'), { target: { value: '300' } });
    expect(useGraphConfig.getState().config.repelStrength).toBe(300);
  });

  it('reads statistics off the engine', () => {
    getGraphEngine().attach(fakeIndex(NODES, LINKS));
    render(<GraphSidebar />);

    expect(statValue('Nodes')).toBe('4');
    expect(statValue('Notes')).toBe('3');
    expect(statValue('Placeholders')).toBe('1');
    expect(statValue('Links')).toBe('1');
  });

  it('renders tags and attachments stats only when the engine reports them', () => {
    const engine = getGraphEngine();
    engine.attach(fakeIndex(NODES, LINKS));

    const { unmount } = render(<GraphSidebar />);
    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
    expect(screen.queryByText('Attachments')).not.toBeInTheDocument();
    unmount();

    const base = engine.stats();
    vi.spyOn(engine, 'stats').mockReturnValue({ ...base, tags: 7, attachments: 2 });
    render(<GraphSidebar />);

    expect(statValue('Tags')).toBe('7');
    expect(statValue('Attachments')).toBe('2');
  });

  it('counts color-group matches against engine nodes', () => {
    getGraphEngine().attach(fakeIndex(NODES, LINKS));
    useGraphConfig.getState().update({
      'collapse-groups': false,
      colorGroups: [
        { query: 'folder:projects', color: '#ff0000' },
        { query: 'type:phantom', color: '#00ff00' },
        { query: 'nothing-matches-this', color: '#0000ff' },
      ],
    });
    render(<GraphSidebar />);

    expect(screen.getByTitle('2 nodes matched')).toBeInTheDocument();
    expect(screen.getByTitle('1 node matched')).toBeInTheDocument();
    expect(screen.getByTitle('0 nodes matched')).toBeInTheDocument();
  });

  it('adds, reorders and removes color groups', () => {
    useGraphConfig.getState().update({
      'collapse-groups': false,
      colorGroups: [
        { query: 'first', color: '#ff0000' },
        { query: 'second', color: '#00ff00' },
      ],
    });
    render(<GraphSidebar />);

    fireEvent.click(screen.getAllByTitle('Move down (lower priority)')[0]);
    expect(useGraphConfig.getState().config.colorGroups.map((g) => g.query)).toEqual(['second', 'first']);

    fireEvent.click(screen.getByText('+ Add Color Group'));
    expect(useGraphConfig.getState().config.colorGroups).toHaveLength(3);

    fireEvent.click(screen.getAllByTitle('Remove group')[0]);
    expect(useGraphConfig.getState().config.colorGroups.map((g) => g.query)).toEqual(['first', '']);
  });

  it('resets every setting to its default', () => {
    useGraphConfig.getState().update({ repelStrength: 400, showTags: false, search: 'x' });
    render(<GraphSidebar />);

    fireEvent.click(screen.getByText('Reset to defaults'));

    expect(useGraphConfig.getState().config).toEqual(getDefaultConfig());
  });

  it('stays live: engine changes repaint the stats', async () => {
    const engine = getGraphEngine();
    let notify = () => {};
    engine.attach({
      nodes: () => NODES,
      links: () => LINKS,
      subscribe: (fn) => { notify = fn; return () => {}; },
    });
    render(<GraphSidebar />);
    expect(statValue('Nodes')).toBe('4');

    NODES.push({ id: 'notes/d.md', title: 'd', type: 'file', tags: [] });
    await act(async () => {
      notify();
      await new Promise((r) => setTimeout(r, 450)); // past the panel's tick throttle
    });

    expect(statValue('Nodes')).toBe('5');
    NODES.pop();
  });
});
