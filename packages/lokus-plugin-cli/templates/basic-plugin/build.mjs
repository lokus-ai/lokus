const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isProd = process.argv.includes('--prod');
const isWatch = process.argv.includes('--watch');

async function build() {
    const context = await esbuild.context({
        entryPoints: ['src/index.ts'],
        bundle: true,
        outfile: 'dist/index.js',
        external: ['lokus', 'react', 'react-dom', 'electron'],
        format: 'cjs',
        platform: 'node',
        target: 'es2020',
        sourcemap: !isProd,
        minify: isProd,
        logLevel: 'info',
    });

    if (isWatch) {
        await context.watch();
        console.log('Watching for changes...');
    } else {
        await context.rebuild();
        await context.dispose();
        console.log('Build complete');
    }
}

build().catch(() => process.exit(1));
