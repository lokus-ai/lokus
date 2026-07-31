/**
 * beginDragGuard — suppress text selection for the duration of a pointer drag.
 *
 * Without this, dragging a resize handle across the editor sweeps a text
 * selection over everything it passes, so the whole document flashes
 * highlighted while you resize. `preventDefault()` on mousedown stops a NEW
 * selection starting; locking `user-select` on the body is what stops an
 * in-flight drag from extending one. We need both.
 *
 * Also pins the cursor so it doesn't flicker to `text` (I-beam) whenever the
 * pointer crosses a text node mid-drag.
 *
 * Returns a cleanup — call it on mouseup. Restores whatever was there before
 * rather than assuming the default, so nested/overlapping drags can't strand
 * the body in a locked state.
 */
export function beginDragGuard(cursor = 'col-resize') {
  const { style } = document.body;
  const previous = {
    userSelect: style.userSelect,
    webkitUserSelect: style.webkitUserSelect,
    cursor: style.cursor,
  };

  style.userSelect = 'none';
  style.webkitUserSelect = 'none';
  style.cursor = cursor;

  // Drop any selection that already started before the handler ran.
  try {
    window.getSelection()?.removeAllRanges();
  } catch {
    // Safari can throw on a detached selection — never block a resize for it.
  }

  return function endDragGuard() {
    style.userSelect = previous.userSelect;
    style.webkitUserSelect = previous.webkitUserSelect;
    style.cursor = previous.cursor;
  };
}
