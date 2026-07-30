/**
 * Browser-safe stub for mcp-server/tools/notes.js.
 * The real module uses Node fs/promises; this stub degrades gracefully
 * when the code runs in the Tauri renderer (browser context).
 */

export const notesTools = [];

export async function executeNoteTool() {
  return { content: [{ type: 'text', text: '' }] };
}
