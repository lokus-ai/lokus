/**
 * ReferenceManager - Tracks and updates file references across the workspace
 *
 * Handles:
 * - WikiLinks: [[file]], [[file|alias]], [[file#heading]], [[file^block]]
 * - Image embeds: ![[image.png]]
 * - Canvas embeds: ![canvas]
 * - Markdown links: [text](file.md)
 */

import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

// Reference patterns to match in markdown files
const PATTERNS = {
  // [[file]], [[file|alias]], [[file#heading]], [[file^block]]
  wikiLink: /\[\[([^\]|#^]+)(?:[|#^][^\]]*?)?\]\]/g,
  // ![[image.png]]
  imageEmbed: /!\[\[([^\]]+)\]\]/g,
  // ![canvas]
  canvasEmbed: /!\[([^\]]+)\]/g,
  // [text](file.md) or [text](./file.md) or [text](../folder/file.md)
  markdownLink: /\[([^\]]*)\]\(([^)]+)\)/g,
}

class ReferenceManager {
  constructor() {
    // Map<targetPath, Set<sourceFilePath>> - which files reference this file
    this.backlinks = new Map()
    // Map<sourceFilePath, Set<targetPath>> - what files does this file reference
    this.forwardLinks = new Map()
    // Cache of file contents for quick reference scanning
    this.contentCache = new Map()
    // Workspace path
    this.workspacePath = ''
    // Is the index built?
    this.isIndexed = false
  }

  /**
   * Initialize with workspace path
   */
  init(workspacePath) {
    this.workspacePath = workspacePath
    this.clear()
  }

  /**
   * Clear all indexes
   */
  clear() {
    this.backlinks.clear()
    this.forwardLinks.clear()
    this.contentCache.clear()
    this.isIndexed = false
  }

  /**
   * Extract all references from markdown content
   * @param {string} content - File content
   * @param {string} sourcePath - Path of the source file
   * @returns {Array<{type: string, target: string, fullMatch: string, alias?: string}>}
   */
  extractReferences(content, sourcePath) {
    const references = []
    const sourceDir = this.dirname(sourcePath)

    // WikiLinks: [[file]], [[file|alias]], [[file#heading]], [[file^block]]
    const wikiLinkRegex = /\[\[([^\]|#^]+)([|#^][^\]]*)?\]\]/g
    let match
    while ((match = wikiLinkRegex.exec(content)) !== null) {
      const target = match[1].trim()
      const extra = match[2] || ''
      references.push({
        type: 'wikiLink',
        target,
        fullMatch: match[0],
        alias: extra.startsWith('|') ? extra.slice(1) : null,
        hash: extra.startsWith('#') ? extra.slice(1) : null,
        block: extra.startsWith('^') ? extra.slice(1) : null,
      })
    }

    // Image embeds: ![[image.png]]
    const imageEmbedRegex = /!\[\[([^\]]+)\]\]/g
    while ((match = imageEmbedRegex.exec(content)) !== null) {
      references.push({
        type: 'imageEmbed',
        target: match[1].trim(),
        fullMatch: match[0],
      })
    }

    // Canvas embeds: ![canvasName] (single bracket, not followed by ()
    const canvasEmbedRegex = /!\[([^\]]+)\](?!\()/g
    while ((match = canvasEmbedRegex.exec(content)) !== null) {
      // Skip if it looks like an image embed ![[
      if (!match[0].startsWith('![[')) {
        references.push({
          type: 'canvasEmbed',
          target: match[1].trim(),
          fullMatch: match[0],
        })
      }
    }

    // Markdown links: [text](file.md) - only local files, not http(s)
    const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g
    while ((match = mdLinkRegex.exec(content)) !== null) {
      const href = match[2].trim()
      // Skip external URLs
      if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('data:')) {
        references.push({
          type: 'markdownLink',
          target: href,
          fullMatch: match[0],
          text: match[1],
        })
      }
    }

    return references
  }

  /**
   * Resolve a reference target to an absolute path
   * @param {string} target - The reference target (could be relative or just filename)
   * @param {string} sourceDir - Directory of the source file
   * @returns {string} Resolved absolute path or the target if can't resolve
   */
  resolveTarget(target, sourceDir) {
    // Remove .md extension if present for comparison
    let cleanTarget = target.replace(/\.md$/, '')

    // If it starts with ./ or ../, it's a relative path
    if (target.startsWith('./') || target.startsWith('../')) {
      return this.resolvePath(sourceDir, target)
    }

    // If it contains /, treat as relative from workspace or current dir
    if (target.includes('/')) {
      // Try from workspace root first
      const fromRoot = this.joinPath(this.workspacePath, target)
      return fromRoot
    }

    // Just a filename - could be anywhere, try same directory first
    return this.joinPath(sourceDir, target)
  }

  /**
   * Find all files that reference a given file
   * @param {string} targetPath - The file to find references to
   * @returns {Set<string>} Set of file paths that reference this file
   */
  getBacklinks(targetPath) {
    return this.backlinks.get(targetPath) || new Set()
  }

  /**
   * Find all files referenced by a given file
   * @param {string} sourcePath - The file to find references from
   * @returns {Set<string>} Set of file paths referenced by this file
   */
  getForwardLinks(sourcePath) {
    return this.forwardLinks.get(sourcePath) || new Set()
  }

  /**
   * Scan a single file and update indexes
   * @param {string} filePath - Path to the file
   * @param {string} content - File content (optional, will read if not provided)
   */
  async indexFile(filePath, content = null) {
    if (!filePath.endsWith('.md')) return

    try {
      const fileContent = content ?? await readTextFile(filePath)
      this.contentCache.set(filePath, fileContent)

      const references = this.extractReferences(fileContent, filePath)
      const sourceDir = this.dirname(filePath)

      // Clear old forward links for this file
      const oldForwardLinks = this.forwardLinks.get(filePath) || new Set()
      for (const oldTarget of oldForwardLinks) {
        const backlinksSet = this.backlinks.get(oldTarget)
        if (backlinksSet) {
          backlinksSet.delete(filePath)
        }
      }

      // Build new forward links
      const newForwardLinks = new Set()
      for (const ref of references) {
        const resolvedTarget = this.resolveTarget(ref.target, sourceDir)
        newForwardLinks.add(resolvedTarget)

        // Update backlinks
        if (!this.backlinks.has(resolvedTarget)) {
          this.backlinks.set(resolvedTarget, new Set())
        }
        this.backlinks.get(resolvedTarget).add(filePath)
      }

      this.forwardLinks.set(filePath, newForwardLinks)
    } catch (err) {
      console.error(`Failed to index file ${filePath}:`, err)
    }
  }

  /**
   * Build index from all markdown files in the workspace
   * @param {Array<{path: string}>} files - Array of file objects with path property
   */
  async buildIndex(files) {
    this.clear()

    const mdFiles = files.filter(f => f.path.endsWith('.md'))

    for (const file of mdFiles) {
      await this.indexFile(file.path)
    }

    this.isIndexed = true
  }

  /**
   * Find files that need updating when a file is moved/renamed
   * @param {string} oldPath - Original file path
   * @returns {Array<{filePath: string, references: Array}>} Files that need updating
   */
  async findAffectedFiles(oldPath) {
    const affected = []
    const oldName = this.basename(oldPath).replace(/\.[^.]+$/, '') // filename without extension
    const oldDir = this.dirname(oldPath)

    // Get all files that might reference this file
    const potentialBacklinks = this.backlinks.get(oldPath) || new Set()

    // Also search for files that reference by name only
    for (const [sourcePath, content] of this.contentCache) {
      if (sourcePath === oldPath) continue

      const references = this.extractReferences(content, sourcePath)
      const matchingRefs = references.filter(ref => {
        const refName = this.basename(ref.target).replace(/\.[^.]+$/, '')
        // Match by full path or by name
        return ref.target === oldPath ||
               ref.target === oldName ||
               ref.target === oldName + '.md' ||
               ref.target.endsWith('/' + oldName) ||
               ref.target.endsWith('/' + oldName + '.md') ||
               refName === oldName
      })

      if (matchingRefs.length > 0) {
        affected.push({
          filePath: sourcePath,
          references: matchingRefs,
        })
      }
    }

    return affected
  }

  /**
   * Update references in a file when a target file is moved/renamed
   * @param {string} filePath - File to update
   * @param {string} oldPath - Old path of the moved file
   * @param {string} newPath - New path of the moved file
   * @returns {boolean} Whether any changes were made
   */
  async updateReferencesInFile(filePath, oldPath, newPath) {
    try {
      let content = this.contentCache.get(filePath) || await readTextFile(filePath)
      const originalContent = content

      const oldName = this.basename(oldPath).replace(/\.[^.]+$/, '')
      const newName = this.basename(newPath).replace(/\.[^.]+$/, '')
      const oldRelative = this.getRelativePath(oldPath, this.workspacePath)
      const newRelative = this.getRelativePath(newPath, this.workspacePath)

      // Calculate relative path from source file to new target
      const sourceDir = this.dirname(filePath)
      const newRelativeFromSource = this.getRelativePathBetween(sourceDir, newPath)

      // Update WikiLinks: [[oldName]] -> [[newName]] or [[oldPath]] -> [[newPath]]
      // Handle various formats: [[name]], [[name|alias]], [[name#heading]], [[name^block]]

      // Pattern 1: Exact name match [[oldName...]]
      const wikiNamePattern = new RegExp(
        `\\[\\[${this.escapeRegex(oldName)}([|#^][^\\]]*)?\\]\\]`,
        'g'
      )
      content = content.replace(wikiNamePattern, `[[${newName}$1]]`)

      // Pattern 2: Path match [[folder/oldName...]]
      const wikiPathPattern = new RegExp(
        `\\[\\[([^\\]]*/)${this.escapeRegex(oldName)}([|#^][^\\]]*)?\\]\\]`,
        'g'
      )
      content = content.replace(wikiPathPattern, (match, prefix, suffix) => {
        // Recalculate the path
        const newPrefix = this.dirname(newRelativeFromSource.replace(/\.md$/, ''))
        if (newPrefix && newPrefix !== '.') {
          return `[[${newPrefix}/${newName}${suffix || ''}]]`
        }
        return `[[${newName}${suffix || ''}]]`
      })

      // Pattern 3: Full relative path match
      const oldRelativeNoExt = oldRelative.replace(/\.md$/, '')
      const newRelativeNoExt = newRelative.replace(/\.md$/, '')
      if (oldRelativeNoExt !== oldName) {
        const wikiFullPathPattern = new RegExp(
          `\\[\\[${this.escapeRegex(oldRelativeNoExt)}([|#^][^\\]]*)?\\]\\]`,
          'g'
        )
        content = content.replace(wikiFullPathPattern, `[[${newRelativeNoExt}$1]]`)
      }

      // Update image embeds: ![[oldName]] -> ![[newName]]
      const imagePattern = new RegExp(
        `!\\[\\[${this.escapeRegex(this.basename(oldPath))}\\]\\]`,
        'g'
      )
      content = content.replace(imagePattern, `![[${this.basename(newPath)}]]`)

      // Update image embeds with path
      const imagePathPattern = new RegExp(
        `!\\[\\[([^\\]]*/)?${this.escapeRegex(this.basename(oldPath))}\\]\\]`,
        'g'
      )
      content = content.replace(imagePathPattern, (match, prefix) => {
        const newImageRelative = this.getRelativePathBetween(sourceDir, newPath)
        return `![[${newImageRelative}]]`
      })

      // Update markdown links: [text](oldPath) -> [text](newPath)
      const mdLinkPattern = new RegExp(
        `\\[([^\\]]*)\\]\\(${this.escapeRegex(oldRelative)}\\)`,
        'g'
      )
      content = content.replace(mdLinkPattern, `[$1](${newRelativeFromSource})`)

      // Also match without .md extension
      const mdLinkNoExtPattern = new RegExp(
        `\\[([^\\]]*)\\]\\(${this.escapeRegex(oldRelativeNoExt)}\\)`,
        'g'
      )
      content = content.replace(mdLinkNoExtPattern, `[$1](${newRelativeFromSource.replace(/\.md$/, '')})`)

      if (content !== originalContent) {
        await writeTextFile(filePath, content)
        this.contentCache.set(filePath, content)
        return true
      }

      return false
    } catch (err) {
      console.error(`Failed to update references in ${filePath}:`, err)
      return false
    }
  }

  /**
   * Main function: Update all references when a file is moved/renamed
   * @param {string} oldPath - Original file path
   * @param {string} newPath - New file path
   * @returns {{updated: number, files: Array<string>}} Result of the update
   */
  async updateAllReferences(oldPath, newPath) {
    const affected = await this.findAffectedFiles(oldPath)
    const updatedFiles = []

    for (const { filePath } of affected) {
      const updated = await this.updateReferencesInFile(filePath, oldPath, newPath)
      if (updated) {
        updatedFiles.push(filePath)
      }
    }

    // Update our indexes
    // Remove old path from indexes
    this.backlinks.delete(oldPath)
    this.forwardLinks.delete(oldPath)
    this.contentCache.delete(oldPath)

    // Re-index the moved file at its new location
    await this.indexFile(newPath)

    // Re-index all updated files
    for (const filePath of updatedFiles) {
      await this.indexFile(filePath)
    }

    return {
      updated: updatedFiles.length,
      files: updatedFiles,
    }
  }

  // ============ Utility functions ============

  dirname(path) {
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
    return lastSlash >= 0 ? path.slice(0, lastSlash) : ''
  }

  basename(path) {
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
    return lastSlash >= 0 ? path.slice(lastSlash + 1) : path
  }

  joinPath(...parts) {
    return parts.filter(Boolean).join('/').replace(/\/+/g, '/')
  }

  resolvePath(base, relative) {
    const baseParts = base.split('/').filter(Boolean)
    const relativeParts = relative.split('/').filter(Boolean)

    for (const part of relativeParts) {
      if (part === '..') {
        baseParts.pop()
      } else if (part !== '.') {
        baseParts.push(part)
      }
    }

    return '/' + baseParts.join('/')
  }

  getRelativePath(absolutePath, basePath) {
    if (absolutePath.startsWith(basePath)) {
      let relative = absolutePath.slice(basePath.length)
      if (relative.startsWith('/')) relative = relative.slice(1)
      return relative
    }
    return absolutePath
  }

  getRelativePathBetween(fromDir, toPath) {
    // Simple implementation - could be improved
    const fromParts = fromDir.split('/').filter(Boolean)
    const toParts = toPath.split('/').filter(Boolean)

    // Find common prefix
    let commonLength = 0
    while (commonLength < fromParts.length &&
           commonLength < toParts.length &&
           fromParts[commonLength] === toParts[commonLength]) {
      commonLength++
    }

    // Build relative path
    const upCount = fromParts.length - commonLength
    const downParts = toParts.slice(commonLength)

    const relativeParts = []
    for (let i = 0; i < upCount; i++) {
      relativeParts.push('..')
    }
    relativeParts.push(...downParts)

    return relativeParts.join('/') || '.'
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

// Export singleton instance
const referenceManager = new ReferenceManager()
export default referenceManager
export { ReferenceManager }
