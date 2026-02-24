/**
 * editorRegistry — maps groupId → TipTap editor instance.
 *
 * EditorGroup registers its editor on mount / editor-ready,
 * and the save handler looks up the focused group's editor here.
 * Kept outside Zustand to avoid serializing complex editor objects.
 */
const editors = new Map();

export function registerEditor(groupId, editor) {
  if (editor) {
    editors.set(groupId, editor);
  } else {
    editors.delete(groupId);
  }
}

export function getEditor(groupId) {
  return editors.get(groupId) ?? null;
}
