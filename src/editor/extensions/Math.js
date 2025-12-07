import { Node, mergeAttributes, InputRule } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { sanitizeMathHtml } from '../../core/security/index.js'
import katex from 'katex'

function preprocessLatexSource(src) {
  if (!src || typeof src !== 'string') return src
  let processed = src.replace(/(%[^\r\n]*?)(?=\s*[\$\}])/g, '$1\n')
  processed = processed.trim()
  if (!processed) return ''
  return processed
}

function renderMathHTML(src, displayMode) {
  try {
    const processedSrc = preprocessLatexSource(src)
    let rendered = katex.renderToString(processedSrc, {
      throwOnError: false,
      displayMode,
      errorColor: '#cc0000',
      strict: 'warn',
      output: 'html', // Output only HTML to prevent MathML duplication
      macros: { "\\f": "#1f(#2)" }
    })

    // Extra safety: remove any MathML blocks if they were generated
    // This prevents duplication where hidden MathML becomes visible text
    rendered = rendered.replace(/<math[\s\S]*?<\/math>/gi, '')

    return rendered
  } catch (error) {
    console.error('KaTeX rendering error:', error)
  }
  return displayMode ? `$$${src}$$` : `$${src}$`
}

// Regex for finding math in text
// Inline: $...$ (not preceded by $, not followed by $, content not empty)
const INLINE_MATH_REGEX = /(?<!\$)\$(?![\s$])([^$]*?)(?<![\s$])\$(?!\$)/g
// Block: $$...$$
const BLOCK_MATH_REGEX = /\$\$([\s\S]*?)\$\$/g

// Plugin to auto-compile math text to nodes when cursor leaves
const MathAutoCompilePlugin = new Plugin({
  key: new PluginKey('math-auto-compile'),
  appendTransaction: (transactions, oldState, newState) => {
    const docChanged = transactions.some(tr => tr.docChanged)
    const selectionChanged = transactions.some(tr => tr.selectionSet)

    if (!docChanged && !selectionChanged) return

    const { selection, doc } = newState
    const { from, to } = selection

    // Check if we are inside a math block (don't compile if we are)
    const isCursorInside = (start, end) => {
      return (from >= start && from <= end) || (to >= start && to <= end)
    }

    let tr = null

    // Helper to schedule replacement
    const replaceWithNode = (start, end, content, isBlock) => {
      if (!tr) tr = newState.tr
      const type = isBlock ? newState.schema.nodes.mathBlock : newState.schema.nodes.mathInline
      if (type) {
        tr.replaceWith(start, end, type.create({ src: content }))
      }
    }

    // Scan text nodes for math patterns
    // Optimization: We scan the current text block.

    doc.descendants((node, pos) => {
      if (!node.isText) return

      const text = node.text
      if (!text) return

      // Check Block Math $$...$$
      let match
      // Reset regex index
      BLOCK_MATH_REGEX.lastIndex = 0
      while ((match = BLOCK_MATH_REGEX.exec(text)) !== null) {
        const start = pos + match.index
        const end = start + match[0].length

        // If cursor is NOT inside, compile it
        if (!isCursorInside(start, end)) {
          replaceWithNode(start, end, match[1], true)
        }
      }

      // Check Inline Math $...$
      INLINE_MATH_REGEX.lastIndex = 0
      while ((match = INLINE_MATH_REGEX.exec(text)) !== null) {
        const start = pos + match.index
        const end = start + match[0].length

        // If cursor is NOT inside, compile it
        if (!isCursorInside(start, end)) {
          replaceWithNode(start, end, match[1], false)
        }
      }
    })

    return tr
  }
})

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: '',
        parseHTML: element => {
          // 1. Try data-src (our own output)
          if (element.hasAttribute('data-src')) {
            return element.getAttribute('data-src')
          }
          // 2. Try to find annotation tag (markdown-it-texmath output)
          const annotation = element.querySelector('annotation')
          if (annotation) {
            return annotation.textContent
          }
          // 3. Fallback to data-latex
          return element.getAttribute('data-latex')
        }
      }
    }
  },

  parseHTML() {
    return [
      { tag: 'span[data-type="math-inline"]' },
      { tag: 'eq' } // markdown-it-texmath inline tag
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-type': 'math-inline',
      class: 'math-inline',
      'data-src': node.attrs.src
    })]
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('span')
      dom.className = 'math-inline'
      dom.setAttribute('data-type', 'math-inline')
      dom.setAttribute('data-src', node.attrs.src)
      dom.style.cursor = 'pointer'

      const renderMath = () => {
        const src = node.attrs.src || ''
        if (!src.trim()) {
          dom.textContent = '[empty]'
          dom.classList.add('math-empty')
          return
        }
        const html = renderMathHTML(src, false)
        dom.innerHTML = sanitizeMathHtml(html)
        dom.classList.remove('math-empty')
      }

      renderMath()

      // Click to Unfurl: Replace node with text
      dom.addEventListener('click', (e) => {
        if (typeof getPos === 'function') {
          e.preventDefault()
          const pos = getPos()
          const src = node.attrs.src

          // Replace node with text: $src$
          editor.chain()
            .focus()
            .deleteRange({ from: pos, to: pos + 1 })
            .insertContentAt(pos, `$${src}$`)
            .run()
        }
      })

      return { dom }
    }
  },

  addInputRules() {
    return [
      new InputRule({
        find: INLINE_MATH_REGEX,
        handler: ({ state, range, match, chain }) => {
          const src = match[1]
          if (src && src.trim()) {
            chain().deleteRange(range).insertContent({ type: this.name, attrs: { src } }).run()
          }
        },
      })
    ]
  },

  addProseMirrorPlugins() {
    return [MathAutoCompilePlugin]
  }
})

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  defining: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: '',
        parseHTML: element => {
          // 1. Try data-src (our own output)
          if (element.hasAttribute('data-src')) {
            return element.getAttribute('data-src')
          }
          // 2. Try to find annotation tag (markdown-it-texmath output)
          const annotation = element.querySelector('annotation')
          if (annotation) {
            return annotation.textContent
          }
          // 3. Fallback to data-latex
          return element.getAttribute('data-latex')
        }
      }
    }
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="math-block"]' },
      { tag: 'eqn' }, // markdown-it-texmath block tag (sometimes inside section)
      { tag: 'section', getAttrs: node => node.querySelector('eqn') ? {} : false }
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'math-block',
      class: 'math-block',
      'data-src': node.attrs.src
    })]
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div')
      dom.className = 'math-block'
      dom.setAttribute('data-type', 'math-block')
      dom.setAttribute('data-src', node.attrs.src)
      dom.style.cursor = 'pointer'

      const renderMath = () => {
        const src = node.attrs.src || ''
        if (!src.trim()) {
          dom.textContent = '[Empty Math Block]'
          dom.classList.add('math-empty')
          return
        }
        const html = renderMathHTML(src, true)
        dom.innerHTML = sanitizeMathHtml(html)
        dom.classList.remove('math-empty')
      }

      renderMath()

      // Click to Unfurl
      dom.addEventListener('click', (e) => {
        if (typeof getPos === 'function') {
          e.preventDefault()
          const pos = getPos()
          const src = node.attrs.src

          // Replace node with text: $$src$$
          editor.chain()
            .focus()
            .deleteRange({ from: pos, to: pos + 1 })
            .insertContentAt(pos, `$$${src}$$`)
            .run()
        }
      })

      return { dom }
    }
  },

  addInputRules() {
    return [
      new InputRule({
        find: BLOCK_MATH_REGEX,
        handler: ({ range, match, chain }) => {
          const src = match[1]
          if (src && src.trim()) {
            chain().deleteRange(range).insertContent({ type: this.name, attrs: { src } }).run()
          }
        },
      })
    ]
  },
})

export default [MathInline, MathBlock]