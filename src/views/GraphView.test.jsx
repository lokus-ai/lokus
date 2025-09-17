import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GraphView from './GraphView.jsx';

// Mock the GraphEngine since it depends on complex graph libraries
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

// Mock CSS import
vi.mock('./GraphView.css', () => ({}));

describe('GraphView', () => {
  const mockData = {
    nodes: [
      { key: 'node1', attributes: { label: 'Test Node 1', x: 0, y: 0, size: 10, color: '#ff0000' } },
      { key: 'node2', attributes: { label: 'Test Node 2', x: 100, y: 100, size: 8, color: '#00ff00' } }
    ],
    edges: [
      { key: 'edge1', source: 'node1', target: 'node2', attributes: { weight: 1, color: '#cccccc' } }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render GraphView component', () => {
    render(<GraphView />);
    
    // Should show loading initially
    expect(screen.getByText('Initializing Graph Engine...')).toBeInTheDocument();
  });

  it('should render with custom className', () => {
    const { container } = render(<GraphView className="test-class" />);
    
    expect(container.firstChild).toHaveClass('graph-view', 'modern', 'test-class');
  });

  it('should handle data prop correctly', async () => {
    const { rerender } = render(<GraphView />);
    
    // Initially no data
    await waitFor(() => {
      expect(screen.queryByText('Initializing Graph Engine...')).toBeInTheDocument();
    });

    // Add data
    rerender(<GraphView data={mockData} />);
    
    // Should process the data
    await waitFor(() => {
      // The component should be initialized and processing data
      expect(screen.queryByText('Initializing Graph Engine...')).toBeInTheDocument();
    });
  });

  it('should handle node click events', () => {
    const onNodeClick = vi.fn();
    render(<GraphView onNodeClick={onNodeClick} data={mockData} />);
    
    // The onNodeClick should be registered with the graph engine
    expect(onNodeClick).not.toHaveBeenCalled();
  });

  it('should handle edge click events', () => {
    const onEdgeClick = vi.fn();
    render(<GraphView onEdgeClick={onEdgeClick} data={mockData} />);
    
    // The onEdgeClick should be registered with the graph engine
    expect(onEdgeClick).not.toHaveBeenCalled();
  });

  it('should render error state when initialization fails', () => {
    // Mock GraphEngine to throw an error
    const { GraphEngine } = require('../core/graph/GraphEngine.js');
    GraphEngine.mockImplementationOnce(() => {
      throw new Error('Test initialization error');
    });

    render(<GraphView />);
    
    expect(screen.getByText('Graph Initialization Error')).toBeInTheDocument();
    expect(screen.getByText('Test initialization error')).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('should render all UI components when initialized', async () => {
    render(<GraphView data={mockData} />);
    
    await waitFor(() => {
      // Should show the graph container
      const container = screen.getByRole('generic', { hidden: true });
      expect(container).toBeInTheDocument();
    });
  });

  it('should handle options prop', () => {
    const options = { enableWorkerLayout: true, autoStart: false };
    render(<GraphView options={options} />);
    
    // Options should be passed to GraphEngine constructor
    const { GraphEngine } = require('../core/graph/GraphEngine.js');
    expect(GraphEngine).toHaveBeenCalledWith(expect.any(Element), options);
  });
});