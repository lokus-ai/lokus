/**
 * Block Reference Resolver
 *
 * Handles conversion of block references from different platforms:
 * - Logseq: ((uuid)) → ^blockid
 * - Roam: ((uid)) → ^blockid
 */

/**
 * Generate a readable block ID from content
 * @param {string} content - Block content
 * @returns {string} Block ID
 */
export function generateBlockId(content) {
  // Take first 3-4 words and create a readable ID
  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0)
    .slice(0, 4);

  if (words.length === 0) {
    return generateRandomBlockId();
  }

  const baseId = words.join('-');

  // Add short hash to avoid collisions
  const hash = simpleHash(content).toString(36).slice(0, 3);

  return `${baseId}-${hash}`;
}

/**
 * Generate a random block ID
 */
export function generateRandomBlockId() {
  return Math.random().toString(36).substring(2, 8);
}

/**
 * Simple hash function for strings
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Block Reference Map
 * Maps UUIDs/UIDs to block content and generated IDs
 */
export class BlockReferenceMap {
  constructor() {
    this.uuidToBlock = new Map(); // uuid -> {content, blockId, filePath}
    this.blockIdToContent = new Map(); // blockId -> content
  }

  /**
   * Register a block with its UUID
   * @param {string} uuid - Original UUID/UID
   * @param {string} content - Block content
   * @param {string} filePath - File where block appears
   * @returns {string} Generated block ID
   */
  registerBlock(uuid, content, filePath) {
    // Generate readable block ID
    const blockId = generateBlockId(content);

    // Store mapping
    this.uuidToBlock.set(uuid, { content, blockId, filePath });
    this.blockIdToContent.set(blockId, content);

    return blockId;
  }

  /**
   * Get block info by UUID
   * @param {string} uuid
   * @returns {Object|null} {content, blockId, filePath}
   */
  getBlockByUUID(uuid) {
    return this.uuidToBlock.get(uuid) || null;
  }

  /**
   * Get generated block ID for UUID
   * @param {string} uuid
   * @returns {string|null}
   */
  getBlockId(uuid) {
    const block = this.uuidToBlock.get(uuid);
    return block ? block.blockId : null;
  }

  /**
   * Check if UUID exists
   */
  hasUUID(uuid) {
    return this.uuidToBlock.has(uuid);
  }

  /**
   * Get all UUIDs
   */
  getAllUUIDs() {
    return Array.from(this.uuidToBlock.keys());
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalBlocks: this.uuidToBlock.size,
      totalUUIDs: this.uuidToBlock.size
    };
  }
}

/**
 * Convert UUID block references to Lokus format
 * @param {string} content - Markdown content with ((uuid)) references
 * @param {BlockReferenceMap} blockMap
 * @param {string} currentFilePath - Current file path for relative links
 * @returns {Object} {content: string, unresolvedRefs: Array}
 */
export function convertBlockReferences(content, blockMap, currentFilePath = '') {
  const unresolvedRefs = [];

  // Match ((uuid)) pattern
  const pattern = /\(\(([a-f0-9-]+)\)\)/g;

  const convertedContent = content.replace(pattern, (match, uuid) => {
    const block = blockMap.getBlockByUUID(uuid);

    if (!block) {
      unresolvedRefs.push(uuid);
      // Keep original if unresolved
      return match;
    }

    const { blockId, filePath } = block;

    // If reference is in same file, use simple syntax
    if (filePath === currentFilePath) {
      return `[[#^${blockId}]]`;
    }

    // If different file, include file name
    const fileName = getFileNameWithoutExt(filePath);
    return `[[${fileName}#^${blockId}]]`;
  });

  return { content: convertedContent, unresolvedRefs };
}

/**
 * Add block ID marker to content
 * @param {string} content - Original content
 * @param {string} blockId - Block ID to add
 * @returns {string} Content with ^blockid marker
 */
export function addBlockIdMarker(content, blockId) {
  // Add block ID at end of line/paragraph
  return `${content} ^${blockId}`;
}

/**
 * Extract UUID from Logseq/Roam block reference
 * @param {string} text
 * @returns {Array<string>} Array of UUIDs found
 */
export function extractUUIDs(text) {
  const pattern = /\(\(([a-f0-9-]+)\)\)/g;
  const uuids = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    uuids.push(match[1]);
  }

  return uuids;
}

/**
 * Get file name without extension
 */
function getFileNameWithoutExt(filePath) {
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];
  return fileName.replace(/\.[^.]+$/, '');
}

/**
 * Find all block references in content and mark them
 * @param {string} content
 * @param {BlockReferenceMap} blockMap
 * @returns {string} Content with block IDs added
 */
export function markBlocksInContent(content, blockMap) {
  const lines = content.split('\n');
  const markedLines = [];

  for (const line of lines) {
    // Skip empty lines and frontmatter
    if (!line.trim() || line.trim() === '---') {
      markedLines.push(line);
      continue;
    }

    // Check if line contains block references
    const uuids = extractUUIDs(line);

    if (uuids.length > 0) {
      // This line is referenced, add block ID
      const blockId = generateBlockId(line);
      markedLines.push(addBlockIdMarker(line, blockId));
    } else {
      markedLines.push(line);
    }
  }

  return markedLines.join('\n');
}

export default {
  generateBlockId,
  generateRandomBlockId,
  BlockReferenceMap,
  convertBlockReferences,
  addBlockIdMarker,
  extractUUIDs,
  markBlocksInContent
};
