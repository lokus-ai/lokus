/**
 * Block ID generator — 10-char base36, cryptographically random.
 *
 * Collision space: 36^10 ≈ 3.7 × 10^15.
 * At 500k blocks the collision probability is ~10^-5% — effectively zero.
 * Plus: SQLite enforces UNIQUE(id) on the blocks table as a second line of defence.
 *
 * Format matches the regex `[a-zA-Z0-9_-]+` used by `block-parser.js` and
 * `BlockId.js` for detecting user-typed `^id` markers — no parser changes needed.
 *
 * Uses rejection sampling to avoid modulo bias (each char drawn from a
 * uniformly-distributed source).
 */

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz'
const REJECT_THRESHOLD = 252 // 7 * 36 — largest multiple of 36 that fits in a byte

/**
 * Generate a new block ID.
 * @returns {string} 10-char base36 ID, e.g. "a3x9k2m4p7"
 */
export function generateBlockId() {
  const id = new Array(10)
  const buf = new Uint8Array(32)
  let filled = 0
  let bufIdx = buf.length // force initial fill

  while (filled < 10) {
    if (bufIdx >= buf.length) {
      if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(buf)
      } else {
        // Degraded fallback for non-browser environments (tests without jsdom crypto).
        // Still uniform via rejection sampling.
        for (let i = 0; i < buf.length; i++) {
          buf[i] = Math.floor(Math.random() * 256)
        }
      }
      bufIdx = 0
    }
    const byte = buf[bufIdx++]
    if (byte < REJECT_THRESHOLD) {
      id[filled++] = BASE36[byte % 36]
    }
  }
  return id.join('')
}

export default generateBlockId
