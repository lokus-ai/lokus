/**
 * Canvas Tools for MCP
 * Tools for working with Lokus Canvas (Tldraw integration)
 */

import { readFile, writeFile, readdir, mkdir } from "fs/promises";
import { join } from "path";

export const canvasTools = [
  {
    name: "list_canvases",
    description: "List all canvases in the workspace",
    inputSchema: {
      type: "object",
      properties: {},
    }
  },
  {
    name: "get_canvas",
    description: "Get canvas data including shapes and connections",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: {
          type: "string",
          description: "Canvas ID or name"
        }
      },
      required: ["canvasId"]
    }
  },
  {
    name: "create_canvas",
    description: "Create a new canvas",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the canvas"
        },
        description: {
          type: "string",
          description: "Canvas description"
        }
      },
      required: ["name"]
    }
  },
  {
    name: "add_canvas_shape",
    description: "Add a shape to canvas (text, rectangle, arrow, etc)",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: {
          type: "string",
          description: "Canvas ID"
        },
        shape: {
          type: "object",
          description: "Shape data (type, position, content, style)"
        }
      },
      required: ["canvasId", "shape"]
    }
  },
  {
    name: "get_canvas_connections",
    description: "Get all connections/arrows between shapes",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: {
          type: "string",
          description: "Canvas ID"
        }
      },
      required: ["canvasId"]
    }
  },
  {
    name: "export_canvas",
    description: "Export canvas as JSON or markdown",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: {
          type: "string",
          description: "Canvas ID"
        },
        format: {
          type: "string",
          enum: ["json", "markdown", "mermaid"],
          description: "Export format"
        }
      },
      required: ["canvasId"]
    }
  }
];

export async function executeCanvasTool(tool, args, workspace, apiUrl) {
  switch (tool) {
    case "list_canvases":
      return await listCanvases(workspace);

    case "get_canvas":
      return await getCanvas(workspace, args.canvasId);

    case "create_canvas":
      return await createCanvas(workspace, args);

    case "add_canvas_shape":
      return await addCanvasShape(workspace, args);

    case "get_canvas_connections":
      return await getCanvasConnections(workspace, args.canvasId);

    case "export_canvas":
      return await exportCanvas(workspace, args);

    default:
      throw new Error(`Unknown canvas tool: ${tool}`);
  }
}

async function listCanvases(workspace) {
  const canvasDir = join(workspace, '.lokus', 'canvas');

  try {
    const entries = await readdir(canvasDir, { withFileTypes: true });
    const canvases = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const name = entry.name.replace('.json', '');
        try {
          const content = await readFile(join(canvasDir, entry.name), 'utf-8');
          const canvas = JSON.parse(content);
          canvases.push({
            id: name,
            name: canvas.name || name,
            shapeCount: canvas.shapes?.length || 0,
            created: canvas.created,
            modified: canvas.modified
          });
        } catch (e) {
          // Skip invalid canvas files
        }
      }
    }

    return {
      content: [{
        type: "text",
        text: `**Canvases in Workspace:**\n\n${
          canvases.length > 0
            ? canvases.map(c => `🎨 **${c.name}**\n  - ID: ${c.id}\n  - Shapes: ${c.shapeCount}\n  - Modified: ${c.modified || 'Unknown'}`).join('\n\n')
            : 'No canvases found'
        }`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: "Canvas feature not configured in this workspace"
      }]
    };
  }
}

async function getCanvas(workspace, canvasId) {
  const canvasPath = join(workspace, '.lokus', 'canvas', `${canvasId}.json`);

  try {
    const content = await readFile(canvasPath, 'utf-8');
    const canvas = JSON.parse(content);

    const shapes = canvas.shapes || [];
    const connections = shapes.filter(s => s.type === 'arrow' || s.type === 'line');
    const nodes = shapes.filter(s => s.type !== 'arrow' && s.type !== 'line');

    return {
      content: [{
        type: "text",
        text: `**Canvas: ${canvas.name || canvasId}**\n
📊 Nodes: ${nodes.length}
🔗 Connections: ${connections.length}
📅 Modified: ${canvas.modified || 'Unknown'}

**Shapes:**
${nodes.slice(0, 10).map(s => `- ${s.type}: ${s.text || s.label || 'No text'}`).join('\n')}
${nodes.length > 10 ? `... and ${nodes.length - 10} more shapes` : ''}

**Connections:**
${connections.slice(0, 5).map(c => `- ${c.from || 'unknown'} → ${c.to || 'unknown'}`).join('\n')}
${connections.length > 5 ? `... and ${connections.length - 5} more connections` : ''}`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: `Canvas "${canvasId}" not found`
      }]
    };
  }
}

async function createCanvas(workspace, { name, description }) {
  const canvasDir = join(workspace, '.lokus', 'canvas');
  await mkdir(canvasDir, { recursive: true });

  const canvasId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const canvasPath = join(canvasDir, `${canvasId}.json`);

  const canvas = {
    id: canvasId,
    name,
    description,
    shapes: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    created: new Date().toISOString(),
    modified: new Date().toISOString()
  };

  await writeFile(canvasPath, JSON.stringify(canvas, null, 2));

  return {
    content: [{
      type: "text",
      text: `✅ Canvas "${name}" created with ID: ${canvasId}`
    }]
  };
}

async function addCanvasShape(workspace, { canvasId, shape }) {
  const canvasPath = join(workspace, '.lokus', 'canvas', `${canvasId}.json`);

  try {
    const content = await readFile(canvasPath, 'utf-8');
    const canvas = JSON.parse(content);

    // Add shape with default properties
    const newShape = {
      id: shape.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
      type: shape.type || 'rectangle',
      x: shape.x || 100,
      y: shape.y || 100,
      width: shape.width || 200,
      height: shape.height || 100,
      text: shape.text || '',
      style: shape.style || {},
      ...shape
    };

    canvas.shapes = canvas.shapes || [];
    canvas.shapes.push(newShape);
    canvas.modified = new Date().toISOString();

    await writeFile(canvasPath, JSON.stringify(canvas, null, 2));

    return {
      content: [{
        type: "text",
        text: `✅ Shape added to canvas "${canvasId}" with ID: ${newShape.id}`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: `❌ Failed to add shape: ${e.message}`
      }]
    };
  }
}

async function getCanvasConnections(workspace, canvasId) {
  const canvasPath = join(workspace, '.lokus', 'canvas', `${canvasId}.json`);

  try {
    const content = await readFile(canvasPath, 'utf-8');
    const canvas = JSON.parse(content);

    const connections = (canvas.shapes || []).filter(s =>
      s.type === 'arrow' || s.type === 'line' || s.type === 'connection'
    );

    // Build connection graph
    const graph = {};
    connections.forEach(conn => {
      const from = conn.from || conn.startId || 'unknown';
      const to = conn.to || conn.endId || 'unknown';
      if (!graph[from]) graph[from] = [];
      graph[from].push(to);
    });

    return {
      content: [{
        type: "text",
        text: `**Canvas Connections:**\n\n${
          Object.entries(graph).map(([from, tos]) =>
            `📍 ${from}\n${tos.map(to => `  → ${to}`).join('\n')}`
          ).join('\n\n')
        }\n\nTotal connections: ${connections.length}`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: `❌ Failed to get connections: ${e.message}`
      }]
    };
  }
}

async function exportCanvas(workspace, { canvasId, format = 'markdown' }) {
  const canvasPath = join(workspace, '.lokus', 'canvas', `${canvasId}.json`);

  try {
    const content = await readFile(canvasPath, 'utf-8');
    const canvas = JSON.parse(content);

    let output = '';

    switch (format) {
      case 'markdown':
        output = `# ${canvas.name || canvasId}\n\n`;
        output += canvas.description ? `${canvas.description}\n\n` : '';

        const nodes = (canvas.shapes || []).filter(s => s.type !== 'arrow' && s.type !== 'line');
        nodes.forEach(node => {
          output += `## ${node.text || node.label || 'Node'}\n\n`;
          if (node.description) output += `${node.description}\n\n`;
        });
        break;

      case 'mermaid':
        output = 'graph TD\n';
        const shapes = canvas.shapes || [];
        shapes.forEach(shape => {
          if (shape.type === 'arrow' || shape.type === 'connection') {
            output += `  ${shape.from || shape.startId} --> ${shape.to || shape.endId}\n`;
          } else if (shape.text) {
            output += `  ${shape.id}["${shape.text}"]\n`;
          }
        });
        break;

      case 'json':
      default:
        output = JSON.stringify(canvas, null, 2);
        break;
    }

    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: `❌ Failed to export canvas: ${e.message}`
      }]
    };
  }
}