/**
 * Global Setup for E2E Tests
 *
 * Creates a real temp workspace with test files that the Tauri app can open.
 * The workspace path is stored in a file that tests can read.
 *
 * IMPORTANT: This setup also waits for the Tauri app to be fully ready
 * before allowing tests to run. This prevents tests from starting while
 * Rust is still compiling.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { chromium } from '@playwright/test';

// Path where we store the workspace path for tests to read
const WORKSPACE_PATH_FILE = join(tmpdir(), 'lokus-e2e-workspace-path.txt');

/**
 * Wait for Tauri app to be fully ready (not just Vite frontend)
 * This checks that the app can actually validate a workspace path,
 * which requires the Rust backend to be running.
 */
async function waitForTauriReady(workspacePath) {
  console.log('⏳ Waiting for Tauri app to be fully ready...');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const maxAttempts = 60; // 60 attempts x 5 seconds = 5 minutes max
  const delayMs = 5000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Navigate to the app with workspace path
      const url = `http://localhost:1420/?workspacePath=${encodeURIComponent(workspacePath)}`;
      await page.goto(url, { timeout: 10000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      // Wait a bit for React to render
      await page.waitForTimeout(2000);

      // Check if workspace loaded (file tree visible) - this means Tauri backend is ready
      const fileTree = page.locator('.file-tree, .file-explorer, [data-testid="file-tree"], .space-y-1');
      const isFileTreeVisible = await fileTree.first().isVisible({ timeout: 3000 }).catch(() => false);

      if (isFileTreeVisible) {
        console.log(`✅ Tauri app is ready! (took ${attempt * delayMs / 1000}s)`);
        await browser.close();
        return true;
      }

      // Check if we're stuck on launcher (Tauri might not be ready yet)
      const launcher = page.locator('text=Open Workspace, text=Recently Opened');
      const isOnLauncher = await launcher.first().isVisible({ timeout: 1000 }).catch(() => false);

      if (isOnLauncher) {
        console.log(`   Attempt ${attempt}/${maxAttempts}: App on launcher - Tauri backend not ready yet`);
      } else {
        console.log(`   Attempt ${attempt}/${maxAttempts}: Waiting for app...`);
      }
    } catch (error) {
      console.log(`   Attempt ${attempt}/${maxAttempts}: ${error.message.slice(0, 50)}...`);
    }

    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  await browser.close();
  console.warn('⚠️ Tauri app may not be fully ready - tests might fail');
  return false;
}

export default async function globalSetup() {
  console.log('🚀 Setting up E2E test environment...');

  // Create a unique workspace for this test run
  const testId = Date.now();
  const testWorkspace = join(tmpdir(), `lokus-e2e-${testId}`);

  try {
    // Create fresh workspace directory
    await fs.mkdir(testWorkspace, { recursive: true });

    // Create .lokus directory (marks it as a valid Lokus workspace)
    const lokusDir = join(testWorkspace, '.lokus');
    await fs.mkdir(lokusDir, { recursive: true });
    await fs.writeFile(
      join(lokusDir, 'config.json'),
      JSON.stringify({ version: '1.0', created: new Date().toISOString() }, null, 2)
    );

    // Create test files with realistic content
    const testFiles = {
      'README.md': `# E2E Test Workspace

This workspace was created for Playwright E2E testing.

## Features to Test

- **Bold text** and *italic text*
- Lists and checkboxes
- Code blocks
- Wiki links: [[Other Note]]

## Tasks

- [ ] Incomplete task
- [x] Completed task

Created: ${new Date().toISOString()}
`,

      'test-note.md': `# Test Note

Hello World! This is a test note for E2E testing.

## Formatting Test

**Bold text** and *italic text* and ~~strikethrough~~.

- List item 1
- List item 2
- List item 3

\`\`\`javascript
console.log("Hello from code block");
\`\`\`

> This is a blockquote

[[Wiki Link Test]]

## Math Test

Inline math: $E = mc^2$

Block math:
$$
\\int_0^1 x^2 dx = \\frac{1}{3}
$$
`,

      'daily-notes.md': `# Daily Notes

Today's tasks:
- [ ] First task
- [x] Completed task
- [ ] Another task

## Meeting Notes

Some important notes from today's meeting.
`,

      'search-test.md': `# Search Test File

This file contains searchable content for testing the search functionality.

Keywords: apple banana cherry delta echo foxtrot

## Section One

The quick brown fox jumps over the lazy dog.

## Section Two

Lorem ipsum dolor sit amet, consectetur adipiscing elit.
`,
    };

    // Create a subfolder with files
    const notesDir = join(testWorkspace, 'notes');
    await fs.mkdir(notesDir, { recursive: true });

    const notesFiles = {
      'project-ideas.md': `# Project Ideas

1. Build a task manager
2. Create a note-taking app
3. Design a canvas tool
`,
      'meeting-notes.md': `# Meeting Notes

## Weekly Standup

- Discussed progress
- Identified blockers
- Planned next steps
`,
    };

    // Write main test files
    for (const [filename, content] of Object.entries(testFiles)) {
      await fs.writeFile(join(testWorkspace, filename), content);
    }

    // Write notes subfolder files
    for (const [filename, content] of Object.entries(notesFiles)) {
      await fs.writeFile(join(notesDir, filename), content);
    }

    // Create a canvas file for canvas tests
    const canvasContent = {
      nodes: [
        {
          id: 'node-1',
          x: 100,
          y: 100,
          width: 200,
          height: 100,
          type: 'text',
          text: 'Test Canvas Node 1'
        },
        {
          id: 'node-2',
          x: 400,
          y: 100,
          width: 200,
          height: 100,
          type: 'text',
          text: 'Test Canvas Node 2'
        }
      ],
      edges: [
        {
          id: 'edge-1',
          fromNode: 'node-1',
          toNode: 'node-2'
        }
      ],
      metadata: {
        version: '1.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString()
      }
    };
    await fs.writeFile(
      join(testWorkspace, 'test-canvas.canvas'),
      JSON.stringify(canvasContent, null, 2)
    );

    // Write workspace path to file so tests can read it
    await fs.writeFile(WORKSPACE_PATH_FILE, testWorkspace);

    // Also set env var (works for same process)
    process.env.LOKUS_E2E_WORKSPACE = testWorkspace;

    console.log(`✅ E2E test workspace created: ${testWorkspace}`);
    console.log(`   - ${Object.keys(testFiles).length} root files`);
    console.log(`   - ${Object.keys(notesFiles).length} files in notes/`);
    console.log(`   - 1 canvas file`);
    console.log(`   - Workspace path saved to: ${WORKSPACE_PATH_FILE}`);

    // Wait for Tauri app to be fully ready before running tests
    // This prevents tests from starting while Rust is still compiling
    await waitForTauriReady(testWorkspace);

  } catch (error) {
    console.error('❌ Failed to setup E2E test workspace:', error);
    throw error;
  }
}

export { WORKSPACE_PATH_FILE };