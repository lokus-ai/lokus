/**
 * lokus-schema.js
 *
 * Explicit ProseMirror schema for the Lokus editor.
 *
 * This schema is the single source of truth for every node and mark type
 * the editor supports. It must stay in sync with the markdown pipeline
 * (lokus-md-pipeline.js) and the serialized PM JSON stored in contentByTab.
 *
 * Node names use camelCase (TipTap convention) because both the persisted
 * PM JSON and the lokus-md-pipeline serializer rely on those names.
 *
 * Node types (24): doc, text, paragraph, heading, blockquote, codeBlock,
 *   horizontalRule, hardBreak, image, bulletList, orderedList, listItem,
 *   taskList, taskItem, table, tableRow, tableHeader, tableCell,
 *   wikiLink, wikiLinkEmbed, canvasLink, callout, mermaid, inlineMath
 *
 * Mark types (8): bold, italic, code, link, strike, highlight,
 *   superscript, subscript
 */

import { Schema } from 'prosemirror-model'
import { tableNodes } from 'prosemirror-tables'

// ---------------------------------------------------------------------------
// Table node specs from prosemirror-tables
//
// We call tableNodes() to get the base specs, then:
//   - rename from snake_case to camelCase
//   - override cell content to 'block*' (allow empty cells, matching TipTap)
//   - add blockId attribute to table and tableRow
// ---------------------------------------------------------------------------

const pmTableSpecs = tableNodes({
  tableGroup: 'block',
  cellContent: 'block*', // TipTap extends cells to allow empty content
  cellAttributes: {},
})

// ---------------------------------------------------------------------------
// Node specs
// ---------------------------------------------------------------------------

const nodes = {
  // -- Document root ---------------------------------------------------------
  doc: {
    content: 'block+',
  },

  // -- Text ------------------------------------------------------------------
  text: {
    group: 'inline',
  },

  // -- Paragraph -------------------------------------------------------------
  paragraph: {
    group: 'block',
    content: 'inline*',
    attrs: {
      blockId: { default: null },
    },
    parseDOM: [{
      tag: 'p',
      getAttrs(dom) {
        return { blockId: dom.getAttribute('data-block-id') || null }
      },
    }],
    toDOM(node) {
      const attrs = {}
      if (node.attrs.blockId) attrs['data-block-id'] = node.attrs.blockId
      return ['p', attrs, 0]
    },
  },

  // -- Heading ---------------------------------------------------------------
  heading: {
    group: 'block',
    content: 'inline*',
    attrs: {
      level: { default: 1 },
      blockId: { default: null },
    },
    defining: true,
    parseDOM: [1, 2, 3, 4, 5, 6].map(level => ({
      tag: `h${level}`,
      attrs: { level },
      getAttrs(dom) {
        return { level, blockId: dom.getAttribute('data-block-id') || null }
      },
    })),
    toDOM(node) {
      const attrs = {}
      if (node.attrs.blockId) attrs['data-block-id'] = node.attrs.blockId
      return [`h${node.attrs.level}`, attrs, 0]
    },
  },

  // -- Blockquote ------------------------------------------------------------
  blockquote: {
    group: 'block',
    content: 'block+',
    defining: true,
    attrs: {
      blockId: { default: null },
    },
    parseDOM: [{
      tag: 'blockquote',
      getAttrs(dom) {
        return { blockId: dom.getAttribute('data-block-id') || null }
      },
    }],
    toDOM(node) {
      const attrs = {}
      if (node.attrs.blockId) attrs['data-block-id'] = node.attrs.blockId
      return ['blockquote', attrs, 0]
    },
  },

  // -- Code block ------------------------------------------------------------
  codeBlock: {
    group: 'block',
    content: 'text*',
    marks: '',
    code: true,
    defining: true,
    isolating: true,
    attrs: {
      language: { default: null },
      blockId: { default: null },
    },
    parseDOM: [{
      tag: 'pre',
      preserveWhitespace: 'full',
      getAttrs(dom) {
        const codeEl = dom.querySelector('code')
        let language = null
        if (codeEl) {
          const cls = codeEl.className || ''
          const match = cls.match(/language-(\S+)/)
          if (match) language = match[1]
        }
        return { language, blockId: dom.getAttribute('data-block-id') || null }
      },
    }],
    toDOM(node) {
      const preAttrs = {}
      if (node.attrs.blockId) preAttrs['data-block-id'] = node.attrs.blockId
      const codeAttrs = {}
      if (node.attrs.language) codeAttrs.class = `language-${node.attrs.language}`
      return ['pre', preAttrs, ['code', codeAttrs, 0]]
    },
  },

  // -- Horizontal rule -------------------------------------------------------
  horizontalRule: {
    group: 'block',
    parseDOM: [{ tag: 'hr' }],
    toDOM() {
      return ['hr']
    },
  },

  // -- Hard break ------------------------------------------------------------
  hardBreak: {
    group: 'inline',
    inline: true,
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM() {
      return ['br']
    },
  },

  // -- Image -----------------------------------------------------------------
  image: {
    group: 'inline',
    inline: true,
    attrs: {
      src: { default: '' },
      alt: { default: '' },
      title: { default: null },
    },
    draggable: true,
    parseDOM: [{
      tag: 'img[src]',
      getAttrs(dom) {
        return {
          src: dom.getAttribute('src') || '',
          alt: dom.getAttribute('alt') || '',
          title: dom.getAttribute('title') || null,
        }
      },
    }],
    toDOM(node) {
      const { src, alt, title } = node.attrs
      const attrs = { src, alt }
      if (title) attrs.title = title
      return ['img', attrs]
    },
  },

  // -- Bullet list -----------------------------------------------------------
  bulletList: {
    group: 'block',
    content: 'listItem+',
    parseDOM: [{ tag: 'ul' }],
    toDOM() {
      return ['ul', 0]
    },
  },

  // -- Ordered list ----------------------------------------------------------
  orderedList: {
    group: 'block',
    content: 'listItem+',
    attrs: {
      order: { default: 1 },
    },
    parseDOM: [{
      tag: 'ol',
      getAttrs(dom) {
        return { order: dom.hasAttribute('start') ? +dom.getAttribute('start') : 1 }
      },
    }],
    toDOM(node) {
      return node.attrs.order === 1
        ? ['ol', 0]
        : ['ol', { start: node.attrs.order }, 0]
    },
  },

  // -- List item -------------------------------------------------------------
  listItem: {
    content: 'paragraph block*',
    attrs: {
      blockId: { default: null },
    },
    defining: true,
    parseDOM: [{
      tag: 'li',
      // Avoid matching taskItem <li> elements
      getAttrs(dom) {
        if (dom.getAttribute('data-type') === 'taskItem') return false
        return { blockId: dom.getAttribute('data-block-id') || null }
      },
    }],
    toDOM(node) {
      const attrs = {}
      if (node.attrs.blockId) attrs['data-block-id'] = node.attrs.blockId
      return ['li', attrs, 0]
    },
  },

  // -- Task list -------------------------------------------------------------
  taskList: {
    group: 'block',
    content: 'taskItem+',
    parseDOM: [{
      tag: 'ul[data-type="taskList"]',
    }],
    toDOM() {
      return ['ul', { 'data-type': 'taskList' }, 0]
    },
  },

  // -- Task item -------------------------------------------------------------
  taskItem: {
    content: 'paragraph block*',
    defining: true,
    attrs: {
      checked: { default: false },
      taskState: { default: null },
      blockId: { default: null },
    },
    parseDOM: [{
      tag: 'li[data-type="taskItem"]',
      priority: 51,
      getAttrs(dom) {
        return {
          checked: dom.getAttribute('data-checked') === 'true',
          taskState: dom.getAttribute('data-task-state') || null,
          blockId: dom.getAttribute('data-block-id') || null,
        }
      },
    }],
    toDOM(node) {
      const attrs = {
        'data-type': 'taskItem',
        'data-checked': node.attrs.checked,
      }
      if (node.attrs.taskState) attrs['data-task-state'] = node.attrs.taskState
      if (node.attrs.blockId) attrs['data-block-id'] = node.attrs.blockId
      return [
        'li',
        attrs,
        [
          'label',
          ['input', { type: 'checkbox', checked: node.attrs.checked ? 'checked' : null }],
          ['span'],
        ],
        ['div', 0],
      ]
    },
  },

  // -- Table (from prosemirror-tables, renamed to camelCase) ------------------
  table: {
    ...pmTableSpecs.table,
    // Override content to use camelCase row name
    content: 'tableRow+',
    attrs: {
      ...(pmTableSpecs.table.attrs || {}),
      blockId: { default: null },
    },
    parseDOM: [{
      tag: 'table',
      getAttrs(dom) {
        return { blockId: dom.getAttribute('data-block-id') || null }
      },
    }],
    toDOM(node) {
      const attrs = {}
      if (node.attrs.blockId) attrs['data-block-id'] = node.attrs.blockId
      return ['table', attrs, ['tbody', 0]]
    },
  },

  tableRow: {
    ...pmTableSpecs.table_row,
    // Override content to use camelCase cell/header names
    content: '(tableCell | tableHeader)*',
    attrs: {
      ...(pmTableSpecs.table_row.attrs || {}),
      blockId: { default: null },
    },
    parseDOM: [{
      tag: 'tr',
      getAttrs(dom) {
        return { blockId: dom.getAttribute('data-block-id') || null }
      },
    }],
    toDOM(node) {
      const attrs = {}
      if (node.attrs.blockId) attrs['data-block-id'] = node.attrs.blockId
      return ['tr', attrs, 0]
    },
  },

  tableHeader: {
    ...pmTableSpecs.table_header,
    // Content already set to 'block*' via cellContent option
    attrs: {
      ...(pmTableSpecs.table_header.attrs || {}),
      blockId: { default: null },
    },
    parseDOM: [{
      tag: 'th',
      getAttrs(dom) {
        const colspan = Number(dom.getAttribute('colspan') || 1)
        const rowspan = Number(dom.getAttribute('rowspan') || 1)
        const colwidth = dom.getAttribute('data-colwidth')
        return {
          colspan,
          rowspan,
          colwidth: colwidth ? colwidth.split(',').map(Number) : null,
          blockId: dom.getAttribute('data-block-id') || null,
        }
      },
    }],
    toDOM(node) {
      const attrs = {}
      if (node.attrs.colspan !== 1) attrs.colspan = node.attrs.colspan
      if (node.attrs.rowspan !== 1) attrs.rowspan = node.attrs.rowspan
      if (node.attrs.colwidth) attrs['data-colwidth'] = node.attrs.colwidth.join(',')
      if (node.attrs.blockId) attrs['data-block-id'] = node.attrs.blockId
      return ['th', attrs, 0]
    },
  },

  tableCell: {
    ...pmTableSpecs.table_cell,
    // Content already set to 'block*' via cellContent option
    attrs: {
      ...(pmTableSpecs.table_cell.attrs || {}),
      blockId: { default: null },
    },
    parseDOM: [{
      tag: 'td',
      getAttrs(dom) {
        const colspan = Number(dom.getAttribute('colspan') || 1)
        const rowspan = Number(dom.getAttribute('rowspan') || 1)
        const colwidth = dom.getAttribute('data-colwidth')
        return {
          colspan,
          rowspan,
          colwidth: colwidth ? colwidth.split(',').map(Number) : null,
          blockId: dom.getAttribute('data-block-id') || null,
        }
      },
    }],
    toDOM(node) {
      const attrs = {}
      if (node.attrs.colspan !== 1) attrs.colspan = node.attrs.colspan
      if (node.attrs.rowspan !== 1) attrs.rowspan = node.attrs.rowspan
      if (node.attrs.colwidth) attrs['data-colwidth'] = node.attrs.colwidth.join(',')
      if (node.attrs.blockId) attrs['data-block-id'] = node.attrs.blockId
      return ['td', attrs, 0]
    },
  },

  // -- Wiki link (inline atom) -----------------------------------------------
  wikiLink: {
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    attrs: {
      id: { default: '' },
      target: { default: '' },
      alt: { default: '' },
      embed: { default: false },
      href: { default: '' },
      src: { default: '' },
    },
    parseDOM: [{
      tag: 'span[data-type="wiki-link"]',
      getAttrs(dom) {
        return {
          id: dom.getAttribute('data-id') || '',
          target: dom.getAttribute('target') || dom.textContent || '',
          alt: dom.textContent || '',
          embed: false,
          href: dom.getAttribute('href') || '',
          src: '',
        }
      },
    }, {
      tag: 'a[data-type="wiki-link"]',
      getAttrs(dom) {
        return {
          id: dom.getAttribute('data-id') || '',
          target: dom.getAttribute('target') || dom.textContent || '',
          alt: dom.textContent || '',
          embed: false,
          href: dom.getAttribute('href') || '',
          src: '',
        }
      },
    }, {
      tag: 'img[data-type="wiki-link"]',
      getAttrs(dom) {
        return {
          id: dom.getAttribute('data-id') || '',
          target: dom.getAttribute('alt') || '',
          alt: dom.getAttribute('alt') || '',
          embed: true,
          href: '',
          src: dom.getAttribute('src') || '',
        }
      },
    }],
    toDOM(node) {
      const { embed, alt, target, href, src } = node.attrs
      if (embed && src) {
        return ['img', {
          'data-type': 'wiki-link',
          class: 'wiki-image',
          alt: alt || target,
          src,
        }]
      }
      const label = alt || target
      return ['a', {
        'data-type': 'wiki-link',
        class: 'wiki-link',
        href: href || target,
      }, label]
    },
  },

  // -- Wiki link embed (block atom) ------------------------------------------
  wikiLinkEmbed: {
    group: 'block',
    atom: true,
    draggable: true,
    attrs: {
      id: { default: '' },
      filePath: { default: '' },
      blockId: { default: '' },
      content: { default: '' },
      fileName: { default: '' },
      loading: { default: false },
      error: { default: null },
    },
    parseDOM: [{
      tag: 'div[data-type="wiki-embed"]',
      getAttrs(dom) {
        return {
          id: dom.getAttribute('data-id') || '',
          filePath: dom.getAttribute('data-file-path') || '',
          blockId: dom.getAttribute('data-block-id') || '',
          content: dom.querySelector('.wiki-embed-content')?.textContent || '',
          fileName: dom.getAttribute('data-file-name') || '',
          loading: false,
          error: null,
        }
      },
    }],
    toDOM(node) {
      const { fileName, blockId, content } = node.attrs
      return [
        'div',
        {
          'data-type': 'wiki-embed',
          class: 'wiki-embed-block',
          'data-file-name': fileName,
          'data-block-id': blockId,
          'data-file-path': node.attrs.filePath,
        },
        [
          'div',
          { class: 'wiki-embed-header' },
          `![[${fileName}^${blockId}]]`,
        ],
        [
          'div',
          { class: 'wiki-embed-content' },
          content || 'Empty block',
        ],
      ]
    },
  },

  // -- Canvas link (inline atom) ---------------------------------------------
  canvasLink: {
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    attrs: {
      id: { default: '' },
      canvasName: { default: '' },
      canvasPath: { default: '' },
      thumbnailUrl: { default: '' },
      exists: { default: false },
    },
    parseDOM: [{
      tag: 'span[data-type="canvas-link"]',
      getAttrs(dom) {
        return {
          id: '',
          canvasName: dom.textContent?.trim() || '',
          canvasPath: dom.getAttribute('href') || '',
          thumbnailUrl: '',
          exists: !dom.classList.contains('canvas-link-broken'),
        }
      },
    }, {
      tag: 'a[data-type="canvas-link"]',
      getAttrs(dom) {
        return {
          id: '',
          canvasName: dom.textContent?.trim() || '',
          canvasPath: dom.getAttribute('href') || '',
          thumbnailUrl: '',
          exists: !dom.classList.contains('canvas-link-broken'),
        }
      },
    }],
    toDOM(node) {
      const { canvasName, canvasPath, exists } = node.attrs
      const className = exists ? 'canvas-link' : 'canvas-link canvas-link-broken'
      return [
        'span',
        {
          'data-type': 'canvas-link',
          class: className,
          href: canvasPath || canvasName,
          style: 'cursor: pointer',
        },
        canvasName,
      ]
    },
  },

  // -- Callout (block with children) -----------------------------------------
  callout: {
    group: 'block',
    content: 'block+',
    defining: true,
    attrs: {
      type: { default: 'note' },
      title: { default: null },
      collapsed: { default: false },
      blockId: { default: null },
    },
    parseDOM: [{
      tag: 'div[data-callout-type]',
      getAttrs(dom) {
        return {
          type: dom.getAttribute('data-callout-type') || 'note',
          title: dom.getAttribute('data-callout-title') || null,
          collapsed: dom.getAttribute('data-collapsed') === 'true',
          blockId: dom.getAttribute('data-block-id') || null,
        }
      },
    }],
    toDOM(node) {
      const { type, title, collapsed, blockId } = node.attrs
      const attrs = {
        class: `callout callout-${type}`,
        'data-callout-type': type,
        'data-collapsed': collapsed ? 'true' : 'false',
      }
      if (title) attrs['data-callout-title'] = title
      if (blockId) attrs['data-block-id'] = blockId
      return [
        'div',
        attrs,
        ['div', { class: 'callout-content' }, 0],
      ]
    },
  },

  // -- Mermaid diagram (block node) ------------------------------------------
  mermaid: {
    group: 'block',
    content: 'text*',
    code: true,
    atom: false,
    selectable: true,
    isolating: true,
    attrs: {
      code: { default: '' },
      theme: { default: 'default' },
      updatedAt: { default: 0 },
      blockId: { default: null },
    },
    parseDOM: [{
      tag: 'mermaid-block',
      getAttrs(dom) {
        let code = ''
        const dataCode = dom.getAttribute('data-code')
        if (dataCode) {
          try { code = atob(dataCode) } catch { code = '' }
        } else {
          const codeEl = dom.querySelector('code')
          code = codeEl ? codeEl.textContent : (dom.getAttribute('code') || '')
        }
        return {
          code,
          theme: dom.getAttribute('theme') || 'default',
          updatedAt: Number(dom.getAttribute('updatedat')) || 0,
          blockId: dom.getAttribute('data-block-id') || null,
        }
      },
    }, {
      tag: 'pre',
      preserveWhitespace: 'full',
      getAttrs(dom) {
        const codeEl = dom.querySelector('code.language-mermaid')
        if (!codeEl) return false
        return {
          code: codeEl.textContent || '',
          theme: 'default',
          updatedAt: 0,
          blockId: null,
        }
      },
    }],
    toDOM(node) {
      const encodedCode = node.attrs.code ? btoa(node.attrs.code) : ''
      const attrs = {
        'data-code': encodedCode,
        theme: node.attrs.theme || 'default',
        updatedat: String(node.attrs.updatedAt || 0),
      }
      if (node.attrs.blockId) attrs['data-block-id'] = node.attrs.blockId
      return ['mermaid-block', attrs]
    },
  },

  // -- Inline math -----------------------------------------------------------
  inlineMath: {
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    attrs: {
      latex: { default: '' },
      display: { default: 'no' },
      evaluate: { default: 'no' },
    },
    parseDOM: [{
      tag: 'span[data-type="inlineMath"]',
      getAttrs(dom) {
        return {
          latex: dom.getAttribute('data-latex') || '',
          display: dom.getAttribute('data-display') || 'no',
          evaluate: dom.getAttribute('data-evaluate') || 'no',
        }
      },
    }],
    toDOM(node) {
      const { latex, display, evaluate } = node.attrs
      const delim = display === 'yes' ? '$$' : '$'
      return [
        'span',
        {
          'data-type': 'inlineMath',
          'data-latex': latex,
          'data-display': display,
          'data-evaluate': evaluate,
        },
        `${delim}${latex}${delim}`,
      ]
    },
  },
}

// ---------------------------------------------------------------------------
// Mark specs
// ---------------------------------------------------------------------------

const marks = {
  // -- Bold ------------------------------------------------------------------
  bold: {
    parseDOM: [
      { tag: 'strong' },
      { tag: 'b', getAttrs: dom => dom.style.fontWeight !== 'normal' && null },
      {
        style: 'font-weight',
        getAttrs: value =>
          /^(bold(er)?|[5-9]\d\d)$/.test(value) && null,
      },
    ],
    toDOM() {
      return ['strong', 0]
    },
  },

  // -- Italic ----------------------------------------------------------------
  italic: {
    parseDOM: [
      { tag: 'i' },
      { tag: 'em' },
      { style: 'font-style=italic' },
    ],
    toDOM() {
      return ['em', 0]
    },
  },

  // -- Code ------------------------------------------------------------------
  code: {
    inclusive: false,
    parseDOM: [{ tag: 'code' }],
    toDOM() {
      return ['code', 0]
    },
  },

  // -- Link ------------------------------------------------------------------
  link: {
    attrs: {
      href: { default: '' },
      title: { default: null },
      target: { default: null },
      rel: { default: null },
      class: { default: null },
    },
    inclusive: false,
    parseDOM: [{
      tag: 'a[href]',
      getAttrs(dom) {
        return {
          href: dom.getAttribute('href') || '',
          title: dom.getAttribute('title') || null,
          target: dom.getAttribute('target') || null,
          rel: dom.getAttribute('rel') || null,
          class: dom.getAttribute('class') || null,
        }
      },
    }],
    toDOM(node) {
      const { href, title, target, rel } = node.attrs
      const attrs = { href }
      if (title) attrs.title = title
      if (target) attrs.target = target
      if (rel) attrs.rel = rel
      return ['a', attrs, 0]
    },
  },

  // -- Strikethrough ---------------------------------------------------------
  strike: {
    parseDOM: [
      { tag: 's' },
      { tag: 'del' },
      { tag: 'strike' },
      {
        style: 'text-decoration',
        getAttrs: value => value === 'line-through' && null,
      },
    ],
    toDOM() {
      return ['s', 0]
    },
  },

  // -- Highlight (==text==) --------------------------------------------------
  highlight: {
    attrs: {
      color: { default: null },
    },
    parseDOM: [{
      tag: 'mark',
      getAttrs(dom) {
        return { color: dom.getAttribute('data-color') || null }
      },
    }],
    toDOM(node) {
      const attrs = {}
      if (node.attrs.color) {
        attrs['data-color'] = node.attrs.color
        attrs.style = `background-color: ${node.attrs.color}`
      }
      return ['mark', attrs, 0]
    },
  },

  // -- Superscript (^text^) --------------------------------------------------
  superscript: {
    inclusive: false,
    parseDOM: [
      { tag: 'sup' },
      {
        style: 'vertical-align',
        getAttrs: value => value === 'super' && null,
      },
    ],
    toDOM() {
      return ['sup', 0]
    },
  },

  // -- Subscript (~text~) ----------------------------------------------------
  subscript: {
    inclusive: false,
    parseDOM: [
      { tag: 'sub' },
      {
        style: 'vertical-align',
        getAttrs: value => value === 'sub' && null,
      },
    ],
    toDOM() {
      return ['sub', 0]
    },
  },
}

// ---------------------------------------------------------------------------
// Create and export the schema
// ---------------------------------------------------------------------------

export const lokusSchema = new Schema({ nodes, marks })

export default lokusSchema
