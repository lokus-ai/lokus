/**
 * Overlay v3 plugin — a transparent, always-on-top window.
 *
 * The overlay page (dog.html) is plain HTML/JS rendered in a sandboxed
 * window. It cannot reach your notes; it only draws.
 *
 * plugin.json:
 * {
 *   "apiVersion": 3,
 *   "id": "running-dog",
 *   "name": "Running Dog",
 *   "version": "1.0.0",
 *   "main": "index.js",
 *   "capabilities": ["overlay", "commands"],
 *   "activation": ["command:dog"],
 *   "contributes": {
 *     "commands": [{ "id": "dog", "title": "Let the dog run" }],
 *     "overlays": [{ "id": "dog", "title": "Dog", "src": "dog.html",
 *                    "width": 240, "height": 160, "clickThrough": true }]
 *   }
 * }
 */
import { definePlugin } from '../plugin.js';
import type { LokusAPI } from '../api.js';

let apiRef: LokusAPI | undefined;

export default definePlugin({
  activate(api) {
    apiRef = api;
    api.on('command', async ({ id }) => {
      if (id !== 'dog') return;
      await api.overlay.show('dog');
    });
  },

  deactivate() {
    apiRef?.overlay.hide('dog');
  },
});
