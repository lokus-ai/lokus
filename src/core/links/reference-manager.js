/**
 * ReferenceManager - Track and update file references when files are moved/renamed
 *
 * Handles:
 * - [[wikilinks]] and [[wikilinks|alias]]
 * - ![[image embeds]]
 * - ![canvas embeds]
 * - Block references [[file^block]]
 * - Heading references [[file#heading]]
 */

import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Get filename without extension
 */
function getBaseName(filePath) {
  const name = filePath.split('/').pop() || filePath
  return name.replace(/\.[^.]+$/, '')
}

/**
 * Get file extension
 */
function getExtension(filePath) {
  const match = filePath.match(/\.([^.]+)$/)
  return match ? match[1].toLowerCase() : ''
}

/**
 * Get directory path from file path
 */
function getDirName(filePath) {
  const parts = filePath.split('/')
  parts.pop()
  return parts.join('/') || '/'
}

/**
 * Build relative path from source to target
 */
function getRelativePath(fromPath, toPath, workspacePath) {
  // Remove workspace prefix if present
  const from = fromPath.startsWith(workspacePath)
    ? fromPath.slice(workspacePath.length).replace(/^\//, '')
    : fromPath
  const to = toPath.startsWith(workspacePath)
    ? toPath.slice(workspacePath.length).replace(/^\//, '')
    : toPath

  return to
}

/**
 * Find all references to a file in markdown content
 * Returns array of { pattern, start, end, type, hasAlias, alias }
 */
export function findReferences(content, targetName, targetPath) {
  const references = []
  const baseName = getBaseName(targetName)
  const escapedName = escapeRegex(baseName)
  const ext = getExtension(targetPath || targetName)

  // Patterns to match:
  // 1. [[name]] - basic wiki link
  // 2. [[name|alias]] - wiki link with alias
  // 3. [[name#heading]] - heading reference
  // 4. [[name^block]] - block reference
  // 5. [[name#heading|alias]] - heading with alias
  // 6. [[name^block|alias]] - block with alias
  // 7. ![[name]] - image/file embed
  // 8. ![name] - canvas embed

  const patterns = [
    // Wiki links: [[name]] or [[name|alias]]
    {
      regex: new RegExp(`\\[\\[(${escapedName})(?:#[^\\]|]+)?(?:\\^[^\\]|]+)?(?:\\|([^\\]]+))?\\]\\]`, 'gi'),
      type: 'wikilink'
    },
    // Wiki links with path: [[folder/name]] or [[./name]]
    {
      regex: new RegExp(`\\[\\[([^\\]]*[/\\\\]${escapedName})(?:#[^\\]|]+)?(?:\\^[^\\]|]+)?(?:\\|([^\\]]+))?\\]\\]`, 'gi'),
      type: 'wikilink-path'
    },
    // Image/file embeds: ![[name]]
    {
      regex: new RegExp(`!\\[\\[(${escapedName}(?:\\.[a-z]+)?)(?:\\|([^\\]]+))?\\]\\]`, 'gi'),
      type: 'embed'
    },
    // Image embeds with path: ![[folder/name.ext]]
    {
      regex: new RegExp(`!\\[\\[([^\\]]*[/\\\\]${escapedName}(?:\\.[a-z]+)?)(?:\\|([^\\]]+))?\\]\\]`, 'gi'),
      type: 'embed-path'
    },
    // Canvas embeds: ![name]
    {
      regex: new RegExp(`!\\[(${escapedName})\\](?!\\()`, 'gi'),
      type: 'canvas'
    },
  ]

  for (const { regex, type } of patterns) {
    let match
    while ((match = regex.exec(content)) !== null) {
      references.push({
        fullMatch: match[0],
        matchedName: match[1],
        alias: match[2] || null,
        start: match.index,
        end: match.index + match[0].length,
        type
      })
    }
  }

  // Sort by position (descending) so we can replace from end to start
  return references.sort((a, b) => b.start - a.start)
}

/**
 * Update references in content from old name to new name
 */
export function updateReferences(content, oldName, newName, oldPath, newPath) {
  const references = findReferences(content, oldName, oldPath)

  if (references.length === 0) {
    return { content, count: 0 }
  }

  let updatedContent = content
  const oldBaseName = getBaseName(oldName)
  const newBaseName = getBaseName(newName)
  const newExt = getExtension(newPath || newName)

  for (const ref of references) {
    const before = updatedContent.slice(0, ref.start)
    const after = updatedContent.slice(ref.end)

    let replacement = ''

    switch (ref.type) {
      case 'wikilink':
        // [[oldName]] -> [[newName]] or [[oldName|alias]] -> [[newName|alias]]
        replacement = ref.fullMatch.replace(
          new RegExp(`\\[\\[${escapeRegex(oldBaseName)}`, 'i'),
          `[[${newBaseName}`
        )
        break

      case 'wikilink-path':
        // [[folder/oldName]] -> [[folder/newName]]
        replacement = ref.fullMatch.replace(
          new RegExp(`${escapeRegex(oldBaseName)}(?=[#^|\\]])`, 'i'),
          newBaseName
        )
        break

      case 'embed':
        // ![[oldName.ext]] -> ![[newName.ext]]
        const oldWithExt = oldBaseName + (getExtension(oldPath) ? '.' + getExtension(oldPath) : '')
        const newWithExt = newBaseName + (newExt ? '.' + newExt : '')
        replacement = ref.fullMatch.replace(
          new RegExp(`!\\[\\[${escapeRegex(ref.matchedName)}`, 'i'),
          `![[${newWithExt}`
        )
        break

      case 'embed-path':
        // ![[folder/oldName.ext]] -> ![[folder/newName.ext]]
        replacement = ref.fullMatch.replace(
          new RegExp(`${escapeRegex(oldBaseName)}(\\.[a-z]+)?(?=[|\\]])`, 'i'),
          newBaseName + (newExt ? '.' + newExt : '$1')
        )
        break

      case 'canvas':
        // ![oldName] -> ![newName]
        replacement = `![${newBaseName}]`
        break

      default:
        replacement = ref.fullMatch
    }

    updatedContent = before + replacement + after
  }

  return {
    content: updatedContent,
    count: references.length
  }
}

/**
 * Scan workspace for all files that reference a target file
 * @param {Array} fileIndex - Array of { title, path } from __LOKUS_FILE_INDEX__
 * @param {string} targetName - Name of the file being moved/renamed
 * @param {string} targetPath - Full path of the file being moved/renamed
 * @returns {Promise<Array>} Array of { path, references }
 */
export async function findFilesWithReferences(fileIndex, targetName, targetPath) {
  const filesWithRefs = []
  const markdownFiles = fileIndex.filter(f =>
    f.path.endsWith('.md') || f.path.endsWith('.canvas')
  )

  for (const file of markdownFiles) {
    // Don't check the file itself
    if (file.path === targetPath) continue

    try {
      const content = await readTextFile(file.path)
      const references = findReferences(content, targetName, targetPath)

      if (references.length > 0) {
        filesWithRefs.push({
          path: file.path,
          title: file.title,
          references,
          content
        })
      }
    } catch (e) {
      // Skip files we can't read
      console.warn(`Could not read file ${file.path}:`, e)
    }
  }

  return filesWithRefs
}

/**
 * Update all references after a file is moved/renamed
 * @param {Array} affectedFiles - Array from findFilesWithReferences
 * @param {string} oldName - Old filename
 * @param {string} newName - New filename
 * @param {string} oldPath - Old full path
 * @param {string} newPath - New full path
 * @returns {Promise<{updated: number, failed: Array}>}
 */
export async function updateAllReferences(affectedFiles, oldName, newName, oldPath, newPath) {
  let updated = 0
  const failed = []

  for (const file of affectedFiles) {
    try {
      const { content: newContent, count } = updateReferences(
        file.content,
        oldName,
        newName,
        oldPath,
        newPath
      )

      if (count > 0) {
        await writeTextFile(file.path, newContent)
        updated++
      }
    } catch (e) {
      failed.push({ path: file.path, error: e.message || String(e) })
    }
  }

  return { updated, failed }
}

/**
 * Main entry point for handling file rename with reference updates
 */
export async function handleFileRename(oldPath, newPath, fileIndex, options = {}) {
  const { showConfirmation = true, onConfirm, onComplete, onError } = options

  const oldName = oldPath.split('/').pop()
  const newName = newPath.split('/').pop()

  // Find all files with references
  const affectedFiles = await findFilesWithReferences(fileIndex, oldName, oldPath)

  if (affectedFiles.length === 0) {
    // No references to update
    onComplete?.({ updated: 0, failed: [], affectedFiles: [] })
    return { updated: 0, failed: [], affectedFiles: [] }
  }

  // Calculate total references
  const totalRefs = affectedFiles.reduce((sum, f) => sum + f.references.length, 0)

  if (showConfirmation && onConfirm) {
    // Ask for confirmation
    const confirmed = await onConfirm({
      oldName,
      newName,
      affectedFiles,
      totalRefs
    })

    if (!confirmed) {
      return { updated: 0, failed: [], affectedFiles, cancelled: true }
    }
  }

  // Update references
  try {
    const result = await updateAllReferences(affectedFiles, oldName, newName, oldPath, newPath)
    result.affectedFiles = affectedFiles
    onComplete?.(result)
    return result
  } catch (e) {
    onError?.(e)
    throw e
  }
}

export default {
  findReferences,
  updateReferences,
  findFilesWithReferences,
  updateAllReferences,
  handleFileRename
}
