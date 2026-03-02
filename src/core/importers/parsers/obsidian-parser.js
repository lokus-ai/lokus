/**
 * Obsidian → IR Parser
 *
 * Reads an Obsidian vault and produces an IR Document.
 * Handles: .md files, .canvas files, callouts, comments, dataview,
 * Tasks-plugin metadata, and Obsidian-specific frontmatter keys.
 */

import { invoke } from '@tauri-apps/api/core';
import {
  createDocument, createPage, createBlock, createCanvas,
  createCanvasNode, createCanvasEdge, createAsset, BlockType
} from '../ir.js';
import { extractFrontmatter, stripObsidianKeys } from '../utils/frontmatter.js';
import { normalizeCalloutType } from '../utils/callout-converter.js';
import { stripObsidianTaskMeta } from '../transformer/task-status-map.js';

/**
 * Parse an Obsidian vault directory into an IR Document.
 * @param {string} vaultPath - Path to the Obsidian vault root
 * @param {Object} [callbacks] - { onProgress(current, total, message) }
 * @returns {Promise<Object>} IR Document
 */
export async function parseObsidianVault(vaultPath, callbacks = {}) {
  const mdFiles = [];
  const canvasFiles = [];
  const assetFiles = [];

  // Discover files
  await walkDirectory(vaultPath, (fullPath, name, isDir) => {
    if (isDir) return;
    if (name.endsWith('.md')) mdFiles.push(fullPath);
    else if (name.endsWith('.canvas')) canvasFiles.push(fullPath);
    else if (isAssetFile(name)) assetFiles.push(fullPath);
  });

  const total = mdFiles.length + canvasFiles.length;
  let current = 0;

  // Parse pages
  const pages = [];
  for (const filePath of mdFiles) {
    current++;
    callbacks.onProgress?.(current, total, filePath.split('/').pop());

    try {
      const content = await invoke('read_file_content', { path: filePath });
      const relativePath = filePath.substring(vaultPath.length + 1);
      const page = parseObsidianFile(content, relativePath);
      pages.push(page);
    } catch (err) {
      // skip files that can't be read
    }
  }

  // Parse canvases
  const canvases = [];
  for (const filePath of canvasFiles) {
    current++;
    callbacks.onProgress?.(current, total, filePath.split('/').pop());

    try {
      const raw = await invoke('read_file_content', { path: filePath });
      const canvas = parseCanvasFile(raw, filePath.split('/').pop());
      canvases.push(canvas);
    } catch {
      // skip
    }
  }

  // Build asset list (referenced by pages)
  const assets = assetFiles.map(sourcePath => {
    const fileName = sourcePath.split('/').pop();
    return createAsset({ sourcePath, destPath: '', referencedBy: [fileName] });
  });

  return createDocument({ pages, canvases, assets });
}

// ---------------------------------------------------------------------------
// Single-file parsing
// ---------------------------------------------------------------------------

function parseObsidianFile(content, relativePath) {
  // Extract and clean frontmatter
  const { data: rawFm, content: body } = extractFrontmatter(content);
  const frontmatter = stripObsidianKeys(rawFm);

  // Determine if daily note (common patterns: daily-notes/, journals/, or date-like name)
  const fileName = relativePath.split('/').pop().replace(/\.md$/, '');
  const isDaily = /^\d{4}-\d{2}-\d{2}$/.test(fileName) ||
    relativePath.startsWith('daily-notes/') ||
    relativePath.startsWith('journals/');

  const blocks = parseBodyToBlocks(body);

  // If it's already in a subfolder, keep that structure; else put at root
  const path = relativePath;

  return createPage({
    title: fileName,
    slug: fileName,
    path,
    frontmatter,
    blocks,
    isDaily,
    sourceFile: relativePath
  });
}

/**
 * Parse markdown body into IR Blocks.
 */
function parseBodyToBlocks(body) {
  const lines = body.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // --- Obsidian comment %%...%% (strip) ---
    if (line.includes('%%')) {
      // Single-line comment
      if (/^%%.*%%$/.test(line.trim())) {
        i++;
        continue;
      }
      // Multi-line comment
      if (line.trim().startsWith('%%')) {
        i++;
        while (i < lines.length && !lines[i].includes('%%')) i++;
        i++; // skip closing %%
        continue;
      }
    }

    // --- Dataview / unsupported fenced code blocks ---
    if (/^```(dataview|dataviewjs|query)\s*$/i.test(line.trim())) {
      const lang = line.trim().match(/^```(\w+)/)[1];
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(createBlock({
        type: BlockType.UNSUPPORTED,
        content: codeLines.join('\n'),
        meta: {
          label: `${lang} query (unsupported)`,
          originalSyntax: '```' + lang + '\n' + codeLines.join('\n') + '\n```'
        }
      }));
      continue;
    }

    // --- Regular code blocks (pass through) ---
    if (line.trim().startsWith('```')) {
      const lang = (line.trim().match(/^```(.*)$/) || [])[1] || '';
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(createBlock({
        type: BlockType.CODE,
        content: codeLines.join('\n'),
        meta: { language: lang }
      }));
      continue;
    }

    // --- Callout ---
    if (/^>\s*\[!(\w+)\]/.test(line)) {
      const match = line.match(/^>\s*\[!(\w+)\]\s*(.*)?$/);
      const rawType = match[1];
      const title = (match[2] || '').trim();
      const calloutType = normalizeCalloutType(rawType);
      const bodyLines = [];
      i++;
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        bodyLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(createBlock({
        type: BlockType.CALLOUT,
        content: bodyLines.join('\n'),
        meta: { calloutType, calloutTitle: title }
      }));
      continue;
    }

    // --- Heading ---
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push(createBlock({
        type: BlockType.HEADING,
        content: headingMatch[2],
        level: headingMatch[1].length
      }));
      i++;
      continue;
    }

    // --- Task ---
    const taskMatch = line.match(/^(\s*)-\s+\[(.)\]\s+(.+)$/);
    if (taskMatch) {
      const state = taskMatch[2];
      const text = stripObsidianTaskMeta(taskMatch[3]);
      const indent = Math.floor((taskMatch[1] || '').length / 2);
      blocks.push(createBlock({
        type: BlockType.TASK,
        content: text,
        level: indent,
        meta: { taskState: state }
      }));
      i++;
      continue;
    }

    // --- List item ---
    const listMatch = line.match(/^(\s*)-\s+(.+)$/);
    if (listMatch) {
      const indent = Math.floor((listMatch[1] || '').length / 2);
      blocks.push(createBlock({
        type: BlockType.LIST,
        content: listMatch[2],
        level: indent
      }));
      i++;
      continue;
    }

    // --- Regular text ---
    blocks.push(createBlock({ type: BlockType.TEXT, content: line }));
    i++;
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Canvas parsing
// ---------------------------------------------------------------------------

function parseCanvasFile(rawJson, fileName) {
  const data = JSON.parse(rawJson);
  const elements = (data.nodes || []).map(n => createCanvasNode({
    id: n.id,
    type: n.type === 'file' ? 'file' : 'text',
    x: n.x || 0,
    y: n.y || 0,
    width: n.width || 250,
    height: n.height || 60,
    text: n.text || '',
    file: n.file || ''
  }));

  const edges = (data.edges || []).map(e => createCanvasEdge({
    id: e.id,
    fromNode: e.fromNode,
    toNode: e.toNode,
    label: e.label || ''
  }));

  return createCanvas({ name: fileName, elements, edges });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function walkDirectory(dirPath, visitor) {
  try {
    const entries = await invoke('read_directory', { path: dirPath });
    for (const entry of entries) {
      // Skip hidden dirs and Obsidian internals
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;

      const fullPath = `${dirPath}/${entry.name}`;
      if (entry.is_dir) {
        visitor(fullPath, entry.name, true);
        await walkDirectory(fullPath, visitor);
      } else {
        visitor(fullPath, entry.name, false);
      }
    }
  } catch {
    // skip unreadable dirs
  }
}

const ASSET_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp',
  '.pdf', '.mp3', '.mp4', '.wav', '.ogg', '.webm'
]);

function isAssetFile(name) {
  const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
  return ASSET_EXTENSIONS.has(ext);
}

export default { parseObsidianVault };
