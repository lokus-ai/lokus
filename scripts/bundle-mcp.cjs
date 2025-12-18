#!/usr/bin/env node

/**
 * Bundle MCP Server for Production
 * Creates self-contained MCP server bundles that work without node_modules
 * - mcp-server.js: stdio transport (Claude Desktop)
 * - http-server-bundle.js: HTTP transport (Claude CLI)
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

// Common esbuild options for Node.js builtins
const nodeExternals = [
  'fs', 'fs/promises', 'path', 'os', 'child_process', 'crypto', 'url', 'util',
  'stream', 'buffer', 'events', 'querystring', 'string_decoder', 'timers',
  'zlib', 'http', 'https', 'net', 'tls', 'dns', 'readline'
].map(ext => `--external:${ext}`).join(' ');

try {
  // First, install esbuild if not present
  try {
    execSync('npm list esbuild', { cwd: ROOT_DIR, stdio: 'ignore' });
  } catch {
    console.log('📦 Installing esbuild...');
    execSync('npm install --save-dev esbuild', { cwd: ROOT_DIR, stdio: 'inherit' });
  }

  // 1. Bundle the stdio MCP server (for Claude Desktop)
  console.log('🎯 Bundling stdio server (index.js -> mcp-server.js)...');

  const stdioBundleCmd = `npx esbuild "${MCP_DIR}/index.js" \
    --bundle \
    --platform=node \
    --target=node18 \
    --outfile="${DIST_DIR}/mcp-server.js" \
    --minify \
    ${nodeExternals} \
    --format=cjs \
    --banner:js="#!/usr/bin/env node"`;

  execSync(stdioBundleCmd, { cwd: ROOT_DIR, stdio: 'inherit' });
  console.log('✅ mcp-server.js bundled');

  // 2. Bundle the HTTP server (for Claude CLI)
  console.log('🎯 Bundling HTTP server (http-server.js -> http-server-bundle.js)...');

  // Use CJS format for Node.js compatibility (no package.json type:module needed)
  // Don't add banner - source file already has shebang
  const httpBundleCmd = `npx esbuild "${MCP_DIR}/http-server.js" \
    --bundle \
    --platform=node \
    --target=node18 \
    --outfile="${DIST_DIR}/http-server-bundle.js" \
    --minify \
    ${nodeExternals} \
    --format=cjs`;

  execSync(httpBundleCmd, { cwd: ROOT_DIR, stdio: 'inherit' });
  console.log('✅ http-server-bundle.js bundled');

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
  fs.chmodSync(path.join(DIST_DIR, 'mcp-server.js'), '755');
  fs.chmodSync(path.join(DIST_DIR, 'http-server-bundle.js'), '755');

  console.log('');
  console.log('✅ MCP Server bundles created successfully!');
  console.log(`📁 Output: ${DIST_DIR}`);

  // Show bundle sizes
  const stdioStats = fs.statSync(path.join(DIST_DIR, 'mcp-server.js'));
  const httpStats = fs.statSync(path.join(DIST_DIR, 'http-server-bundle.js'));
  console.log(`📊 stdio server (mcp-server.js): ${(stdioStats.size / 1024).toFixed(2)} KB`);
  console.log(`📊 HTTP server (http-server-bundle.js): ${(httpStats.size / 1024).toFixed(2)} KB`);

} catch (error) {
  console.error('❌ Bundling failed:', error.message);
  process.exit(1);
}
