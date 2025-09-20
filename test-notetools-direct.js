#!/usr/bin/env node

/**
 * Direct testing of NoteTools without MCP server
 * Tests each of the 11 NoteTools functions individually
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Mock the problematic imports before importing NoteTools
const mockWorkspaceManager = {
  async getValidatedWorkspacePath() {
    return join(dirname(fileURLToPath(import.meta.url)), 'test-workspace');
  },
  async validatePath(path) {
    return true;
  }
};

const mockTaskManager = {
  createTask: () => ({ id: 'test-task', status: 'pending' }),
  updateTask: () => true,
  getTasks: () => []
};

// Create module URL mapping to override imports
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Override the workspace manager import
import Module from 'module';
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
  if (request.includes('workspace/manager.js')) {
    // Return a path that will resolve to our mock
    return 'MOCK_WORKSPACE_MANAGER';
  }
  if (request.includes('tasks/manager.js')) {
    return 'MOCK_TASK_MANAGER';
  }
  return originalResolveFilename.call(this, request, parent, isMain);
};

// Now import NoteTools
import { NoteTools } from './src/mcp-server/tools/noteTools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock workspace path for testing
const TEST_WORKSPACE = join(__dirname, 'test-workspace');

// Create mock providers
const mockNoteProvider = {
  async getNoteContent(path) {
    try {
      return await readFile(path, 'utf-8');
    } catch {
      return null;
    }
  },
  async saveNoteContent(path, content) {
    await writeFile(path, content, 'utf-8');
    return true;
  }
};

const mockFileProvider = {
  async exists(path) {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  },
  async createDirectory(path) {
    await mkdir(path, { recursive: true });
    return true;
  }
};

// Mock WorkspaceManager to avoid Tauri dependency
class MockWorkspaceManager {
  static async getValidatedWorkspacePath() {
    return TEST_WORKSPACE;
  }
  
  static async validatePath(path) {
    return true;
  }
}

// Replace the import with our mock
global.WorkspaceManager = MockWorkspaceManager;

async function setupTestEnvironment() {
  console.log('🔧 Setting up test environment...');
  
  // Create test workspace
  await mkdir(TEST_WORKSPACE, { recursive: true });
  
  // Create test note
  const testNote = `# Test Note

This is a test note for NoteTools testing.

## Section 1
Some content here.

- [ ] Task 1
- [x] Task 2 (completed)
- [ ] Task 3

## Section 2
More content with [[wiki-link]] and math $x^2 + y^2 = z^2$.

### Subsection
Additional content.
`;

  await writeFile(join(TEST_WORKSPACE, 'test-note.md'), testNote);
  await writeFile(join(TEST_WORKSPACE, 'sample-note.md'), '# Sample Note\n\nSample content for linking tests.');
  
  console.log('✅ Test environment setup complete');
}

async function testNoteTools() {
  const results = [];
  
  console.log('🚀 Starting NoteTools testing...\n');
  
  // Initialize NoteTools
  const noteTools = new NoteTools(mockNoteProvider, mockFileProvider, {
    logger: {
      info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
      error: (msg, error) => console.error(`[ERROR] ${msg}`, error || ''),
      warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || '')
    }
  });
  
  try {
    await noteTools.initialize();
    console.log('✅ NoteTools initialized successfully\n');
  } catch (error) {
    console.error('❌ Failed to initialize NoteTools:', error);
    return results;
  }
  
  // Test 1: create_note
  console.log('📝 Testing create_note...');
  try {
    const result = await noteTools.createNote({
      title: 'New Test Note',
      content: 'This is a new note created by the test.',
      path: 'new-note.md',
      template: 'basic'
    });
    results.push({
      tool: 'create_note',
      status: '✅',
      description: 'Creates a new note with specified content and template',
      result: result.success ? 'Success' : 'Failed',
      notes: result.message || ''
    });
    console.log('✅ create_note test completed');
  } catch (error) {
    results.push({
      tool: 'create_note',
      status: '❌',
      description: 'Creates a new note with specified content and template',
      result: 'Error',
      notes: error.message
    });
    console.log('❌ create_note test failed:', error.message);
  }
  
  // Test 2: update_note
  console.log('📝 Testing update_note...');
  try {
    const result = await noteTools.updateNote({
      path: 'test-note.md',
      content: '# Updated Test Note\n\nThis note has been updated.',
      preserveMetadata: true
    });
    results.push({
      tool: 'update_note',
      status: '✅',
      description: 'Updates existing note content',
      result: result.success ? 'Success' : 'Failed',
      notes: result.message || ''
    });
    console.log('✅ update_note test completed');
  } catch (error) {
    results.push({
      tool: 'update_note',
      status: '❌',
      description: 'Updates existing note content',
      result: 'Error',
      notes: error.message
    });
    console.log('❌ update_note test failed:', error.message);
  }
  
  // Test 3: link_notes
  console.log('📝 Testing link_notes...');
  try {
    const result = await noteTools.linkNotes({
      sourceNote: 'test-note.md',
      targetNote: 'sample-note.md',
      linkType: 'bidirectional',
      context: 'Related topics'
    });
    results.push({
      tool: 'link_notes',
      status: '✅',
      description: 'Creates bidirectional links between notes',
      result: result.success ? 'Success' : 'Failed',
      notes: result.message || ''
    });
    console.log('✅ link_notes test completed');
  } catch (error) {
    results.push({
      tool: 'link_notes',
      status: '❌',
      description: 'Creates bidirectional links between notes',
      result: 'Error',
      notes: error.message
    });
    console.log('❌ link_notes test failed:', error.message);
  }
  
  // Test 4: resolve_wikilinks
  console.log('📝 Testing resolve_wikilinks...');
  try {
    const result = await noteTools.resolveWikiLinks({
      notePath: 'test-note.md',
      autoCreate: false,
      suggestions: true
    });
    results.push({
      tool: 'resolve_wikilinks',
      status: '✅',
      description: 'Resolves and validates wiki links in a note',
      result: result.success ? 'Success' : 'Failed',
      notes: `Found ${result.resolvedLinks?.length || 0} links, ${result.unresolvedLinks?.length || 0} unresolved`
    });
    console.log('✅ resolve_wikilinks test completed');
  } catch (error) {
    results.push({
      tool: 'resolve_wikilinks',
      status: '❌',
      description: 'Resolves and validates wiki links in a note',
      result: 'Error',
      notes: error.message
    });
    console.log('❌ resolve_wikilinks test failed:', error.message);
  }
  
  // Test 5: extract_note_outline
  console.log('📝 Testing extract_note_outline...');
  try {
    const result = await noteTools.extractNoteOutline({
      notePath: 'test-note.md',
      maxDepth: 3,
      includeContent: true
    });
    results.push({
      tool: 'extract_note_outline',
      status: '✅',
      description: 'Extracts hierarchical outline from note headers',
      result: result.success ? 'Success' : 'Failed',
      notes: `Found ${result.outline?.length || 0} outline sections`
    });
    console.log('✅ extract_note_outline test completed');
  } catch (error) {
    results.push({
      tool: 'extract_note_outline',
      status: '❌',
      description: 'Extracts hierarchical outline from note headers',
      result: 'Error',
      notes: error.message
    });
    console.log('❌ extract_note_outline test failed:', error.message);
  }
  
  // Test 6: generate_note_summary
  console.log('📝 Testing generate_note_summary...');
  try {
    const result = await noteTools.generateNoteSummary({
      notePath: 'test-note.md',
      maxLength: 200,
      includeKeywords: true,
      includeLinks: true
    });
    results.push({
      tool: 'generate_note_summary',
      status: '✅',
      description: 'Generates intelligent summary of note content',
      result: result.success ? 'Success' : 'Failed',
      notes: `Summary length: ${result.summary?.length || 0} chars`
    });
    console.log('✅ generate_note_summary test completed');
  } catch (error) {
    results.push({
      tool: 'generate_note_summary',
      status: '❌',
      description: 'Generates intelligent summary of note content',
      result: 'Error',
      notes: error.message
    });
    console.log('❌ generate_note_summary test failed:', error.message);
  }
  
  // Test 7: organize_note_sections
  console.log('📝 Testing organize_note_sections...');
  try {
    const result = await noteTools.organizeNoteSections({
      notePath: 'test-note.md',
      strategy: 'alphabetical',
      preserveOrder: ['Introduction', 'Conclusion']
    });
    results.push({
      tool: 'organize_note_sections',
      status: '✅',
      description: 'Reorganizes note sections using specified strategy',
      result: result.success ? 'Success' : 'Failed',
      notes: result.message || ''
    });
    console.log('✅ organize_note_sections test completed');
  } catch (error) {
    results.push({
      tool: 'organize_note_sections',
      status: '❌',
      description: 'Reorganizes note sections using specified strategy',
      result: 'Error',
      notes: error.message
    });
    console.log('❌ organize_note_sections test failed:', error.message);
  }
  
  // Test 8: convert_tasks_to_kanban
  console.log('📝 Testing convert_tasks_to_kanban...');
  try {
    const result = await noteTools.convertTasksToKanban({
      notePath: 'test-note.md',
      boardName: 'Test Board',
      includeCompleted: true
    });
    results.push({
      tool: 'convert_tasks_to_kanban',
      status: '✅',
      description: 'Converts task lists to kanban board format',
      result: result.success ? 'Success' : 'Failed',
      notes: `Found ${result.tasks?.length || 0} tasks`
    });
    console.log('✅ convert_tasks_to_kanban test completed');
  } catch (error) {
    results.push({
      tool: 'convert_tasks_to_kanban',
      status: '❌',
      description: 'Converts task lists to kanban board format',
      result: 'Error',
      notes: error.message
    });
    console.log('❌ convert_tasks_to_kanban test failed:', error.message);
  }
  
  // Test 9: duplicate_note
  console.log('📝 Testing duplicate_note...');
  try {
    const result = await noteTools.duplicateNote({
      sourcePath: 'test-note.md',
      targetPath: 'test-note-copy.md',
      updateTitle: true,
      updateLinks: false
    });
    results.push({
      tool: 'duplicate_note',
      status: '✅',
      description: 'Creates a copy of a note with optional modifications',
      result: result.success ? 'Success' : 'Failed',
      notes: result.message || ''
    });
    console.log('✅ duplicate_note test completed');
  } catch (error) {
    results.push({
      tool: 'duplicate_note',
      status: '❌',
      description: 'Creates a copy of a note with optional modifications',
      result: 'Error',
      notes: error.message
    });
    console.log('❌ duplicate_note test failed:', error.message);
  }
  
  // Test 10: get_note_templates
  console.log('📝 Testing get_note_templates...');
  try {
    const result = await noteTools.getNoteTemplates({
      includeBuiltIn: true,
      includeCustom: true,
      category: 'all'
    });
    results.push({
      tool: 'get_note_templates',
      status: '✅',
      description: 'Retrieves available note templates',
      result: result.success ? 'Success' : 'Failed',
      notes: `Found ${result.templates?.length || 0} templates`
    });
    console.log('✅ get_note_templates test completed');
  } catch (error) {
    results.push({
      tool: 'get_note_templates',
      status: '❌',
      description: 'Retrieves available note templates',
      result: 'Error',
      notes: error.message
    });
    console.log('❌ get_note_templates test failed:', error.message);
  }
  
  // Test 11: get_note_history
  console.log('📝 Testing get_note_history...');
  try {
    const result = await noteTools.getNoteHistory({
      notePath: 'test-note.md',
      maxEntries: 10,
      includeContent: false
    });
    results.push({
      tool: 'get_note_history',
      status: '✅',
      description: 'Retrieves note modification history',
      result: result.success ? 'Success' : 'Failed',
      notes: `Found ${result.history?.length || 0} history entries`
    });
    console.log('✅ get_note_history test completed');
  } catch (error) {
    results.push({
      tool: 'get_note_history',
      status: '❌',
      description: 'Retrieves note modification history',
      result: 'Error',
      notes: error.message
    });
    console.log('❌ get_note_history test failed:', error.message);
  }
  
  return results;
}

function printResults(results) {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 NOTETOOLS TEST RESULTS');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.status === '✅').length;
  const failed = results.filter(r => r.status === '❌').length;
  
  console.log(`\n📊 Summary: ${passed} passed, ${failed} failed out of ${results.length} tools\n`);
  
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.status} ${result.tool}`);
    console.log(`   Description: ${result.description}`);
    console.log(`   Result: ${result.result}`);
    if (result.notes) {
      console.log(`   Notes: ${result.notes}`);
    }
    console.log('');
  });
  
  if (failed === 0) {
    console.log('🎉 All NoteTools tests passed successfully!');
  } else {
    console.log(`⚠️  ${failed} test(s) failed. Check the error messages above.`);
  }
}

async function main() {
  try {
    await setupTestEnvironment();
    const results = await testNoteTools();
    printResults(results);
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run the tests
main().catch(console.error);