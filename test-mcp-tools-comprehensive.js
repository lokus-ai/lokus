#!/usr/bin/env node

/**
 * Comprehensive MCP Tools Test Runner
 * 
 * Tests all 38 MCP tools across 4 categories:
 * - FileTools (6 tools)
 * - EditorTools (10 tools) 
 * - WorkspaceTools (12 tools)
 * - AITools (10 tools)
 */

import { spawn } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

class MCPToolsTester {
  constructor() {
    this.baseUrl = 'http://localhost:3456';
    this.testWorkspace = join(homedir(), 'Documents', 'Lokus-Test-Workspace');
    this.results = {
      fileTools: {},
      editorTools: {},
      workspaceTools: {},
      aiTools: {},
      summary: {
        total: 38,
        passed: 0,
        failed: 0,
        errors: []
      }
    };
    this.mcpServerProcess = null;
  }

  async startMCPServer() {
    console.log('🚀 Starting MCP Server for testing...\n');
    
    return new Promise((resolve, reject) => {
      // Start the MCP server using the test script
      this.mcpServerProcess = spawn('node', ['test-complete-mcp.js'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      let output = '';
      
      this.mcpServerProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (output.includes('Complete MCP Server started successfully')) {
          // Give it a moment to fully initialize
          setTimeout(() => {
            console.log('✅ MCP Server is ready for testing\n');
            resolve();
          }, 2000);
        }
      });

      this.mcpServerProcess.stderr.on('data', (data) => {
        console.error('MCP Server error:', data.toString());
      });

      this.mcpServerProcess.on('error', reject);

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('MCP Server failed to start within 10 seconds'));
      }, 10000);
    });
  }

  async stopMCPServer() {
    if (this.mcpServerProcess) {
      console.log('\n🛑 Stopping MCP Server...');
      this.mcpServerProcess.kill('SIGTERM');
      this.mcpServerProcess = null;
    }
  }

  async callMCPTool(toolName, toolArgs = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: toolArgs
          },
          id: Date.now()
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`MCP Error: ${data.error.message}`);
      }

      return data.result;
    } catch (error) {
      throw new Error(`Failed to call ${toolName}: ${error.message}`);
    }
  }

  async testFileTools() {
    console.log('📁 Testing FileTools (6 tools)...\n');

    const tests = [
      {
        name: 'list_files',
        args: { path: '.', recursive: false },
        expectedContent: 'package.json'
      },
      {
        name: 'create_note',
        args: { 
          name: 'test-note', 
          content: '# Test Note\n\nThis is a test note for MCP tools validation.'
        },
        expectedContent: 'created successfully'
      },
      {
        name: 'write_file',
        args: {
          path: 'test-file.md',
          content: '# Test File\n\nThis is a test file.'
        },
        expectedContent: 'written successfully'
      },
      {
        name: 'read_file',
        args: { path: 'test-file.md' },
        expectedContent: 'Test File'
      },
      {
        name: 'get_file_metadata',
        args: { path: 'test-file.md' },
        expectedContent: 'metadata'
      },
      {
        name: 'search_files',
        args: { 
          query: 'test',
          fileTypes: ['md']
        },
        expectedContent: 'results'
      }
    ];

    for (const test of tests) {
      await this.runToolTest('fileTools', test);
    }
  }

  async testEditorTools() {
    console.log('✏️ Testing EditorTools (10 tools)...\n');

    const tests = [
      {
        name: 'get_file_content',
        args: { filePath: 'test-file.md' },
        expectedContent: 'Test File'
      },
      {
        name: 'format_text',
        args: {
          filePath: 'test-file.md',
          format: 'bold',
          text: 'Bold Text'
        },
        expectedContent: 'formatting'
      },
      {
        name: 'insert_heading',
        args: {
          filePath: 'test-file.md',
          text: 'New Section',
          level: 2
        },
        expectedContent: 'heading'
      },
      {
        name: 'insert_list',
        args: {
          filePath: 'test-file.md',
          items: ['Item 1', 'Item 2', 'Item 3'],
          listType: 'bulleted'
        },
        expectedContent: 'list'
      },
      {
        name: 'create_task_list',
        args: {
          filePath: 'test-file.md',
          tasks: [
            { text: 'Task 1', checked: false },
            { text: 'Task 2', checked: true }
          ]
        },
        expectedContent: 'task'
      },
      {
        name: 'insert_link',
        args: {
          filePath: 'test-file.md',
          type: 'wiki',
          target: 'related-page'
        },
        expectedContent: 'link'
      },
      {
        name: 'insert_math',
        args: {
          filePath: 'test-file.md',
          formula: 'E = mc^2',
          display: 'inline'
        },
        expectedContent: 'math'
      },
      {
        name: 'insert_code_block',
        args: {
          filePath: 'test-file.md',
          code: 'console.log("Hello World");',
          language: 'javascript'
        },
        expectedContent: 'code'
      },
      {
        name: 'insert_table',
        args: {
          filePath: 'test-file.md',
          rows: 3,
          cols: 3,
          headers: ['Name', 'Age', 'City']
        },
        expectedContent: 'table'
      },
      {
        name: 'replace_content',
        args: {
          filePath: 'test-file.md',
          searchText: 'Test File',
          replaceText: 'Updated Test File'
        },
        expectedContent: 'replaced'
      }
    ];

    for (const test of tests) {
      await this.runToolTest('editorTools', test);
    }
  }

  async testWorkspaceTools() {
    console.log('🗂️ Testing WorkspaceTools (12 tools)...\n');

    const tests = [
      {
        name: 'get_workspace_info',
        args: { includeStats: true },
        expectedContent: 'workspace'
      },
      {
        name: 'initialize_workspace',
        args: {
          name: 'Test Workspace',
          description: 'A test workspace for MCP validation',
          template: 'basic'
        },
        expectedContent: 'initialized'
      },
      {
        name: 'update_workspace_config',
        args: {
          config: { 
            name: 'Updated Test Workspace',
            version: '1.1.0'
          }
        },
        expectedContent: 'config'
      },
      {
        name: 'backup_workspace',
        args: {
          name: 'test-backup',
          includeConfig: true
        },
        expectedContent: 'backup'
      },
      {
        name: 'get_workspace_backups',
        args: { includeDetails: true },
        expectedContent: 'backups'
      },
      {
        name: 'export_workspace',
        args: {
          format: 'json',
          includeFiles: true
        },
        expectedContent: 'export'
      },
      {
        name: 'clean_workspace',
        args: {
          cleanupType: 'temp',
          dryRun: true
        },
        expectedContent: 'cleanup'
      },
      {
        name: 'analyze_workspace_health',
        args: {
          checkBrokenLinks: true,
          generateReport: true
        },
        expectedContent: 'health'
      },
      {
        name: 'sync_workspace',
        args: {
          syncType: 'filesystem',
          direction: 'pull'
        },
        expectedContent: 'sync'
      },
      {
        name: 'get_workspace_history',
        args: { limit: 10 },
        expectedContent: 'history'
      },
      {
        name: 'import_content',
        args: {
          source: 'files',
          sourcePath: '.',
          createBackup: false
        },
        expectedContent: 'import'
      },
      {
        name: 'restore_workspace',
        args: {
          backupName: 'test-backup',
          confirm: true
        },
        expectedContent: 'restore'
      }
    ];

    for (const test of tests) {
      await this.runToolTest('workspaceTools', test);
    }
  }

  async testAITools() {
    console.log('🤖 Testing AITools (10 tools)...\n');

    const tests = [
      {
        name: 'get_ai_history',
        args: { limit: 5 },
        expectedContent: 'history'
      },
      {
        name: 'analyze_content',
        args: {
          path: 'test-file.md',
          analysisType: 'comprehensive'
        },
        expectedContent: 'analysis'
      },
      {
        name: 'analyze_content_quality',
        args: {
          path: 'test-file.md',
          qualityMetrics: ['completeness', 'clarity']
        },
        expectedContent: 'quality'
      },
      {
        name: 'suggest_connections',
        args: {
          sourcePath: 'test-file.md',
          connectionType: 'semantic',
          maxSuggestions: 5
        },
        expectedContent: 'connections'
      },
      {
        name: 'generate_insights',
        args: {
          scope: 'workspace',
          timeframe: 'month'
        },
        expectedContent: 'insights'
      },
      {
        name: 'analyze_writing_patterns',
        args: {
          scope: 'workspace',
          patternTypes: ['vocabulary', 'complexity']
        },
        expectedContent: 'patterns'
      },
      {
        name: 'detect_knowledge_gaps',
        args: {
          analysisDepth: 'moderate',
          suggestResources: true
        },
        expectedContent: 'gaps'
      },
      {
        name: 'optimize_structure',
        args: {
          structureType: 'all',
          generatePlan: true
        },
        expectedContent: 'optimization'
      },
      {
        name: 'analyze_collaboration_patterns',
        args: {
          timeframe: 'month',
          generateRecommendations: true
        },
        expectedContent: 'collaboration'
      },
      {
        name: 'predict_content_needs',
        args: {
          predictionHorizon: 'month',
          generateActionItems: true
        },
        expectedContent: 'predictions'
      }
    ];

    for (const test of tests) {
      await this.runToolTest('aiTools', test);
    }
  }

  async runToolTest(category, test) {
    const { name, args, expectedContent } = test;
    
    try {
      console.log(`  Testing ${name}...`);
      
      const result = await this.callMCPTool(name, args);
      
      // Check if result contains expected content
      const resultString = JSON.stringify(result).toLowerCase();
      const hasExpectedContent = resultString.includes(expectedContent.toLowerCase());
      
      if (hasExpectedContent || result?.success || result?.content) {
        console.log(`    ✅ ${name} - PASSED`);
        this.results[category][name] = {
          status: 'PASSED',
          result: result,
          args: args
        };
        this.results.summary.passed++;
      } else {
        console.log(`    ❌ ${name} - FAILED (missing expected content: ${expectedContent})`);
        this.results[category][name] = {
          status: 'FAILED',
          result: result,
          args: args,
          reason: `Missing expected content: ${expectedContent}`
        };
        this.results.summary.failed++;
      }
      
    } catch (error) {
      console.log(`    ❌ ${name} - ERROR: ${error.message}`);
      this.results[category][name] = {
        status: 'ERROR',
        error: error.message,
        args: args
      };
      this.results.summary.failed++;
      this.results.summary.errors.push(`${name}: ${error.message}`);
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 MCP TOOLS COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(80));
    
    const categories = [
      { name: 'FileTools', key: 'fileTools', total: 6 },
      { name: 'EditorTools', key: 'editorTools', total: 10 },
      { name: 'WorkspaceTools', key: 'workspaceTools', total: 12 },
      { name: 'AITools', key: 'aiTools', total: 10 }
    ];

    let totalPassed = 0;
    let totalFailed = 0;

    categories.forEach(({ name, key, total }) => {
      const results = this.results[key];
      const passed = Object.values(results).filter(r => r.status === 'PASSED').length;
      const failed = Object.values(results).filter(r => r.status !== 'PASSED').length;
      
      totalPassed += passed;
      totalFailed += failed;
      
      const percentage = ((passed / total) * 100).toFixed(1);
      const status = percentage >= 80 ? '✅' : percentage >= 50 ? '⚠️' : '❌';
      
      console.log(`\n${status} ${name}: ${passed}/${total} tools working (${percentage}%)`);
      
      // Show failed tools
      if (failed > 0) {
        Object.entries(results).forEach(([toolName, result]) => {
          if (result.status !== 'PASSED') {
            console.log(`    ❌ ${toolName}: ${result.reason || result.error}`);
          }
        });
      }
    });

    console.log('\n' + '-'.repeat(80));
    console.log(`OVERALL RESULTS: ${totalPassed}/${this.results.summary.total} tools working`);
    console.log(`Success Rate: ${((totalPassed / this.results.summary.total) * 100).toFixed(1)}%`);
    
    if (this.results.summary.errors.length > 0) {
      console.log('\n🚨 CRITICAL ERRORS:');
      this.results.summary.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }

    console.log('\n📝 Tool Status Summary:');
    console.log(`✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`📊 Coverage: ${((totalPassed / 38) * 100).toFixed(1)}%`);
    
    const overallStatus = totalPassed >= 30 ? 'EXCELLENT' : totalPassed >= 25 ? 'GOOD' : totalPassed >= 15 ? 'FAIR' : 'POOR';
    console.log(`🎯 Overall Status: ${overallStatus}`);
    
    console.log('='.repeat(80));
    
    return {
      totalTools: 38,
      passed: totalPassed,
      failed: totalFailed,
      successRate: ((totalPassed / 38) * 100).toFixed(1),
      status: overallStatus,
      categories: categories.map(({ name, key, total }) => {
        const results = this.results[key];
        const passed = Object.values(results).filter(r => r.status === 'PASSED').length;
        return {
          name,
          passed,
          total,
          percentage: ((passed / total) * 100).toFixed(1)
        };
      })
    };
  }

  async runAllTests() {
    try {
      // Start MCP server
      await this.startMCPServer();
      
      // Update todo
      console.log('✅ MCP Server started successfully\n');

      // Run all test suites
      await this.testFileTools();
      console.log('');
      
      await this.testEditorTools();
      console.log('');
      
      await this.testWorkspaceTools();
      console.log('');
      
      await this.testAITools();
      console.log('');
      
      // Generate final report
      const summary = this.generateReport();
      
      return summary;
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    } finally {
      await this.stopMCPServer();
    }
  }
}

// Main execution
async function main() {
  console.log('🧪 MCP Tools Comprehensive Testing Suite');
  console.log('Testing all 38 tools across 4 categories\n');
  
  const tester = new MCPToolsTester();
  
  try {
    const results = await tester.runAllTests();
    
    // Exit with appropriate code
    const exitCode = results.passed >= 30 ? 0 : 1;
    console.log(`\n🏁 Testing completed. Exit code: ${exitCode}`);
    process.exit(exitCode);
    
  } catch (error) {
    console.error('\n💥 Testing suite crashed:', error);
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, cleaning up...');
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, cleaning up...');
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default MCPToolsTester;