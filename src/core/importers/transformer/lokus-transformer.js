/**
 * Lokus Transformer
 *
 * Serializes the IR (Document) into Lokus-compatible output files:
 *   - Pages  → Markdown with YAML frontmatter
 *   - Canvas → .excalidraw JSON
 *   - Assets → copied via attachment-handler
 *
 * This is the ONLY module that knows Lokus syntax.
 */

import { invoke } from '@tauri-apps/api/core';
import { BlockType } from '../ir.js';
import { propertiesToYAML } from '../utils/frontmatter.js';
import { canvasToExcalidraw } from './canvas-converter.js';
import { copyAssets, remapAssetPaths } from '../utils/attachment-handler.js';

/**
 * Transform an IR Document into files written to destPath.
 * @param {Object} document - IR Document { pages, canvases, assets }
 * @param {string} destPath - Destination workspace root
 * @param {Object} [callbacks] - { onProgress(current, total, message) }
 * @returns {Promise<{pagesWritten:number, canvasesWritten:number, assetsCopied:number, errors:string[]}>}
 */
export async function transformDocument(document, destPath, callbacks = {}) {
  const errors = [];
  const total = document.pages.length + document.canvases.length;
  let current = 0;

  // --- Assets first (so remapping works) ---
  let assetsCopied = 0;
  if (document.assets.length > 0) {
    const assetResult = await copyAssets(document.assets, destPath);
    assetsCopied = assetResult.copied;
    errors.push(...assetResult.errors);
  }

  // --- Pages ---
  let pagesWritten = 0;
  for (const page of document.pages) {
    try {
      current++;
      callbacks.onProgress?.(current, total, page.path || page.title);

      let markdown = serializePage(page);

      // Remap asset paths if we have assets
      if (document.assets.length > 0) {
        markdown = remapAssetPaths(markdown, document.assets);
      }

      const filePath = `${destPath}/${page.path || slugToPath(page.slug || page.title)}`;
      await ensureParentDir(filePath);
      await invoke('write_file', { path: filePath, content: markdown });
      pagesWritten++;
    } catch (err) {
      errors.push(`Page "${page.title}": ${err.message}`);
    }
  }

  // --- Canvases ---
  let canvasesWritten = 0;
  for (const canvas of document.canvases) {
    try {
      current++;
      callbacks.onProgress?.(current, total, canvas.name);

      const excalidraw = canvasToExcalidraw(canvas);
      const filePath = `${destPath}/${canvas.name.replace(/\.canvas$/, '')}.excalidraw`;
      await ensureParentDir(filePath);
      await invoke('write_file', { path: filePath, content: excalidraw });
      canvasesWritten++;
    } catch (err) {
      errors.push(`Canvas "${canvas.name}": ${err.message}`);
    }
  }

  return { pagesWritten, canvasesWritten, assetsCopied, errors };
}

// ---------------------------------------------------------------------------
// Page serialisation
// ---------------------------------------------------------------------------

/**
 * Serialize a single IR Page to a markdown string.
 */
export function serializePage(page) {
  const parts = [];

  // Frontmatter
  if (page.frontmatter && Object.keys(page.frontmatter).length > 0) {
    parts.push(propertiesToYAML(page.frontmatter));
    parts.push('');
  }

  // Blocks
  parts.push(serializeBlocks(page.blocks, 0));

  return parts.join('\n').replace(/\n{4,}/g, '\n\n\n').trim() + '\n';
}

/**
 * Recursively serialize an array of IR Blocks.
 */
function serializeBlocks(blocks, indentLevel) {
  const lines = [];

  for (const block of blocks) {
    const indent = '  '.repeat(indentLevel);

    switch (block.type) {
      case BlockType.HEADING: {
        const lvl = Math.min(Math.max(block.level || 1, 1), 6);
        lines.push('');
        lines.push('#'.repeat(lvl) + ' ' + block.content);
        break;
      }

      case BlockType.TASK: {
        const state = block.meta.taskState || ' ';
        lines.push(`${indent}- [${state}] ${block.content}`);
        break;
      }

      case BlockType.LIST: {
        lines.push(`${indent}- ${block.content}`);
        break;
      }

      case BlockType.CALLOUT: {
        const calloutType = block.meta.calloutType || 'note';
        const title = block.meta.calloutTitle || '';
        const header = title ? `> [!${calloutType}] ${title}` : `> [!${calloutType}]`;
        lines.push(header);
        if (block.content) {
          for (const cLine of block.content.split('\n')) {
            lines.push(`> ${cLine}`);
          }
        }
        break;
      }

      case BlockType.CODE: {
        const lang = block.meta.language || '';
        lines.push('```' + lang);
        lines.push(block.content);
        lines.push('```');
        break;
      }

      case BlockType.EMBED: {
        lines.push(`![[${block.content}]]`);
        break;
      }

      case BlockType.BLOCKREF: {
        // Will be resolved to [[target#^id]] by block-resolver in the importer
        lines.push(block.content);
        break;
      }

      case BlockType.UNSUPPORTED: {
        const label = block.meta.label || 'Unsupported';
        lines.push(`> [!info] ${label}`);
        if (block.meta.originalSyntax) {
          for (const uLine of block.meta.originalSyntax.split('\n')) {
            lines.push(`> ${uLine}`);
          }
        } else if (block.content) {
          for (const uLine of block.content.split('\n')) {
            lines.push(`> ${uLine}`);
          }
        }
        break;
      }

      case BlockType.TEXT:
      default: {
        lines.push(indent + block.content);
        break;
      }
    }

    // Recurse into children
    if (block.children && block.children.length > 0) {
      lines.push(serializeBlocks(block.children, indentLevel + 1));
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugToPath(titleOrSlug) {
  const slug = titleOrSlug
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
  return slug + '.md';
}

async function ensureParentDir(filePath) {
  const parent = filePath.substring(0, filePath.lastIndexOf('/'));
  if (!parent) return;
  try {
    const exists = await invoke('path_exists', { path: parent });
    if (!exists) {
      await invoke('create_directory', { path: parent, recursive: true });
    }
  } catch {
    // best effort
  }
}

export default { transformDocument, serializePage };
