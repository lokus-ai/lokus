#!/usr/bin/env node

/**
 * Bundle MCP Server for Production
 * Creates a self-contained MCP server bundle that works without node_modules
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const ROOT_DIR = path.join(__dirname, '..');
const MCP_DIR = path.join(ROOT_DIR, 'src', 'mcp-server');
const DIST_DIR = path.join(ROOT_DIR, 'src-tauri', 'resources', 'mcp-bundle');

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

console.log('🔨 Bundling MCP Server for production...');

// Use esbuild or webpack to bundle the MCP server
try {
  // First, install esbuild if not present
  try {
    execSync('npm list esbuild', { cwd: ROOT_DIR, stdio: 'ignore' });
  } catch {
    console.log('📦 Installing esbuild...');
    execSync('npm install --save-dev esbuild', { cwd: ROOT_DIR, stdio: 'inherit' });
  }

  // Bundle the MCP server with all dependencies
  console.log('🎯 Creating self-contained bundle...');

  const esbuildCmd = `npx esbuild "${MCP_DIR}/index.js" \
    --bundle \
    --platform=node \
    --target=node18 \
    --outfile="${DIST_DIR}/mcp-server.js" \
    --minify \
    --external:fs \
    --external:path \
    --external:os \
    --external:child_process \
    --external:crypto \
    --external:url \
    --external:util \
    --external:stream \
    --external:buffer \
    --external:events \
    --external:querystring \
    --external:string_decoder \
    --external:timers \
    --external:zlib \
    --external:http \
    --external:https \
    --external:net \
    --external:tls \
    --external:dns \
    --external:readline \
    --format=cjs`;

  execSync(esbuildCmd, { cwd: ROOT_DIR, stdio: 'inherit' });

  // Copy package.json (minimal version)
  const packageJson = {
    name: "@lokus/mcp-server",
    version: "1.0.0",
    main: "mcp-server.js",
    type: "commonjs",
    description: "Lokus MCP Server - Bundled for production"
  };

  fs.writeFileSync(
    path.join(DIST_DIR, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create a launcher script
  const launcher = `#!/usr/bin/env node
/**
 * Lokus MCP Server Launcher
 * Auto-generated bundled version
 */
require('./mcp-server.js');
`;

  fs.writeFileSync(path.join(DIST_DIR, 'index.js'), launcher);
  fs.chmodSync(path.join(DIST_DIR, 'index.js'), '755');

  console.log('✅ MCP Server bundled successfully!');
  console.log(`📁 Output: ${DIST_DIR}`);

  // Show bundle size
  const stats = fs.statSync(path.join(DIST_DIR, 'mcp-server.js'));
  console.log(`📊 Bundle size: ${(stats.size / 1024).toFixed(2)} KB`);

} catch (error) {
  console.error('❌ Bundling failed:', error.message);
  process.exit(1);
}