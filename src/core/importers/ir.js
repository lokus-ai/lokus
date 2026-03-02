/**
 * Intermediate Representation (IR) for note import pipeline.
 *
 * All parsers produce IR, and only the LokusTransformer consumes it.
 */

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function createDocument({ pages = [], canvases = [], assets = [] } = {}) {
  return { pages, canvases, assets };
}

export function createPage({
  title = '',
  slug = '',
  path = '',
  frontmatter = {},
  blocks = [],
  isDaily = false,
  sourceFile = ''
} = {}) {
  return { title, slug, path, frontmatter, blocks, isDaily, sourceFile };
}

export function createBlock({
  type = 'text',
  content = '',
  level = 0,
  children = [],
  meta = {}
} = {}) {
  return { type, content, level, children, meta };
}

export function createCanvas({ name = '', elements = [], edges = [] } = {}) {
  return { name, elements, edges };
}

export function createCanvasNode({ id = '', type = 'text', x = 0, y = 0, width = 250, height = 60, text = '', file = '' } = {}) {
  return { id, type, x, y, width, height, text, file };
}

export function createCanvasEdge({ id = '', fromNode = '', toNode = '', label = '' } = {}) {
  return { id, fromNode, toNode, label };
}

export function createAsset({ sourcePath = '', destPath = '', referencedBy = [] } = {}) {
  return { sourcePath, destPath, referencedBy };
}

// ---------------------------------------------------------------------------
// Block-type constants
// ---------------------------------------------------------------------------

export const BlockType = {
  TEXT: 'text',
  HEADING: 'heading',
  TASK: 'task',
  LIST: 'list',
  CALLOUT: 'callout',
  CODE: 'code',
  EMBED: 'embed',
  BLOCKREF: 'blockref',
  UNSUPPORTED: 'unsupported'
};
