import { Plugin, PluginKey } from 'prosemirror-state';
import tippy from 'tippy.js/dist/tippy.esm.js';

const DEFAULT_PLUGIN_KEY = new PluginKey('floatingMenu');

/**
 * Computes a DOMRect-compatible object for the current editor selection
 * by using view.coordsAtPos() on the selection's from/to positions.
 *
 * Falls back to the editor DOM element's bounding rect if the selection
 * yields no usable coordinates.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @returns {DOMRect}
 */
function getSelectionRect(view) {
  const { state } = view;
  const { from, to } = state.selection;

  try {
    const fromCoords = view.coordsAtPos(from);
    const toCoords = view.coordsAtPos(to);

    // Build a rect that spans from the start to the end of the selection.
    // coordsAtPos returns { left, right, top, bottom } in viewport coordinates.
    const left = Math.min(fromCoords.left, toCoords.left);
    const right = Math.max(fromCoords.right, toCoords.right);
    const top = Math.min(fromCoords.top, toCoords.top);
    const bottom = Math.max(fromCoords.bottom, toCoords.bottom);
    const width = right - left;
    const height = bottom - top;

    return {
      width,
      height,
      top,
      bottom,
      left,
      right,
      // DOMRect interface
      x: left,
      y: top,
      toJSON() {
        return { width, height, top, bottom, left, right, x: left, y: top };
      },
    };
  } catch (_err) {
    // Fallback: use editor DOM bounding rect
    return view.dom.getBoundingClientRect();
  }
}

/**
 * Creates a ProseMirror Plugin that shows a floating tippy.js menu anchored
 * to the current editor selection.
 *
 * @param {object} config
 * @param {PluginKey}   [config.pluginKey]    - Optional PluginKey; defaults to a new key named 'floatingMenu'.
 * @param {HTMLElement}  config.element       - The menu DOM element to use as tippy content.
 * @param {(state: import('prosemirror-state').EditorState, view: import('prosemirror-view').EditorView) => boolean} config.shouldShow
 *   - Called on every editor update; return true to show the menu, false to hide it.
 * @param {object}      [config.tippyOptions] - Extra tippy.js options (e.g. placement, offset).
 * @returns {Plugin}
 */
function createFloatingMenuPlugin(config) {
  const {
    pluginKey = DEFAULT_PLUGIN_KEY,
    element,
    shouldShow,
    tippyOptions = {},
  } = config;

  if (!element) {
    throw new Error('createFloatingMenuPlugin: config.element is required');
  }

  if (typeof shouldShow !== 'function') {
    throw new Error('createFloatingMenuPlugin: config.shouldShow must be a function');
  }

  return new Plugin({
    key: pluginKey,

    view(editorView) {
      // Instantiate tippy attached to the editor's DOM host element.
      // We pass the editor DOM as the reference so tippy can compute
      // overflow boundaries, and override getReferenceClientRect on
      // each show to reflect the live selection position.
      const instances = tippy(editorView.dom, {
        content: element,
        appendTo: () => document.body,
        interactive: true,
        trigger: 'manual',
        placement: tippyOptions.placement ?? 'top',
        showOnCreate: false,
        // Merge any extra caller-supplied options, but keep our critical ones.
        ...tippyOptions,
        // Ensure these are never overridden by callers.
        interactive: true,
        trigger: 'manual',
        getReferenceClientRect: () => getSelectionRect(editorView),
      });

      // tippy() called on a single DOM node returns an array with one instance.
      const tippyInstance = Array.isArray(instances) ? instances[0] : instances;

      return {
        /**
         * Called by ProseMirror after every transaction (including selection changes).
         *
         * @param {import('prosemirror-view').EditorView} view
         */
        update(view) {
          const { state } = view;
          const visible = shouldShow(state, view);

          if (visible) {
            // Refresh the reference rect so the popover repositions to the
            // current selection before/during show.
            tippyInstance.setProps({
              getReferenceClientRect: () => getSelectionRect(view),
            });
            tippyInstance.show();
          } else {
            tippyInstance.hide();
          }
        },

        /**
         * Called when the plugin view is torn down (editor destroyed).
         */
        destroy() {
          tippyInstance.destroy();
        },
      };
    },
  });
}

export { createFloatingMenuPlugin };
