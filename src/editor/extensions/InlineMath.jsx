import katex from 'katex'
import 'katex/dist/katex.min.css'

/**
 * ProseMirror nodeView factory for inlineMath nodes.
 * Renders LaTeX via KaTeX into a <span>.
 */
export function inlineMathNodeView(node) {
  const isDisplay = node.attrs.display === 'yes'
  const dom = document.createElement(isDisplay ? 'div' : 'span')
  dom.style.cssText = isDisplay
    ? 'text-align:center;cursor:pointer;margin:0.5em 0'
    : 'display:inline-block;cursor:pointer'

  function renderKatex(n) {
    try {
      dom.innerHTML = katex.renderToString(n.attrs.latex || '', {
        displayMode: n.attrs.display === 'yes',
        throwOnError: false,
      })
    } catch {
      const delim = n.attrs.display === 'yes' ? '$$' : '$'
      dom.textContent = `${delim}${n.attrs.latex || ''}${delim}`
    }
  }

  renderKatex(node)

  return {
    dom,
    update(updatedNode) {
      if (updatedNode.type !== node.type) return false
      node = updatedNode
      renderKatex(node)
      return true
    },
    destroy() {},
    stopEvent() { return true },
    ignoreMutation() { return true },
  }
}
