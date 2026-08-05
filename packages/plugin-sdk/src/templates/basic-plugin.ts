/**
 * Basic v3 plugin — a status-bar clock with a palette command.
 *
 * Build with esbuild to CJS (the Lokus loader runs CommonJS or ESM):
 *   esbuild src/index.ts --bundle --platform=browser --format=cjs --outfile=dist/index.js
 *
 * plugin.json next to it:
 * {
 *   "apiVersion": 3,
 *   "id": "my-plugin",
 *   "name": "My Plugin",
 *   "version": "1.0.0",
 *   "main": "index.js",
 *   "capabilities": ["ui", "editor"],
 *   "activation": ["startup"],
 *   "contributes": {
 *     "commands": [{ "id": "stamp", "title": "Insert timestamp" }],
 *     "statusBar": [{ "id": "clock", "position": "right", "text": "…" }]
 *   }
 * }
 */
import { definePlugin } from '../plugin.js';

let timer: ReturnType<typeof setInterval> | undefined;

export default definePlugin({
  activate(api) {
    const tick = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      api.ui.setStatusBarItem('clock', { text: `🕐 ${pad(d.getHours())}:${pad(d.getMinutes())}` });
    };
    tick();
    timer = setInterval(tick, 1000);

    api.on('command', async ({ id }) => {
      if (id !== 'stamp') return;
      await api.editor.insert(`\n🕐 *${new Date().toLocaleString()}*\n`);
      await api.ui.notify({ message: 'Timestamp inserted', type: 'success' });
    });
  },

  deactivate() {
    if (timer) clearInterval(timer);
  },
});
