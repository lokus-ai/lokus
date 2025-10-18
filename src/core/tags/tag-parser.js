/**
 * Tag Parser - Extract and parse tags from note content and frontmatter
 * Supports: #tag, #nested/tag, and frontmatter tags
 */

/**
 * Extract tags from note content
 * @param {string} content - Markdown content
 * @param {object} frontmatter - Parsed frontmatter object
 * @returns {Set<string>} - Unique tags found
 */
export function extractTags(content, frontmatter = {}) {
  const tags = new Set();

  // Extract from frontmatter
  if (frontmatter && frontmatter.tags) {
    const fmTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];
    fmTags.forEach(tag => {
      const normalized = normalizeTag(tag);
      if (normalized) tags.add(normalized);
    });
  }

  // Extract inline tags from content
  const inlineTags = extractInlineTags(content);
  inlineTags.forEach(tag => tags.add(tag));

  return tags;
}

/**
 * Extract inline tags from content (#tag, #nested/tag)
 * @param {string} content - Markdown content
 * @returns {Set<string>} - Tags found in content
 */
export function extractInlineTags(content) {
  const tags = new Set();

  // Regex for hashtag pattern
  // Matches: #tag, #nested/tag, #multi-word-tag
  // Doesn't match: #123 (pure numbers), # (just hash)
  const tagRegex = /#([a-zA-Z][\w/-]*)/g;

  let match;
  while ((match = tagRegex.exec(content)) !== null) {
    const tag = match[1];

    // Skip if tag is inside code block or inline code
    if (!isInCodeBlock(content, match.index)) {
      const normalized = normalizeTag(tag);
      if (normalized && isValidTag(normalized)) {
        tags.add(normalized);
      }
    }
  }

  return tags;
}

/**
 * Check if position is inside a code block or inline code
 * @param {string} content - Full content
 * @param {number} position - Position to check
 * @returns {boolean}
 */
function isInCodeBlock(content, position) {
  // Check for inline code (`text`)
  let beforeText = content.substring(0, position);
  let afterText = content.substring(position);

  // Count backticks before and after
  const backticksBeforeSingle = (beforeText.match(/`/g) || []).length;
  const backticksBeforeTriple = (beforeText.match(/```/g) || []).length;

  // If odd number of single backticks before, we're in inline code
  if (backticksBeforeSingle % 2 !== 0) return true;

  // If odd number of triple backticks before, we're in code block
  if (backticksBeforeTriple % 2 !== 0) return true;

  return false;
}

/**
 * Normalize tag format
 * @param {string} tag - Raw tag string
 * @returns {string} - Normalized tag
 */
export function normalizeTag(tag) {
  if (!tag || typeof tag !== 'string') return '';

  // Remove leading # if present
  tag = tag.replace(/^#+/, '');

  // Trim whitespace
  tag = tag.trim();

  // Convert to lowercase for consistency
  tag = tag.toLowerCase();

  // Remove trailing slashes
  tag = tag.replace(/\/+$/, '');

  return tag;
}

/**
 * Validate tag format
 * @param {string} tag - Normalized tag
 * @returns {boolean}
 */
export function isValidTag(tag) {
  if (!tag || tag.length === 0) return false;

  // Must start with letter
  if (!/^[a-zA-Z]/.test(tag)) return false;

  // Only alphanumeric, dash, underscore, forward slash
  if (!/^[a-zA-Z0-9/_-]+$/.test(tag)) return false;

  // No pure numbers
  if (/^\d+$/.test(tag)) return false;

  // Max length
  if (tag.length > 100) return false;

  return true;
}

/**
 * Parse nested tag structure
 * @param {string} tag - Tag with potential nesting (e.g., 'parent/child/grandchild')
 * @returns {object} - Parsed tag structure
 */
export function parseNestedTag(tag) {
  const parts = tag.split('/').filter(p => p.length > 0);

  return {
    full: tag,
    parts: parts,
    parent: parts.length > 1 ? parts.slice(0, -1).join('/') : null,
    name: parts[parts.length - 1] || tag,
    depth: parts.length
  };
}

/**
 * Get all parent tags for a nested tag
 * Example: 'work/projects/lokus' -> ['work', 'work/projects', 'work/projects/lokus']
 * @param {string} tag - Nested tag
 * @returns {string[]} - Array of all parent tags including the tag itself
 */
export function getTagHierarchy(tag) {
  const parts = tag.split('/').filter(p => p.length > 0);
  const hierarchy = [];

  for (let i = 0; i < parts.length; i++) {
    hierarchy.push(parts.slice(0, i + 1).join('/'));
  }

  return hierarchy;
}

/**
 * Find tag boundaries in content for highlighting/autocomplete
 * @param {string} content - Content to search
 * @param {number} cursorPosition - Current cursor position
 * @returns {object|null} - Tag info at cursor or null
 */
export function findTagAtCursor(content, cursorPosition) {
  // Look backwards for #
  let start = cursorPosition - 1;
  while (start >= 0 && content[start] !== '#' && content[start] !== ' ' && content[start] !== '\n') {
    start--;
  }

  if (start < 0 || content[start] !== '#') return null;

  // Look forwards for end
  let end = cursorPosition;
  while (end < content.length && /[\w/-]/.test(content[end])) {
    end++;
  }

  const fullTag = content.substring(start, end);
  const tagText = content.substring(start + 1, end); // without #

  return {
    start: start,
    end: end,
    fullText: fullTag,
    tagText: tagText,
    isValid: isValidTag(normalizeTag(tagText))
  };
}

/**
 * Parse frontmatter tags from YAML
 * @param {string} yamlContent - YAML frontmatter content
 * @returns {string[]} - Array of tags
 */
export function parseFrontmatterTags(yamlContent) {
  const tags = [];

  // Match tags: or tag: followed by array or string
  const tagPatterns = [
    /tags:\s*\[(.*?)\]/g,  // tags: [tag1, tag2]
    /tags:\s*\n((?:\s*-\s*.+\n?)+)/g,  // tags:\n  - tag1\n  - tag2
    /tag:\s*(\S+)/g  // tag: singletag
  ];

  tagPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(yamlContent)) !== null) {
      const content = match[1];
      if (content) {
        // Parse array format
        if (content.includes(',')) {
          content.split(',').forEach(t => {
            const clean = t.trim().replace(/['"]/g, '');
            if (clean) tags.push(normalizeTag(clean));
          });
        }
        // Parse list format
        else if (content.includes('-')) {
          content.split('\n').forEach(line => {
            const clean = line.replace(/^\s*-\s*/, '').trim().replace(/['"]/g, '');
            if (clean) tags.push(normalizeTag(clean));
          });
        }
        // Single tag
        else {
          const clean = content.trim().replace(/['"]/g, '');
          if (clean) tags.push(normalizeTag(clean));
        }
      }
    }
  });

  return tags;
}

export default {
  extractTags,
  extractInlineTags,
  normalizeTag,
  isValidTag,
  parseNestedTag,
  getTagHierarchy,
  findTagAtCursor,
  parseFrontmatterTags
};
