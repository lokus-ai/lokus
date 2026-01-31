/**
 * Attendee Linker - Convert attendee names/emails to wiki-links
 * 
 * Matches attendees against existing pages in the workspace:
 * 1. Exact match: "John Smith" → [[John Smith]]
 * 2. Email prefix: "john.smith@company.com" → [[John Smith]]
 * 3. Partial match: "John" → [[John Smith]] (if only one match)
 */

/** Get file index from global scope */
function getFileIndex() {
  const index = globalThis.__LOKUS_FILE_INDEX__ || [];
  return Array.isArray(index) ? index : [];
}

/** Normalize string for comparison */
function normalize(str) {
  return (str || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/\.md$/i, '');
}

/** Extract name from email: john.smith@company.com → John Smith */
function nameFromEmail(email) {
  if (!email?.includes('@')) return null;
  const local = email.split('@')[0];
  return local?.replace(/[._-]/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .trim() || null;
}

/** Check if string is email format */
function isEmail(str) {
  return str && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
}

/** Get display title from file (without .md) */
function getTitle(file) {
  const title = file.title || file.path?.split('/').pop() || '';
  return title.replace(/\.md$/i, '');
}

/** Find matching file for a name */
function findMatch(name, files) {
  const normalized = normalize(name);
  if (!normalized) return null;
  
  // Exact match
  const exact = files.find(f => normalize(getTitle(f)) === normalized);
  if (exact) return exact;
  
  // Partial match (only if exactly one result)
  const partial = files.filter(f => {
    const title = normalize(getTitle(f));
    return title.startsWith(normalized) || title.includes(` ${normalized}`);
  });
  return partial.length === 1 ? partial[0] : null;
}

/** Match single attendee to wiki page */
function matchAttendee(attendee, files) {
  const name = (attendee || '').trim();
  if (!name) return name;
  
  // Try direct match
  let match = findMatch(name, files);
  if (match) return `[[${getTitle(match)}]]`;
  
  // Try email extraction
  if (isEmail(name)) {
    const extracted = nameFromEmail(name);
    if (extracted) {
      match = findMatch(extracted, files);
      if (match) return `[[${getTitle(match)}]]`;
    }
  }
  
  return name; // No match - return as plain text
}

/**
 * Convert attendees string to wiki-linked string
 * @param {string|Array} attendees - Comma-separated string or array
 * @returns {string} Attendees with wiki-links where matches exist
 * 
 * @example
 * linkAttendees("John Smith, jane@company.com, Unknown")
 * // → "[[John Smith]], [[Jane Doe]], Unknown"
 */
export function linkAttendees(attendees) {
  if (!attendees) return '';
  
  const files = getFileIndex();
  
  // Parse input to array
  const list = Array.isArray(attendees)
    ? attendees.map(a => typeof a === 'string' ? a : a.displayName || a.name || a.email || '')
    : String(attendees).split(',');
  
  // Match each attendee and join
  return list
    .map(a => a.trim())
    .filter(a => a.length > 0)
    .map(a => matchAttendee(a, files))
    .join(', ');
}
