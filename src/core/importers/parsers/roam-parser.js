/**
 * Roam → IR Parser
 *
 * Reads a Roam Research JSON export and produces an IR Document.
 * Handles: nested blocks, page refs, tags, block UIDs, attributes,
 * date-page titles, and Firebase image URLs.
 */

import {
  createDocument, createPage, createBlock, createAsset, BlockType
} from '../ir.js';
import { parseRoamDateTitle, formatDateSlug } from '../utils/frontmatter.js';
import { mapRoamTask } from '../transformer/task-status-map.js';
import { BlockReferenceMap } from '../utils/block-resolver.js';

/**
 * Parse a Roam JSON export into an IR Document.
 * @param {Array} roamPages - Parsed JSON array (the export file contents)
 * @param {Object} [callbacks] - { onProgress(current, total, message) }
 * @returns {{ document: Object, blockMap: BlockReferenceMap }}
 */
export function parseRoamExport(roamPages, callbacks = {}) {
  const blockMap = new BlockReferenceMap();
  const total = roamPages.length;

  // First pass: register all block UIDs
  for (const page of roamPages) {
    const title = getPageTitle(page);
    const fileName = sanitizeFileName(title);
    registerBlocksRecursive(page.children || [], fileName, blockMap);
  }

  // Second pass: build IR pages
  const pages = [];
  for (let i = 0; i < roamPages.length; i++) {
    const page = roamPages[i];
    callbacks.onProgress?.(i + 1, total, getPageTitle(page));

    try {
      pages.push(convertRoamPage(page, blockMap));
    } catch {
      // skip
    }
  }

  // Roam doesn't ship assets in the JSON export;
  // Firebase image URLs are kept as-is in content.
  return {
    document: createDocument({ pages, canvases: [], assets: [] }),
    blockMap
  };
}

// ---------------------------------------------------------------------------
// Page conversion
// ---------------------------------------------------------------------------

function convertRoamPage(page, blockMap) {
  const title = getPageTitle(page);
  const children = page.children || [];

  // Frontmatter from metadata
  const frontmatter = {};
  if (page['create-time']) {
    frontmatter.created = new Date(page['create-time']).toISOString();
  }
  if (page['edit-time']) {
    frontmatter.modified = new Date(page['edit-time']).toISOString();
  }
  const tags = extractTags(page);
  if (tags.length > 0) frontmatter.tags = tags;

  // Extract top-level attributes (key:: value pattern in block strings)
  for (const child of children) {
    const attrMatch = (child.string || '').match(/^([a-zA-Z0-9_-]+)::\s*(.+)$/);
    if (attrMatch) {
      frontmatter[attrMatch[1]] = attrMatch[2].trim();
    }
  }

  // Check if daily note
  const parsedDate = parseRoamDateTitle(title);
  const isDaily = parsedDate !== null;

  let pagePath;
  if (isDaily) {
    pagePath = `daily-notes/${formatDateSlug(parsedDate)}.md`;
  } else {
    pagePath = `${sanitizeFileName(title)}.md`;
  }

  // Convert blocks to IR
  const blocks = convertRoamBlocks(children, 0);

  return createPage({
    title,
    slug: sanitizeFileName(title),
    path: pagePath,
    frontmatter,
    blocks,
    isDaily,
    sourceFile: `roam-export/${sanitizeFileName(title)}.json`
  });
}

// ---------------------------------------------------------------------------
// Block conversion
// ---------------------------------------------------------------------------

function convertRoamBlocks(blocks, level) {
  const result = [];

  for (const block of blocks) {
    const raw = block.string || block.content || '';
    if (!raw.trim() && (!block.children || block.children.length === 0)) continue;

    // Skip attribute blocks (already extracted to frontmatter)
    if (/^[a-zA-Z0-9_-]+::\s+/.test(raw) && level === 0) continue;

    const irBlock = convertSingleBlock(raw, level);
    result.push(irBlock);

    // Recurse children
    if (block.children && block.children.length > 0) {
      irBlock.children = convertRoamBlocks(block.children, level + 1);
    }
  }

  return result;
}

function convertSingleBlock(raw, level) {
  let text = raw;

  // Task markers: {{[[TODO]]}}, {{[[DONE]]}}, {{[[DOING]]}}
  const taskMarkers = ['{{[[TODO]]}}', '{{[[DONE]]}}', '{{[[DOING]]}}'];
  for (const marker of taskMarkers) {
    if (text.includes(marker)) {
      const state = mapRoamTask(marker);
      text = text.replace(marker, '').trim();
      return createBlock({
        type: BlockType.TASK,
        content: processRoamInline(text),
        level,
        meta: { taskState: state || ' ' }
      });
    }
  }

  // Top-level short blocks → heading
  if (level === 0 && text.length < 80 && !text.includes('.')) {
    return createBlock({
      type: BlockType.HEADING,
      content: processRoamInline(text),
      level: 2
    });
  }

  // Default: list item
  return createBlock({
    type: BlockType.LIST,
    content: processRoamInline(text),
    level
  });
}

// ---------------------------------------------------------------------------
// Inline syntax processing
// ---------------------------------------------------------------------------

function processRoamInline(text) {
  let result = text;

  // #[[multi word tag]] → #multi-word-tag
  result = result.replace(/#\[\[([^\]]+)\]\]/g, (_, inner) => {
    return '#' + inner.replace(/\s+/g, '-').toLowerCase();
  });

  // {{[[TODO]]}}, {{[[DONE]]}} (stray ones not caught earlier)
  result = result.replace(/\{\{\[\[TODO\]\]\}\}/g, '');
  result = result.replace(/\{\{\[\[DONE\]\]\}\}/g, '');
  result = result.replace(/\{\{\[\[DOING\]\]\}\}/g, '');

  // {{attr:: value}} → strip
  result = result.replace(/\{\{([^:]+)::\s*([^}]+)\}\}/g, '');

  // Normalize wiki link aliases: [text]([[page]]) → [[page|text]]
  result = result.replace(/\[([^\]]+)\]\(\[\[([^\]]+)\]\]\)/g, '[[$2|$1]]');

  return result.trim();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPageTitle(page) {
  return page.title || page['page-title'] || 'Untitled';
}

function extractTags(page) {
  const tags = [];
  if (page.tags && Array.isArray(page.tags)) {
    tags.push(...page.tags);
  }
  const title = getPageTitle(page);
  const tagMatches = title.match(/#(\w+)/g);
  if (tagMatches) {
    tags.push(...tagMatches.map(t => t.slice(1)));
  }
  return [...new Set(tags)];
}

function sanitizeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

function registerBlocksRecursive(blocks, fileName, blockMap) {
  for (const block of blocks) {
    if (block.uid) {
      const content = block.string || block.content || '';
      blockMap.registerBlock(block.uid, content, fileName);
    }
    if (block.children && block.children.length > 0) {
      registerBlocksRecursive(block.children, fileName, blockMap);
    }
  }
}

export default { parseRoamExport };
