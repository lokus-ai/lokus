import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Workspace from './Workspace.jsx';

// Mock all the complex dependencies
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve())
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve([]))
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn(() => Promise.resolve(true))
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }) => children,
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), isDragging: false }),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  PointerSensor: vi.fn()
}));

vi.mock('./DraggableTab', () => ({
  DraggableTab: ({ tab }) => <div data-testid={`tab-${tab.path}`}>{tab.name}</div>
}));

vi.mock('../components/LokusLogo.jsx', () => ({
  default: () => <div data-testid="lokus-logo">Logo</div>
}));

vi.mock('../editor', () => ({
  default: ({ content, onContentChange }) => (
    <div data-testid="editor">
      <textarea 
        value={content} 
        onChange={(e) => onContentChange?.(e.target.value)}
        data-testid="editor-textarea"
      />
    </div>
  )
}));

vi.mock('../components/StatusBar.jsx', () => ({
  default: () => <div data-testid="status-bar">Status Bar</div>
}));

vi.mock('./Canvas.jsx', () => ({
  default: () => <div data-testid="canvas">Canvas</div>
}));

vi.mock('./GraphView.jsx', () => ({
  default: ({ data, onNodeClick, className }) => (
    <div data-testid="graph-view" className={className}>
      <div data-testid="graph-data">
        Nodes: {data?.nodes?.length || 0}, Edges: {data?.edges?.length || 0}
      </div>
      <button 
        data-testid="test-node-click" 
        onClick={() => onNodeClick?.({ 
          nodeId: 'test-node', 
          nodeData: { path: '/test/file.md', isPhantom: false } 
        })}
      >
        Test Node Click
      </button>
    </div>
  )
}));

// Mock GraphEngine to avoid WebGL dependencies
vi.mock('../core/graph/GraphEngine.js', () => ({
  GraphEngine: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    importData: vi.fn(),
    getStats: vi.fn(() => ({
      nodeCount: 5,
      edgeCount: 3,
      layoutIterations: 0,
      renderTime: 16
    })),
    startLayout: vi.fn(),
    stopLayout: vi.fn(),
    fitToViewport: vi.fn(),
    clear: vi.fn(),
    addNode: vi.fn(),
    addEdge: vi.fn(),
    setColorScheme: vi.fn(),
    setZoom: vi.fn(),
    resetLayout: vi.fn(),
    exportToPNG: vi.fn(),
    panTo: vi.fn(),
    setPerformanceMode: vi.fn(),
    getViewportBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 100 }))
  }))
}));

vi.mock('../core/graph/GraphDataProcessor.js', () => ({
  GraphDataProcessor: vi.fn().mockImplementation(() => ({
    buildGraphFromWorkspace: vi.fn(() => Promise.resolve({
      nodes: [
        { key: 'file1', attributes: { label: 'Test.md', path: '/test/file.md' } },
        { key: 'file2', attributes: { label: 'Notes.md', path: '/test/notes.md' } }
      ],
      edges: [
        { key: 'edge1', source: 'file1', target: 'file2' }
      ],
      stats: { nodeCount: 2, edgeCount: 1 }
    })),
    updateChangedFiles: vi.fn((changedFiles) => Promise.resolve({
      nodes: [
        { key: 'file1', attributes: { label: 'Test.md', path: '/test/file.md' } },
        { key: 'file2', attributes: { label: 'Notes.md', path: '/test/notes.md' } },
        { key: 'file3', attributes: { label: 'NewFile.md', path: '/test/newfile.md' } }
      ],
      edges: [
        { key: 'edge1', source: 'file1', target: 'file2' },
        { key: 'edge2', source: 'file1', target: 'file3' }
      ],
      stats: { nodeCount: 3, edgeCount: 2 }
    })),
    extractWikiLinks: vi.fn((content) => {
      const links = [];
      const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
      let match;
      while ((match = wikiLinkRegex.exec(content)) !== null) {
        links.push({
          target: match[1].trim(),
          alias: match[2] ? match[2].trim() : null,
          type: 'wiki',
          position: match.index
        });
      }
      return links;
    })
  }))
}));

// Mock other components
vi.mock('../components/FileContextMenu.jsx', () => ({
  default: ({ children }) => children
}));

vi.mock('../components/ui/context-menu.jsx', () => ({
  ContextMenu: ({ children }) => children,
  ContextMenuTrigger: ({ children }) => children,
  ContextMenuContent: ({ children }) => <div>{children}</div>,
  ContextMenuItem: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
  ContextMenuSeparator: () => <div />
}));

vi.mock('../core/shortcuts/registry.js', () => ({
  getActiveShortcuts: vi.fn(() => Promise.resolve({})),
  formatAccelerator: vi.fn((accel) => accel)
}));

vi.mock('../components/CommandPalette.jsx', () => ({
  default: () => <div data-testid="command-palette">Command Palette</div>
}));

vi.mock('../components/InFileSearch.jsx', () => ({
  default: () => <div data-testid="in-file-search">In File Search</div>
}));

vi.mock('../components/SearchPanel.jsx', () => ({
  default: () => <div data-testid="search-panel">Search Panel</div>
}));

vi.mock('../components/MiniKanban.jsx', () => ({
  default: () => <div data-testid="mini-kanban">Mini Kanban</div>
}));

vi.mock('../components/FullKanban.jsx', () => ({
  default: () => <div data-testid="full-kanban">Full Kanban</div>
}));

vi.mock('./PluginSettings.jsx', () => ({
  default: () => <div data-testid="plugin-settings">Plugin Settings</div>
}));

vi.mock('./PluginDetail.jsx', () => ({
  default: () => <div data-testid="plugin-detail">Plugin Detail</div>
}));

vi.mock('../core/canvas/manager.js', () => ({
  canvasManager: {
    createCanvas: vi.fn(() => Promise.resolve('/test/canvas.canvas')),
    saveCanvas: vi.fn(() => Promise.resolve())
  }
}));

vi.mock('../components/TemplatePicker.jsx', () => ({
  default: () => <div data-testid="template-picker">Template Picker</div>
}));

vi.mock('../core/markdown/compiler.js', () => ({
  getMarkdownCompiler: vi.fn(() => ({
    processTemplate: vi.fn((content) => content)
  }))
}));

vi.mock('../components/CreateTemplate.jsx', () => ({
  default: () => <div data-testid="create-template">Create Template</div>
}));

describe('Workspace Graph Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window location for URLSearchParams
    delete window.location;
    window.location = { search: '' };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render graph view button in activity bar', () => {
    render(<Workspace initialPath="/test/workspace" />);
    
    const graphButton = screen.getByTitle('Graph View');
    expect(graphButton).toBeInTheDocument();
  });

  it('should show graph view panel when graph button clicked', async () => {
    render(<Workspace initialPath="/test/workspace" />);
    
    const graphButton = screen.getByTitle('Graph View');
    fireEvent.click(graphButton);
    
    await waitFor(() => {
      expect(screen.getByText('Graph View')).toBeInTheDocument();
      expect(screen.getByText('Open Graph View')).toBeInTheDocument();
    });
  });

  it('should open graph view tab when "Open Graph View" clicked', async () => {
    render(<Workspace initialPath="/test/workspace" />);
    
    // Click graph view button in activity bar
    const graphButton = screen.getByTitle('Graph View');
    fireEvent.click(graphButton);
    
    await waitFor(() => {
      expect(screen.getByText('Open Graph View')).toBeInTheDocument();
    });
    
    // Click "Open Graph View" button
    const openButton = screen.getByText('Open Graph View');
    fireEvent.click(openButton);
    
    await waitFor(() => {
      // Should show graph view content
      expect(screen.getByTestId('graph-view')).toBeInTheDocument();
    });
  });

  it('should build graph data and display in graph view', async () => {
    render(<Workspace initialPath="/test/workspace" />);
    
    // Navigate to graph view
    const graphButton = screen.getByTitle('Graph View');
    fireEvent.click(graphButton);
    
    const openButton = screen.getByText('Open Graph View');
    fireEvent.click(openButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('graph-view')).toBeInTheDocument();
    });
    
    // Should show "Build Graph" button initially
    const buildButton = screen.getByText('Build Graph');
    expect(buildButton).toBeInTheDocument();
    
    // Click build graph
    fireEvent.click(buildButton);
    
    await waitFor(() => {
      // Should show graph data
      expect(screen.getByTestId('graph-data')).toBeInTheDocument();
      expect(screen.getByText('Nodes: 2, Edges: 1')).toBeInTheDocument();
    });
  });

  it('should handle node click and open files', async () => {
    const { invoke } = require('@tauri-apps/api/core');
    
    // Setup mocks for different calls
    invoke.mockImplementation((command, args) => {
      if (command === 'read_workspace_files') {
        return Promise.resolve([]);
      }
      if (command === 'read_file_content') {
        return Promise.resolve('Test file content');
      }
      return Promise.resolve();
    });
    
    render(<Workspace initialPath="/test/workspace" />);
    
    // Navigate to graph view and build graph
    const graphButton = screen.getByTitle('Graph View');
    fireEvent.click(graphButton);
    
    const openButton = screen.getByText('Open Graph View');
    fireEvent.click(openButton);
    
    const buildButton = screen.getByText('Build Graph');
    fireEvent.click(buildButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('graph-view')).toBeInTheDocument();
    });
    
    // Click on a test node
    const testNodeButton = screen.getByTestId('test-node-click');
    fireEvent.click(testNodeButton);
    
    // Should open the file (check that invoke was called to read file content)
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('read_file_content', { path: '/test/file.md' });
    });
  });

  it('should show graph view keyboard shortcut hint', () => {
    render(<Workspace initialPath="/test/workspace" />);
    
    const graphButton = screen.getByTitle('Graph View');
    fireEvent.click(graphButton);
    
    expect(screen.getByText('Use Cmd+Shift+G to quickly open the graph view.')).toBeInTheDocument();
  });

  it('should handle graph view activity bar button states correctly', () => {
    render(<Workspace initialPath="/test/workspace" />);
    
    // Initially, Explorer should be active
    const explorerButton = screen.getByTitle('Explorer');
    expect(explorerButton).toHaveClass('primary');
    
    // Click graph view button
    const graphButton = screen.getByTitle('Graph View');
    fireEvent.click(graphButton);
    
    // Graph view button should be active
    expect(graphButton).toHaveClass('primary');
    expect(explorerButton).not.toHaveClass('primary');
    
    // Click back to explorer
    fireEvent.click(explorerButton);
    
    // Explorer should be active again
    expect(explorerButton).toHaveClass('primary');
    expect(graphButton).not.toHaveClass('primary');
  });

  it('should update graph when wiki links are added to files', async () => {
    const { invoke } = require('@tauri-apps/api/core');
    const { GraphDataProcessor } = require('../core/graph/GraphDataProcessor.js');
    
    // Setup mock for file reading
    invoke.mockImplementation((command, args) => {
      if (command === 'read_workspace_files') {
        return Promise.resolve([
          { name: 'test.md', path: '/test/test.md', is_directory: false }
        ]);
      }
      if (command === 'read_file_content') {
        return Promise.resolve('# Test\n\nThis is a test file with [[notes]] link.');
      }
      if (command === 'write_file_content') {
        return Promise.resolve();
      }
      return Promise.resolve();
    });

    render(<Workspace initialPath="/test/workspace" />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('editor')).toBeInTheDocument();
    });
    
    // Open graph view and build initial graph
    const graphButton = screen.getByTitle('Graph View');
    fireEvent.click(graphButton);
    
    const openButton = screen.getByText('Open Graph View');
    fireEvent.click(openButton);
    
    const buildButton = screen.getByText('Build Graph');
    fireEvent.click(buildButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('graph-data')).toBeInTheDocument();
      expect(screen.getByText('Nodes: 2, Edges: 1')).toBeInTheDocument();
    });
    
    // Go back to editor
    const explorerButton = screen.getByTitle('Explorer');
    fireEvent.click(explorerButton);
    
    // Simulate adding a wiki link to the editor
    const editorTextarea = screen.getByTestId('editor-textarea');
    fireEvent.change(editorTextarea, { 
      target: { value: '# Test\n\nThis is a test file with [[notes]] and [[newfile]] links.' } 
    });
    
    // Trigger save (simulate Ctrl+S)
    const saveEvent = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    document.dispatchEvent(saveEvent);
    
    // Check that updateChangedFiles was called
    await waitFor(() => {
      const processor = GraphDataProcessor.mock.results[0].value;
      expect(processor.updateChangedFiles).toHaveBeenCalledWith(['/test/test.md']);
    });
    
    // Go back to graph view and verify updated data
    fireEvent.click(graphButton);
    fireEvent.click(openButton);
    
    await waitFor(() => {
      // Should show updated graph with new connection
      expect(screen.getByText('Nodes: 3, Edges: 2')).toBeInTheDocument();
    });
  });
});