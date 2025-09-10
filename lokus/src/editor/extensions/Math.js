import { Node, mergeAttributes, InputRule } from '@tiptap/core'

function getKatex() {
  try {
    const k = (typeof globalThis !== 'undefined' ? globalThis : window)?.katex
    if (!k) return null
    return typeof k.renderToString === 'function' ? k.renderToString : null
  } catch { return null }
}

function renderMathHTML(src, displayMode) {
  try {
    const render = getKatex()
    if (render) return render(src, { throwOnError: false, displayMode })
  } catch {}
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
    const html = renderMathHTML(src, false)
    // Leaf node: return actual HTML/text content, not a content hole (0)
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'math-inline', class: 'math-inline', 'data-src': src }), html]
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
        find: /\$(.+?)\$$/, // $...$
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
    const html = renderMathHTML(src, true)
    // Leaf node: return rendered HTML/text content directly
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'math-block', class: 'math-block', 'data-src': src }), html]
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
        find: /^\$\$(.+)\$\$$/, // $$...$$ on a line
        handler: ({ range, match, chain }) => {
          const src = match[1]
          chain().deleteRange(range).insertContent({ type: this.name, attrs: { src } }).run()
        },
      }),
    ]
  },
})

export default [MathInline, MathBlock]
