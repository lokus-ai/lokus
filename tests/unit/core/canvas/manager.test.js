import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasManager } from '../../../../src/core/canvas/manager.js';

// Mock Tauri API
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}));

describe('CanvasManager', () => {
  let canvasManager;
  const mockWorkspacePath = '/test/workspace';
  const mockCanvasName = 'Test Canvas';
  const mockCanvasPath = `${mockWorkspacePath}/${mockCanvasName}.canvas`;

  beforeEach(() => {
    canvasManager = new CanvasManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    canvasManager.clearCache();
  });

  describe('createCanvas', () => {
    it('should create a new canvas file with empty data', async () => {
      mockInvoke.mockResolvedValueOnce();

      const result = await canvasManager.createCanvas(mockWorkspacePath, mockCanvasName);

      expect(result).toBe(mockCanvasPath);
      expect(mockInvoke).toHaveBeenCalledWith('write_file_content', {
        path: mockCanvasPath,
        content: expect.stringContaining('"nodes": []')
      });
    });

    it('should append .canvas extension if not provided', async () => {
      mockInvoke.mockResolvedValueOnce();

      const result = await canvasManager.createCanvas(mockWorkspacePath, 'Test');

      expect(result).toBe('/test/workspace/Test.canvas');
    });

    it('should handle creation errors', async () => {
      const error = new Error('Failed to write file');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(canvasManager.createCanvas(mockWorkspacePath, mockCanvasName))
        .rejects.toThrow(error);
    });
  });

  describe('loadCanvas', () => {
    it('should load valid canvas data from file', async () => {
      const mockCanvasData = {
        nodes: [{ id: '1', type: 'text', x: 0, y: 0, width: 100, height: 50 }],
        edges: [],
        metadata: { version: '1.0.0' }
      };
      mockInvoke.mockResolvedValueOnce(JSON.stringify(mockCanvasData));

      const result = await canvasManager.loadCanvas(mockCanvasPath);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('1');
      expect(mockInvoke).toHaveBeenCalledWith('read_file_content', { path: mockCanvasPath });
    });

    it('should return cached data on subsequent loads', async () => {
      const mockCanvasData = { nodes: [], edges: [] };
      mockInvoke.mockResolvedValueOnce(JSON.stringify(mockCanvasData));

      // First load
      await canvasManager.loadCanvas(mockCanvasPath);
      
      // Second load should use cache
      const result = await canvasManager.loadCanvas(mockCanvasPath);

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(result.nodes).toEqual([]);
    });

    it('should handle invalid JSON gracefully', async () => {
      mockInvoke.mockResolvedValueOnce('invalid json');

      const result = await canvasManager.loadCanvas(mockCanvasPath);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('should return empty canvas on file read error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('File not found'));

      const result = await canvasManager.loadCanvas(mockCanvasPath);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });
  });

  describe('saveCanvas', () => {
    it('should save canvas data as JSON', async () => {
      const canvasData = {
        nodes: [{ id: '1', type: 'text', x: 10, y: 20 }],
        edges: []
      };
      mockInvoke.mockResolvedValueOnce();

      await canvasManager.saveCanvas(mockCanvasPath, canvasData);

      expect(mockInvoke).toHaveBeenCalledWith('write_file_content', {
        path: mockCanvasPath,
        content: expect.stringContaining('"id": "1"')
      });
    });

    it('should validate data before saving', async () => {
      const invalidData = { nodes: 'invalid' };
      mockInvoke.mockResolvedValueOnce();

      await canvasManager.saveCanvas(mockCanvasPath, invalidData);

      expect(mockInvoke).toHaveBeenCalledWith('write_file_content', {
        path: mockCanvasPath,
        content: expect.stringContaining('"nodes": []')
      });
    });

    it('should handle save errors', async () => {
      const canvasData = { nodes: [], edges: [] };
      const error = new Error('Write failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(canvasManager.saveCanvas(mockCanvasPath, canvasData))
        .rejects.toThrow(error);
    });
  });

  describe('deleteCanvas', () => {
    it('should delete canvas file and clear cache', async () => {
      mockInvoke.mockResolvedValueOnce();
      
      // Add to cache first
      canvasManager.canvasCache.set(mockCanvasPath, { nodes: [], edges: [] });
      expect(canvasManager.canvasCache.has(mockCanvasPath)).toBe(true);

      await canvasManager.deleteCanvas(mockCanvasPath);

      expect(mockInvoke).toHaveBeenCalledWith('delete_file', { path: mockCanvasPath });
      expect(canvasManager.canvasCache.has(mockCanvasPath)).toBe(false);
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Delete failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(canvasManager.deleteCanvas(mockCanvasPath))
        .rejects.toThrow(error);
    });
  });

  describe('createEmptyCanvasData', () => {
    it('should create valid empty canvas structure', () => {
      const emptyCanvas = canvasManager.createEmptyCanvasData();

      expect(emptyCanvas).toHaveProperty('nodes');
      expect(emptyCanvas).toHaveProperty('edges');
      expect(emptyCanvas).toHaveProperty('metadata');
      expect(emptyCanvas.nodes).toEqual([]);
      expect(emptyCanvas.edges).toEqual([]);
      expect(emptyCanvas.metadata.version).toBe('1.0.0');
      expect(emptyCanvas.metadata.createdWith).toBe('Lokus');
    });
  });

  describe('validateCanvasData', () => {
    it('should validate correct canvas data', () => {
      const validData = {
        nodes: [{ id: '1', type: 'text', x: 0, y: 0 }],
        edges: [{ id: '2', fromNode: '1', toNode: '3' }],
        metadata: { version: '1.0.0' }
      };

      const result = canvasManager.validateCanvasData(validData);

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(1);
      expect(result.metadata.modified).toBeDefined();
    });

    it('should fix invalid canvas data', () => {
      const invalidData = {
        nodes: 'invalid',
        edges: null
      };

      const result = canvasManager.validateCanvasData(invalidData);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.metadata.version).toBe('1.0.0');
    });

    it('should handle null/undefined data', () => {
      const result1 = canvasManager.validateCanvasData(null);
      const result2 = canvasManager.validateCanvasData(undefined);

      expect(result1.nodes).toEqual([]);
      expect(result2.nodes).toEqual([]);
    });
  });

  describe('convertToJsonCanvas', () => {
    it('should return JSON Canvas data unchanged', () => {
      const jsonCanvasData = {
        nodes: [{ id: '1', type: 'text', x: 0, y: 0 }],
        edges: []
      };

      const result = canvasManager.convertToJsonCanvas(jsonCanvasData);

      expect(result).toEqual(jsonCanvasData);
    });

    it('should convert tldraw format to JSON Canvas', () => {
      const tldrawData = {
        records: [
          {
            typeName: 'shape',
            type: 'text',
            id: 'shape:1',
            x: 10,
            y: 20,
            props: { text: 'Hello World', w: 100, h: 50 }
          }
        ]
      };

      const result = canvasManager.convertToJsonCanvas(tldrawData);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('shape:1');
      expect(result.nodes[0].type).toBe('text');
      expect(result.nodes[0].text).toBe('Hello World');
    });
  });

  describe('clearCache', () => {
    it('should clear specific canvas from cache', () => {
      canvasManager.canvasCache.set('/path/1.canvas', { nodes: [] });
      canvasManager.canvasCache.set('/path/2.canvas', { nodes: [] });

      canvasManager.clearCache('/path/1.canvas');

      expect(canvasManager.canvasCache.has('/path/1.canvas')).toBe(false);
      expect(canvasManager.canvasCache.has('/path/2.canvas')).toBe(true);
    });

    it('should clear entire cache when no path provided', () => {
      canvasManager.canvasCache.set('/path/1.canvas', { nodes: [] });
      canvasManager.canvasCache.set('/path/2.canvas', { nodes: [] });

      canvasManager.clearCache();

      expect(canvasManager.canvasCache.size).toBe(0);
    });
  });
});