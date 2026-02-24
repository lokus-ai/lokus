/**
 * lokus-md-pipeline.js
 *
 * Direct Markdown <-> ProseMirror pipeline for Lokus.
 *
 * Replaces the old md→HTML→ProseMirror / ProseMirror→HTML→md round-trip with
 * a lossless md→ProseMirror / ProseMirror→md pipeline that preserves all
 * Lokus-specific syntax (wiki links, callouts, mermaid, math, block IDs …).
 *
 * Exports:
 *   createLokusParser(schema)     → MarkdownParser
 *   createLokusSerializer()       → MarkdownSerializer
 *
 * Usage:
 *   import { createLokusParser, createLokusSerializer } from '../core/markdown/lokus-md-pipeline'
 *
 *   const parser     = createLokusParser(editor.schema)
 *   const serializer = createLokusSerializer()
 *
 *   const doc      = parser.parse(markdownString)           // md → PM doc
 *   const markdown = serializer.serialize(editor.state.doc) // PM doc → md
 */

import MarkdownIt from 'markdown-it'
import markdownItMark from 'markdown-it-mark'
import { MarkdownParser, MarkdownSerializer } from 'prosemirror-markdown'

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Prefix every line of `text` with `> ` (for blockquote / callout body).
 * Empty lines get a bare `>` so the output stays valid CommonMark.
 */
function prefixBlockquote(text) {
  return text
    .split('\n')
    .map(line => (line.trim() === '' ? '>' : `> ${line}`))
    .join('\n')
}

// ---------------------------------------------------------------------------
// markdown-it plugin: superscript  ^text^
// (Inline rule — no external dependency needed)
// ---------------------------------------------------------------------------

function markdownItSup(md) {
  md.inline.ruler.after('emphasis', 'superscript', (state, silent) => {
    const src = state.src
    const pos = state.pos
    const max = state.posMax

    if (src.charCodeAt(pos) !== 0x5e /* ^ */) return false

    const start = pos + 1
    if (start >= max) return false

    // Find closing ^ (no newlines allowed inside)
    let end = src.indexOf('^', start)
    if (end === -1 || end === start) return false

    const content = src.slice(start, end)
    if (content.includes('\n')) return false

    // In silent (validation) mode, just confirm we can match
    if (silent) return true

    const tokenOpen = state.push('sup_open', 'sup', 1)
    tokenOpen.markup = '^'
    const tokenContent = state.push('text', '', 0)
    tokenContent.content = content
    const tokenClose = state.push('sup_close', 'sup', -1)
    tokenClose.markup = '^'

    state.pos = end + 1
    return true
  })
}

// ---------------------------------------------------------------------------
// markdown-it plugin: subscript  ~text~
// (Inline rule — no external dependency needed)
// ---------------------------------------------------------------------------

function markdownItSub(md) {
  md.inline.ruler.after('emphasis', 'subscript', (state, silent) => {
    const src = state.src
    const pos = state.pos
    const max = state.posMax

    if (src.charCodeAt(pos) !== 0x7e /* ~ */) return false

    const start = pos + 1
    if (start >= max) return false

    let end = src.indexOf('~', start)
    if (end === -1 || end === start) return false

    const content = src.slice(start, end)
    if (content.includes('\n')) return false

    // In silent (validation) mode, just confirm we can match
    if (silent) return true

    const tokenOpen = state.push('sub_open', 'sub', 1)
    tokenOpen.markup = '~'
    const tokenContent = state.push('text', '', 0)
    tokenContent.content = content
    const tokenClose = state.push('sub_close', 'sub', -1)
    tokenClose.markup = '~'

    state.pos = end + 1
    return true
  })
}

// ---------------------------------------------------------------------------
// markdown-it plugin: canvas links   ![[name.canvas]]
// (Must be registered BEFORE the general wiki-link plugin so it takes priority)
// ---------------------------------------------------------------------------

function markdownItCanvasLink(md) {
  md.inline.ruler.push('canvas_link', (state, silent) => {
    const src = state.src.slice(state.pos)

    if (!src.startsWith('![[')) return false

    const match = src.match(/^!\[\[([^\]]+?\.canvas)\]\]/)
    if (!match) return false

    if (!silent) {
      const token = state.push('canvas_link', '', 0)
      token.attrSet('canvasName', match[1].replace(/\.canvas$/i, '').trim())
      token.markup = match[0]
      token.content = match[1]
    }

    state.pos += match[0].length
    return true
  })
}

// ---------------------------------------------------------------------------
// markdown-it plugin: wiki-link embeds  ![[file^blockId]] / ![[file#heading]]
// (Block-level — must come before wiki_link inline rule)
// ---------------------------------------------------------------------------

function markdownItWikiLinkEmbed(md) {
  md.block.ruler.before('paragraph', 'wiki_link_embed', (state, startLine, endLine, silent) => {
    const pos = state.bMarks[startLine] + state.tShift[startLine]
    const lineText = state.src.slice(pos, state.eMarks[startLine])

    const match = lineText.match(/^!\[\[([^\]#^]+?)([#^])([^\]]+?)\]\]\s*$/)
    if (!match) return false

    if (!silent) {
      const token = state.push('wiki_link_embed', '', 0)
      token.attrSet('fileName', match[1].trim())
      token.attrSet('separator', match[2])
      token.attrSet('blockId', match[3].trim())
      token.map = [startLine, startLine + 1]
      token.markup = lineText
    }

    state.line = startLine + 1
    return true
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })
}

// ---------------------------------------------------------------------------
// markdown-it plugin: inline wiki links  [[target]] / [[target|alias]] / ![[target]]
// ---------------------------------------------------------------------------

function markdownItWikiLink(md) {
  md.inline.ruler.push('wiki_link', (state, silent) => {
    const src = state.src.slice(state.pos)

    // Detect embed prefix
    const isEmbed = src.startsWith('![[')
    const startStr = isEmbed ? '![[' : '[['
    if (!src.startsWith(startStr)) return false

    // Match full [[...]]
    const inner = isEmbed ? src.slice(3) : src.slice(2)
    const closeIdx = inner.indexOf(']]')
    if (closeIdx === -1) return false

    const raw = inner.slice(0, closeIdx)
    // Don't match if it looks like a standard markdown image/link
    if (!isEmbed && src[2] === '[') return false  // skip [[[ which is ambiguous

    if (!silent) {
      const target = raw.trim()
      const pipeIdx = target.indexOf('|')
      const resolvedTarget = pipeIdx !== -1 ? target.slice(0, pipeIdx).trim() : target
      const alt = pipeIdx !== -1 ? target.slice(pipeIdx + 1).trim() : ''

      const token = state.push('wiki_link', '', 0)
      token.attrSet('target', resolvedTarget)
      token.attrSet('alt', alt)
      token.attrSet('embed', isEmbed ? 'true' : 'false')
      token.markup = src.slice(0, isEmbed ? closeIdx + 5 : closeIdx + 4)
      token.content = raw
    }

    state.pos += (isEmbed ? 3 : 2) + closeIdx + 2
    return true
  })
}

// ---------------------------------------------------------------------------
// markdown-it plugin: callouts  > [!type]- Title\n> content
// ---------------------------------------------------------------------------

function markdownItCallout(md) {
  // We post-process blockquote tokens and convert ones that start with [!type]
  md.core.ruler.push('callout', state => {
    const tokens = state.tokens
    let i = 0
    while (i < tokens.length) {
      if (tokens[i].type !== 'blockquote_open') {
        i++
        continue
      }

      // Find matching blockquote_close
      let closeIdx = i + 1
      let depth = 1
      while (closeIdx < tokens.length && depth > 0) {
        if (tokens[closeIdx].type === 'blockquote_open') depth++
        if (tokens[closeIdx].type === 'blockquote_close') depth--
        closeIdx++
      }
      closeIdx-- // points to blockquote_close

      // Look for the first inline token inside the blockquote
      // The structure is: blockquote_open, paragraph_open, inline, paragraph_close, ...
      let inlineToken = null
      for (let j = i + 1; j < closeIdx; j++) {
        if (tokens[j].type === 'inline') {
          inlineToken = tokens[j]
          break
        }
      }

      if (!inlineToken) {
        i++
        continue
      }

      // Check if the first inline starts with [!type]
      const headerMatch = inlineToken.content.match(/^\[!(\w+)\](-?)\s*(.*)$/)
      if (!headerMatch) {
        i++
        continue
      }

      const [, calloutType, collapsedFlag, titleText] = headerMatch
      const collapsed = collapsedFlag === '-'
      const title = titleText.trim() || null

      // Collect the inner content tokens (everything between the first paragraph and blockquote_close)
      // Skip the first paragraph (which contains the header line)
      let contentStart = -1
      for (let j = i + 1; j < closeIdx; j++) {
        if (tokens[j].type === 'paragraph_open') {
          // Skip first paragraph (header)
          if (contentStart === -1) {
            // Find and skip this paragraph
            while (j < closeIdx && tokens[j].type !== 'paragraph_close') j++
            contentStart = j + 1
            break
          }
        }
      }

      const innerTokens = contentStart !== -1
        ? tokens.slice(contentStart, closeIdx)
        : []

      // Build replacement tokens
      const openToken = new state.Token('callout_open', 'div', 1)
      openToken.attrSet('data-callout-type', calloutType.toLowerCase())
      if (title) openToken.attrSet('data-callout-title', title)
      openToken.attrSet('data-collapsed', collapsed ? 'true' : 'false')
      openToken.meta = { calloutType: calloutType.toLowerCase(), title, collapsed }
      openToken.block = true

      const closeToken = new state.Token('callout_close', 'div', -1)
      closeToken.block = true

      // Replace blockquote_open ... blockquote_close with callout_open ... innerTokens ... callout_close
      tokens.splice(i, closeIdx - i + 1, openToken, ...innerTokens, closeToken)

      // Skip over the inserted tokens
      i += innerTokens.length + 2
    }
  })
}

// ---------------------------------------------------------------------------
// markdown-it plugin: mermaid fence  ```mermaid ... ```
// (Intercepts the fence token for lang='mermaid')
// ---------------------------------------------------------------------------

function markdownItMermaid(md) {
  // We intercept after all parsing via a core rule
  md.core.ruler.push('mermaid', state => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === 'fence' && tokens[i].info.trim() === 'mermaid') {
        tokens[i].type = 'mermaid_block'
        tokens[i].tag = ''
      }
    }
  })
}

// ---------------------------------------------------------------------------
// markdown-it plugin: inline math  $...$ and block math  $$...$$
// ---------------------------------------------------------------------------

function markdownItMath(md) {
  // Block math: $$...$$
  md.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
    const pos = state.bMarks[startLine] + state.tShift[startLine]
    const lineText = state.src.slice(pos, state.eMarks[startLine])

    if (!lineText.startsWith('$$')) return false
    if (lineText.length > 2 && !lineText.endsWith('$$')) return false

    if (!silent) {
      // Single-line block math: $$formula$$
      if (lineText.length > 4 && lineText.startsWith('$$') && lineText.endsWith('$$')) {
        const formula = lineText.slice(2, lineText.length - 2).trim()
        const token = state.push('math_inline', '', 0)
        token.attrSet('display', 'yes')
        token.content = formula
        token.markup = lineText
        token.map = [startLine, startLine + 1]
        state.line = startLine + 1
        return true
      }

      // Multi-line block math
      let nextLine = startLine + 1
      while (nextLine < endLine) {
        const nextPos = state.bMarks[nextLine] + state.tShift[nextLine]
        const nextText = state.src.slice(nextPos, state.eMarks[nextLine])
        if (nextText.trim() === '$$') break
        nextLine++
      }

      if (nextLine >= endLine) return false

      // Collect content between $$ ... $$
      const contentLines = []
      for (let l = startLine + 1; l < nextLine; l++) {
        const lPos = state.bMarks[l] + state.tShift[l]
        contentLines.push(state.src.slice(lPos, state.eMarks[l]))
      }

      const token = state.push('math_inline', '', 0)
      token.attrSet('display', 'yes')
      token.content = contentLines.join('\n')
      token.markup = '$$'
      token.map = [startLine, nextLine + 1]

      state.line = nextLine + 1
      return true
    }

    // Silent (validation) pass — just confirm we can match, no side-effects
    return true
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })

  // Inline math: $...$
  md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
    const src = state.src
    const pos = state.pos
    const max = state.posMax

    if (src.charCodeAt(pos) !== 0x24 /* $ */) return false
    if (pos + 1 >= max) return false

    // Skip double $$ (handled by block rule)
    if (src.charCodeAt(pos + 1) === 0x24) return false

    const start = pos + 1
    let end = src.indexOf('$', start)
    if (end === -1 || end === start) return false

    const content = src.slice(start, end)
    if (content.includes('\n')) return false

    if (!silent) {
      const token = state.push('math_inline', '', 0)
      token.attrSet('display', 'no')
      token.content = content
      token.markup = `$${content}$`
    }

    state.pos = end + 1
    return true
  })
}

// ---------------------------------------------------------------------------
// Build the markdown-it tokenizer instance
//
// schemaNodes: optional Set<string> of node names present in the schema.
// When provided, custom plugins are only registered for nodes that exist.
// This prevents unknown-token errors when parsing with a minimal schema.
// ---------------------------------------------------------------------------

function buildTokenizer(schemaNodes) {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false, // keep output predictable for round-trip
  })

  const has = name => !schemaNodes || schemaNodes.has(name)

  // Standard plugin: highlight marks (==text==)
  if (has('highlight') || !schemaNodes) {
    md.use(markdownItMark)
  }

  // Custom Lokus plugins (order matters: more specific patterns first)
  if (has('canvasLink')) md.use(markdownItCanvasLink)   // ![[name.canvas]] (before wiki_link)
  if (has('wikiLinkEmbed')) md.use(markdownItWikiLinkEmbed) // block ![[file^id]]
  if (has('wikiLink')) md.use(markdownItWikiLink)       // [[target]] / ![[target]]
  if (has('callout')) md.use(markdownItCallout)         // > [!type] …
  if (has('mermaid')) md.use(markdownItMermaid)         // ```mermaid … ```
  if (has('inlineMath') || has('math')) md.use(markdownItMath) // $…$ and $$…$$
  if (has('superscript')) md.use(markdownItSup)         // ^text^
  if (has('subscript')) md.use(markdownItSub)           // ~text~

  return md
}

// ---------------------------------------------------------------------------
// createLokusParser(schema)
//
// Returns a MarkdownParser configured for the Lokus ProseMirror schema.
// The schema is typically obtained from editor.schema after the TipTap editor
// has been created with all Lokus extensions.
// ---------------------------------------------------------------------------

export function createLokusParser(schema) {
  /**
   * Helper – safely look up a node type; returns null when the schema does not
   * contain that node (e.g. when running outside a full editor environment).
   */
  function nodeType(name) {
    return schema.nodes[name] ?? null
  }

  /**
   * Helper – safely look up a mark type.
   */
  function markType(name) {
    return schema.marks[name] ?? null
  }

  // Build a schema-aware tokenizer: only register plugins whose target node/mark
  // exists in this schema.  This prevents unknown-token errors with minimal schemas.
  const schemaNodes = new Set([
    ...Object.keys(schema.nodes),
    ...Object.keys(schema.marks),
  ])
  const tokenizer = buildTokenizer(schemaNodes)

  // Build the token→ParseSpec mapping for prosemirror-markdown's MarkdownParser.
  // Token names must match what markdown-it emits (possibly after our core rules).

  const tokens = {
    // -----------------------------------------------------------------------
    // Standard block nodes
    // -----------------------------------------------------------------------
    // block/node values resolve to TipTap camelCase names when available,
    // falling back to prosemirror-basic snake_case names.
    blockquote: { block: 'blockquote' },
    paragraph:  { block: 'paragraph' },
    list_item:  { block: nodeType('listItem') ? 'listItem' : 'list_item' },
    bullet_list: { block: nodeType('bulletList') ? 'bulletList' : 'bullet_list' },
    ordered_list: {
      block: nodeType('orderedList') ? 'orderedList' : 'ordered_list',
      getAttrs: tok => ({ order: +(tok.attrGet('start') ?? 1) }),
    },
    heading: {
      block: 'heading',
      getAttrs: tok => ({ level: +tok.tag.slice(1) }),
    },
    code_block: {
      block: nodeType('codeBlock') ? 'codeBlock' : 'code_block',
      noCloseToken: true,
    },
    fence: {
      block: nodeType('codeBlock') ? 'codeBlock' : 'code_block',
      getAttrs: tok => ({ language: tok.info.trim() || null }),
      noCloseToken: true,
    },
    hr: { node: nodeType('horizontalRule') ? 'horizontalRule' : 'horizontal_rule' },
    image: {
      node: 'image',
      getAttrs: tok => ({
        src: tok.attrGet('src') ?? '',
        alt: tok.children?.[0]?.content ?? '',
        title: tok.attrGet('title') ?? null,
      }),
    },
    hardbreak: { node: nodeType('hardBreak') ? 'hardBreak' : 'hard_break' },

    // -----------------------------------------------------------------------
    // Standard inline marks
    //
    // TipTap renames 'em'→'italic', 'strong'→'bold', 's'→'strike'.
    // We resolve the actual mark name dynamically so this works with both
    // the prosemirror-markdown basic schema and the full TipTap schema.
    // -----------------------------------------------------------------------
    em: {
      mark: markType('italic') ? 'italic' : 'em',
    },
    strong: {
      mark: markType('bold') ? 'bold' : 'strong',
    },
    link: {
      mark: 'link',
      getAttrs: tok => ({
        href: tok.attrGet('href') ?? '',
        title: tok.attrGet('title') ?? null,
      }),
    },
    code_inline: { mark: 'code', noCloseToken: true },
    s: {
      mark: markType('strike') ? 'strike' : 's',
    },

    // -----------------------------------------------------------------------
    // markdown-it-mark  ==highlight==
    // -----------------------------------------------------------------------
    mark: { mark: 'highlight' },

    // -----------------------------------------------------------------------
    // Superscript / subscript
    // -----------------------------------------------------------------------
    sup: { mark: 'superscript' },
    sub: { mark: 'subscript' },

    // -----------------------------------------------------------------------
    // Custom Lokus nodes
    // -----------------------------------------------------------------------

    // wiki_link  → wikiLink (inline atom)
    wiki_link: {
      node: 'wikiLink',
      getAttrs: tok => ({
        id: '',
        target: tok.attrGet('target') ?? '',
        alt: tok.attrGet('alt') ?? '',
        embed: tok.attrGet('embed') === 'true',
        href: tok.attrGet('target') ?? '',
        src: '',
      }),
    },

    // wiki_link_embed  → wikiLinkEmbed (block atom)
    wiki_link_embed: {
      node: 'wikiLinkEmbed',
      getAttrs: tok => ({
        id: '',
        fileName: tok.attrGet('fileName') ?? '',
        blockId: tok.attrGet('blockId') ?? '',
        filePath: `${tok.attrGet('fileName') ?? ''}${tok.attrGet('separator') ?? '^'}${tok.attrGet('blockId') ?? ''}`,
        content: '',
        loading: false,
        error: null,
      }),
    },

    // callout_open / callout_close  → callout (block with children)
    callout: {
      block: 'callout',
      getAttrs: tok => ({
        type: tok.attrGet('data-callout-type') ?? tok.meta?.calloutType ?? 'note',
        title: tok.attrGet('data-callout-title') ?? tok.meta?.title ?? null,
        collapsed: (tok.attrGet('data-collapsed') === 'true') || (tok.meta?.collapsed ?? false),
      }),
    },

    // mermaid_block  → mermaid (block node)
    mermaid_block: {
      node: 'mermaid',
      getAttrs: tok => ({
        code: tok.content?.trimEnd() ?? '',
        theme: 'default',
        updatedAt: Date.now(),
      }),
    },

    // canvas_link  → canvasLink (inline atom)
    canvas_link: {
      node: 'canvasLink',
      getAttrs: tok => ({
        id: '',
        canvasName: tok.attrGet('canvasName') ?? '',
        canvasPath: '',
        thumbnailUrl: '',
        exists: false,
      }),
    },

    // math_inline  → inlineMath (handles both inline $…$ and display $$…$$)
    math_inline: {
      node: 'inlineMath',
      getAttrs: tok => ({
        latex: tok.content ?? '',
        display: tok.attrGet('display') === 'yes' ? 'yes' : 'no',
      }),
    },
  }

  // Filter out mappings that reference node/mark types not present in the schema.
  // Also skip entries where the resolved mark/node name is null (unknown syntax).
  // This keeps the parser usable even when called with a minimal schema.
  const filteredTokens = {}
  for (const [name, spec] of Object.entries(tokens)) {
    if (spec.node != null && !nodeType(spec.node)) continue
    if (spec.block != null && !nodeType(spec.block)) continue
    if (spec.mark != null && !markType(spec.mark)) continue
    if (spec.mark === null) continue // explicitly unresolved mark
    filteredTokens[name] = spec
  }

  return new MarkdownParser(schema, tokenizer, filteredTokens)
}

// ---------------------------------------------------------------------------
// createLokusSerializer()
//
// Returns a MarkdownSerializer that covers all standard ProseMirror nodes
// plus every Lokus custom node/mark.  The serializer does NOT depend on a
// specific schema instance — it operates purely on node/mark type names.
// ---------------------------------------------------------------------------

export function createLokusSerializer() {
  // -------------------------------------------------------------------------
  // Node serializers
  //
  // IMPORTANT: keys must exactly match the ProseMirror schema node `name`
  // property.  TipTap uses camelCase names (bulletList, orderedList, …)
  // while the basic PM schema uses snake_case (bullet_list, …).
  // We register both forms so the serializer works with either schema.
  // -------------------------------------------------------------------------
  const nodes = {
    // Standard nodes — snake_case (prosemirror basic schema)
    blockquote(state, node) {
      state.wrapBlock('> ', null, node, () => state.renderContent(node))
    },

    code_block(state, node) {
      const lang = node.attrs.language ?? node.attrs.params ?? ''
      state.write('```' + (lang || '') + '\n')
      state.text(node.textContent, false)
      state.ensureNewLine()
      state.write('```')
      state.closeBlock(node)
    },

    heading(state, node) {
      state.write(state.repeat('#', node.attrs.level) + ' ')
      state.renderInline(node)
      // Append blockId if present
      if (node.attrs?.blockId) {
        state.write(` ^${node.attrs.blockId}`)
      }
      state.closeBlock(node)
    },

    horizontal_rule(state, node) {
      state.write(node.attrs.markup || '---')
      state.closeBlock(node)
    },

    bullet_list(state, node) {
      state.renderList(node, '  ', () => (node.attrs.bullet || '-') + ' ')
    },

    ordered_list(state, node) {
      const start = node.attrs.order ?? node.attrs.start ?? 1
      const maxW = String(start + node.childCount - 1).length
      state.renderList(node, '  ', i => {
        const num = String(start + i)
        return state.repeat(' ', maxW - num.length) + num + '. '
      })
    },

    list_item(state, node) {
      state.renderContent(node)
    },

    paragraph(state, node) {
      // Render inline content then append blockId marker if present
      state.renderInline(node)
      if (node.attrs?.blockId) {
        state.write(` ^${node.attrs.blockId}`)
      }
      state.closeBlock(node)
    },

    image(state, node) {
      state.write(
        '![' +
          state.esc(node.attrs.alt ?? '') +
          '](' +
          state.esc(node.attrs.src ?? '') +
          (node.attrs.title ? ' ' + state.quote(node.attrs.title) : '') +
          ')'
      )
    },

    hard_break(state, node, parent, index) {
      for (let i = index + 1; i < parent.childCount; i++) {
        if (parent.child(i).type !== node.type) {
          state.write('\\\n')
          return
        }
      }
    },

    text(state, node) {
      state.text(node.text ?? '', !state.inAutolink)
    },

    // TipTap camelCase aliases for the standard nodes above
    codeBlock(state, node) { nodes.code_block(state, node) },
    horizontalRule(state, node) { nodes.horizontal_rule(state, node) },
    bulletList(state, node) { nodes.bullet_list(state, node) },
    orderedList(state, node) { nodes.ordered_list(state, node) },
    listItem(state, node) { nodes.list_item(state, node) },
    hardBreak(state, node, parent, index) { nodes.hard_break(state, node, parent, index) },

    // -----------------------------------------------------------------------
    // GFM table
    // -----------------------------------------------------------------------
    table(state, node) {
      // Collect rows
      const rows = []
      node.forEach(row => {
        const cells = []
        row.forEach(cell => {
          // Render cell content as plain inline text (strip newlines, escape pipes)
          const cellText = createInlineCellSerializer(state, cell)
          cells.push(cellText)
        })
        rows.push({ cells, isHeader: row.firstChild?.type.name === 'tableHeader' })
      })

      if (rows.length === 0) return

      // First row with tableHeader cells → header; otherwise treat first as header
      const firstIsHeader = rows[0].isHeader
      const headerCells = rows[0].cells
      const bodyRows = rows.slice(1).map(r => r.cells)

      const colCount = headerCells.length
      const separator = '| ' + Array(colCount).fill('---').join(' | ') + ' |'
      const buildRow = cells => '| ' + cells.join(' | ') + ' |'

      state.write(buildRow(headerCells) + '\n')
      state.write(separator + '\n')
      for (const row of bodyRows) {
        state.write(buildRow(row) + '\n')
      }
      state.ensureNewLine()
      state.closeBlock(node)
    },

    // tableRow / tableHeader / tableCell are rendered inline by the table()
    // serializer above via createInlineCellSerializer.  These stubs prevent
    // the serializer from throwing if it ever encounters them at the top level.
    table_row(state, node) { state.renderContent(node) },
    table_header(state, node) { state.renderInline(node) },
    table_cell(state, node) { state.renderInline(node) },
    tableRow(state, node) { state.renderContent(node) },
    tableHeader(state, node) { state.renderInline(node) },
    tableCell(state, node) { state.renderInline(node) },

    // -----------------------------------------------------------------------
    // Task list  (TipTap camelCase names: taskList / taskItem)
    // -----------------------------------------------------------------------
    taskList(state, node) {
      state.renderList(node, '  ', () => '- ')
    },
    // snake_case alias
    task_list(state, node) { nodes.taskList(state, node) },

    taskItem(state, node) {
      // taskState covers all Obsidian/Lokus checkbox states:
      //   ' ' unchecked, 'x' checked, '!' important, '/' in-progress, '?' question …
      const taskState = node.attrs.taskState
      const checked = node.attrs.checked

      let marker
      if (taskState !== undefined && taskState !== null) {
        marker = `[${taskState}] `
      } else {
        marker = checked ? '[x] ' : '[ ] '
      }

      state.write(marker)
      state.renderContent(node)
    },
    // snake_case alias
    task_item(state, node) { nodes.taskItem(state, node) },

    // -----------------------------------------------------------------------
    // Lokus custom nodes
    // -----------------------------------------------------------------------

    // 1. wikiLink  [[target]] | [[target|alias]] | ![[target]]
    wikiLink(state, node) {
      const { target, alt, embed } = node.attrs ?? {}
      const displayTarget = target ?? ''
      const inner =
        alt && alt !== displayTarget
          ? `${displayTarget}|${alt}`
          : displayTarget

      if (embed) {
        state.write(`![[${inner}]]`)
      } else {
        state.write(`[[${inner}]]`)
      }
    },

    // 2. wikiLinkEmbed  ![[fileName^blockId]] / ![[fileName#heading]]
    wikiLinkEmbed(state, node) {
      const { fileName, blockId, filePath } = node.attrs ?? {}

      if (filePath) {
        // Derive separator from stored filePath
        const sepMatch = filePath.match(/[#^]/)
        if (sepMatch) {
          const sep = sepMatch[0]
          const sepIdx = filePath.indexOf(sep)
          const fn = filePath.slice(0, sepIdx)
          const bid = filePath.slice(sepIdx + 1)
          state.write(`![[${fn}${sep}${bid}]]`)
          state.closeBlock(node)
          return
        }
      }

      // Fallback: use ^ convention
      state.write(`![[${fileName ?? ''}^${blockId ?? ''}]]`)
      state.closeBlock(node)
    },

    // 3. callout  > [!type]- Title\n> content
    callout(state, node) {
      const { type: calloutType, title, collapsed } = node.attrs ?? {}
      const collapsedFlag = collapsed ? '-' : ''
      const titlePart = title ? ` ${title}` : ''
      const header = `> [!${calloutType ?? 'note'}]${collapsedFlag}${titlePart}`

      // Collect child block markdown with a sub-serializer trick:
      // Render each child, capture the output, then prefix with "> "
      const childMarkdown = serializeChildrenToString(state, node)
      const prefixed = prefixBlockquote(childMarkdown.trim())

      state.write(header + '\n' + prefixed)
      state.closeBlock(node)
    },

    // 4. mermaid  ```mermaid\n{code}\n```
    mermaid(state, node) {
      const code = node.attrs?.code ?? node.textContent ?? ''
      state.write('```mermaid\n' + code + '\n```')
      state.closeBlock(node)
    },

    // 5. canvasLink  ![[name.canvas]]
    canvasLink(state, node) {
      const { canvasName } = node.attrs ?? {}
      const name = canvasName ?? ''
      const suffix = name.endsWith('.canvas') ? '' : '.canvas'
      state.write(`![[${name}${suffix}]]`)
    },

    // 6. inlineMath  $formula$ or $$formula$$
    inlineMath(state, node) {
      const { latex, display } = node.attrs ?? {}
      const formula = latex ?? node.textContent ?? ''
      if (display === 'yes') {
        state.write(`$$${formula}$$`)
      } else {
        state.write(`$${formula}$`)
      }
    },

    // 7. math (alias used by @aarkue/tiptap-math-extension)
    math(state, node) {
      const { latex, display } = node.attrs ?? {}
      const formula = latex ?? node.textContent ?? ''
      if (display === 'yes') {
        state.write(`$$${formula}$$`)
      } else {
        state.write(`$${formula}$`)
      }
    },
  }

  // -------------------------------------------------------------------------
  // Mark serializers
  // -------------------------------------------------------------------------
  const marks = {
    em: { open: '*', close: '*', mixable: true, expelEnclosingWhitespace: true },
    strong: { open: '**', close: '**', mixable: true, expelEnclosingWhitespace: true },
    // TipTap uses 'italic' / 'bold' as mark names (not 'em' / 'strong')
    italic: { open: '*', close: '*', mixable: true, expelEnclosingWhitespace: true },
    bold:   { open: '**', close: '**', mixable: true, expelEnclosingWhitespace: true },
    link: {
      open(state, mark) {
        state.inAutolink = mark.attrs.href === mark.attrs.title
        return '['
      },
      close(state, mark) {
        state.inAutolink = undefined
        return (
          '](' +
          mark.attrs.href.replace(/[()"]/g, '\\$&') +
          (mark.attrs.title ? ' "' + mark.attrs.title.replace(/"/g, '\\"') + '"' : '') +
          ')'
        )
      },
    },
    code:   { open: '`', close: '`', escape: false },
    strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
    // TipTap alias
    s:      { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },

    // highlight  ==text==
    highlight: { open: '==', close: '==', mixable: true, expelEnclosingWhitespace: true },

    // superscript  ^text^
    superscript: { open: '^', close: '^', mixable: false, expelEnclosingWhitespace: false },

    // subscript  ~text~
    subscript: { open: '~', close: '~', mixable: false, expelEnclosingWhitespace: false },
  }

  return new MarkdownSerializer(nodes, marks, { strict: false })
}

// ---------------------------------------------------------------------------
// Internal helper: render block children to a plain string
// (used by callout serializer to capture child markdown before prefixing)
// ---------------------------------------------------------------------------

/**
 * Serialize all children of `parent` into a single markdown string by
 * temporarily capturing the serializer state's output buffer.
 *
 * This works by creating a lightweight proxy that wraps the state methods
 * and collects output into an array rather than writing to the real buffer.
 *
 * @param {import('prosemirror-markdown').MarkdownSerializerState} state
 * @param {import('prosemirror-model').Node} parent
 * @returns {string}
 */
function serializeChildrenToString(state, parent) {
  // We use a captured output string by saving/restoring the internal buffer.
  // prosemirror-markdown's MarkdownSerializerState stores output in `state.out`.
  const savedOut = state.out
  state.out = ''
  state.renderContent(parent)
  const result = state.out
  state.out = savedOut
  return result
}

/**
 * Serialize a single table cell's inline content to plain text (for GFM tables).
 * Pipes inside cells are escaped.
 *
 * @param {import('prosemirror-markdown').MarkdownSerializerState} state
 * @param {import('prosemirror-model').Node} cell
 * @returns {string}
 */
function createInlineCellSerializer(state, cell) {
  const savedOut = state.out
  state.out = ''
  cell.forEach(block => {
    if (block.isTextblock) {
      state.renderInline(block)
    } else {
      state.renderContent(block)
    }
  })
  const cellText = state.out.trim().replace(/\|/g, '\\|').replace(/\n/g, ' ')
  state.out = savedOut
  return cellText
}
