#!/usr/bin/env node
/**
 * Script to remove debug println!/eprintln! statements from Rust code
 * Keeps error-related eprintln! in catch blocks
 */

const fs = require('fs');
const path = require('path');

const RUST_SRC = path.join(__dirname, '..', 'src-tauri', 'src');

// Pattern to match debug eprintln!/println! (not in error handlers)
// These patterns identify debug logs we want to remove
const DEBUG_PATTERNS = [
  /^\s*eprintln!\("\[sync_file_from_iroh\].*\n/gm,
  /^\s*eprintln!\("\[Sync\].*\n/gm,
  /^\s*eprintln!\("\[Periodic sync\].*\n/gm,
  /^\s*eprintln!\("\[First sync\].*\n/gm,
  /^\s*println!\("  Max text length:.*\n/gm,
  /^\s*println!\("Usage Tips:.*\n/gm,
  /^\s*println!\("  - \{\}.*\n/gm,
  /^\s*eprintln!\("Removed old log file:.*\n/gm,
];

function getAllRustFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      getAllRustFiles(fullPath, files);
    } else if (entry.name.endsWith('.rs')) {
      files.push(fullPath);
    }
  }

  return files;
}

function removeDebugLogs(content) {
  let result = content;
  let totalRemoved = 0;

  for (const pattern of DEBUG_PATTERNS) {
    const matches = result.match(pattern);
    if (matches) {
      totalRemoved += matches.length;
      result = result.replace(pattern, '');
    }
  }

  // Also handle multi-line eprintln that span lines
  // Match eprintln!("[sync...] ... ", var, var); patterns
  const multiLinePattern = /^\s*eprintln!\("\[(sync_file_from_iroh|Sync|Periodic sync|First sync)\][^;]*;\s*\n/gm;
  const multiMatches = result.match(multiLinePattern);
  if (multiMatches) {
    totalRemoved += multiMatches.length;
    result = result.replace(multiLinePattern, '');
  }

  return { content: result, removed: totalRemoved };
}

function main() {
  console.log('🦀 Removing debug logs from Rust src/...\n');

  const files = getAllRustFiles(RUST_SRC);
  let totalRemoved = 0;
  let filesModified = 0;

  for (const filePath of files) {
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);
    const originalContent = fs.readFileSync(filePath, 'utf-8');

    const { content: cleanedContent, removed } = removeDebugLogs(originalContent);

    if (cleanedContent !== originalContent) {
      fs.writeFileSync(filePath, cleanedContent, 'utf-8');
      console.log(`  ✓ ${relativePath} (${removed} removed)`);
      totalRemoved += removed;
      filesModified++;
    }
  }

  console.log(`\n✅ Done! Removed ${totalRemoved} debug statements from ${filesModified} files.`);
}

main();
