import { Node, mergeAttributes, InputRule } from '@tiptap/core'

function getKatex() {
  try {
    const k = (typeof globalThis !== 'undefined' ? globalThis : window)?.katex
    if (!k) {
      console.warn('KaTeX not found on globalThis/window')
      return null
    }
    if (typeof k.renderToString !== 'function') {
      console.warn('KaTeX renderToString not available')
      return null
    }
    return k.renderToString
  } catch (error) { 
    console.warn('Error accessing KaTeX:', error)
    return null 
  }
}

function renderMathHTML(src, displayMode) {
  try {
    const render = getKatex()
    if (render) {
      const rendered = render(src, { 
        throwOnError: false, 
        displayMode,
        errorColor: '#cc0000',
        macros: {
          "\\f": "#1f(#2)"
        }
      })
      return rendered
    }
  } catch (error) {
    console.warn('KaTeX render error:', error, 'for source:', src)
  }
  // Fallback: show TeX source with delimiters  
  return displayMode ? `$$${src}$$` : `$${src}$`
}

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { src: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'span[data-type="math-inline"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    const { src = '' } = HTMLAttributes
    return ['span', mergeAttributes(HTMLAttributes, { 
      'data-type': 'math-inline', 
      class: 'math-inline', 
      'data-src': src 
    }), src]
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span')
      dom.className = 'math-inline'
      dom.setAttribute('data-type', 'math-inline')
      dom.setAttribute('data-src', node.attrs.src)
      
      const renderMath = () => {
        const html = renderMathHTML(node.attrs.src, false)
        dom.innerHTML = html
      }
      
      // Try to render immediately, but also listen for KaTeX load
      renderMath()
      
      // If KaTeX is still loading, try again in a bit
      if (!getKatex()) {
        const checkKatex = setInterval(() => {
          if (getKatex()) {
            renderMath()
            clearInterval(checkKatex)
          }
        }, 100)
        setTimeout(() => clearInterval(checkKatex), 5000) // Stop trying after 5s
      }
      
      return { dom }
    }
  },
  addCommands() {
    return {
      setMathInline: (src = '') => ({ chain }) =>
        chain().insertContent({ type: this.name, attrs: { src } }).run(),
      editMathInline: () => ({ editor }) => {
        const node = editor.state.selection?.node
        const curr = node?.attrs?.src || ''
        const next = window.prompt('Inline math (TeX)', curr)
        if (next == null) return false
        return editor.chain().updateAttributes(this.name, { src: next }).run()
      }
    }
  },
  addInputRules() {
    return [
      new InputRule({
        find: /\$([^$\s][^$]*[^$\s])\$\s*$/,  // $...$ but not $$ and not empty
        handler: ({ state, range, match, chain }) => {
          const src = match[1].trim()
          if (src) {
            chain().deleteRange(range).insertContent({ type: this.name, attrs: { src } }).run()
          }
        },
      }),
      new InputRule({
        find: /\$([^$\s])\$\s*$/,  // Single character math like $x$
        handler: ({ state, range, match, chain }) => {
          const src = match[1]
          chain().deleteRange(range).insertContent({ type: this.name, attrs: { src } }).run()
        },
      }),
    ]
  },
})

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  defining: true,
  selectable: true,
  addAttributes() { return { src: { default: '' } } },
  parseHTML() { return [{ tag: 'div[data-type="math-block"]' }] },
  renderHTML({ HTMLAttributes }) {
    const { src = '' } = HTMLAttributes
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'math-block', 
      class: 'math-block', 
      'data-src': src 
    }), src]
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'math-block'
      dom.setAttribute('data-type', 'math-block')
      dom.setAttribute('data-src', node.attrs.src)
      
      const renderMath = () => {
        const html = renderMathHTML(node.attrs.src, true)
        dom.innerHTML = html
      }
      
      // Try to render immediately, but also listen for KaTeX load
      renderMath()
      
      // If KaTeX is still loading, try again in a bit
      if (!getKatex()) {
        const checkKatex = setInterval(() => {
          if (getKatex()) {
            renderMath()
            clearInterval(checkKatex)
          }
        }, 100)
        setTimeout(() => clearInterval(checkKatex), 5000) // Stop trying after 5s
      }
      
      return { dom }
    }
  },
  addCommands() {
    return {
      setMathBlock: (src = '') => ({ chain }) =>
        chain().insertContent({ type: this.name, attrs: { src } }).run(),
      editMathBlock: () => ({ editor }) => {
        const node = editor.state.selection?.node
        const curr = node?.attrs?.src || ''
        const next = window.prompt('Block math (TeX)', curr)
        if (next == null) return false
        return editor.chain().updateAttributes(this.name, { src: next }).run()
      }
    }
  },
  addInputRules() {
    return [
      new InputRule({
        find: /^\$\$\s*([\s\S]*?)\s*\$\$\s*$/m, // $$...$$ anywhere on line
        handler: ({ range, match, chain }) => {
          const src = match[1].trim()
          if (src) {
            chain().deleteRange(range).insertContent({ type: this.name, attrs: { src } }).run()
          }
        },
      }),
    ]
  },
})

export default [MathInline, MathBlock]
