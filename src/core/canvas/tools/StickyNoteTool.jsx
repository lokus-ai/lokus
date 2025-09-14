/**
 * Custom Sticky Note Tool - Example of extending tldraw
 * This demonstrates how to create custom tools for the canvas
 */

import { StateNode, TLClickEvent } from 'tldraw'
import { nanoid } from 'nanoid'

export class StickyNoteTool extends StateNode {
  static override id = 'sticky-note'
  
  // Tool configuration
  static override initial = 'idle'
  
  // Define tool states
  static override children = () => [Idle, Creating]

  // Tool cursor
  override cursor = 'crosshair'

  // Handle tool selection
  onEnter = () => {
    this.editor.setCursor({ type: 'crosshair' })
  }

  onExit = () => {
    this.editor.setCursor({ type: 'default' })
  }
}

class Idle extends StateNode {
  static override id = 'idle'

  onPointerDown = (info: TLPointerEventInfo) => {
    this.parent.transition('creating', info)
  }

  onCancel = () => {
    this.editor.setCurrentTool('select')
  }
}

class Creating extends StateNode {
  static override id = 'creating'

  onPointerUp = () => {
    this.createStickyNote()
    this.parent.transition('idle')
  }

  onCancel = () => {
    this.parent.transition('idle')
  }

  createStickyNote = () => {
    const { currentPagePoint } = this.editor.inputs

    // Create sticky note shape
    const stickyNote = {
      id: `shape:sticky_${nanoid()}`,
      type: 'geo',
      x: currentPagePoint.x - 100,
      y: currentPagePoint.y - 100,
      props: {
        w: 200,
        h: 200,
        geo: 'rectangle',
        color: 'yellow',
        fill: 'solid',
        text: 'New Note',
        font: 'sans',
        size: 'm',
        align: 'start',
        verticalAlign: 'start'
      }
    }

    this.editor.createShape(stickyNote)
    this.editor.setSelectedShapes([stickyNote.id])
  }
}

// Tool definition for tldraw
export const stickyNoteToolDefinition = {
  id: 'sticky-note',
  icon: '📝',
  label: 'Sticky Note',
  kbd: 'n',
  onSelect: () => {
    console.log('Sticky note tool selected')
  },
  tool: StickyNoteTool
}

// Custom shape for mind map nodes
export class MindMapNodeTool extends StateNode {
  static override id = 'mind-map-node'
  static override initial = 'idle'
  static override children = () => [MindMapIdle, MindMapCreating]

  override cursor = 'pointer'
}

class MindMapIdle extends StateNode {
  static override id = 'idle'

  onPointerDown = (info) => {
    this.parent.transition('creating', info)
  }
}

class MindMapCreating extends StateNode {
  static override id = 'creating'

  onPointerUp = () => {
    this.createMindMapNode()
    this.parent.transition('idle')
  }

  createMindMapNode = () => {
    const { currentPagePoint } = this.editor.inputs

    const mindMapNode = {
      id: `shape:mindmap_${nanoid()}`,
      type: 'geo',
      x: currentPagePoint.x - 75,
      y: currentPagePoint.y - 25,
      props: {
        w: 150,
        h: 50,
        geo: 'ellipse',
        color: 'blue',
        fill: 'solid',
        text: 'Idea',
        font: 'sans',
        size: 'm',
        align: 'middle',
        verticalAlign: 'middle'
      }
    }

    this.editor.createShape(mindMapNode)
    this.editor.setSelectedShapes([mindMapNode.id])
  }
}

// Flow chart tools
export const flowChartTools = {
  process: {
    id: 'process-box',
    icon: '⬜',
    label: 'Process',
    createShape: (point) => ({
      id: `shape:process_${nanoid()}`,
      type: 'geo',
      x: point.x - 75,
      y: point.y - 25,
      props: {
        w: 150,
        h: 50,
        geo: 'rectangle',
        color: 'green',
        fill: 'solid',
        text: 'Process',
        align: 'middle',
        verticalAlign: 'middle'
      }
    })
  },

  decision: {
    id: 'decision-diamond',
    icon: '◆',
    label: 'Decision',
    createShape: (point) => ({
      id: `shape:decision_${nanoid()}`,
      type: 'geo',
      x: point.x - 75,
      y: point.y - 50,
      props: {
        w: 150,
        h: 100,
        geo: 'rhombus',
        color: 'orange',
        fill: 'solid',
        text: 'Decision?',
        align: 'middle',
        verticalAlign: 'middle'
      }
    })
  },

  terminal: {
    id: 'terminal-oval',
    icon: '⭕',
    label: 'Start/End',
    createShape: (point) => ({
      id: `shape:terminal_${nanoid()}`,
      type: 'geo',
      x: point.x - 75,
      y: point.y - 25,
      props: {
        w: 150,
        h: 50,
        geo: 'ellipse',
        color: 'red',
        fill: 'solid',
        text: 'Start/End',
        align: 'middle',
        verticalAlign: 'middle'
      }
    })
  }
}

// Export all custom tools
export const customCanvasTools = [
  stickyNoteToolDefinition,
  {
    id: 'mind-map',
    icon: '🧠',
    label: 'Mind Map',
    tool: MindMapNodeTool
  },
  ...Object.values(flowChartTools).map(tool => ({
    ...tool,
    tool: createGenericTool(tool.createShape)
  }))
]

// Generic tool creator helper
function createGenericTool(createShapeFunc) {
  return class GenericTool extends StateNode {
    static override id = 'generic-tool'
    static override initial = 'idle'
    static override children = () => [
      class extends StateNode {
        static override id = 'idle'
        onPointerDown = (info) => {
          const shape = createShapeFunc(this.editor.inputs.currentPagePoint)
          this.editor.createShape(shape)
          this.editor.setSelectedShapes([shape.id])
          this.editor.setCurrentTool('select')
        }
      }
    ]
  }
}