import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
    css: true,
    include: ['tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    testTimeout: 10000,
  }
})