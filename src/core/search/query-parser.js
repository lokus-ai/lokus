/**
 * query-parser.js - Parse and validate search queries with filters and operators
 * Supports: AND, OR, NOT operators, exact phrases, and filters (tag:, folder:, modified:)
 */

/**
 * QueryParser class - Parse and validate search queries
 */
class QueryParser {
  constructor() {
    this.operators = ['AND', 'OR', 'NOT'];
    this.filters = ['tag', 'folder', 'modified'];
  }

  /**
   * Validate a search query
   * @param {string} query - The search query to validate
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate(query) {
    const errors = [];

    if (!query || typeof query !== 'string') {
      errors.push('Query must be a non-empty string');
      return { valid: false, errors };
    }

    // Check for balanced quotes
    const quotes = (query.match(/"/g) || []).length;
    if (quotes % 2 !== 0) {
      errors.push('Unbalanced quotes in query');
    }

    // Check for valid filter syntax
    const filterRegex = /(\w+):/g;
    let match;
    while ((match = filterRegex.exec(query)) !== null) {
      const filterName = match[1];
      if (!this.filters.includes(filterName)) {
        errors.push(`Unknown filter: ${filterName}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Parse a search query into structured format
   * @param {string} query - The search query to parse
   * @returns {{ terms: string[], filters: object, combineWith: string, exactPhrases: string[] }}
   */
  parse(query) {
    const result = {
      terms: [],
      filters: {},
      combineWith: 'AND',
      exactPhrases: [],
      negatedTerms: []
    };

    if (!query) return result;

    let remaining = query;

    // Extract exact phrases first
    const phraseRegex = /"([^"]+)"/g;
    let phraseMatch;
    while ((phraseMatch = phraseRegex.exec(query)) !== null) {
      result.exactPhrases.push(phraseMatch[1]);
      remaining = remaining.replace(phraseMatch[0], '');
    }

    // Extract filters (tag:value, folder:value, modified:value)
    const filterRegex = /(\w+):(\S+)/g;
    let filterMatch;
    while ((filterMatch = filterRegex.exec(remaining)) !== null) {
      const [fullMatch, filterName, filterValue] = filterMatch;
      if (this.filters.includes(filterName)) {
        result.filters[filterName] = filterValue;
        remaining = remaining.replace(fullMatch, '');
      }
    }

    // Detect combine operator (AND or OR)
    if (remaining.includes(' OR ')) {
      result.combineWith = 'OR';
      remaining = remaining.replace(/ OR /g, ' ');
    } else if (remaining.includes(' AND ')) {
      result.combineWith = 'AND';
      remaining = remaining.replace(/ AND /g, ' ');
    }

    // Extract NOT terms
    const notRegex = /NOT\s+(\S+)/g;
    let notMatch;
    while ((notMatch = notRegex.exec(remaining)) !== null) {
      result.negatedTerms.push(notMatch[1]);
      remaining = remaining.replace(notMatch[0], '');
    }

    // Split remaining into terms
    const terms = remaining
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t && !this.operators.includes(t));

    result.terms = terms;

    return result;
  }

  /**
   * Convert parsed query back to search string
   * @param {{ terms: string[], exactPhrases: string[] }} parsed - Parsed query object
   * @returns {string} - Search string
   */
  toSearchQuery(parsed) {
    const parts = [];

    // Add exact phrases
    if (parsed.exactPhrases && parsed.exactPhrases.length > 0) {
      parts.push(...parsed.exactPhrases.map(p => `"${p}"`));
    }

    // Add regular terms
    if (parsed.terms && parsed.terms.length > 0) {
      parts.push(...parsed.terms);
    }

    return parts.join(' ');
  }
}

// Singleton instance
let queryParserInstance = null;

/**
 * Get the singleton QueryParser instance
 * @returns {QueryParser}
 */
export function getQueryParser() {
  if (!queryParserInstance) {
    queryParserInstance = new QueryParser();
  }
  return queryParserInstance;
}

/**
 * Format filters for display
 * @param {object} filters - Filters object { tag: string, folder: string, modified: string }
 * @returns {string} - Formatted filter string
 */
export function formatFilters(filters) {
  if (!filters) return '';

  const parts = [];

  if (filters.tag) {
    parts.push(`tag:${filters.tag}`);
  }

  if (filters.folder) {
    parts.push(`folder:${filters.folder}`);
  }

  if (filters.modified) {
    const modifiedLabels = {
      today: 'Today',
      yesterday: 'Yesterday',
      last7days: 'Last 7 days',
      last30days: 'Last 30 days'
    };
    const label = modifiedLabels[filters.modified] || filters.modified;
    parts.push(`modified:${label}`);
  }

  return parts.join(', ');
}

/**
 * Highlight matching text in HTML
 * @param {string} text - Text to highlight
 * @param {string} query - Search query
 * @returns {string} - HTML with highlighted matches
 */
export function highlightMatches(text, query) {
  if (!text || !query) return text || '';

  // Parse query to extract search terms
  const parser = getQueryParser();
  const parsed = parser.parse(query);

  // Collect all terms to highlight
  const allTerms = [
    ...parsed.terms,
    ...parsed.exactPhrases,
    ...parsed.negatedTerms
  ].filter(Boolean);

  if (allTerms.length === 0) return text;

  // Escape HTML
  let result = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Highlight each term (case-insensitive)
  for (const term of allTerms) {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    result = result.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  return result;
}

export default QueryParser;
