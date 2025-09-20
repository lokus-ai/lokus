/**
 * Editor Tools Integration Tests
 * 
 * Tests for the Lokus Editor Tools MCP integration.
 * These tests verify tool functionality without requiring a full editor instance.
 */

import { editorTools } from './editorTools.js';
import { editorToolExamples } from './editorToolsDemo.js';

/**
 * Mock TipTap editor for testing
 */
class MockEditor {
  constructor() {
    this.content = '';
    this.selection = { from: 0, to: 0, empty: true };
    this.state = {
      doc: {
        textContent: 'Sample document content for testing.',
        descendants: (callback) => {
          // Mock paragraph node
          callback({ type: { name: 'paragraph' }, textContent: 'Sample document content for testing.' });
        }
      },
      selection: this.selection
    };
    this.commandHistory = [];
  }

  getHTML() {
    return `<p>${this.content || 'Sample document content for testing.'}</p>`;
  }

  getJSON() {
    return {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: this.content || 'Sample document content for testing.' }]
      }]
    };
  }

  get commands() {
    return {
      focus: () => this.recordCommand('focus'),
      toggleBold: () => this.recordCommand('toggleBold'),
      toggleItalic: () => this.recordCommand('toggleItalic'),
      toggleStrike: () => this.recordCommand('toggleStrike'),
      toggleHighlight: (opts) => this.recordCommand('toggleHighlight', opts),
      toggleSuperscript: () => this.recordCommand('toggleSuperscript'),
      toggleSubscript: () => this.recordCommand('toggleSubscript'),
      toggleCode: () => this.recordCommand('toggleCode'),
      unsetAllMarks: () => this.recordCommand('unsetAllMarks'),
      setWikiLink: (raw, opts) => this.recordCommand('setWikiLink', { raw, ...opts }),
      setLink: (opts) => this.recordCommand('setLink', opts),
      setMathInline: (formula) => this.recordCommand('setMathInline', formula),
      setMathBlock: (formula) => this.recordCommand('setMathBlock', formula),
      insertTable: (opts) => this.recordCommand('insertTable', opts),
      setCodeBlock: (opts) => this.recordCommand('setCodeBlock', opts),
      toggleTaskList: () => this.recordCommand('toggleTaskList'),
      splitListItem: (type) => this.recordCommand('splitListItem', type),
      toggleTask: () => this.recordCommand('toggleTask'),
      insertContent: (content) => this.recordCommand('insertContent', content),
      deleteSelection: () => this.recordCommand('deleteSelection'),
      setTextSelection: (range) => this.recordCommand('setTextSelection', range),
      selectAll: () => this.recordCommand('selectAll'),
      addRowAfter: () => this.recordCommand('addRowAfter'),
      addColumnAfter: () => this.recordCommand('addColumnAfter'),
      deleteRow: () => this.recordCommand('deleteRow'),
      deleteColumn: () => this.recordCommand('deleteColumn')
    };
  }

  chain() {
    return {
      focus: () => this.chain(),
      toggleBold: () => this.chain(),
      toggleItalic: () => this.chain(),
      toggleStrike: () => this.chain(),
      toggleHighlight: () => this.chain(),
      insertContent: (content) => { this.content += content; return this.chain(); },
      setTextSelection: () => this.chain(),
      deleteSelection: () => this.chain(),
      deleteRange: () => this.chain(),
      run: () => true
    };
  }

  recordCommand(name, args) {
    this.commandHistory.push({ name, args });
    return true;
  }

  getCommandHistory() {
    return this.commandHistory;
  }

  clearHistory() {
    this.commandHistory = [];
  }
}

/**
 * Set up mock editor for testing
 */
function setupMockEditor() {
  const mockEditor = new MockEditor();
  
  // Mock global editor access
  globalThis.__LOKUS_EDITOR_INSTANCE__ = mockEditor;
  
  return mockEditor;
}

/**
 * Test individual tool
 */
async function testTool(tool, input) {
  const mockEditor = setupMockEditor();
  
  try {
    mockEditor.clearHistory();
    const result = await tool.handler(input);
    
    return {
      success: true,
      result,
      commandHistory: mockEditor.getCommandHistory()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      commandHistory: mockEditor.getCommandHistory()
    };
  }
}

/**
 * Run all tool tests
 */
export async function runEditorToolTests() {
  console.log('🧪 Running Editor Tools Tests\n');
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    details: {}
  };

  for (const tool of editorTools) {
    const example = editorToolExamples[tool.name];
    if (!example) {
      console.warn(`⚠️  No test example for ${tool.name}`);
      continue;
    }

    results.total++;
    
    console.log(`Testing ${tool.name}...`);
    
    const testResult = await testTool(tool, example.example);
    
    if (testResult.success) {
      console.log(`  ✅ Passed`);
      results.passed++;
    } else {
      console.log(`  ❌ Failed: ${testResult.error}`);
      results.failed++;
    }
    
    results.details[tool.name] = testResult;
  }

  console.log(`\n📊 Test Results:`);
  console.log(`  Total: ${results.total}`);
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Success Rate: ${(results.passed / results.total * 100).toFixed(1)}%`);

  return results;
}

/**
 * Test specific tool functionality
 */
export async function testSpecificTool(toolName, input) {
  const tool = editorTools.find(t => t.name === toolName);
  if (!tool) {
    throw new Error(`Tool '${toolName}' not found`);
  }

  console.log(`🔍 Testing ${toolName} with custom input:`);
  console.log(`  Input:`, JSON.stringify(input, null, 2));
  
  const result = await testTool(tool, input);
  
  console.log(`  Result:`, result);
  
  return result;
}

/**
 * Validate tool schemas
 */
export function validateToolSchemas() {
  console.log('🔍 Validating Tool Schemas\n');
  
  const issues = [];
  
  for (const tool of editorTools) {
    console.log(`Validating ${tool.name}...`);
    
    // Check required properties
    if (!tool.name) issues.push(`${tool.name}: Missing name`);
    if (!tool.description) issues.push(`${tool.name}: Missing description`);
    if (!tool.inputSchema) issues.push(`${tool.name}: Missing inputSchema`);
    if (!tool.handler) issues.push(`${tool.name}: Missing handler`);
    
    // Check input schema structure
    if (tool.inputSchema) {
      if (tool.inputSchema.type !== 'object') {
        issues.push(`${tool.name}: inputSchema.type should be 'object'`);
      }
      if (!tool.inputSchema.properties) {
        issues.push(`${tool.name}: inputSchema missing properties`);
      }
    }
    
    // Check handler is function
    if (tool.handler && typeof tool.handler !== 'function') {
      issues.push(`${tool.name}: handler should be a function`);
    }
    
    if (issues.length === 0) {
      console.log(`  ✅ Valid`);
    } else {
      console.log(`  ❌ Issues found`);
    }
  }
  
  if (issues.length > 0) {
    console.log(`\n⚠️  Schema Issues Found:`);
    issues.forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log(`\n✅ All tool schemas are valid`);
  }
  
  return issues;
}

/**
 * Performance test
 */
export async function performanceTest() {
  console.log('⚡ Running Performance Tests\n');
  
  const results = {};
  
  for (const tool of editorTools) {
    const example = editorToolExamples[tool.name];
    if (!example) continue;
    
    console.log(`Testing ${tool.name} performance...`);
    
    const iterations = 100;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await testTool(tool, example.example);
      const end = performance.now();
      times.push(end - start);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    results[tool.name] = {
      average: avgTime.toFixed(2),
      min: minTime.toFixed(2),
      max: maxTime.toFixed(2),
      iterations
    };
    
    console.log(`  Average: ${avgTime.toFixed(2)}ms`);
  }
  
  console.log(`\n📈 Performance Summary:`);
  Object.entries(results).forEach(([name, stats]) => {
    console.log(`  ${name}: ${stats.average}ms avg (${stats.min}-${stats.max}ms)`);
  });
  
  return results;
}

// Export for use in other test files
export default {
  runEditorToolTests,
  testSpecificTool,
  validateToolSchemas,
  performanceTest,
  MockEditor,
  setupMockEditor
};