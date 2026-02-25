/**
 * react-pm-helpers.jsx
 *
 * Drop-in replacements for two TipTap/React utilities, rewritten against raw
 * ProseMirror + React 18 APIs so the editor can be decoupled from @tiptap/react.
 *
 * Exports
 * -------
 *   ReactPopup          — replaces `ReactRenderer` from @tiptap/react
 *                         Used by suggestion plugins (WikiLinkSuggest, slash-command)
 *                         to mount a React component in a floating popup container.
 *
 *   createReactNodeView — replaces `ReactNodeViewRenderer` from @tiptap/react
 *                         Used by node extensions (MermaidDiagram) to render a
 *                         React component as a ProseMirror NodeView.
 */

import React from 'react'
import { createRoot } from 'react-dom/client'

// ---------------------------------------------------------------------------
// ReactPopup
// ---------------------------------------------------------------------------

/**
 * Renders a React component into a detached DOM element so it can be appended
 * anywhere in the document (e.g. appended to a positioned container div by a
 * suggestion plugin).
 *
 * API surface matches the TipTap `ReactRenderer` used across the codebase:
 *
 *   const component = new ReactPopup(WikiLinkList, initialProps)
 *   container.appendChild(component.element)
 *   component.updateProps(newProps)     // re-render with merged props
 *   component.ref?.onKeyDown(props)     // call imperative method on inner ref
 *   component.destroy()                 // unmount + remove DOM element
 *
 * The rendered React component MUST use `forwardRef` + `useImperativeHandle`
 * to expose methods (e.g. `onKeyDown`) via its ref — exactly as WikiLinkList
 * and SlashCommandList already do.
 */
export class ReactPopup {
  /**
   * @param {React.ComponentType<any>} Component  - The React component to render
   * @param {object} initialProps                 - Initial props to pass to the component
   */
  constructor(Component, initialProps = {}) {
    this._Component = Component
    this._props = { ...initialProps }

    // The inner ref captures the imperative handle exposed by the component
    // via useImperativeHandle. Callers access it as `component.ref`.
    this._innerRef = { current: null }

    // Create the host DOM node. Callers append this to their own container.
    this.element = document.createElement('div')
    this.element.style.cssText = 'display:contents'

    // Mount a React root on the host node.
    this._root = createRoot(this.element)

    // Initial render.
    this._render()
  }

  /**
   * The imperative ref exposed by the inner component (e.g. { onKeyDown }).
   * Returns null if the component has not yet committed or does not forward a ref.
   *
   * @returns {object|null}
   */
  get ref() {
    return this._innerRef.current
  }

  /**
   * Re-render the component with shallowly merged props.
   *
   * @param {object} newProps
   */
  updateProps(newProps) {
    this._props = { ...this._props, ...newProps }
    this._render()
  }

  /**
   * Unmount the React tree and remove the host element from the DOM.
   */
  destroy() {
    // Schedule unmount on the next tick so React can flush any pending
    // state updates before the root is torn down (avoids "Cannot update
    // an unmounted root" warnings in React 18+).
    Promise.resolve().then(() => {
      try {
        this._root.unmount()
      } catch (_) {
        // Silently swallow — root may already be unmounted if destroy() is
        // called multiple times (defensive).
      }
    })

    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
  }

  // -- private ---------------------------------------------------------------

  _render() {
    const Component = this._Component
    const innerRef = this._innerRef

    // We use a thin wrapper so we can capture the ref without modifying the
    // caller's props object or requiring the Component to accept a special prop.
    const Wrapper = () => (
      <Component ref={innerRef} {...this._props} />
    )

    this._root.render(<Wrapper />)
  }
}

// ---------------------------------------------------------------------------
// createReactNodeView
// ---------------------------------------------------------------------------

/**
 * Creates a ProseMirror NodeView factory that renders a React component
 * inside each node instance.
 *
 * Replaces `ReactNodeViewRenderer(Component)` from @tiptap/react.
 *
 * Usage (in a PM Node extension):
 *
 *   addNodeView() {
 *     return createReactNodeView(MermaidComponent)
 *   }
 *
 * The returned factory matches the PM NodeView factory signature:
 *   (node, view, getPos, decorations, innerDecorations) => NodeView
 *
 * The React component receives these props:
 *   { node, view, getPos, updateAttributes, selected }
 *
 * `node` and `selected` are reactive — they update when PM calls
 * `update()` / `selectNode()` / `deselectNode()`.
 *
 * `updateAttributes(attrs)` dispatches a `setNodeMarkup` transaction so the
 * component can mutate node attributes without directly touching the PM view.
 *
 * The component is expected to render its own visible content. The `dom` that
 * PM uses as the NodeView container is the wrapper div created here.
 * Consumers that previously used TipTap's `<NodeViewWrapper>` should replace
 * it with a plain `<div>` (or any appropriate element) because this helper
 * supplies the outer container itself.
 *
 * @param {React.ComponentType<any>} Component
 * @returns {(node: PMNode, view: EditorView, getPos: () => number) => NodeView}
 */
export function createReactNodeView(Component) {
  return function nodeViewFactory(node, view, getPos) {
    // ------------------------------------------------------------------
    // Mutable state shared between the closure and React renders.
    // We store these in plain objects so that the React render function
    // always closes over the latest values without stale references.
    // ------------------------------------------------------------------
    let currentNode = node
    let isSelected = false

    // The DOM element that ProseMirror owns as the NodeView container.
    const dom = document.createElement('div')
    dom.classList.add('react-node-view')

    // React 18 root mounted on `dom`.
    const root = createRoot(dom)

    // ------------------------------------------------------------------
    // updateAttributes — dispatches a setNodeMarkup transaction so the
    // React component can update node attributes declaratively.
    // ------------------------------------------------------------------
    function updateAttributes(attrs) {
      const pos = typeof getPos === 'function' ? getPos() : null
      if (pos == null || pos === false) return

      const { tr } = view.state
      tr.setNodeMarkup(pos, undefined, {
        ...currentNode.attrs,
        ...attrs,
      })
      view.dispatch(tr)
    }

    // ------------------------------------------------------------------
    // Render helper — called on mount and on every prop change.
    // ------------------------------------------------------------------
    function render() {
      root.render(
        <Component
          node={currentNode}
          view={view}
          getPos={getPos}
          updateAttributes={updateAttributes}
          selected={isSelected}
        />
      )
    }

    // Initial render.
    render()

    // ------------------------------------------------------------------
    // ProseMirror NodeView interface
    // ------------------------------------------------------------------
    return {
      /**
       * The DOM element ProseMirror places in the document for this node.
       */
      dom,

      /**
       * Called by PM when the node this view represents has changed.
       * Return false to let PM destroy + recreate the view; return true to
       * keep the existing view and re-render with the new node data.
       *
       * @param {PMNode} updatedNode
       * @returns {boolean}
       */
      update(updatedNode) {
        // Reject updates for a different node type — PM will handle teardown.
        if (updatedNode.type !== currentNode.type) {
          return false
        }

        currentNode = updatedNode
        render()
        return true
      },

      /**
       * Called when the node is selected in the editor.
       */
      selectNode() {
        isSelected = true
        dom.classList.add('ProseMirror-selectednode')
        render()
      },

      /**
       * Called when the node is deselected.
       */
      deselectNode() {
        isSelected = false
        dom.classList.remove('ProseMirror-selectednode')
        render()
      },

      /**
       * Called when PM is about to destroy this node view.
       * Schedule unmount so React can flush pending work first.
       */
      destroy() {
        Promise.resolve().then(() => {
          try {
            root.unmount()
          } catch (_) {
            // Already unmounted — no-op.
          }
        })
      },

      /**
       * For atom nodes (node.isAtom === true) we absorb all browser events
       * so ProseMirror does not interfere with React's own event handling
       * (e.g. textarea input inside Mermaid edit mode).
       *
       * For non-atom nodes we let PM handle events normally.
       *
       * @param {Event} _event
       * @returns {boolean}
       */
      stopEvent(_event) {
        return currentNode.isAtom
      },

      /**
       * Tell PM to ignore all DOM mutations inside this node view because
       * React owns the DOM subtree; PM should never attempt to reconcile it.
       *
       * @returns {boolean}
       */
      ignoreMutation() {
        return true
      },
    }
  }
}
