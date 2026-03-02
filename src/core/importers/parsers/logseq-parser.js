/**
 * Logseq → IR Parser
 *
 * Reads a Logseq graph directory and produces an IR Document.
 * Handles: outline bullets, properties, block refs, embeds, queries,
 * task keywords, namespaces, daily journals, and assets.
 */

import { invoke } from '@tauri-apps/api/core';
import {
  createDocument, createPage, createBlock, createAsset, BlockType
} from '../ir.js';
import { parseLogseqProperties } from '../utils/frontmatter.js';
import { mapLogseqTask } from '../transformer/task-status-map.js';
import { normalizeCalloutType } from '../utils/callout-converter.js';
import { BlockReferenceMap, extractUUIDs } from '../utils/block-resolver.js';

/**
 * Parse a Logseq graph directory into an IR Document.
 * @param {string} graphPath - Path to Logseq graph root
 * @param {Object} [callbacks] - { onProgress(current, total, message) }
 * @returns {Promise<{document: Object, blockMap: BlockReferenceMap}>}
 */
export async function parseLogseqGraph(graphPath, callbacks = {}) {
  const blockMap = new BlockReferenceMap();

  // Find all .md files (skip logseq/ and .logseq/)
  const mdFiles = await findMarkdownFiles(graphPath);

  // Find assets
  const assetDir = `${graphPath}/assets`;
  const assetFiles = await findAssetFiles(assetDir);

  const total = mdFiles.length;
  let current = 0;

  const pages = [];

  for (const filePath of mdFiles) {
    current++;
    const fileName = filePath.split('/').pop();
    callbacks.onProgress?.(current, total, fileName);

    try {
      const content = await invoke('read_file_content', { path: filePath });
      const relativePath = filePath.substring(graphPath.length + 1);
      const page = parseLogseqFile(content, relativePath, filePath, blockMap);
      pages.push(page);
    } catch {
      // skip unreadable files
    }
  }

  // Build asset IR
  const assets = assetFiles.map(sourcePath => {
    const name = sourcePath.split('/').pop();
    return createAsset({ sourcePath, destPath: '', referencedBy: [name] });
  });

  return {
    document: createDocument({ pages, canvases: [], assets }),
    blockMap
  };
}

// ---------------------------------------------------------------------------
// Single-file parsing
// ---------------------------------------------------------------------------

function parseLogseqFile(content, relativePath, fullPath, blockMap) {
  // Parse Logseq properties (key:: value at top of file)
  const { properties, content: body } = parseLogseqProperties(content);

  // Determine daily journal
  const isDaily = relativePath.startsWith('journals/');
  let pagePath;
  let title;

  if (isDaily) {
    // journals/2024_01_01.md → daily-notes/2024-01-01.md
    const name = relativePath.split('/').pop().replace(/\.md$/, '');
    const dateSlug = name.replace(/_/g, '-');
    pagePath = `daily-notes/${dateSlug}.md`;
    title = dateSlug;
  } else if (relativePath.startsWith('pages/')) {
    // pages/parent___child.md → parent/child.md (Logseq namespace)
    const name = relativePath.replace(/^pages\//, '').replace(/\.md$/, '');
    const namespacePath = name.replace(/___/g, '/');
    pagePath = `${namespacePath}.md`;
    title = namespacePath.split('/').pop();
  } else {
    const name = relativePath.replace(/\.md$/, '');
    pagePath = `${name}.md`;
    title = name.split('/').pop();
  }

  // Register block UUIDs found in the body
  const uuids = extractUUIDs(body);
  for (const uuid of uuids) {
    if (!blockMap.hasUUID(uuid)) {
      blockMap.registerBlock(uuid, '[Referenced block]', fullPath);
    }
  }

  const blocks = parseLogseqBody(body, blockMap, fullPath);

  return createPage({
    title,
    slug: title,
    path: pagePath,
    frontmatter: properties,
    blocks,
    isDaily,
    sourceFile: relativePath
  });
}

/**
 * Parse the body of a Logseq file into IR blocks.
 * Logseq files are outline-structured: every line starts with `- `.
 */
function parseLogseqBody(body, blockMap, filePath) {
  const lines = body.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks (pass through)
    if (line.trim().startsWith('```')) {
      const lang = (line.trim().match(/^```(.*)$/) || [])[1] || '';

      // Unsupported query types
      if (/^(query|datalog)$/i.test(lang)) {
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++;
        blocks.push(createBlock({
          type: BlockType.UNSUPPORTED,
          content: codeLines.join('\n'),
          meta: {
            label: `Logseq ${lang} query (unsupported)`,
            originalSyntax: '```' + lang + '\n' + codeLines.join('\n') + '\n```'
          }
        }));
        continue;
      }

      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(createBlock({
        type: BlockType.CODE,
        content: codeLines.join('\n'),
        meta: { language: lang }
      }));
      continue;
    }

    // Callout
    if (/^>\s*\[!(\w+)\]/.test(line)) {
      const match = line.match(/^>\s*\[!(\w+)\]\s*(.*)?$/);
      const calloutType = normalizeCalloutType(match[1]);
      const title = (match[2] || '').trim();
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

    // Parse outline bullet
    const bulletMatch = line.match(/^(\s*)-\s+(.*)$/);
    if (bulletMatch) {
      const indent = Math.floor((bulletMatch[1] || '').length / 2);
      let text = bulletMatch[2];

      // Strip SCHEDULED/DEADLINE
      text = text.replace(/SCHEDULED:\s*<[^>]+>/g, '').replace(/DEADLINE:\s*<[^>]+>/g, '').trim();

      // Task keyword check
      const taskKwMatch = text.match(/^(TODO|DOING|DONE|LATER|NOW|WAIT|WAITING|CANCELLED|CANCELED)\s+(.*)/i);
      if (taskKwMatch) {
        const state = mapLogseqTask(taskKwMatch[1]);
        blocks.push(createBlock({
          type: BlockType.TASK,
          content: processInlineSyntax(taskKwMatch[2]),
          level: indent,
          meta: { taskState: state || ' ' }
        }));
        i++;
        continue;
      }

      // Embed {{embed [[page]]}} or {{embed ((ref))}}
      const embedMatch = text.match(/^\{\{embed\s+\[\[([^\]]+)\]\]\}\}$/);
      if (embedMatch) {
        blocks.push(createBlock({
          type: BlockType.EMBED,
          content: embedMatch[1],
          level: indent
        }));
        i++;
        continue;
      }

      const blockEmbedMatch = text.match(/^\{\{embed\s+\(\(([^)]+)\)\)\}\}$/);
      if (blockEmbedMatch) {
        blocks.push(createBlock({
          type: BlockType.EMBED,
          content: blockEmbedMatch[1],
          level: indent
        }));
        i++;
        continue;
      }

      // Query blocks inline: {{query ...}}
      const queryMatch = text.match(/^\{\{query\s+(.*)\}\}$/);
      if (queryMatch) {
        blocks.push(createBlock({
          type: BlockType.UNSUPPORTED,
          content: queryMatch[1],
          meta: { label: 'Logseq query (unsupported)', originalSyntax: text }
        }));
        i++;
        continue;
      }

      // Decide: heading or list item
      // Top-level short bullets → heading; otherwise → list
      if (indent === 0 && text.length < 80 && !text.includes('.') && !text.startsWith('!')) {
        blocks.push(createBlock({
          type: BlockType.HEADING,
          content: processInlineSyntax(text),
          level: 2
        }));
      } else {
        blocks.push(createBlock({
          type: BlockType.LIST,
          content: processInlineSyntax(text),
          level: indent
        }));
      }
      i++;
      continue;
    }

    // Non-bullet text (rare in Logseq files but handle gracefully)
    if (line.trim() === '') {
      blocks.push(createBlock({ type: BlockType.TEXT, content: '' }));
    } else {
      // Could be a heading already in markdown
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        blocks.push(createBlock({
          type: BlockType.HEADING,
          content: processInlineSyntax(headingMatch[2]),
          level: headingMatch[1].length
        }));
      } else {
        blocks.push(createBlock({
          type: BlockType.TEXT,
          content: processInlineSyntax(line)
        }));
      }
    }
    i++;
  }

  return blocks;
}

/**
 * Process Logseq inline syntax → Lokus-compatible markdown.
 */
function processInlineSyntax(text) {
  let result = text;

  // Normalise wiki links: [text]([[page]]) → [[page|text]]
  result = result.replace(/\[([^\]]+)\]\(\[\[([^\]]+)\]\]\)/g, '[[$2|$1]]');

  // Inline embeds that weren't top-level: {{embed [[page]]}} → ![[page]]
  result = result.replace(/\{\{embed\s+\[\[([^\]]+)\]\]\}\}/g, '![[$1]]');

  // Block embeds inline: {{embed ((ref))}} → ![[ref]]
  result = result.replace(/\{\{embed\s+\(\(([^)]+)\)\)\}\}/g, '![[$1]]');

  return result;
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

async function findMarkdownFiles(dirPath, files = []) {
  try {
    const entries = await invoke('read_directory', { path: dirPath });
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`;
      if (entry.is_dir) {
        if (entry.name === 'logseq' || entry.name === '.logseq' || entry.name.startsWith('.')) continue;
        await findMarkdownFiles(fullPath, files);
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch {
    // skip
  }
  return files;
}

async function findAssetFiles(dirPath) {
  const files = [];
  try {
    const exists = await invoke('path_exists', { path: dirPath });
    if (!exists) return files;

    const entries = await invoke('read_directory', { path: dirPath });
    for (const entry of entries) {
      if (!entry.is_dir) {
        files.push(`${dirPath}/${entry.name}`);
      }
    }
  } catch {
    // skip
  }
  return files;
}

export default { parseLogseqGraph };
