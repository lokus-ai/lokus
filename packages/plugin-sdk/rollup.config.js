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
    declarationMap: false
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
  {
    input: 'src/utils/index.ts',
    output: [
      {
        file: 'dist/utils/index.js',
        format: 'cjs',
        sourcemap: true
      },
      {
        file: 'dist/utils/index.esm.js',
        format: 'esm',
        sourcemap: true
      }
    ],
    external,
    plugins
  },
  
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
  },
  
  // Utils type definitions
  {
    input: 'src/utils/index.ts',
    output: {
      file: 'dist/utils/index.d.ts',
      format: 'esm'
    },
    plugins: [dts()],
    external
  }
]