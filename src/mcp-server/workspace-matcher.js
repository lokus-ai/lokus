/**
 * Smart Workspace Matcher
 * Fuzzy matching utility for workspace detection from natural language
 */

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching workspace names
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
function calculateSimilarity(str1, str2) {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return 1 - (distance / maxLength);
}

/**
 * Match workspace from natural language query
 * @param {string} query - Natural language query (e.g., "my knowledge base", "work notes")
 * @param {Array} workspaces - Array of workspace objects with {name, path}
 * @param {number} threshold - Minimum similarity threshold (0-1), default 0.6
 * @returns {Object|null} - Matched workspace or null
 */
export function matchWorkspace(query, workspaces, threshold = 0.6) {
  if (!query || !workspaces || workspaces.length === 0) {
    return null;
  }

  const normalizedQuery = query.toLowerCase().trim();

  // First pass: Look for exact matches (case-insensitive)
  for (const workspace of workspaces) {
    if (workspace.name.toLowerCase() === normalizedQuery) {
      return {
        workspace,
        confidence: 1.0,
        matchType: 'exact'
      };
    }
  }

  // Second pass: Look for substring matches
  for (const workspace of workspaces) {
    const wsName = workspace.name.toLowerCase();
    if (wsName.includes(normalizedQuery) || normalizedQuery.includes(wsName)) {
      return {
        workspace,
        confidence: 0.9,
        matchType: 'substring'
      };
    }
  }

  // Third pass: Fuzzy matching with similarity scores
  let bestMatch = null;
  let bestScore = 0;

  for (const workspace of workspaces) {
    const similarity = calculateSimilarity(normalizedQuery, workspace.name);

    if (similarity > bestScore && similarity >= threshold) {
      bestScore = similarity;
      bestMatch = workspace;
    }
  }

  if (bestMatch) {
    return {
      workspace: bestMatch,
      confidence: bestScore,
      matchType: 'fuzzy'
    };
  }

  return null;
}

/**
 * Match multiple possible workspaces and return ranked results
 * @param {string} query - Natural language query
 * @param {Array} workspaces - Array of workspace objects
 * @param {number} minThreshold - Minimum similarity to include
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Array} - Ranked array of matches with confidence scores
 */
export function matchMultipleWorkspaces(query, workspaces, minThreshold = 0.5, maxResults = 3) {
  if (!query || !workspaces || workspaces.length === 0) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const matches = [];

  for (const workspace of workspaces) {
    const wsName = workspace.name.toLowerCase();
    let confidence = 0;
    let matchType = 'fuzzy';

    // Exact match
    if (wsName === normalizedQuery) {
      confidence = 1.0;
      matchType = 'exact';
    }
    // Substring match
    else if (wsName.includes(normalizedQuery) || normalizedQuery.includes(wsName)) {
      confidence = 0.9;
      matchType = 'substring';
    }
    // Fuzzy match
    else {
      confidence = calculateSimilarity(normalizedQuery, workspace.name);
      matchType = 'fuzzy';
    }

    if (confidence >= minThreshold) {
      matches.push({
        workspace,
        confidence,
        matchType
      });
    }
  }

  // Sort by confidence (descending) and return top results
  return matches
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxResults);
}

/**
 * Extract workspace references from natural language text
 * Looks for patterns like "in my knowledge base", "from work notes", etc.
 * @param {string} text - Natural language text
 * @returns {Array} - Array of potential workspace references
 */
export function extractWorkspaceReferences(text) {
  const references = [];

  // Patterns that indicate workspace references
  const patterns = [
    /(?:in|from|to|at|on)\s+(?:my\s+)?([a-zA-Z0-9\s-]+?)(?:\s+workspace|\s+notes?|\s+folder)/gi,
    /(?:workspace|notes?|folder)\s+(?:named|called)\s+["']?([a-zA-Z0-9\s-]+?)["']?/gi,
    /["']([a-zA-Z0-9\s-]+?)["']\s+(?:workspace|notes?|folder)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      references.push(match[1].trim());
    }
  }

  return [...new Set(references)]; // Remove duplicates
}
