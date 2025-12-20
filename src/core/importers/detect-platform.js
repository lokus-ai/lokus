/**
 * Platform Auto-Detection
 *
 * Automatically detects the source platform of a notes folder
 * based on file structure and markers.
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Platform detection result
 * @typedef {Object} DetectionResult
 * @property {string} platform - 'logseq' | 'roam' | 'obsidian' | 'unknown'
 * @property {number} confidence - 0-100 confidence score
 * @property {string} reason - Human-readable reason for detection
 * @property {number} fileCount - Number of markdown files found
 * @property {boolean} needsConversion - Whether conversion is needed
 */

/**
 * Detect the platform of a notes folder
 * @param {string} folderPath - Path to the folder to analyze
 * @returns {Promise<DetectionResult>}
 */
export async function detectPlatform(folderPath) {
  try {
    // Check for Logseq markers
    const logseqResult = await detectLogseq(folderPath);
    if (logseqResult.detected) {
      return {
        platform: 'logseq',
        confidence: logseqResult.confidence,
        reason: logseqResult.reason,
        fileCount: logseqResult.fileCount,
        needsConversion: true
      };
    }

    // Check for Obsidian markers
    const obsidianResult = await detectObsidian(folderPath);
    if (obsidianResult.detected) {
      return {
        platform: 'obsidian',
        confidence: obsidianResult.confidence,
        reason: obsidianResult.reason,
        fileCount: obsidianResult.fileCount,
        needsConversion: false // Obsidian is already compatible
      };
    }

    // Check for Roam (JSON file)
    const roamResult = await detectRoam(folderPath);
    if (roamResult.detected) {
      return {
        platform: 'roam',
        confidence: roamResult.confidence,
        reason: roamResult.reason,
        fileCount: roamResult.fileCount,
        needsConversion: true
      };
    }

    // Unknown - count markdown files
    const fileCount = await countMarkdownFiles(folderPath);

    return {
      platform: 'unknown',
      confidence: 0,
      reason: fileCount > 0
        ? `Found ${fileCount} markdown files but couldn't detect the source platform`
        : 'No markdown files found',
      fileCount,
      needsConversion: false
    };
  } catch (error) {
    return {
      platform: 'unknown',
      confidence: 0,
      reason: `Detection error: ${error.message}`,
      fileCount: 0,
      needsConversion: false
    };
  }
}

/**
 * Detect Logseq graph
 */
async function detectLogseq(folderPath) {
  const markers = [
    { path: 'logseq/config.edn', weight: 50 },
    { path: '.logseq', weight: 30 },
    { path: 'logseq', weight: 20 },
    { path: 'pages', weight: 10 },
    { path: 'journals', weight: 10 }
  ];

  let confidence = 0;
  const foundMarkers = [];

  for (const marker of markers) {
    const exists = await pathExists(`${folderPath}/${marker.path}`);
    if (exists) {
      confidence += marker.weight;
      foundMarkers.push(marker.path);
    }
  }

  // Also check for Logseq-specific syntax in files
  if (confidence > 0 && confidence < 50) {
    const hasLogseqSyntax = await checkLogseqSyntax(folderPath);
    if (hasLogseqSyntax) {
      confidence += 20;
    }
  }

  const fileCount = await countMarkdownFiles(folderPath);

  return {
    detected: confidence >= 50,
    confidence: Math.min(confidence, 100),
    reason: foundMarkers.length > 0
      ? `Found Logseq markers: ${foundMarkers.join(', ')}`
      : 'No Logseq markers found',
    fileCount
  };
}

/**
 * Detect Obsidian vault
 */
async function detectObsidian(folderPath) {
  const markers = [
    { path: '.obsidian', weight: 80 },
    { path: '.obsidian/app.json', weight: 20 },
    { path: '.obsidian/workspace.json', weight: 10 }
  ];

  let confidence = 0;
  const foundMarkers = [];

  for (const marker of markers) {
    const exists = await pathExists(`${folderPath}/${marker.path}`);
    if (exists) {
      confidence += marker.weight;
      foundMarkers.push(marker.path);
    }
  }

  const fileCount = await countMarkdownFiles(folderPath);

  return {
    detected: confidence >= 80,
    confidence: Math.min(confidence, 100),
    reason: foundMarkers.length > 0
      ? `Found Obsidian vault: ${foundMarkers.join(', ')}`
      : 'No Obsidian markers found',
    fileCount
  };
}

/**
 * Detect Roam export (JSON file)
 */
async function detectRoam(folderPath) {
  try {
    const entries = await invoke('read_directory', { path: folderPath });

    // Look for JSON files that might be Roam exports
    for (const entry of entries) {
      if (!entry.is_dir && entry.name.endsWith('.json')) {
        const jsonPath = `${folderPath}/${entry.name}`;
        const isRoam = await checkRoamJson(jsonPath);

        if (isRoam.valid) {
          return {
            detected: true,
            confidence: 90,
            reason: `Found Roam export: ${entry.name}`,
            fileCount: isRoam.pageCount
          };
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return {
    detected: false,
    confidence: 0,
    reason: 'No Roam JSON export found',
    fileCount: 0
  };
}

/**
 * Check if a JSON file is a Roam export
 */
async function checkRoamJson(jsonPath) {
  try {
    const content = await invoke('read_file_content', { path: jsonPath });
    const data = JSON.parse(content);

    // Roam exports are arrays of pages with specific structure
    if (Array.isArray(data) && data.length > 0) {
      const firstPage = data[0];
      // Roam pages have 'title', 'uid', and often 'children'
      if (firstPage.title && (firstPage.uid || firstPage.children)) {
        return {
          valid: true,
          pageCount: data.length
        };
      }
    }
  } catch (error) {
    // Not valid JSON or not Roam format
  }

  return { valid: false, pageCount: 0 };
}

/**
 * Check for Logseq-specific syntax in files
 */
async function checkLogseqSyntax(folderPath) {
  try {
    // Sample a few files
    const entries = await invoke('read_directory', { path: folderPath });
    const mdFiles = entries.filter(e => !e.is_dir && e.name.endsWith('.md')).slice(0, 5);

    for (const file of mdFiles) {
      const content = await invoke('read_file_content', { path: `${folderPath}/${file.name}` });

      // Check for Logseq-specific patterns
      const logseqPatterns = [
        /^\s*-\s+TODO\s+/m,           // TODO markers
        /^\s*-\s+DONE\s+/m,           // DONE markers
        /^\s*[a-z-]+::\s+/m,          // Property syntax
        /\{\{embed\s+\[\[/,           // Embed syntax
        /\(\([a-f0-9-]{36}\)\)/,      // Block references
      ];

      for (const pattern of logseqPatterns) {
        if (pattern.test(content)) {
          return true;
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return false;
}

/**
 * Count markdown files in a folder
 */
async function countMarkdownFiles(folderPath, count = { value: 0 }) {
  try {
    const entries = await invoke('read_directory', { path: folderPath });

    for (const entry of entries) {
      if (entry.is_dir) {
        // Skip hidden folders and system folders
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await countMarkdownFiles(`${folderPath}/${entry.name}`, count);
        }
      } else if (entry.name.endsWith('.md')) {
        count.value++;
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return count.value;
}

/**
 * Check if path exists
 */
async function pathExists(path) {
  try {
    return await invoke('path_exists', { path });
  } catch {
    return false;
  }
}

export default { detectPlatform };
