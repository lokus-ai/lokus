import Fuse from 'fuse.js';

/**
 * Fuzzy Matcher using Fuse.js
 *
 * Provides fuzzy search capabilities for files, headings, tags, and content.
 * Used by QuickSwitcher and other search features.
 */

/**
 * Create a fuzzy search instance for files
 * @param {Array} files - Array of file objects with { path, name, content }
 * @returns {Fuse} Fuse instance
 */
export function createFileMatcher(files) {
  const options = {
    keys: [
      { name: 'name', weight: 0.7 },
      { name: 'path', weight: 0.3 },
    ],
    threshold: 0.4, // Lower = more strict matching
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,
    ignoreLocation: true, // Search entire string
  };

  return new Fuse(files, options);
}

/**
 * Create a fuzzy search instance for headings
 * @param {Array} headings - Array of heading objects with { text, file, level }
 * @returns {Fuse} Fuse instance
 */
export function createHeadingMatcher(headings) {
  const options = {
    keys: [
      { name: 'text', weight: 0.8 },
      { name: 'file', weight: 0.2 },
    ],
    threshold: 0.3,
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,
    ignoreLocation: true,
  };

  return new Fuse(headings, options);
}

/**
 * Create a fuzzy search instance for tags
 * @param {Array} tags - Array of tag objects with { tag, files }
 * @returns {Fuse} Fuse instance
 */
export function createTagMatcher(tags) {
  const options = {
    keys: ['tag'],
    threshold: 0.2,
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 1,
    ignoreLocation: true,
  };

  return new Fuse(tags, options);
}

/**
 * Create a fuzzy search instance for full-text content search
 * @param {Array} documents - Array of document objects with { path, name, content }
 * @returns {Fuse} Fuse instance
 */
export function createContentMatcher(documents) {
  const options = {
    keys: [
      { name: 'content', weight: 0.6 },
      { name: 'name', weight: 0.3 },
      { name: 'path', weight: 0.1 },
    ],
    threshold: 0.4,
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 3,
    distance: 100, // How far to search for matches
  };

  return new Fuse(documents, options);
}

/**
 * Extract headings from HTML or markdown content
 * @param {string} content - HTML or markdown content
 * @param {string} filePath - File path for reference
 * @returns {Array} Array of heading objects
 */
export function extractHeadings(content, filePath) {
  const headings = [];

  // Match HTML headings
  const htmlRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
  let match;

  while ((match = htmlRegex.exec(content)) !== null) {
    const level = parseInt(match[1], 10);
    const text = match[2].replace(/<[^>]*>/g, '').trim(); // Strip HTML tags

    if (text) {
      headings.push({
        level,
        text,
        file: filePath,
        position: match.index,
      });
    }
  }

  // Also match markdown headings if no HTML found
  if (headings.length === 0) {
    const mdRegex = /^(#{1,6})\s+(.+)$/gm;

    while ((match = mdRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();

      if (text) {
        headings.push({
          level,
          text,
          file: filePath,
          position: match.index,
        });
      }
    }
  }

  return headings;
}

/**
 * Extract tags from content
 * @param {string} content - Content to extract tags from
 * @returns {Array} Array of unique tags
 */
export function extractTags(content) {
  const tagRegex = /#([a-zA-Z0-9_-]+)/g;
  const tags = new Set();
  let match;

  while ((match = tagRegex.exec(content)) !== null) {
    tags.add(match[1]);
  }

  return Array.from(tags);
}

/**
 * Get preview text from content (first N characters)
 * @param {string} content - Content to preview
 * @param {number} maxLength - Maximum length (default: 150)
 * @returns {string} Preview text
 */
export function getPreviewText(content, maxLength = 150) {
  // Strip HTML tags
  const text = content.replace(/<[^>]*>/g, '').trim();

  if (text.length <= maxLength) {
    return text;
  }

  // Truncate at word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Sort results by score and recency
 * @param {Array} results - Fuse search results
 * @param {Array} recentFiles - Array of recently accessed file paths
 * @returns {Array} Sorted results
 */
export function sortResults(results, recentFiles = []) {
  return results.sort((a, b) => {
    const aPath = a.item.path || a.item.file;
    const bPath = b.item.path || b.item.file;

    // Prioritize recent files
    const aRecent = recentFiles.indexOf(aPath);
    const bRecent = recentFiles.indexOf(bPath);

    if (aRecent !== -1 && bRecent === -1) return -1;
    if (bRecent !== -1 && aRecent === -1) return 1;
    if (aRecent !== -1 && bRecent !== -1) {
      if (aRecent !== bRecent) return aRecent - bRecent;
    }

    // Sort by score (lower is better)
    return a.score - b.score;
  });
}

/**
 * Highlight matches in text
 * @param {string} text - Original text
 * @param {Array} matches - Fuse.js matches array
 * @returns {string} HTML with highlighted matches
 */
export function highlightMatches(text, matches) {
  if (!matches || matches.length === 0) {
    return text;
  }

  // Collect all match indices
  const indices = [];
  matches.forEach((match) => {
    if (match.indices) {
      indices.push(...match.indices);
    }
  });

  if (indices.length === 0) {
    return text;
  }

  // Sort indices by start position
  indices.sort((a, b) => a[0] - b[0]);

  // Build highlighted string
  let result = '';
  let lastIndex = 0;

  indices.forEach(([start, end]) => {
    // Add text before match
    result += text.substring(lastIndex, start);

    // Add highlighted match
    result += `<mark class="search-highlight">${text.substring(start, end + 1)}</mark>`;

    lastIndex = end + 1;
  });

  // Add remaining text
  result += text.substring(lastIndex);

  return result;
}

export default {
  createFileMatcher,
  createHeadingMatcher,
  createTagMatcher,
  createContentMatcher,
  extractHeadings,
  extractTags,
  getPreviewText,
  sortResults,
  highlightMatches,
};
