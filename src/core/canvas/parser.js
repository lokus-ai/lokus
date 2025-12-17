/**
 * JSON Canvas Format Parser
 * Handles conversion between JSON Canvas format and tldraw format
 * Based on the JSON Canvas specification: https://jsoncanvas.org/spec/1.0/
 */

/**
 * Convert JSON Canvas format to tldraw store format
 * @param {Object} jsonCanvas - JSON Canvas data
 * @returns {Object} - Tldraw store-compatible data
 */
export function jsonCanvasToTldraw(jsonCanvas) {
  const records = [];
  const assets = [];

  // Create page record
  const pageId = 'page:page';
  records.push({
    typeName: 'page',
    id: pageId,
    name: 'Page',
    index: 'a1',
    meta: {}
  });

  // Create camera record - defines viewport position and zoom
  records.push({
    typeName: 'camera',
    id: 'camera:page:page',
    x: jsonCanvas.metadata?.viewport?.x || 0,
    y: jsonCanvas.metadata?.viewport?.y || 0,
    z: jsonCanvas.metadata?.viewport?.zoom || 1,
    meta: {}
  });

  // Create instance record - defines current instance state
  records.push({
    typeName: 'instance',
    id: 'instance:instance',
    currentPageId: pageId,
    followingUserId: null,
    brush: null,
    opacityForNextShape: 1,
    stylesForNextShape: {},
    meta: {}
  });

  // Create instance page state record - defines current page state
  records.push({
    typeName: 'instance_page_state',
    id: 'instance_page_state:page:page',
    pageId: pageId,
    selectedShapeIds: [],
    hintingShapeIds: [],
    erasingShapeIds: [],
    hoveredShapeId: null,
    editingShapeId: null,
    croppingShapeId: null,
    focusedGroupId: null,
    meta: {}
  });

  // Convert nodes to tldraw shapes
  if (jsonCanvas.nodes) {
    jsonCanvas.nodes.forEach((node, index) => {
      const shape = convertNodeToShape(node, index);
      if (shape) {
        records.push(shape);
      }
    });
  }

  // Convert edges to tldraw arrows
  if (jsonCanvas.edges) {
    jsonCanvas.edges.forEach((edge, index) => {
      const arrow = convertEdgeToArrow(edge, index, jsonCanvas.nodes);
      if (arrow) {
        records.push(arrow);
      }
    });
  }

  // Create document record
  records.push({
    typeName: 'document',
    id: 'document:document',
    gridSize: 10,
    name: '',
    meta: {}
  });

  return {
    records,
    schema: {
      schemaVersion: 1,
      storeVersion: 4,
      recordVersions: {
        asset: { version: 1, subTypeKey: 'type', subTypeVersions: { image: 2, video: 2, bookmark: 0 } },
        camera: { version: 1 },
        document: { version: 2 },
        instance: { version: 22 },
        instance_page_state: { version: 5 },
        page: { version: 1 },
        shape: { 
          version: 3, 
          subTypeKey: 'type', 
          subTypeVersions: { 
            group: 0, geo: 1, arrow: 1, highlight: 0, embed: 4, image: 2, video: 1, text: 1 
          } 
        },
        instance_presence: { version: 5 },
        pointer: { version: 1 }
      }
    }
  };
}

/**
 * Convert JSON Canvas node to tldraw shape
 * @param {Object} node - JSON Canvas node
 * @param {number} index - Shape index for ordering
 * @returns {Object} - Tldraw shape record
 */
function convertNodeToShape(node, index) {
  const baseShape = {
    id: node.id || `shape:node_${index}`,
    typeName: 'shape',
    x: node.x || 0,
    y: node.y || 0,
    rotation: 0,
    index: `a${index + 1}`,
    parentId: 'page:page',
    isLocked: false,
    opacity: 1,
    meta: {}
  };

  switch (node.type) {
    case 'text':
      return {
        ...baseShape,
        type: 'text',
        props: {
          color: node.color || 'black',
          size: node.fontSize || 16,
          w: node.width || 200,
          h: node.height || 50,
          text: node.text || '',
          font: 'draw',
          align: 'middle',
          autoSize: false,
          scale: 1
        }
      };

    case 'file':
      // Convert file nodes to text shapes with file reference
      return {
        ...baseShape,
        type: 'text',
        props: {
          color: node.color || 'blue',
          size: 14,
          w: node.width || 200,
          h: node.height || 100,
          text: `📄 ${node.file || 'Unknown File'}`,
          font: 'draw',
          align: 'start',
          autoSize: false,
          scale: 1
        }
      };

    case 'link':
      // Convert link nodes to text shapes with URL
      return {
        ...baseShape,
        type: 'text',
        props: {
          color: node.color || 'blue',
          size: 14,
          w: node.width || 200,
          h: node.height || 50,
          text: `🔗 ${node.url || 'Link'}`,
          font: 'draw',
          align: 'middle',
          autoSize: false,
          scale: 1
        }
      };

    case 'group':
      return {
        ...baseShape,
        type: 'group',
        props: {
          color: node.color || 'grey',
          w: node.width || 300,
          h: node.height || 200,
        }
      };

    default:
      // Default to text shape
      return {
        ...baseShape,
        type: 'geo',
        props: {
          color: node.color || 'black',
          fill: 'none',
          dash: 'draw',
          size: 'm',
          font: 'draw',
          text: node.text || '',
          align: 'middle',
          verticalAlign: 'middle',
          growY: 0,
          url: '',
          w: node.width || 100,
          h: node.height || 100,
          geo: 'rectangle'
        }
      };
  }
}

/**
 * Convert JSON Canvas edge to tldraw arrow
 * @param {Object} edge - JSON Canvas edge
 * @param {number} index - Arrow index for ordering
 * @param {Array} nodes - All nodes for reference
 * @returns {Object} - Tldraw arrow record
 */
function convertEdgeToArrow(edge, index, nodes) {
  const fromNode = nodes?.find(n => n.id === edge.fromNode);
  const toNode = nodes?.find(n => n.id === edge.toNode);

  if (!fromNode || !toNode) {
    return null;
  }

  return {
    id: edge.id || `shape:arrow_${index}`,
    typeName: 'shape',
    type: 'arrow',
    x: 0,
    y: 0,
    rotation: 0,
    index: `a${index + 1000}`, // Place arrows after shapes
    parentId: 'page:page',
    isLocked: false,
    opacity: 1,
    meta: {},
    props: {
      color: edge.color || 'black',
      fill: 'none',
      dash: 'draw',
      size: 'm',
      arrowheadStart: 'none',
      arrowheadEnd: 'arrow',
      font: 'draw',
      start: {
        type: 'binding',
        boundShapeId: edge.fromNode,
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isExact: false
      },
      end: {
        type: 'binding',
        boundShapeId: edge.toNode,
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isExact: false
      },
      bend: 0,
      text: edge.label || '',
      labelColor: edge.color || 'black',
      labelSize: 's'
    }
  };
}

/**
 * Convert tldraw store to JSON Canvas format
 * @param {Object} storeData - Tldraw store data
 * @returns {Object} - JSON Canvas format data
 */
export function tldrawToJsonCanvas(storeData) {
  const nodes = [];
  const edges = [];

  if (!storeData.records) {
    return createEmptyJsonCanvas();
  }

  // Extract shapes and convert to nodes/edges
  const shapes = storeData.records.filter(record => record.typeName === 'shape');
  
  shapes.forEach((shape, index) => {
    
    if (shape.type === 'arrow') {
      const edge = convertShapeToEdge(shape);
      if (edge) {
        edges.push(edge);
      }
    } else {
      const node = convertShapeToNode(shape);
      if (node) {
        nodes.push(node);
      }
    }
  });

  const result = {
    nodes,
    edges,
    metadata: {
      version: '1.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      createdWith: 'Lokus'
    }
  };
  
  
  return result;
}

/**
 * Convert tldraw shape to JSON Canvas node
 * @param {Object} shape - Tldraw shape record
 * @returns {Object} - JSON Canvas node
 */
function convertShapeToNode(shape) {
  const baseNode = {
    id: shape.id,
    x: shape.x || 0,
    y: shape.y || 0,
    width: shape.props?.w || 100,
    height: shape.props?.h || 50,
    color: shape.props?.color || 'black'
  };

  switch (shape.type) {
    case 'text':
      return {
        ...baseNode,
        type: 'text',
        text: shape.props?.text || ''
      };

    case 'geo':
      if (shape.props?.text && shape.props.text.startsWith('📄')) {
        // File node
        return {
          ...baseNode,
          type: 'file',
          file: shape.props.text.replace('📄 ', '')
        };
      } else if (shape.props?.text && shape.props.text.startsWith('🔗')) {
        // Link node
        return {
          ...baseNode,
          type: 'link',
          url: shape.props.text.replace('🔗 ', '')
        };
      } else {
        // Regular text node
        return {
          ...baseNode,
          type: 'text',
          text: shape.props?.text || ''
        };
      }

    case 'group':
      return {
        ...baseNode,
        type: 'group'
      };

    default:
      return {
        ...baseNode,
        type: 'text',
        text: shape.props?.text || ''
      };
  }
}

/**
 * Convert tldraw arrow shape to JSON Canvas edge
 * @param {Object} shape - Tldraw arrow shape
 * @returns {Object} - JSON Canvas edge
 */
function convertShapeToEdge(shape) {
  if (shape.type !== 'arrow') {
    return null;
  }

  return {
    id: shape.id,
    fromNode: shape.props?.start?.boundShapeId || null,
    toNode: shape.props?.end?.boundShapeId || null,
    color: shape.props?.color || 'black',
    label: shape.props?.text || ''
  };
}

/**
 * Create empty JSON Canvas data structure
 * @returns {Object} - Empty JSON Canvas
 */
function createEmptyJsonCanvas() {
  return {
    nodes: [],
    edges: [],
    metadata: {
      version: '1.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      createdWith: 'Lokus'
    }
  };
}

/**
 * Validate JSON Canvas format
 * @param {Object} data - Data to validate
 * @returns {boolean} - True if valid JSON Canvas format
 */
export function isValidJsonCanvas(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Must have nodes and edges arrays
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    return false;
  }

  // Validate node structure
  for (const node of data.nodes) {
    if (!node.id || typeof node.x !== 'number' || typeof node.y !== 'number') {
      return false;
    }
  }

  // Validate edge structure
  for (const edge of data.edges) {
    if (!edge.id || !edge.fromNode || !edge.toNode) {
      return false;
    }
  }

  return true;
}

/**
 * Migrate old canvas format to current JSON Canvas format
 * @param {Object} data - Canvas data to migrate
 * @returns {Object} - Migrated canvas data
 */
export function migrateCanvasFormat(data) {
  // If already in JSON Canvas format, return as-is
  if (isValidJsonCanvas(data)) {
    return data;
  }

  // Try to convert from tldraw format
  if (data && data.records) {
    return tldrawToJsonCanvas(data);
  }

  // Return empty canvas if format is unrecognized
  return createEmptyJsonCanvas();
}