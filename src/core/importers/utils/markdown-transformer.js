/**
 * Markdown Transformer Utilities
 *
 * Handles conversion of different markdown flavors to standard format
 */

/**
 * Convert Logseq outline structure to standard markdown
 * @param {string} content - Logseq-style outline markdown
 * @returns {string} Standard markdown
 */
export function convertLogseqOutline(content) {
  const lines = content.split('\n');
  const result = [];
  let lastLevel = 0;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }

    // Don't process inside code blocks
    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    // Parse indent level and content
    const { level, content: lineContent, isBullet } = parseLogseqLine(line);

    if (lineContent === '') {
      // Preserve empty lines
      result.push('');
      continue;
    }

    // Detect if this is structural or content
    const isStructural = isBullet && shouldConvertToHeading(lineContent, level, lastLevel);

    if (isStructural) {
      // Convert to heading
      const headingLevel = Math.min(level + 1, 6);
      result.push('#'.repeat(headingLevel) + ' ' + lineContent);
    } else if (isBullet) {
      // Keep as list item
      const indent = '  '.repeat(level);
      result.push(indent + '- ' + lineContent);
    } else {
      // Regular paragraph
      result.push(lineContent);
    }

    lastLevel = level;
  }

  return cleanupMarkdown(result.join('\n'));
}

/**
 * Parse a Logseq line to extract indent level and content
 */
function parseLogseqLine(line) {
  // Match indent (spaces or tabs) followed by optional bullet (-, *)
  const match = line.match(/^(\s*)([-*]\s+)?(.*)$/);

  if (!match) {
    return { level: 0, content: line, isBullet: false };
  }

  const [, indent, bullet, content] = match;

  // Calculate indent level (2 spaces = 1 level)
  const level = Math.floor(indent.length / 2);

  return {
    level,
    content: content.trim(),
    isBullet: !!bullet
  };
}

/**
 * Determine if a bullet should become a heading
 */
function shouldConvertToHeading(content, level, lastLevel) {
  // Top-level bullets are often headings
  if (level === 0) return true;

  // Short content at level increases is likely a heading
  if (level > lastLevel && content.length < 60 && !content.includes('.')) {
    return true;
  }

  // Contains heading-like words
  const headingWords = /^(overview|introduction|summary|conclusion|notes|questions|todo|goals|objectives)/i;
  if (headingWords.test(content)) {
    return true;
  }

  return false;
}

/**
 * Clean up markdown by removing excessive blank lines
 */
function cleanupMarkdown(content) {
  // Remove more than 2 consecutive blank lines
  return content
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

/**
 * Convert Roam-style indentation to markdown
 * Roam uses a flatter block-based structure
 */
export function convertRoamBlocks(blocks, level = 0) {
  const result = [];

  for (const block of blocks) {
    const content = block.string || block.content || '';
    const indent = '  '.repeat(level);

    // Add block content
    if (content.trim()) {
      // Check if should be heading
      if (level === 0 && content.length < 60) {
        result.push('## ' + content);
      } else {
        result.push(indent + '- ' + content);
      }
    }

    // Process children recursively
    if (block.children && block.children.length > 0) {
      const childContent = convertRoamBlocks(block.children, level + 1);
      result.push(childContent);
    }
  }

  return result.join('\n');
}

/**
 * Normalize wiki links to consistent format
 * @param {string} content
 * @returns {string}
 */
export function normalizeWikiLinks(content) {
  // Convert [[page|alias]] to standard format
  // Logseq sometimes uses [text](link) for internal links
  return content
    .replace(/\[([^\]]+)\]\(\[\[([^\]]+)\]\]\)/g, '[[$2|$1]]')
    .trim();
}

/**
 * Convert Logseq page embeds to Lokus format
 * {{embed [[page]]}} → ![[page]]
 */
export function convertEmbeds(content) {
  return content
    .replace(/\{\{embed\s+\[\[([^\]]+)\]\]\}\}/g, '![$[$1]]')
    .replace(/\{\{embed\s+\(\(([^)]+)\)\)\}\}/g, '![[$1]]') // Block embeds
    .trim();
}

/**
 * Convert Logseq queries to code blocks (can't execute in Lokus)
 */
export function convertQueries(content) {
  return content
    .replace(/\{\{query\s+(.*?)\}\}/gs, '```query\n$1\n```')
    .trim();
}

/**
 * Clean up Logseq-specific syntax
 */
export function cleanLogseqSyntax(content) {
  return content
    // Remove SCHEDULED/DEADLINE markers
    .replace(/SCHEDULED:\s*<[^>]+>/g, '')
    .replace(/DEADLINE:\s*<[^>]+>/g, '')
    // Convert TODO/DOING/DONE to task list format
    .replace(/^(\s*-\s*)TODO\s+/gm, '$1[ ] ')
    .replace(/^(\s*-\s*)DOING\s+/gm, '$1[ ] ')
    .replace(/^(\s*-\s*)DONE\s+/gm, '$1[x] ')
    .trim();
}

/**
 * Clean up Roam-specific syntax
 */
export function cleanRoamSyntax(content) {
  return content
    // Remove {{[[TODO]]}} style tags
    .replace(/\{\{\[\[TODO\]\]\}\}/g, '- [ ]')
    .replace(/\{\{\[\[DONE\]\]\}\}/g, '- [x]')
    // Remove {{attr:: value}} style attributes
    .replace(/\{\{([^:]+)::\s*([^}]+)\}\}/g, '')
    // Clean up extra spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Convert all markdown links to absolute if relative
 * @param {string} content
 * @param {string} basePath - Base path for resolving relative links
 * @returns {string}
 */
export function resolveRelativeLinks(content, basePath) {
  // For now, just return content as-is
  // In future, could resolve relative image/file paths
  return content;
}

/**
 * Full transformation pipeline for Logseq content
 */
export function transformLogseqContent(content) {
  let result = content;

  // Step 1: Convert properties (handled separately in frontmatter.js)

  // Step 2: Clean platform-specific syntax
  result = cleanLogseqSyntax(result);

  // Step 3: Convert embeds
  result = convertEmbeds(result);

  // Step 4: Convert queries to code blocks
  result = convertQueries(result);

  // Step 5: Normalize wiki links
  result = normalizeWikiLinks(result);

  // Step 6: Convert outline structure
  result = convertLogseqOutline(result);

  // Step 7: Final cleanup
  result = cleanupMarkdown(result);

  return result;
}

/**
 * Full transformation pipeline for Roam content
 */
export function transformRoamContent(content, blocks = null) {
  let result = content;

  // If blocks provided, convert them first
  if (blocks) {
    result = convertRoamBlocks(blocks);
  }

  // Step 1: Clean platform-specific syntax
  result = cleanRoamSyntax(result);

  // Step 2: Normalize wiki links
  result = normalizeWikiLinks(result);

  // Step 3: Final cleanup
  result = cleanupMarkdown(result);

  return result;
}

export default {
  convertLogseqOutline,
  convertRoamBlocks,
  normalizeWikiLinks,
  convertEmbeds,
  convertQueries,
  cleanLogseqSyntax,
  cleanRoamSyntax,
  resolveRelativeLinks,
  transformLogseqContent,
  transformRoamContent
};
