/**
 * Global Setup for E2E Tests
 * Sets up test environment before all tests run
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export default async function globalSetup() {
  console.log('🚀 Setting up E2E test environment...');
  
  // Create a global test workspace directory
  const globalTestWorkspace = join(tmpdir(), 'lokus-e2e-global');
  
  try {
    // Clean up any existing workspace
    await fs.rm(globalTestWorkspace, { recursive: true, force: true });
    
    // Create fresh workspace
    await fs.mkdir(globalTestWorkspace, { recursive: true });
    
    // Create common test files
    const commonFiles = {
      'README.md': '# E2E Test Workspace\n\nThis workspace is used for Playwright E2E testing.',
      'sample-note.md': '# Sample Note\n\nThis is a sample note for testing.',
      'test-canvas.canvas': JSON.stringify({
        nodes: [
          {
            id: 'global-test-node',
            x: 50,
            y: 50,
            width: 150,
            height: 75,
            type: 'text',
            text: 'Global Test Node'
          }
        ],
        edges: [],
        metadata: {
          version: '1.0',
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          createdWith: 'Lokus E2E'
        }
      }, null, 2)
    };

    for (const [filename, content] of Object.entries(commonFiles)) {
      await fs.writeFile(join(globalTestWorkspace, filename), content);
    }

    // Store path for tests to use
    process.env.LOKUS_GLOBAL_TEST_WORKSPACE = globalTestWorkspace;
    
    console.log(`✅ Global test workspace created: ${globalTestWorkspace}`);
    
  } catch (error) {
    console.error('❌ Failed to setup global test workspace:', error);
    throw error;
  }
}