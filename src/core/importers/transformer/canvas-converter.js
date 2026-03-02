/**
 * Canvas IR → Excalidraw JSON converter.
 *
 * Converts the Canvas intermediate representation (from Obsidian .canvas files)
 * into a valid Excalidraw JSON file that Lokus can open.
 */

let _idCounter = 0;
function uid() {
  return `imp_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`;
}

// Default styling constants
const FONT_SIZE = 16;
const PADDING = 20;
const STROKE_COLOR = '#1e1e1e';
const BG_COLOR = '#ffffff';
const TEXT_COLOR = '#1e1e1e';
const ARROW_COLOR = '#1e1e1e';

/**
 * Convert a Canvas IR object to Excalidraw JSON string.
 * @param {Object} canvas - { name, elements: CanvasNode[], edges: CanvasEdge[] }
 * @returns {string} JSON string ready to write as .excalidraw file
 */
export function canvasToExcalidraw(canvas) {
  const excalidrawElements = [];
  const nodeIdMap = new Map(); // canvas node id → excalidraw element id

  // Convert nodes
  for (const node of canvas.elements) {
    const rectId = uid();
    const textId = uid();
    nodeIdMap.set(node.id, rectId);

    const label = node.type === 'file' ? `[[${node.file}]]` : (node.text || '');
    const width = node.width || 250;
    const height = node.height || 60;

    // Rectangle element
    excalidrawElements.push({
      id: rectId,
      type: 'rectangle',
      x: node.x || 0,
      y: node.y || 0,
      width,
      height,
      angle: 0,
      strokeColor: STROKE_COLOR,
      backgroundColor: node.type === 'file' ? '#e3f2fd' : BG_COLOR,
      fillStyle: 'solid',
      strokeWidth: 1,
      roughness: 0,
      opacity: 100,
      groupIds: [rectId + '_g'],
      boundElements: [{ type: 'text', id: textId }],
      locked: false,
      isDeleted: false,
      version: 1,
      versionNonce: 0
    });

    // Text element (bound to rectangle)
    excalidrawElements.push({
      id: textId,
      type: 'text',
      x: (node.x || 0) + PADDING,
      y: (node.y || 0) + PADDING,
      width: width - PADDING * 2,
      height: height - PADDING * 2,
      angle: 0,
      strokeColor: TEXT_COLOR,
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      roughness: 0,
      opacity: 100,
      groupIds: [rectId + '_g'],
      boundElements: [],
      text: label,
      fontSize: FONT_SIZE,
      fontFamily: 1,
      textAlign: 'center',
      verticalAlign: 'middle',
      containerId: rectId,
      originalText: label,
      locked: false,
      isDeleted: false,
      version: 1,
      versionNonce: 0
    });
  }

  // Convert edges → arrow elements
  for (const edge of canvas.edges) {
    const arrowId = uid();
    const fromRectId = nodeIdMap.get(edge.fromNode);
    const toRectId = nodeIdMap.get(edge.toNode);

    const fromNode = canvas.elements.find(n => n.id === edge.fromNode);
    const toNode = canvas.elements.find(n => n.id === edge.toNode);

    if (!fromNode || !toNode) continue;

    const startX = (fromNode.x || 0) + (fromNode.width || 250);
    const startY = (fromNode.y || 0) + (fromNode.height || 60) / 2;
    const endX = toNode.x || 0;
    const endY = (toNode.y || 0) + (toNode.height || 60) / 2;

    const arrow = {
      id: arrowId,
      type: 'arrow',
      x: startX,
      y: startY,
      width: endX - startX,
      height: endY - startY,
      angle: 0,
      strokeColor: ARROW_COLOR,
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      roughness: 0,
      opacity: 100,
      groupIds: [],
      boundElements: [],
      points: [[0, 0], [endX - startX, endY - startY]],
      startBinding: fromRectId ? { elementId: fromRectId, focus: 0, gap: 4 } : null,
      endBinding: toRectId ? { elementId: toRectId, focus: 0, gap: 4 } : null,
      startArrowhead: null,
      endArrowhead: 'arrow',
      locked: false,
      isDeleted: false,
      version: 1,
      versionNonce: 0
    };

    excalidrawElements.push(arrow);

    // If edge has a label, add a text element near the midpoint
    if (edge.label) {
      const labelId = uid();
      const midX = startX + (endX - startX) / 2;
      const midY = startY + (endY - startY) / 2 - 12;

      excalidrawElements.push({
        id: labelId,
        type: 'text',
        x: midX,
        y: midY,
        width: edge.label.length * 8,
        height: 20,
        angle: 0,
        strokeColor: TEXT_COLOR,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        roughness: 0,
        opacity: 100,
        groupIds: [],
        boundElements: [],
        text: edge.label,
        fontSize: 14,
        fontFamily: 1,
        textAlign: 'center',
        verticalAlign: 'middle',
        containerId: null,
        originalText: edge.label,
        locked: false,
        isDeleted: false,
        version: 1,
        versionNonce: 0
      });
    }
  }

  return JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'lokus',
    elements: excalidrawElements,
    appState: {
      viewBackgroundColor: '#ffffff',
      gridSize: null
    },
    files: {}
  }, null, 2);
}

export default { canvasToExcalidraw };
