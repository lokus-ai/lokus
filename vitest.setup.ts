import '@testing-library/jest-dom'

// Ensure no Tauri detection leaks into tests
Object.defineProperty(globalThis, 'window', {
  value: globalThis.window || {},
  writable: true,
});
try {
  delete window.__TAURI_INTERNALS__
  delete window.__TAURI_METADATA__
} catch {}

