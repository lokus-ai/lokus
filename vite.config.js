import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    // Array form so entries can use a regex `find`.
    alias: [
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
          // Excalidraw is deliberately NOT named here. Forcing it into a
          // manual chunk made Rollup hoist the entry's shared helpers into
          // that same chunk, which gave the entry a *static* import of it —
          // so all 7 MB was modulepreloaded at boot even though Canvas is
          // lazily imported. Left alone, Rollup puts it in an async chunk
          // that only loads when a canvas is actually opened.
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
