const esbuild = require('esbuild');

const isProduction = process.env.NODE_ENV === 'production';

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  platform: 'node',
  target: 'node16',
  format: 'cjs',
  sourcemap: !isProduction,
  minify: isProduction,
  external: ['@lokus/plugin-sdk'],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
}).catch(() => process.exit(1));

if (process.argv.includes('--watch')) {
  esbuild.context({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outfile: 'dist/index.js',
    platform: 'node',
    target: 'node16',
    format: 'cjs',
    sourcemap: true,
    external: ['@lokus/plugin-sdk'],
    define: {
      'process.env.NODE_ENV': JSON.stringify('development')
    }
  }).then(ctx => {
    ctx.watch();
    console.log('Watching for changes...');
  });
}