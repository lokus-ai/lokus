/**
 * Dev-server management: reuse a running Vite on :1420 or spawn `npm run dev`.
 */

import { spawn } from 'child_process';

const URL = 'http://localhost:1420';

async function isUp() {
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function ensureDevServer({ cwd, log = console.error }) {
  if (await isUp()) {
    log('[qa] ⚠ reusing dev server already on :1420 — make sure it was started with QA_FS_SHIM=1, or the editor will crash on note-open (see journey 00)');
    return { url: URL, stop: async () => {} };
  }
  log('[qa] starting vite dev server (QA_FS_SHIM=1)…');
  const child = spawn('npm', ['run', 'dev'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    env: { ...process.env, BROWSER: 'none', QA_FS_SHIM: '1' },
  });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await isUp()) {
      log('[qa] dev server ready');
      return {
        url: URL,
        stop: async () => {
          try {
            process.kill(-child.pid, 'SIGTERM');
          } catch {}
        },
      };
    }
    if (child.exitCode !== null) {
      throw new Error(`vite exited early (code ${child.exitCode}):\n${out.slice(-2000)}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {}
  throw new Error(`vite did not become ready in 120s:\n${out.slice(-2000)}`);
}
