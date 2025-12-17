#!/usr/bin/env node
/**
 * Script to remove all console.log/warn/error/debug/info statements from the codebase
 * Usage: node scripts/remove-console-logs.cjs
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');

// Files/patterns to skip
const SKIP_PATTERNS = [
  /\.md$/,           // Markdown files
  /\.test\.(js|jsx|ts|tsx)$/,  // Test files
  /logger\.js$/,     // Logger utility itself
  /node_modules/,    // Node modules
];

// Regex to match console statements (handles multi-line)
const CONSOLE_REGEX = /^\s*console\.(log|warn|error|debug|info)\s*\([^;]*\);?\s*\n?/gm;

// More aggressive regex for multi-line console statements
const MULTILINE_CONSOLE_REGEX = /^\s*console\.(log|warn|error|debug|info)\s*\([\s\S]*?\);\s*\n?/gm;

function shouldSkip(filePath) {
  return SKIP_PATTERNS.some(pattern => pattern.test(filePath));
}

function getAllFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!entry.name.includes('node_modules')) {
        getAllFiles(fullPath, files);
      }
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function removeConsoleLogs(content) {
  let result = content;
  let removed = 0;

  // First pass: simple single-line console statements
  result = result.replace(/^[ \t]*console\.(log|warn|error|debug|info)\([^)]*\);?[ \t]*\r?\n/gm, (match) => {
    removed++;
    return '';
  });

  // Second pass: multi-line console statements (be careful with nested parens)
  // Match console.xxx( followed by content until we find the closing );
  const lines = result.split('\n');
  const newLines = [];
  let inConsole = false;
  let parenDepth = 0;
  let consoleBuffer = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inConsole) {
      // Continue collecting the console statement
      consoleBuffer += line + '\n';
      parenDepth += (line.match(/\(/g) || []).length;
      parenDepth -= (line.match(/\)/g) || []).length;

      if (parenDepth <= 0) {
        // End of console statement
        inConsole = false;
        removed++;
        consoleBuffer = '';
      }
    } else if (/^\s*console\.(log|warn|error|debug|info)\s*\(/.test(line)) {
      // Start of a console statement
      parenDepth = (line.match(/\(/g) || []).length;
      parenDepth -= (line.match(/\)/g) || []).length;

      if (parenDepth <= 0) {
        // Single line console, already handled or skip
        if (/;\s*$/.test(line) || parenDepth === 0) {
          removed++;
          continue;
        }
      }

      inConsole = true;
      consoleBuffer = line + '\n';
    } else {
      newLines.push(line);
    }
  }

  return { content: newLines.join('\n'), removed };
}

function cleanupEmptyBlocks(content) {
  // Clean up empty catch blocks that might have only had console.error
  // catch (e) { } or catch (error) { }
  content = content.replace(/catch\s*\([^)]*\)\s*\{\s*\}/g, 'catch { }');

  // Clean up multiple consecutive empty lines (more than 2)
  content = content.replace(/\n{3,}/g, '\n\n');

  return content;
}

function main() {
  console.log('🧹 Removing console logs from src/...\n');

  const files = getAllFiles(SRC_DIR);
  let totalRemoved = 0;
  let filesModified = 0;

  for (const filePath of files) {
    if (shouldSkip(filePath)) {
      continue;
    }

    const relativePath = path.relative(path.join(__dirname, '..'), filePath);
    const originalContent = fs.readFileSync(filePath, 'utf-8');

    const { content: cleanedContent, removed } = removeConsoleLogs(originalContent);
    const finalContent = cleanupEmptyBlocks(cleanedContent);

    if (finalContent !== originalContent) {
      fs.writeFileSync(filePath, finalContent, 'utf-8');
      console.log(`  ✓ ${relativePath} (${removed} removed)`);
      totalRemoved += removed;
      filesModified++;
    }
  }

  console.log(`\n✅ Done! Removed ${totalRemoved} console statements from ${filesModified} files.`);
}

main();
