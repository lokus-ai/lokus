/**
 * Markdown-it plugin for WikiLinks
 * Converts [[Page Name]] to proper HTML for TipTap
 */

// Helper to resolve wiki target to full path using file index
function resolveWikiLinkPath(target) {
  try {
    const index = globalThis.__LOKUS_FILE_INDEX__ || []
    if (!Array.isArray(index) || !index.length || !target) return target

    // Remove alias part after | if present
    let base = String(target).split('|')[0].trim()
    if (!base) return target

    // CRITICAL: Remove block reference (^blockid) before resolving
    // target might be "Mermaid.md^aligned-table"
    // We need to resolve just "Mermaid.md" to get the full path
    const blockRefMatch = base.match(/^([^#^]+)([#^].+)?$/)
    if (blockRefMatch) {
      const filePart = blockRefMatch[1]  // "Mermaid.md"
      const blockPart = blockRefMatch[2] || ''  // "^aligned-table"
      base = filePart  // Only resolve the file part
    }

    const dirname = (p) => {
      if (!p) return ''
      const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
      return i >= 0 ? p.slice(0, i) : ''
    }

    const filename = (p) => (p || '').split(/[\\/]/).pop()
    const wsPath = globalThis.__LOKUS_WORKSPACE_PATH__ || ''

    // Check for explicit root marker (./) - means "root file, no same-folder preference"
    const isExplicitRoot = base.startsWith('./')
    if (isExplicitRoot) {
      base = base.slice(2)  // Remove ./
      // Find file in workspace root
      const rootFile = index.find(f => {
        const name = filename(f.path)
        const dir = dirname(f.path)
        const isInRoot = dir === wsPath || dir === wsPath.replace(/\/$/, '')
        return isInRoot && (name === base || name === `${base}.md`)
      })
      return rootFile?.path || target
    }

    // If includes slash, try exact path match
    if (/[/\\]/.test(base)) {
      const hit = index.find(f => f.path.endsWith(base)) || index.find(f => f.path === base)
      return hit?.path || target
    }

    // Otherwise, match by filename (with or without .md extension)
    const activePath = globalThis.__LOKUS_ACTIVE_FILE__ || ''
    const activeDir = dirname(activePath)

    // Create name-based index
    const nameMap = new Map()
    for (const f of index) {
      const name = filename(f.path)
      if (!nameMap.has(name)) nameMap.set(name, [])
      nameMap.get(name).push(f)
    }

    // Try exact name match, then with .md extension
    let candidates = nameMap.get(base) || nameMap.get(`${base}.md`) || []

    if (!candidates.length) return target
    if (candidates.length === 1) return candidates[0].path

    // Multiple matches - prefer same folder
    const sameFolder = candidates.find(f => dirname(f.path) === activeDir)
    return sameFolder ? sameFolder.path : candidates[0].path
  } catch (e) {
    return target
  }
}

// Helper to resolve canvas file path using file index
function resolveCanvasPath(canvasName) {
  try {
    const index = globalThis.__LOKUS_FILE_INDEX__ || []
    if (!Array.isArray(index) || !index.length || !canvasName) {
      return { exists: false, path: '', name: canvasName }
    }

    const canvasFileName = `${canvasName}.canvas`

    // Find canvas file in the index
    const matchedFile = index.find(file => {
      const fileName = file.name || file.path.split('/').pop()
      return fileName === canvasFileName || fileName === canvasName
    })

    if (matchedFile) {
      return { exists: true, path: matchedFile.path, name: canvasName }
    }

    return { exists: false, path: '', name: canvasName }
  } catch (e) {
    return { exists: false, path: '', name: canvasName }
  }
}

export default function markdownItWikiLinks(md) {
  // Inline rule for ![Canvas Name] (canvas links)
  // Must be registered before 'image' to take precedence
  md.inline.ruler.before('image', 'canvaslink', (state, silent) => {
    const start = state.pos;
    const max = state.posMax;

    // Check if we're at ![
    if (state.src.charCodeAt(start) !== 0x21 /* ! */ ||
        state.src.charCodeAt(start + 1) !== 0x5B /* [ */) {
      return false;
    }

    // Find the closing ]
    let pos = start + 2;
    let found = false;

    while (pos < max) {
      if (state.src.charCodeAt(pos) === 0x5D /* ] */) {
        found = true;
        break;
      }
      pos++;
    }

    if (!found) {
      return false;
    }

    // Check that this is NOT followed by ( which would make it a regular image
    if (pos + 1 < max && state.src.charCodeAt(pos + 1) === 0x28 /* ( */) {
      return false; // Let the image rule handle this
    }

    // Also check it's not a wiki-style image embed ![[...]]
    if (state.src.charCodeAt(start + 2) === 0x5B /* [ */) {
      return false; // Let the wiki image rule handle this
    }

    // Extract the canvas name
    const canvasName = state.src.slice(start + 2, pos).trim();

    if (!canvasName) {
      return false;
    }

    if (!silent) {
      // Resolve canvas path
      const resolved = resolveCanvasPath(canvasName);

      const token = state.push('canvaslink_open', 'span', 1);
      token.attrs = [
        ['data-type', 'canvas-link'],
        ['class', resolved.exists ? 'canvas-link' : 'canvas-link canvas-link-broken'],
        ['href', resolved.path || canvasName],
        ['style', 'cursor: pointer']
      ];

      const textToken = state.push('text', '', 0);
      textToken.content = canvasName;

      state.push('canvaslink_close', 'span', -1);
    }

    state.pos = pos + 1;
    return true;
  });

  // Renderer for canvas links
  md.renderer.rules.canvaslink_open = (tokens, idx) => {
    const token = tokens[idx];
    const href = token.attrGet('href');
    const className = token.attrGet('class');

    return `<span data-type="canvas-link" class="${md.utils.escapeHtml(className)}" href="${md.utils.escapeHtml(href)}" style="cursor: pointer">`;
  };

  md.renderer.rules.canvaslink_close = () => {
    return '</span>';
  };

  // Inline rule for [[...]]
  md.inline.ruler.before('link', 'wikilink', (state, silent) => {
    const start = state.pos;
    const max = state.posMax;

    // Check if we're at [[
    if (state.src.charCodeAt(start) !== 0x5B /* [ */ ||
        state.src.charCodeAt(start + 1) !== 0x5B /* [ */) {
      return false;
    }

    // Find the closing ]]
    let pos = start + 2;
    let found = false;

    while (pos < max - 1) {
      if (state.src.charCodeAt(pos) === 0x5D /* ] */ &&
          state.src.charCodeAt(pos + 1) === 0x5D /* ] */) {
        found = true;
        break;
      }
      pos++;
    }

    if (!found) {
      return false;
    }

    // Extract the link text
    const content = state.src.slice(start + 2, pos);

    if (!silent) {
      // Parse content: [[path|alias]] or [[path#hash]] or [[path^block]] or [[path]]
      // First separate alias (after |)
      const aliasSplit = content.split('|')
      const pathWithRef = aliasSplit[0].trim()  // "path" or "path#hash" or "path^block"

      // Then separate block/hash reference
      const blockRefMatch = pathWithRef.match(/^([^#^]+)([#^].+)?$/)
      const filePart = blockRefMatch ? blockRefMatch[1].trim() : pathWithRef
      const blockPart = blockRefMatch ? (blockRefMatch[2] || '') : ''

      // Resolve ONLY the file part to get full path
      const resolvedFilePath = resolveWikiLinkPath(filePart);

      // Reconstruct href with resolved path + block reference (no alias in href)
      const resolvedPath = resolvedFilePath + blockPart;

      const token = state.push('wikilink_open', 'span', 1);
      token.attrs = [
        ['data-type', 'wiki-link'],
        ['class', 'wiki-link'],
        ['href', resolvedPath],  // Full path with block reference (no alias)
        ['target', content]       // Keep original content as target (with alias)
      ];

      const textToken = state.push('text', '', 0);
      textToken.content = content;

      state.push('wikilink_close', 'span', -1);
    }

    state.pos = pos + 2;
    return true;
  });

  // Renderer for wiki links
  md.renderer.rules.wikilink_open = (tokens, idx) => {
    const token = tokens[idx];
    const href = token.attrGet('href');
    const target = token.attrGet('target');

    return `<span data-type="wiki-link" class="wiki-link" href="${md.utils.escapeHtml(href)}" target="${md.utils.escapeHtml(target)}">`;
  };

  md.renderer.rules.wikilink_close = () => {
    return '</span>';
  };
}
