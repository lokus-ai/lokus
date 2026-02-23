/**
 * Custom @tiptap/markdown serializers for Lokus-specific node types.
 *
 * Each entry produced by getMarkdownExtensionConfigs() is a plain object
 * (not a full Tiptap extension) that the MarkdownManager reads via
 * getExtensionField().  The MarkdownManager looks for:
 *
 *   - `name`                 — matches the ProseMirror node name used when
 *                              looking up a renderMarkdown handler.
 *   - `markdownTokenName`    — the marked.js token type consumed by
 *                              parseMarkdown (defaults to `name`).
 *   - `markdownTokenizer`    — optional custom tokenizer registered with
 *                              marked.js for non-standard syntax.
 *   - `parseMarkdown(token, helpers)` — markdown → Tiptap JSON.
 *   - `renderMarkdown(node, helpers, ctx)` — Tiptap JSON → markdown string.
 *
 * To wire these in, call editor.markdown.registerExtension(cfg) for every
 * object returned here after the editor is set up.
 *
 * Supported node types
 * --------------------
 *  1. wikiLink      — inline atom  [[target]] | [[target|alias]] | ![[target]]
 *  2. wikiLinkEmbed — block  atom  ![[file^blockId]] | ![[file#heading]]
 *  3. callout       — block  node  > [!type]- Title\n> content
 *  4. mermaid       — block  node  ```mermaid\n{code}\n```
 *  5. canvasLink    — inline atom  ![[name.canvas]]
 *  6. table         — GFM table serializer (workaround for tiptap #5750)
 */

import { Extension } from '@tiptap/core'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Return the string content of all text-type children in a Tiptap JSON node,
 * joined without separator.
 * @param {import('@tiptap/core').JSONContent} node
 * @returns {string}
 */
function getTextContent(node) {
  if (!node.content) return ''
  return node.content
    .map((child) => (child.type === 'text' ? (child.text ?? '') : getTextContent(child)))
    .join('')
}

/**
 * Prefix every non-empty line of `text` with `> `.
 * @param {string} text
 * @returns {string}
 */
function prefixBlockquote(text) {
  return text
    .split('\n')
    .map((line) => (line.trim() === '' ? '>' : `> ${line}`))
    .join('\n')
}

// ---------------------------------------------------------------------------
// 1. WikiLink  ([[target]] | [[target|alias]] | ![[target]])
// ---------------------------------------------------------------------------

/**
 * Tokenizer for inline wiki links consumed by marked.js.
 *
 * Covers three variants in priority order:
 *   ![[name]]          → embed wikiLink  (image/file embed)
 *   [[name|alias]]     → aliased wikiLink
 *   [[name]]           → plain wikiLink
 *
 * The token shape: { type, raw, embed, target }
 */
const wikiLinkTokenizer = {
  name: 'wikiLink',
  level: 'inline',
  start(src) {
    // earliest occurrence of ![[ or [[
    const embedIdx = src.indexOf('![[')
    const linkIdx = src.indexOf('[[')
    if (embedIdx === -1 && linkIdx === -1) return -1
    if (embedIdx === -1) return linkIdx
    if (linkIdx === -1) return embedIdx
    return Math.min(embedIdx, linkIdx)
  },
  tokenize(src) {
    // embed: ![[target]]
    const embedMatch = src.match(/^!\[\[([^\]]+?)\]\]/)
    if (embedMatch) {
      return {
        type: 'wikiLink',
        raw: embedMatch[0],
        embed: true,
        target: embedMatch[1].trim(),
      }
    }

    // plain or aliased: [[target]] or [[target|alias]]
    const linkMatch = src.match(/^\[\[([^\]]+?)\]\]/)
    if (linkMatch) {
      return {
        type: 'wikiLink',
        raw: linkMatch[0],
        embed: false,
        target: linkMatch[1].trim(),
      }
    }

    return undefined
  },
}

const wikiLinkConfig = Extension.create({
  name: 'wikiLink',

  markdownTokenName: 'wikiLink',

  markdownTokenizer: wikiLinkTokenizer,

  parseMarkdown(token, helpers) {
    const { embed, target } = token

    // Split "path|alias" — alias goes into `alt`
    const pipeIdx = target.indexOf('|')
    const rawTarget = pipeIdx !== -1 ? target.slice(0, pipeIdx) : target
    const alt = pipeIdx !== -1 ? target.slice(pipeIdx + 1) : ''

    return helpers.createNode('wikiLink', {
      id: '',
      target: rawTarget,
      alt,
      embed: !!embed,
      href: rawTarget,
      src: '',
    })
  },

  renderMarkdown(node) {
    const { target, alt, embed } = node.attrs ?? {}
    const displayTarget = target || ''

    // Build the inner part — include alias only when different from target
    const inner =
      alt && alt !== displayTarget
        ? `${displayTarget}|${alt}`
        : displayTarget

    if (embed) return `![[${inner}]]`
    return `[[${inner}]]`
  },
})

// ---------------------------------------------------------------------------
// 2. WikiLinkEmbed  (![[file^blockId]] / ![[file#heading]])
// ---------------------------------------------------------------------------

/**
 * Block-level tokenizer for ![[file^blockId]] embed syntax.
 *
 * This must not conflict with the inline wikiLink tokenizer.  The
 * distinguishing feature is the ^ or # separator indicating a block/heading
 * reference.  When the MarkdownManager processes block tokens first, this
 * tokenizer takes priority for lines that match the embed pattern.
 *
 * Token shape: { type, raw, fileName, blockId, separator }
 */
const wikiLinkEmbedTokenizer = {
  name: 'wikiLinkEmbed',
  level: 'block',
  start(src) {
    return src.indexOf('![[')
  },
  tokenize(src) {
    // ![[fileName^blockId]] or ![[fileName#heading]] on its own line
    const match = src.match(/^!\[\[([^\]#^]+?)([#^])([^\]]+?)\]\]\s*(?:\n|$)/)
    if (!match) return undefined

    return {
      type: 'wikiLinkEmbed',
      raw: match[0],
      fileName: match[1].trim(),
      separator: match[2],    // ^ or #
      blockId: match[3].trim(),
    }
  },
}

const wikiLinkEmbedConfig = Extension.create({
  name: 'wikiLinkEmbed',

  markdownTokenName: 'wikiLinkEmbed',

  markdownTokenizer: wikiLinkEmbedTokenizer,

  parseMarkdown(token, helpers) {
    const { fileName, blockId, separator } = token

    return helpers.createNode('wikiLinkEmbed', {
      id: '',
      fileName: fileName || '',
      blockId: blockId || '',
      // Reconstruct the full filePath key used internally
      filePath: `${fileName}${separator ?? '^'}${blockId}`,
      content: '',
      loading: false,
      error: null,
    })
  },

  renderMarkdown(node) {
    const { fileName, blockId, filePath } = node.attrs ?? {}

    // Prefer the stored separator from filePath when available
    if (filePath) {
      const separatorMatch = filePath.match(/[#^]/)
      if (separatorMatch) {
        const sep = separatorMatch[0]
        const fn = filePath.slice(0, filePath.indexOf(sep))
        const bid = filePath.slice(filePath.indexOf(sep) + 1)
        return `![[${fn}${sep}${bid}]]`
      }
    }

    // Fallback: use ^ (block-reference convention)
    const fn = fileName || ''
    const bid = blockId || ''
    return `![[${fn}^${bid}]]`
  },
})

// ---------------------------------------------------------------------------
// 3. Callout  (Obsidian-style blockquote admonitions)
// ---------------------------------------------------------------------------

/**
 * Block tokenizer for Obsidian callouts:
 *
 *   > [!note]- Optional Title
 *   > Content line one
 *   > Content line two
 *
 * Token shape: { type, raw, calloutType, collapsed, title, body }
 */
const calloutTokenizer = {
  name: 'callout',
  level: 'block',
  start(src) {
    // Must start with "> [!" to distinguish from a plain blockquote
    const match = src.match(/^>\s*\[!/)
    return match ? 0 : src.indexOf('\n> [!')
  },
  tokenize(src, _tokens, lexer) {
    // First line must be the callout declaration
    const headerMatch = src.match(/^>\s*\[!(\w+)\](-?)\s*(.*?)(?:\n|$)/)
    if (!headerMatch) return undefined

    const [headerRaw, calloutType, collapsedFlag, title] = headerMatch

    // Collect subsequent "> ..." lines as callout body
    let raw = headerRaw
    let body = ''
    const remaining = src.slice(headerRaw.length)
    const bodyLines = remaining.match(/^(?:>\s?.*(?:\n|$))*/m)

    if (bodyLines && bodyLines[0]) {
      raw += bodyLines[0]
      body = bodyLines[0]
        .split('\n')
        .map((line) => line.replace(/^>\s?/, ''))
        .join('\n')
        .trim()
    }

    // Tokenise the body so parseMarkdown can recurse into child blocks
    const tokens = body ? lexer.blockTokens(body) : []

    return {
      type: 'callout',
      raw,
      calloutType: calloutType.toLowerCase(),
      collapsed: collapsedFlag === '-',
      title: title.trim() || null,
      body,
      tokens,
    }
  },
}

const calloutConfig = Extension.create({
  name: 'callout',

  markdownTokenName: 'callout',

  markdownTokenizer: calloutTokenizer,

  parseMarkdown(token, helpers) {
    const { calloutType, collapsed, title, tokens } = token

    // Recursively parse the body into block children
    const content = tokens && tokens.length > 0
      ? helpers.parseChildren(tokens)
      : [helpers.createNode('paragraph', {}, [])]

    return helpers.createNode('callout', {
      type: calloutType || 'note',
      title: title || null,
      collapsed: !!collapsed,
    }, content)
  },

  renderMarkdown(node, helpers) {
    const { type: calloutType, title, collapsed } = node.attrs ?? {}

    const collapsedFlag = collapsed ? '-' : ''
    const titlePart = title ? ` ${title}` : ''
    const header = `> [!${calloutType ?? 'note'}]${collapsedFlag}${titlePart}`

    // Render all child blocks then prefix each line with "> "
    const childMarkdown = helpers.renderChildren(node.content ?? [], '\n\n')
    const prefixed = prefixBlockquote(childMarkdown)

    return `${header}\n${prefixed}`
  },
})

// ---------------------------------------------------------------------------
// 4. MermaidDiagram  (fenced code block with mermaid language tag)
// ---------------------------------------------------------------------------

/**
 * Block tokenizer for ```mermaid fenced code blocks.
 *
 * marked.js already parses fenced code as `code` tokens with a `lang`
 * property.  We register an additional "mermaid" token handler so that
 * code blocks with lang === 'mermaid' are routed to the mermaid node
 * type instead of the generic codeBlock renderer.
 *
 * Token shape (from marked): { type: 'code', lang: 'mermaid', text: '...' }
 * We re-label the type so registerExtension can route it.
 */
const mermaidTokenizer = {
  name: 'mermaid',
  level: 'block',
  start(src) {
    return src.indexOf('```mermaid')
  },
  tokenize(src) {
    const match = src.match(/^```mermaid\r?\n([\s\S]*?)```(?:\r?\n|$)/)
    if (!match) return undefined

    return {
      type: 'mermaid',
      raw: match[0],
      code: match[1].trimEnd(),
    }
  },
}

const mermaidConfig = Extension.create({
  name: 'mermaid',

  markdownTokenName: 'mermaid',

  markdownTokenizer: mermaidTokenizer,

  parseMarkdown(token, helpers) {
    return helpers.createNode('mermaid', {
      code: token.code || '',
      theme: 'default',
      updatedAt: Date.now(),
    })
  },

  renderMarkdown(node) {
    const code = node.attrs?.code ?? ''
    return `\`\`\`mermaid\n${code}\n\`\`\``
  },
})

// ---------------------------------------------------------------------------
// 5. CanvasLink  (![[name.canvas]])
// ---------------------------------------------------------------------------

/**
 * Inline tokenizer for canvas file links.
 *
 * Format: ![[SomeCanvas.canvas]]
 *
 * This is similar to wikiLink embeds but targets .canvas files specifically.
 * The serializer produces the Obsidian-compatible ![[name.canvas]] syntax.
 *
 * Token shape: { type, raw, canvasName }
 */
const canvasLinkTokenizer = {
  name: 'canvasLink',
  level: 'inline',
  start(src) {
    return src.indexOf('![[')
  },
  tokenize(src) {
    const match = src.match(/^!\[\[([^\]]+?\.canvas)\]\]/)
    if (!match) return undefined

    return {
      type: 'canvasLink',
      raw: match[0],
      canvasName: match[1].replace(/\.canvas$/, '').trim(),
    }
  },
}

const canvasLinkConfig = Extension.create({
  name: 'canvasLink',

  markdownTokenName: 'canvasLink',

  markdownTokenizer: canvasLinkTokenizer,

  parseMarkdown(token, helpers) {
    return helpers.createNode('canvasLink', {
      id: '',
      canvasName: token.canvasName || '',
      canvasPath: '',
      thumbnailUrl: '',
      exists: false,
    })
  },

  renderMarkdown(node) {
    const { canvasName } = node.attrs ?? {}
    const name = canvasName || ''
    // Always serialise with the .canvas extension so the tokenizer can
    // distinguish canvas links from regular wiki-link embeds.
    const suffix = name.endsWith('.canvas') ? '' : '.canvas'
    return `![[${name}${suffix}]]`
  },
})

// ---------------------------------------------------------------------------
// 6. Table  (GFM — workaround for tiptap #5750)
// ---------------------------------------------------------------------------

/**
 * Render a TipTap table node to GFM markdown.
 *
 * TipTap's table structure:
 *   table
 *     tableRow   (first row contains tableHeader cells when created by TipTap)
 *       tableHeader | tableCell
 *     tableRow
 *       tableCell
 *
 * The MarkdownManager does not have a built-in table renderer so we supply
 * one here.  We do not register a tokenizer because marked.js already
 * handles GFM tables natively as `table` tokens.
 */
const tableConfig = Extension.create({
  name: 'table',

  markdownTokenName: 'table',

  /**
   * Parse a marked.js GFM table token into TipTap JSON.
   * The token shape (from marked): { header: [{text}], rows: [[{text}]] }
   */
  parseMarkdown(token, helpers) {
    const headerCells = (token.header ?? []).map((cell) => {
      const cellText = typeof cell === 'string' ? cell : (cell.text ?? '')
      return helpers.createNode('tableHeader', {}, [
        helpers.createNode('paragraph', {}, [helpers.createTextNode(cellText)]),
      ])
    })

    const headerRow = helpers.createNode('tableRow', {}, headerCells)

    const bodyRows = (token.rows ?? []).map((row) => {
      const cells = row.map((cell) => {
        const cellText = typeof cell === 'string' ? cell : (cell.text ?? '')
        return helpers.createNode('tableCell', {}, [
          helpers.createNode('paragraph', {}, [helpers.createTextNode(cellText)]),
        ])
      })
      return helpers.createNode('tableRow', {}, cells)
    })

    return helpers.createNode('table', {}, [headerRow, ...bodyRows])
  },

  /**
   * Render a TipTap table node to a GFM markdown table string.
   */
  renderMarkdown(node) {
    if (!node.content || node.content.length === 0) return ''

    /**
     * Extract plain text from a tableHeader or tableCell node.
     * @param {import('@tiptap/core').JSONContent} cellNode
     * @returns {string}
     */
    function cellText(cellNode) {
      return getTextContent(cellNode).replace(/\|/g, '\\|').trim()
    }

    /**
     * Build a single markdown table row from an array of cell strings.
     * @param {string[]} cells
     * @returns {string}
     */
    function buildRow(cells) {
      return `| ${cells.join(' | ')} |`
    }

    const rows = node.content
    let headerCells = null
    const bodyRows = []

    for (const row of rows) {
      if (!row.content) continue

      const isHeaderRow = row.content.some((c) => c.type === 'tableHeader')

      const cells = row.content.map(cellText)

      if (isHeaderRow && headerCells === null) {
        headerCells = cells
      } else {
        bodyRows.push(cells)
      }
    }

    // If no dedicated header row, treat the first body row as the header so
    // the output is always valid GFM (GFM requires a separator row).
    if (!headerCells) {
      if (bodyRows.length === 0) return ''
      headerCells = bodyRows.shift()
    }

    const columnCount = headerCells.length
    const separator = buildRow(Array(columnCount).fill('---'))
    const lines = [
      buildRow(headerCells),
      separator,
      ...bodyRows.map(buildRow),
    ]

    return lines.join('\n')
  },
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns an array of Tiptap Extension objects — one per custom node type —
 * each carrying `parseMarkdown`, `renderMarkdown`, and (where needed)
 * `markdownTokenizer` fields that are read by @tiptap/markdown's
 * MarkdownManager via getExtensionField().
 *
 * Usage:
 *   import { getMarkdownExtensionConfigs } from './markdownSerializers.js'
 *
 *   // After editor is created and editor.markdown is available:
 *   getMarkdownExtensionConfigs().forEach(cfg => {
 *     editor.markdown.registerExtension(cfg)
 *   })
 *
 * Or pass them directly to the MarkdownManager constructor:
 *   new MarkdownManager({ extensions: [...baseExtensions, ...getMarkdownExtensionConfigs()] })
 *
 * @returns {import('@tiptap/core').AnyExtension[]}
 */
export function getMarkdownExtensionConfigs() {
  return [
    wikiLinkConfig,
    wikiLinkEmbedConfig,
    calloutConfig,
    mermaidConfig,
    canvasLinkConfig,
    tableConfig,
  ]
}

export {
  wikiLinkConfig,
  wikiLinkEmbedConfig,
  calloutConfig,
  mermaidConfig,
  canvasLinkConfig,
  tableConfig,
}
