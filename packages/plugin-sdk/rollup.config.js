import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import dts from 'rollup-plugin-dts'

const external = [
  'fs',
  'path',
  'os',
  'events',
  'util',
  'stream',
  'crypto',
  'child_process',
  'eventemitter3',
  'ajv',
  'ajv-formats',
  'semver',
  'chalk',
  'commander',
  'inquirer',
  'fs-extra',
  'glob',
  'chokidar'
]

const plugins = [
  typescript({
    tsconfig: './tsconfig.json',
    declaration: false,
    declarationMap: false,
    // incremental + a cold tsbuildinfo cache makes the plugin silently skip
    // emitting transformed sources (fresh CI clones failed; warm local builds passed)
    incremental: false
  }),
  resolve({
    preferBuiltins: true
  }),
  commonjs(),
  json()
]

export default [
  // Main bundle
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true
      },
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true
      }
    ],
    external,
    plugins
  },
  
  // Testing utilities bundle
  {
    input: 'src/testing/index.ts',
    output: [
      {
        file: 'dist/testing/index.js',
        format: 'cjs',
        sourcemap: true
      },
      {
        file: 'dist/testing/index.esm.js',
        format: 'esm',
        sourcemap: true
      }
    ],
    external,
    plugins
  },
  
  // Templates bundle
  {
    input: 'src/templates/index.ts',
    output: [
      {
        file: 'dist/templates/index.js',
        format: 'cjs',
        sourcemap: true
      },
      {
        file: 'dist/templates/index.esm.js',
        format: 'esm',
        sourcemap: true
      }
    ],
    external,
    plugins
  },
  
  // Utils bundle
  // (removed in v3 — the old helper classes targeted the deleted runtime)

  // Type definitions
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm'
    },
    plugins: [dts()],
    external
  },
  
  // Testing type definitions
  {
    input: 'src/testing/index.ts',
    output: {
      file: 'dist/testing/index.d.ts',
      format: 'esm'
    },
    plugins: [dts()],
    external
  },
  
  // Templates type definitions
  {
    input: 'src/templates/index.ts',
    output: {
      file: 'dist/templates/index.d.ts',
      format: 'esm'
    },
    plugins: [dts()],
    external
  }
]