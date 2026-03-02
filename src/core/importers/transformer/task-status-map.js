/**
 * Cross-platform task status mappings.
 *
 * Lokus supports 20 task states. This module maps platform-specific markers
 * to the appropriate Lokus checkbox character.
 */

// Logseq keyword → Lokus task state
const LOGSEQ_MAP = {
  'TODO':      ' ',
  'DOING':     '/',
  'DONE':      'x',
  'LATER':     '<',
  'NOW':       '!',
  'WAIT':      'w',
  'WAITING':   'w',
  'CANCELLED': '-',
  'CANCELED':  '-'
};

// Roam marker → Lokus task state
const ROAM_MAP = {
  '{{[[TODO]]}}':  ' ',
  '{{[[DONE]]}}':  'x',
  '{{[[DOING]]}}': '/'
};

/**
 * Map a Logseq task keyword to a Lokus checkbox state.
 * Returns null if the keyword is not a known task marker.
 */
export function mapLogseqTask(keyword) {
  return LOGSEQ_MAP[keyword.toUpperCase()] ?? null;
}

/**
 * Map a Roam task marker (e.g. "{{[[TODO]]}}") to a Lokus state.
 */
export function mapRoamTask(marker) {
  return ROAM_MAP[marker] ?? null;
}

/**
 * Strip Obsidian Tasks-plugin inline metadata from task text.
 * e.g. `Buy milk [due:: 2024-01-15] [priority:: high]` → `Buy milk`
 * Standard [ ] / [x] are already Lokus-compatible and are left untouched.
 */
export function stripObsidianTaskMeta(text) {
  return text.replace(/\s*\[[a-zA-Z]+::\s*[^\]]*\]/g, '').trim();
}

export default { mapLogseqTask, mapRoamTask, stripObsidianTaskMeta };
