import katex from 'katex'
import 'katex/dist/katex.min.css'

/**
 * ProseMirror nodeView factory for inlineMath nodes.
 * Renders LaTeX via KaTeX into a <span>.
 */
export function inlineMathNodeView(node) {
  const dom = document.createElement('span')
  dom.style.cssText = 'display:inline-block;cursor:pointer'

  function renderKatex(n) {
    try {
      dom.innerHTML = katex.renderToString(n.attrs.latex || '', {
        displayMode: n.attrs.display === 'yes',
        throwOnError: false,
      })
    } catch {
      dom.textContent = `$${n.attrs.latex || ''}$`
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
