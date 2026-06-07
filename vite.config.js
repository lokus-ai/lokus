import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

/**
 * Stub out mcp-server modules in the browser bundle.
 * The MCP server runs as a separate Node.js process and uses fs/promises,
 * which doesn't exist in the Tauri WebView. This plugin redirects any
 * frontend import of those modules to browser-safe stubs.
 */
function mcpServerBrowserStub() {
  const stubMap = {
    [path.resolve(__dirname, 'src/mcp-server/utils/graphIndex.js')]:
      path.resolve(__dirname, 'src/core/ai/mcp-graph-stub.js'),
    [path.resolve(__dirname, 'src/mcp-server/tools/notes.js')]:
      path.resolve(__dirname, 'src/core/ai/mcp-notes-stub.js'),
  };
  return {
    name: 'mcp-server-browser-stub',
    enforce: 'pre',
    resolveId(id, importer) {
      // Match relative imports that end with the mcp-server path
      if (id.endsWith('mcp-server/utils/graphIndex.js')) {
        return stubMap[path.resolve(__dirname, 'src/mcp-server/utils/graphIndex.js')];
      }
      if (id.endsWith('mcp-server/tools/notes.js')) {
        return stubMap[path.resolve(__dirname, 'src/mcp-server/tools/notes.js')];
      }
      return null;
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), mcpServerBrowserStub()],
  resolve: {
    // Array form so the graphIndex entry can use a regex `find`.
    alias: [
      // graphIndex.js statically imports Node builtins (fs/promises, path), which
      // cannot resolve in the browser/client bundle and break the production build.
      // Redirect it to the Tauri-backed entry (real filesystem access via the app's
      // Rust `invoke` commands, not a dead stub); the Node/MCP-server esbuild bundle
      // is separate and still uses graphIndex.js. Mechanism adapted from PR #536.
      // Does not match graphIndex.core.js / graphIndex.tauri.js (different suffixes).
      {
        find: /^.*[\\/]graphIndex\.js$/,
        replacement: path.resolve(__dirname, "./src/mcp-server/utils/graphIndex.tauri.js"),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: "jsxgraph/distrib/jsxgraph.css", replacement: path.resolve(__dirname, "node_modules/jsxgraph/distrib/jsxgraph.css") },
      // QA harness only (npm run qa): keep client code that wrongly imports Node
      // builtins from crashing module evaluation. See qa/harness/node-shims.
      ...(process.env.QA_FS_SHIM
        ? [
            { find: "fs/promises", replacement: path.resolve(__dirname, "./qa/harness/node-shims/fs-promises.js") },
            { find: "path", replacement: path.resolve(__dirname, "./qa/harness/node-shims/path.js") },
          ]
        : []),
    ],
  },

  // Excalidraw 0.18+ uses `export { english as "en-us" }` in locale modules
  // which requires es2022 target for both esbuild (dev) and rollup (build)
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },

  // Build configuration
  build: {
    target: 'es2022',
    // Generate source maps for production (hidden by default, only visible to Sentry)
    sourcemap: 'hidden',
    // Excalidraw chunk is ~3MB, suppress warning
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@excalidraw')) return 'excalidraw-vendor'
          if (id.includes('react-dom') || id.includes('react/')) return 'react-vendor'
          if (id.includes('@sentry')) return 'sentry'
        },
      },
    },
  },

  // Worker configuration
  worker: {
    format: 'es', // Use ES modules for workers (required for code-splitting)
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
