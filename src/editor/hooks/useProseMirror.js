/**
 * useProseMirror — Core React hook that owns a ProseMirror EditorView.
 *
 * This hook is the centerpiece of the TipTap-to-raw-ProseMirror migration.
 * It fixes the tab-switching content loss bug by ensuring the EditorView is
 * created exactly ONCE when the DOM mount point appears, and NEVER recreated
 * due to callback identity changes.
 *
 * THE BUG IT FIXES:
 *   TipTap's useEditor hook accepted a dependency array that included
 *   `handleEditorUpdate`. That callback depended on `onContentChange`, which
 *   depended on `activeFile`. Every tab switch produced a new activeFile, which
 *   cascaded through the dependency chain and caused useEditor to destroy and
 *   recreate the entire editor — losing all content.
 *
 * THE FIX:
 *   All callbacks (onUpdate, onReady, onDestroy) are stored in refs. Their
 *   identity changes are invisible to the hook internals. The EditorView is
 *   created once via a callback ref on a <div>, and destroyed only when that
 *   div unmounts. Content is managed imperatively by the parent (EditorGroup),
 *   not through React props.
 *
 * Usage:
 *   const { mountRef, viewRef } = useProseMirror({
 *     schema, plugins, onUpdate, nodeViews, editorProps, onReady, onDestroy,
 *   });
 *
 *   return <div ref={mountRef} />;
 *
 * @module useProseMirror
 */

import { useRef, useCallback, useEffect } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

/**
 * Creates and manages a ProseMirror EditorView tied to a DOM element's lifecycle.
 *
 * @param {Object} options
 * @param {import('prosemirror-model').Schema} options.schema
 *   ProseMirror Schema instance. Must be stable (same reference) for the
 *   lifetime of the hook. Changing it requires remounting the component.
 *
 * @param {import('prosemirror-state').Plugin[]} options.plugins
 *   Array of ProseMirror plugins. The initial set is used at creation time.
 *   Runtime changes are applied via `view.updateState(state.reconfigure(...))`.
 *
 * @param {(view: import('prosemirror-view').EditorView) => void} [options.onUpdate]
 *   Called when a user edit changes the document. NOT called for programmatic
 *   changes (transactions with `tr.getMeta('programmatic') === true`).
 *   Stored in a ref — identity changes do not cause view recreation.
 *
 * @param {Object.<string, Function>} [options.nodeViews]
 *   ProseMirror nodeView factories, keyed by node type name.
 *   Example: `{ mermaid: mermaidNodeViewFactory }`
 *
 * @param {import('prosemirror-view').EditorProps} [options.editorProps]
 *   Additional EditorView props (handleDOMEvents, attributes, etc.).
 *   Merged into the view at creation time.
 *
 * @param {(view: import('prosemirror-view').EditorView) => void} [options.onReady]
 *   Called once after the EditorView is created and mounted.
 *   Stored in a ref — identity changes are invisible.
 *
 * @param {() => void} [options.onDestroy]
 *   Called when the EditorView is destroyed (DOM element unmounts).
 *   Stored in a ref — identity changes are invisible.
 *
 * @returns {{ mountRef: (node: HTMLElement | null) => void, viewRef: React.MutableRefObject<EditorView | null> }}
 *   - `mountRef`: Callback ref. Attach to a `<div ref={mountRef} />`. When React
 *     calls it with a DOM node, the EditorView is created inside that node. When
 *     React calls it with `null` (unmount), the view is destroyed.
 *   - `viewRef`: A React ref holding the current EditorView instance (or null).
 *     Use this for imperative operations like `viewRef.current.dispatch(...)`.
 */
export default function useProseMirror({
  schema,
  plugins = [],
  onUpdate,
  nodeViews,
  editorProps,
  onReady,
  onDestroy,
}) {
  // ── Stable refs for the EditorView and its container DOM node ──────────

  /** @type {React.MutableRefObject<EditorView | null>} */
  const viewRef = useRef(null);

  /** The DOM node that hosts the EditorView */
  const containerRef = useRef(null);

  // ── Callback refs — identity changes never trigger recreation ──────────
  //
  // These refs are updated on every render so they always point to the
  // latest callback. The EditorView's dispatchTransaction reads from
  // onUpdateRef.current, so it always calls the most recent onUpdate
  // without the view needing to know about the change.

  const onUpdateRef = useRef(onUpdate);
  const onReadyRef = useRef(onReady);
  const onDestroyRef = useRef(onDestroy);

  // Keep refs in sync with latest props — no effect needed, just assignment.
  // This runs during render (before commit), which is fine for refs.
  onUpdateRef.current = onUpdate;
  onReadyRef.current = onReady;
  onDestroyRef.current = onDestroy;

  // ── Stable refs for creation-time config ───────────────────────────────
  //
  // These are read once during EditorView creation. If they need to change
  // at runtime, use view.updateState() / view.setProps() explicitly.

  const schemaRef = useRef(schema);
  const pluginsRef = useRef(plugins);
  const nodeViewsRef = useRef(nodeViews);
  const editorPropsRef = useRef(editorProps);

  // Update the refs so reconfigure() can access latest values if needed.
  schemaRef.current = schema;
  pluginsRef.current = plugins;
  nodeViewsRef.current = nodeViews;
  editorPropsRef.current = editorProps;

  // ── View destruction helper ────────────────────────────────────────────

  const destroyView = useCallback(() => {
    if (viewRef.current) {
      onDestroyRef.current?.();
      viewRef.current.destroy();
      viewRef.current = null;
    }
  }, []);

  // ── mountRef: callback ref that ties view lifecycle to the DOM ─────────
  //
  // This is the key pattern that replaces TipTap's useEditor:
  //
  //   <div ref={mountRef} />
  //
  // When React mounts the div:  mountRef(domNode) → create EditorView
  // When React unmounts the div: mountRef(null)   → destroy EditorView
  //
  // The callback has [] deps via useCallback, so its identity is stable.
  // React will only call it when the actual DOM element mounts/unmounts,
  // not on re-renders.

  const mountRef = useCallback((node) => {
    // ── Unmount path ───────────────────────────────────────────────────
    if (!node) {
      destroyView();
      containerRef.current = null;
      return;
    }

    // ── Guard: same node, view already exists ──────────────────────────
    if (node === containerRef.current && viewRef.current) {
      return;
    }

    // ── Cleanup previous view if container changed ─────────────────────
    if (viewRef.current) {
      destroyView();
    }

    containerRef.current = node;

    // ── Create the EditorState with an empty document ──────────────────
    //
    // The hook intentionally does NOT accept a `content` prop. Content is
    // managed imperatively by EditorGroup via view.dispatch() or
    // view.updateState(). The initial state is always an empty document.
    // This matches the existing pattern where <Editor content="" /> is
    // always passed an empty string, with real content set via
    // editor.commands.setContent().

    const state = EditorState.create({
      schema: schemaRef.current,
      plugins: pluginsRef.current,
    });

    // ── Create the EditorView ──────────────────────────────────────────

    const view = new EditorView(node, {
      state,

      // NodeView factories for custom rendering (e.g., mermaid diagrams)
      nodeViews: nodeViewsRef.current || {},

      // Spread any additional EditorView props (handleDOMEvents, attributes, etc.)
      ...editorPropsRef.current,

      /**
       * Custom transaction dispatch — replaces TipTap's onUpdate callback
       * AND the isSettingRef guard pattern.
       *
       * Every state change in ProseMirror goes through dispatchTransaction.
       * We use transaction metadata to distinguish user edits from
       * programmatic changes:
       *
       *   - User types/deletes/formats: tr has no 'programmatic' meta
       *     → we call onUpdate so EditorGroup can mark the tab dirty.
       *
       *   - Tab switch sets content: tr.setMeta('programmatic', true)
       *     → we skip onUpdate, so the tab switch doesn't trigger a
       *       spurious "content changed" event.
       *
       * This is cleaner than the old isSettingRef flag approach because:
       *   1. The metadata travels WITH the transaction, not in external state.
       *   2. There is no race condition — the flag is checked atomically.
       *   3. Multiple programmatic updates can be in flight simultaneously.
       */
      dispatchTransaction(tr) {
        // Safety: bail if the view has been destroyed between dispatch
        // and this callback executing (unlikely but defensive).
        if (viewRef.current !== this) return;

        const newState = this.state.apply(tr);
        this.updateState(newState);

        // Only notify the parent of user-initiated document changes.
        // Programmatic changes (tab switches, initial loads) set
        // tr.setMeta('programmatic', true) to suppress this.
        if (tr.docChanged && !tr.getMeta('programmatic')) {
          onUpdateRef.current?.(this);
        }
      },
    });

    viewRef.current = view;

    // ── Notify consumer that the view is ready ─────────────────────────
    onReadyRef.current?.(view);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destroyView]);
  // `destroyView` is the only dep, and it's stable (useCallback with []).
  // schemaRef, pluginsRef, etc. are refs — reading .current in the callback
  // always gets the latest value without being in the dep array.

  // ── Cleanup on component unmount ───────────────────────────────────────
  //
  // The mountRef(null) call from React should handle cleanup in most cases,
  // but this effect is a safety net for edge cases (e.g., the component
  // unmounts without the ref callback firing, or StrictMode double-mount).

  useEffect(() => {
    return () => {
      destroyView();
    };
  }, [destroyView]);

  // ── Plugin reconfiguration ─────────────────────────────────────────────
  //
  // If the plugins array changes at runtime (e.g., dynamic plugin
  // extensions, theme changes), reconfigure the EditorState. This is a
  // lightweight operation that preserves the document and selection —
  // the EditorView itself is NOT recreated.
  //
  // We compare by reference: if the same array object is passed, no
  // reconfiguration occurs. Consumers should memoize their plugins array
  // with useMemo to avoid unnecessary reconfiguration.

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentPlugins = view.state.plugins;
    if (plugins === currentPlugins) return;

    const newState = view.state.reconfigure({ plugins });
    view.updateState(newState);
  }, [plugins]);

  return { mountRef, viewRef };
}
