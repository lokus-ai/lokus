/**
 * Callout type normalization.
 *
 * Maps platform-specific callout types to the set Lokus supports.
 * Unsupported types are mapped to the closest equivalent.
 */

// Lokus natively supports these callout types
const LOKUS_CALLOUT_TYPES = new Set([
  'note', 'tip', 'info', 'warning', 'danger',
  'quote', 'example', 'question', 'success', 'failure',
  'bug', 'abstract', 'todo'
]);

// Obsidian types that need remapping
const OBSIDIAN_REMAP = {
  'faq':       'question',
  'help':      'question',
  'caution':   'warning',
  'attention': 'warning',
  'important': 'warning',
  'hint':      'tip',
  'cite':      'quote',
  'summary':   'abstract',
  'tldr':      'abstract',
  'check':     'success',
  'done':      'success',
  'fail':      'failure',
  'missing':   'failure',
  'error':     'danger'
};

/**
 * Normalize a callout type string to a Lokus-supported type.
 * @param {string} type - Original callout type (case-insensitive)
 * @returns {string} A Lokus-supported callout type
 */
export function normalizeCalloutType(type) {
  const lower = type.toLowerCase().trim();

  if (LOKUS_CALLOUT_TYPES.has(lower)) return lower;
  if (OBSIDIAN_REMAP[lower]) return OBSIDIAN_REMAP[lower];

  // Fallback: wrap in note
  return 'note';
}

/**
 * Check if a callout type is natively supported by Lokus.
 */
export function isSupportedCalloutType(type) {
  return LOKUS_CALLOUT_TYPES.has(type.toLowerCase().trim());
}

export default { normalizeCalloutType, isSupportedCalloutType };
