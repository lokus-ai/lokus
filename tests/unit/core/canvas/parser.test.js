import { describe, it, expect } from 'vitest';
import {
  jsonCanvasToTldraw,
  tldrawToJsonCanvas,
  isValidJsonCanvas,
  migrateCanvasFormat
} from '../../../../src/core/canvas/parser.js';

describe('Canvas Parser', () => {
  describe('jsonCanvasToTldraw', () => {
    it('should convert simple JSON Canvas to tldraw format', () => {
      const jsonCanvas = {
        nodes: [
          {
            id: 'node1',
            type: 'text',
            x: 100,
            y: 200,
            width: 150,
            height: 75,
            text: 'Hello World',
            color: 'blue'
          }
        ],
        edges: []
      };

      const result = jsonCanvasToTldraw(jsonCanvas);

      expect(result).toHaveProperty('records');
      expect(result.records).toContainEqual(
        expect.objectContaining({
          typeName: 'shape',
          type: 'text',
          id: 'node1',
          x: 100,
          y: 200,
          props: expect.objectContaining({
            text: 'Hello World',
            color: 'blue',
            w: 150,
            h: 75
          })
        })
      );
    });

    it('should convert file nodes to text shapes with file indicator', () => {
      const jsonCanvas = {
        nodes: [
          {
            id: 'file1',
            type: 'file',
            x: 0,
            y: 0,
            width: 200,
            height: 100,
            file: 'document.md'
          }
        ],
        edges: []
      };

      const result = jsonCanvasToTldraw(jsonCanvas);
      const fileShape = result.records.find(r => r.id === 'file1');

      expect(fileShape.type).toBe('text');
      expect(fileShape.props.text).toBe('📄 document.md');
      expect(fileShape.props.color).toBe('blue');
    });

    it('should convert link nodes to text shapes with URL indicator', () => {
      const jsonCanvas = {
        nodes: [
          {
            id: 'link1',
            type: 'link',
            x: 0,
            y: 0,
            width: 200,
            height: 50,
            url: 'https://example.com'
          }
        ],
        edges: []
      };

      const result = jsonCanvasToTldraw(jsonCanvas);
      const linkShape = result.records.find(r => r.id === 'link1');

      expect(linkShape.type).toBe('text');
      expect(linkShape.props.text).toBe('🔗 https://example.com');
      expect(linkShape.props.color).toBe('blue');
    });

    it('should convert edges to arrow shapes', () => {
      const jsonCanvas = {
        nodes: [
          { id: 'node1', type: 'text', x: 0, y: 0, width: 100, height: 50 },
          { id: 'node2', type: 'text', x: 200, y: 0, width: 100, height: 50 }
        ],
        edges: [
          {
            id: 'edge1',
            fromNode: 'node1',
            toNode: 'node2',
            color: 'red',
            label: 'Connection'
          }
        ]
      };

      const result = jsonCanvasToTldraw(jsonCanvas);
      const arrow = result.records.find(r => r.type === 'arrow');

      expect(arrow).toBeDefined();
      expect(arrow.props.color).toBe('red');
      expect(arrow.props.text).toBe('Connection');
      expect(arrow.props.start.boundShapeId).toBe('node1');
      expect(arrow.props.end.boundShapeId).toBe('node2');
    });

    it('should include page and document records', () => {
      const jsonCanvas = { nodes: [], edges: [] };

      const result = jsonCanvasToTldraw(jsonCanvas);

      expect(result.records).toContainEqual(
        expect.objectContaining({ typeName: 'page' })
      );
      expect(result.records).toContainEqual(
        expect.objectContaining({ typeName: 'document' })
      );
    });

    it('should include schema information', () => {
      const jsonCanvas = { nodes: [], edges: [] };

      const result = jsonCanvasToTldraw(jsonCanvas);

      expect(result).toHaveProperty('schema');
      expect(result.schema).toHaveProperty('schemaVersion');
      expect(result.schema).toHaveProperty('recordVersions');
    });
  });

  describe('tldrawToJsonCanvas', () => {
    it('should convert tldraw shapes to JSON Canvas nodes', () => {
      const tldrawData = {
        records: [
          {
            typeName: 'shape',
            type: 'text',
            id: 'shape:1',
            x: 50,
            y: 100,
            props: {
              text: 'Test text',
              color: 'green',
              w: 200,
              h: 80
            }
          }
        ]
      };

      const result = tldrawToJsonCanvas(tldrawData);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]).toEqual({
        id: 'shape:1',
        x: 50,
        y: 100,
        width: 200,
        height: 80,
        color: 'green',
        type: 'text',
        text: 'Test text'
      });
    });

    it('should convert arrow shapes to JSON Canvas edges', () => {
      const tldrawData = {
        records: [
          {
            typeName: 'shape',
            type: 'arrow',
            id: 'arrow:1',
            props: {
              color: 'black',
              text: 'Arrow label',
              start: { boundShapeId: 'node1' },
              end: { boundShapeId: 'node2' }
            }
          }
        ]
      };

      const result = tldrawToJsonCanvas(tldrawData);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toEqual({
        id: 'arrow:1',
        fromNode: 'node1',
        toNode: 'node2',
        color: 'black',
        label: 'Arrow label'
      });
    });

    it('should handle geo shapes with file indicators', () => {
      const tldrawData = {
        records: [
          {
            typeName: 'shape',
            type: 'geo',
            id: 'geo:1',
            x: 0,
            y: 0,
            props: {
              text: '📄 README.md',
              w: 150,
              h: 60,
              color: 'blue'
            }
          }
        ]
      };

      const result = tldrawToJsonCanvas(tldrawData);

      expect(result.nodes[0].type).toBe('file');
      expect(result.nodes[0].file).toBe('README.md');
    });

    it('should handle geo shapes with link indicators', () => {
      const tldrawData = {
        records: [
          {
            typeName: 'shape',
            type: 'geo',
            id: 'geo:1',
            x: 0,
            y: 0,
            props: {
              text: '🔗 https://lokus.dev',
              w: 150,
              h: 60,
              color: 'blue'
            }
          }
        ]
      };

      const result = tldrawToJsonCanvas(tldrawData);

      expect(result.nodes[0].type).toBe('link');
      expect(result.nodes[0].url).toBe('https://lokus.dev');
    });

    it('should return empty canvas when no records', () => {
      const tldrawData = {};

      const result = tldrawToJsonCanvas(tldrawData);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.metadata.createdWith).toBe('Lokus');
    });

    it('should include metadata', () => {
      const tldrawData = { records: [] };

      const result = tldrawToJsonCanvas(tldrawData);

      expect(result.metadata).toHaveProperty('version', '1.0');
      expect(result.metadata).toHaveProperty('created');
      expect(result.metadata).toHaveProperty('modified');
      expect(result.metadata).toHaveProperty('createdWith', 'Lokus');
    });
  });

  describe('isValidJsonCanvas', () => {
    it('should validate correct JSON Canvas format', () => {
      const validCanvas = {
        nodes: [
          { id: '1', x: 0, y: 0, type: 'text' }
        ],
        edges: [
          { id: '2', fromNode: '1', toNode: '3' }
        ]
      };

      expect(isValidJsonCanvas(validCanvas)).toBe(true);
    });

    it('should reject invalid data types', () => {
      expect(isValidJsonCanvas(null)).toBe(false);
      expect(isValidJsonCanvas('string')).toBe(false);
      expect(isValidJsonCanvas(123)).toBe(false);
    });

    it('should reject missing required properties', () => {
      expect(isValidJsonCanvas({})).toBe(false);
      expect(isValidJsonCanvas({ nodes: [] })).toBe(false);
      expect(isValidJsonCanvas({ edges: [] })).toBe(false);
    });

    it('should reject invalid nodes structure', () => {
      const invalidCanvas = {
        nodes: [{ id: '1' }], // missing x, y
        edges: []
      };

      expect(isValidJsonCanvas(invalidCanvas)).toBe(false);
    });

    it('should reject invalid edges structure', () => {
      const invalidCanvas = {
        nodes: [{ id: '1', x: 0, y: 0 }],
        edges: [{ id: '2' }] // missing fromNode, toNode
      };

      expect(isValidJsonCanvas(invalidCanvas)).toBe(false);
    });

    it('should handle nodes and edges as non-arrays', () => {
      const invalidCanvas1 = { nodes: 'invalid', edges: [] };
      const invalidCanvas2 = { nodes: [], edges: 'invalid' };

      expect(isValidJsonCanvas(invalidCanvas1)).toBe(false);
      expect(isValidJsonCanvas(invalidCanvas2)).toBe(false);
    });
  });

  describe('migrateCanvasFormat', () => {
    it('should return valid JSON Canvas unchanged', () => {
      const validCanvas = {
        nodes: [{ id: '1', x: 0, y: 0, type: 'text' }],
        edges: []
      };

      const result = migrateCanvasFormat(validCanvas);

      expect(result).toEqual(validCanvas);
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
            props: { text: 'Migrated', w: 100, h: 50 }
          }
        ]
      };

      const result = migrateCanvasFormat(tldrawData);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].text).toBe('Migrated');
      expect(result.metadata.createdWith).toBe('Lokus');
    });

    it('should return empty canvas for unrecognized format', () => {
      const unknownFormat = { unknown: 'format' };

      const result = migrateCanvasFormat(unknownFormat);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.metadata.createdWith).toBe('Lokus');
    });

    it('should handle null/undefined input', () => {
      const result1 = migrateCanvasFormat(null);
      const result2 = migrateCanvasFormat(undefined);

      expect(result1.nodes).toEqual([]);
      expect(result2.nodes).toEqual([]);
    });
  });
});