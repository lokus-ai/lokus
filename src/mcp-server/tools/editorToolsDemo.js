/**
 * Editor Tools Demo and Integration
 * 
 * Demonstrates how to integrate and use the Lokus Editor Tools with MCP.
 * This file shows how to register the tools and provides usage examples.
 */

import { editorTools } from './editorTools.js';

/**
 * Register editor tools with MCP server
 */
export function registerEditorTools(mcpServer) {
  if (!mcpServer || typeof mcpServer.registerTool !== 'function') {
    console.warn('[EditorTools] MCP server not available or invalid');
    return false;
  }

  try {
    // Register all editor tools
    editorTools.forEach(tool => {
      mcpServer.registerTool(tool);
      console.log(`[EditorTools] Registered tool: ${tool.name}`);
    });

    console.log(`[EditorTools] Successfully registered ${editorTools.length} editor tools`);
    return true;
  } catch (error) {
    console.error('[EditorTools] Failed to register tools:', error);
    return false;
  }
}

/**
 * Demo usage examples for each editor tool
 */
export const editorToolExamples = {
  format_text: {
    description: "Apply bold formatting to selected text",
    example: {
      format: "bold",
      text: "Important text"
    }
  },
  
  insert_link: {
    description: "Insert a wiki link to another page",
    example: {
      type: "wiki", 
      target: "README",
      text: "Read the documentation"
    }
  },
  
  insert_math: {
    description: "Insert an inline math equation",
    example: {
      formula: "E = mc^2",
      display: "inline"
    }
  },
  
  insert_table: {
    description: "Create a 3x3 table with header row",
    example: {
      action: "create",
      rows: 3,
      cols: 3,
      withHeaderRow: true
    }
  },
  
  insert_code_block: {
    description: "Insert a JavaScript code block",
    example: {
      code: "console.log('Hello World!');",
      language: "javascript"
    }
  },
  
  create_task_list: {
    description: "Create a task list with multiple items",
    example: {
      tasks: [
        { text: "Write documentation", checked: false },
        { text: "Test editor tools", checked: true },
        { text: "Deploy to production", checked: false }
      ]
    }
  },
  
  get_selection: {
    description: "Get information about current selection",
    example: {}
  },
  
  replace_selection: {
    description: "Replace selection with markdown content",
    example: {
      content: "# New Heading\n\nThis is **important** content.",
      contentType: "markdown",
      selectNew: false
    }
  },
  
  get_document_stats: {
    description: "Get document word count and statistics",
    example: {
      includeSpaces: true
    }
  },
  
  export_document: {
    description: "Export document as markdown with metadata",
    example: {
      format: "markdown",
      includeMetadata: true
    }
  }
};

/**
 * Test all editor tools with example data
 */
export async function testEditorTools() {
  console.log('[EditorTools] Starting tool tests...\n');
  
  const results = {};
  
  for (const tool of editorTools) {
    const example = editorToolExamples[tool.name];
    if (!example) {
      console.warn(`[EditorTools] No example for tool: ${tool.name}`);
      continue;
    }
    
    try {
      console.log(`Testing ${tool.name}:`);
      console.log(`  Description: ${example.description}`);
      console.log(`  Input:`, JSON.stringify(example.example, null, 2));
      
      const result = await tool.handler(example.example);
      console.log(`  Result:`, result);
      console.log(`  ✅ Success\n`);
      
      results[tool.name] = { success: true, result };
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}\n`);
      results[tool.name] = { success: false, error: error.message };
    }
  }
  
  console.log('[EditorTools] Test summary:');
  const successful = Object.values(results).filter(r => r.success).length;
  const total = Object.keys(results).length;
  console.log(`  ${successful}/${total} tools tested successfully`);
  
  return results;
}

/**
 * Integration helper for Lokus plugins
 */
export class EditorToolsPlugin {
  constructor(pluginAPI) {
    this.pluginAPI = pluginAPI;
    this.registeredTools = new Map();
  }
  
  /**
   * Initialize and register all editor tools
   */
  async initialize() {
    try {
      // Register tools with MCP
      for (const tool of editorTools) {
        const registeredTool = await this.pluginAPI.registerTool(tool);
        this.registeredTools.set(tool.name, registeredTool);
      }
      
      console.log(`[EditorToolsPlugin] Initialized with ${this.registeredTools.size} tools`);
      return true;
      
    } catch (error) {
      console.error('[EditorToolsPlugin] Initialization failed:', error);
      return false;
    }
  }
  
  /**
   * Get registered tool by name
   */
  getTool(name) {
    return this.registeredTools.get(name);
  }
  
  /**
   * Get all registered tools
   */
  getAllTools() {
    return Array.from(this.registeredTools.values());
  }
  
  /**
   * Dispose and cleanup
   */
  dispose() {
    this.registeredTools.clear();
    console.log('[EditorToolsPlugin] Disposed');
  }
}

export default {
  editorTools,
  registerEditorTools,
  editorToolExamples,
  testEditorTools,
  EditorToolsPlugin
};