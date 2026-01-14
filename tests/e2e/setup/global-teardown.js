/**
 * Global Teardown for E2E Tests
 *
 * Cleans up the temp workspace created by global-setup.js
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Same path as in global-setup.js
const WORKSPACE_PATH_FILE = join(tmpdir(), 'lokus-e2e-workspace-path.txt');

export default async function globalTeardown() {
  console.log('🧹 Cleaning up E2E test environment...');

  try {
    // Read the workspace path from file
    const workspacePath = await fs.readFile(WORKSPACE_PATH_FILE, 'utf-8').catch(() => null);

    if (workspacePath) {
      // Clean up the test workspace
      await fs.rm(workspacePath.trim(), { recursive: true, force: true });
      console.log(`✅ Cleaned up test workspace: ${workspacePath.trim()}`);

      // Clean up the path file
      await fs.rm(WORKSPACE_PATH_FILE, { force: true });
    }

    // Also clean up any stale lokus-e2e-* directories older than 1 hour
    const tmpDir = tmpdir();
    const files = await fs.readdir(tmpDir);
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    for (const file of files) {
      if (file.startsWith('lokus-e2e-')) {
        const fullPath = join(tmpDir, file);
        try {
          const stat = await fs.stat(fullPath);
          if (stat.mtimeMs < oneHourAgo) {
            await fs.rm(fullPath, { recursive: true, force: true });
            console.log(`   Cleaned up stale workspace: ${file}`);
          }
        } catch {
          // Ignore errors for individual cleanup
        }
      }
    }

  } catch (error) {
    console.warn('⚠️ Cleanup warning:', error.message);
  }

  console.log('✅ E2E test cleanup complete');
}