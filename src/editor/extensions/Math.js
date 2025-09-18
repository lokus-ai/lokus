import { Node, mergeAttributes, InputRule } from '@tiptap/core'
import { sanitizeMathHtml, safeSetInnerHTML } from '../../core/security/index.js'

function getKatex() {
  try {
    const k = (typeof globalThis !== 'undefined' ? globalThis : window)?.katex
    if (!k) {
      return null
    }
    if (typeof k.renderToString !== 'function') {
      return null
    }
    return k.renderToString
  } catch (error) { 
    return null 
  }
}

function preprocessLatexSource(src) {
  if (!src || typeof src !== 'string') return src
  
  // Fix comment issues: ensure comments end with newlines
  let processed = src.replace(/(%[^\r\n]*?)(?=\s*[\$\}])/g, '$1\n')
  
  // Remove trailing whitespace that could interfere with parsing
  processed = processed.trim()
  
  // Handle empty or whitespace-only input
  if (!processed) return ''
  
  return processed
}

function renderMathHTML(src, displayMode) {
  try {
    const render = getKatex()
    if (render) {
      // Preprocess the LaTeX source to fix common issues
      const processedSrc = preprocessLatexSource(src)
      
      const rendered = render(processedSrc, { 
        throwOnError: false, 
        displayMode,
        errorColor: '#cc0000',
        strict: 'warn', // Show warnings but don't fail
        macros: {
          "\\f": "#1f(#2)"
        }
      })
      return rendered
    }
  } catch (error) {
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
        const src = node.attrs.src || ''
        // Debug log
        
        if (!src.trim()) {
          dom.textContent = '[empty]'
          dom.classList.add('math-empty')
          return
        }
        
        const html = renderMathHTML(src, false)
        // Debug log
        
        // For now, bypass sanitization for KaTeX since it's trusted content
        dom.innerHTML = html
        dom.classList.remove('math-empty')
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
          if (src && src.length > 0) {
            chain().deleteRange(range).insertContent({ type: this.name, attrs: { src } }).run()
          }
        },
      }),
      new InputRule({
        find: /\$([^$\s])\$\s*$/,  // Single character math like $x$
        handler: ({ state, range, match, chain }) => {
          const src = match[1].trim()
          if (src && src.length > 0) {
            chain().deleteRange(range).insertContent({ type: this.name, attrs: { src } }).run()
          }
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
        const src = node.attrs.src || ''
        // Debug log
        
        if (!src.trim()) {
          dom.textContent = '[Empty Math Block - Click to edit]'
          dom.classList.add('math-empty')
          return
        }
        
        const html = renderMathHTML(src, true)
        // Debug log
        
        // For now, bypass sanitization for KaTeX since it's trusted content
        // TODO: Create proper KaTeX-specific sanitization
        dom.innerHTML = html
        dom.classList.remove('math-empty')
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
        find: /\$\$\s*([\s\S]*?)\s*\$\$\s*$/, // $$...$$ at end of input
        handler: ({ range, match, chain }) => {
          const src = match[1].trim()
          if (src && src.length > 0) {
            chain().deleteRange(range).insertContent({ 
              type: this.name, 
              attrs: { src } 
            }).run()
          } else {
          }
        },
      }),
    ]
  },
})

export default [MathInline, MathBlock]