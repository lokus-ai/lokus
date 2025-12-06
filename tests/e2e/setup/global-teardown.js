/**
 * Global Teardown for E2E Tests
 * Cleans up test environment after all tests complete
 */

import { promises as fs } from 'fs';

export default async function globalTeardown() {
  console.log('🧹 Cleaning up E2E test environment...');
  
  const globalTestWorkspace = process.env.LOKUS_GLOBAL_TEST_WORKSPACE;
  
  if (globalTestWorkspace) {
    try {
      await fs.rm(globalTestWorkspace, { recursive: true, force: true });
      console.log(`✅ Cleaned up global test workspace: ${globalTestWorkspace}`);
    } catch (error) {
      console.warn('⚠️ Failed to cleanup global test workspace:', error);
    }
  }
  
  console.log('✅ E2E test cleanup complete');
}