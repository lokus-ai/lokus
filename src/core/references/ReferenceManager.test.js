import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ReferenceManager } from './ReferenceManager.js'

// Mock Tauri filesystem
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}))

import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

describe('ReferenceManager', () => {
  let manager

  beforeEach(() => {
    manager = new ReferenceManager()
    manager.init('/workspace')
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with workspace path', () => {
      expect(manager.workspacePath).toBe('/workspace')
      expect(manager.isIndexed).toBe(false)
    })

    it('should clear all indexes on init', () => {
      manager.backlinks.set('test', new Set(['file1']))
      manager.forwardLinks.set('file1', new Set(['test']))
      manager.contentCache.set('file1', 'content')

      manager.init('/new-workspace')

      expect(manager.backlinks.size).toBe(0)
      expect(manager.forwardLinks.size).toBe(0)
      expect(manager.contentCache.size).toBe(0)
    })
  })

  describe('extractReferences', () => {
    describe('WikiLinks', () => {
      it('should extract simple wikilinks [[Page]]', () => {
        const content = 'Some text [[My Page]] more text'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        expect(refs).toHaveLength(1)
        expect(refs[0]).toMatchObject({
          type: 'wikiLink',
          target: 'My Page',
          fullMatch: '[[My Page]]',
        })
      })

      it('should extract wikilinks with aliases [[Page|Display Text]]', () => {
        const content = '[[My Page|Custom Display]]'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        expect(refs).toHaveLength(1)
        expect(refs[0]).toMatchObject({
          type: 'wikiLink',
          target: 'My Page',
          alias: 'Custom Display',
        })
      })

      it('should extract wikilinks with headings [[Page#Heading]]', () => {
        const content = '[[My Page#Section One]]'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        expect(refs).toHaveLength(1)
        expect(refs[0]).toMatchObject({
          type: 'wikiLink',
          target: 'My Page',
          hash: 'Section One',
        })
      })

      it('should extract wikilinks with block references [[Page^block-id]]', () => {
        const content = '[[My Page^abc123]]'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        expect(refs).toHaveLength(1)
        expect(refs[0]).toMatchObject({
          type: 'wikiLink',
          target: 'My Page',
          block: 'abc123',
        })
      })

      it('should extract multiple wikilinks from content', () => {
        const content = '[[Page One]] and [[Page Two]] and [[Page Three]]'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        expect(refs).toHaveLength(3)
        expect(refs.map(r => r.target)).toEqual(['Page One', 'Page Two', 'Page Three'])
      })

      it('should handle wikilinks with paths [[folder/Page]]', () => {
        const content = '[[subfolder/My Page]]'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        expect(refs).toHaveLength(1)
        expect(refs[0].target).toBe('subfolder/My Page')
      })
    })

    describe('Image Embeds', () => {
      it('should extract image embeds ![[image.png]]', () => {
        const content = 'Some text ![[screenshot.png]] more text'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        // Note: The regex may also match as wikiLink since patterns overlap
        // The important thing is that imageEmbed is captured
        const imageRefs = refs.filter(r => r.type === 'imageEmbed')
        expect(imageRefs).toHaveLength(1)
        expect(imageRefs[0]).toMatchObject({
          type: 'imageEmbed',
          target: 'screenshot.png',
          fullMatch: '![[screenshot.png]]',
        })
      })

      it('should extract image embeds with paths', () => {
        const content = '![[assets/images/photo.jpg]]'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        const imageRefs = refs.filter(r => r.type === 'imageEmbed')
        expect(imageRefs).toHaveLength(1)
        expect(imageRefs[0].target).toBe('assets/images/photo.jpg')
      })

      it('should handle multiple image embeds', () => {
        const content = '![[img1.png]] and ![[img2.jpg]] and ![[img3.gif]]'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        const imageRefs = refs.filter(r => r.type === 'imageEmbed')
        expect(imageRefs).toHaveLength(3)
      })
    })

    describe('Canvas Embeds', () => {
      it('should extract canvas embeds ![canvas]', () => {
        const content = 'Some text ![My Canvas] more text'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        const canvasRefs = refs.filter(r => r.type === 'canvasEmbed')
        expect(canvasRefs).toHaveLength(1)
        expect(canvasRefs[0].target).toBe('My Canvas')
      })

      it('should NOT extract image markdown links ![alt](url)', () => {
        const content = '![alt text](https://example.com/image.png)'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        const canvasRefs = refs.filter(r => r.type === 'canvasEmbed')
        expect(canvasRefs).toHaveLength(0)
      })

      it('should NOT extract ![[]] as canvas embed', () => {
        const content = '![[image.png]]'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        const canvasRefs = refs.filter(r => r.type === 'canvasEmbed')
        expect(canvasRefs).toHaveLength(0)
      })
    })

    describe('Markdown Links', () => {
      it('should extract local markdown links [text](file.md)', () => {
        const content = 'Check [this document](notes/document.md) for more info'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        expect(refs).toHaveLength(1)
        expect(refs[0]).toMatchObject({
          type: 'markdownLink',
          target: 'notes/document.md',
          text: 'this document',
        })
      })

      it('should extract relative links with ./', () => {
        const content = '[link](./sibling.md)'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        expect(refs).toHaveLength(1)
        expect(refs[0].target).toBe('./sibling.md')
      })

      it('should extract relative links with ../', () => {
        const content = '[parent](../parent.md)'
        const refs = manager.extractReferences(content, '/workspace/folder/file.md')

        expect(refs).toHaveLength(1)
        expect(refs[0].target).toBe('../parent.md')
      })

      it('should NOT extract external http links', () => {
        const content = '[Google](https://google.com)'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        const mdLinks = refs.filter(r => r.type === 'markdownLink')
        expect(mdLinks).toHaveLength(0)
      })

      it('should NOT extract external http links (http://)', () => {
        const content = '[Example](http://example.com)'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        const mdLinks = refs.filter(r => r.type === 'markdownLink')
        expect(mdLinks).toHaveLength(0)
      })

      it('should NOT extract data URLs', () => {
        const content = '[Image](data:image/png;base64,abc123)'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        const mdLinks = refs.filter(r => r.type === 'markdownLink')
        expect(mdLinks).toHaveLength(0)
      })
    })

    describe('Edge Cases', () => {
      it('should handle empty content', () => {
        const refs = manager.extractReferences('', '/workspace/file.md')
        expect(refs).toHaveLength(0)
      })

      it('should handle content with no references', () => {
        const content = 'Just some plain text without any links or references.'
        const refs = manager.extractReferences(content, '/workspace/file.md')
        expect(refs).toHaveLength(0)
      })

      it('should handle mixed reference types', () => {
        const content = `
          # My Document

          Check [[Wiki Page]] for details.

          ![[diagram.png]]

          See also [external guide](../guides/setup.md).

          ![My Canvas]
        `
        const refs = manager.extractReferences(content, '/workspace/notes/file.md')

        // Note: ![[diagram.png]] is matched by both wikiLink pattern (as [[diagram.png]]) and imageEmbed pattern
        // wikiLinks also captures the content inside [[...]], so we may have 2 wikiLink matches
        const wikiLinks = refs.filter(r => r.type === 'wikiLink')
        const imageEmbeds = refs.filter(r => r.type === 'imageEmbed')
        const mdLinks = refs.filter(r => r.type === 'markdownLink')
        const canvasEmbeds = refs.filter(r => r.type === 'canvasEmbed')

        // Should have at least one of each type (some may overlap)
        expect(wikiLinks.length).toBeGreaterThanOrEqual(1)
        expect(imageEmbeds).toHaveLength(1)
        expect(mdLinks).toHaveLength(1)
        expect(canvasEmbeds).toHaveLength(1)
      })

      it('should trim whitespace from targets', () => {
        const content = '[[  Page With Spaces  ]]'
        const refs = manager.extractReferences(content, '/workspace/file.md')

        expect(refs[0].target).toBe('Page With Spaces')
      })
    })
  })

  describe('utility functions', () => {
    describe('dirname', () => {
      it('should return directory path', () => {
        expect(manager.dirname('/workspace/folder/file.md')).toBe('/workspace/folder')
      })

      it('should handle root files', () => {
        expect(manager.dirname('/file.md')).toBe('')
      })

      it('should handle nested paths', () => {
        expect(manager.dirname('/a/b/c/d/file.md')).toBe('/a/b/c/d')
      })

      it('should handle Windows-style backslashes', () => {
        expect(manager.dirname('C:\\Users\\docs\\file.md')).toBe('C:\\Users\\docs')
      })
    })

    describe('basename', () => {
      it('should return filename', () => {
        expect(manager.basename('/workspace/folder/file.md')).toBe('file.md')
      })

      it('should handle root files', () => {
        expect(manager.basename('/file.md')).toBe('file.md')
      })

      it('should handle filenames without path', () => {
        expect(manager.basename('file.md')).toBe('file.md')
      })
    })

    describe('joinPath', () => {
      it('should join path parts', () => {
        expect(manager.joinPath('/workspace', 'folder', 'file.md')).toBe('/workspace/folder/file.md')
      })

      it('should filter empty parts', () => {
        expect(manager.joinPath('/workspace', '', 'file.md')).toBe('/workspace/file.md')
      })

      it('should collapse multiple slashes', () => {
        expect(manager.joinPath('/workspace/', '/folder/', 'file.md')).toBe('/workspace/folder/file.md')
      })
    })

    describe('resolvePath', () => {
      it('should resolve relative paths with ../', () => {
        expect(manager.resolvePath('/workspace/folder/subfolder', '../sibling.md'))
          .toBe('/workspace/folder/sibling.md')
      })

      it('should resolve relative paths with ./', () => {
        expect(manager.resolvePath('/workspace/folder', './file.md'))
          .toBe('/workspace/folder/file.md')
      })

      it('should handle multiple parent traversals', () => {
        expect(manager.resolvePath('/workspace/a/b/c', '../../file.md'))
          .toBe('/workspace/a/file.md')
      })
    })

    describe('getRelativePath', () => {
      it('should return relative path from workspace', () => {
        expect(manager.getRelativePath('/workspace/folder/file.md', '/workspace'))
          .toBe('folder/file.md')
      })

      it('should handle paths not in workspace', () => {
        expect(manager.getRelativePath('/other/file.md', '/workspace'))
          .toBe('/other/file.md')
      })
    })

    describe('getRelativePathBetween', () => {
      it('should calculate relative path between directories', () => {
        expect(manager.getRelativePathBetween('/workspace/folder', '/workspace/folder/file.md'))
          .toBe('file.md')
      })

      it('should handle sibling directories', () => {
        expect(manager.getRelativePathBetween('/workspace/folderA', '/workspace/folderB/file.md'))
          .toBe('../folderB/file.md')
      })

      it('should handle deeply nested paths', () => {
        expect(manager.getRelativePathBetween('/workspace/a/b/c', '/workspace/a/x/y/file.md'))
          .toBe('../../x/y/file.md')
      })
    })

    describe('escapeRegex', () => {
      it('should escape special regex characters', () => {
        expect(manager.escapeRegex('file.name')).toBe('file\\.name')
        expect(manager.escapeRegex('file[0]')).toBe('file\\[0\\]')
        expect(manager.escapeRegex('path/to/file')).toBe('path/to/file')
      })

      it('should escape all special characters', () => {
        const special = '.*+?^${}()|[]\\'
        const escaped = manager.escapeRegex(special)
        expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')
      })
    })
  })

  describe('resolveTarget', () => {
    beforeEach(() => {
      manager.init('/workspace')
    })

    it('should resolve relative paths with ./', () => {
      expect(manager.resolveTarget('./sibling.md', '/workspace/folder'))
        .toBe('/workspace/folder/sibling.md')
    })

    it('should resolve relative paths with ../', () => {
      expect(manager.resolveTarget('../parent.md', '/workspace/folder/sub'))
        .toBe('/workspace/folder/parent.md')
    })

    it('should resolve paths with slashes from workspace root', () => {
      expect(manager.resolveTarget('folder/file.md', '/workspace/notes'))
        .toBe('/workspace/folder/file.md')
    })

    it('should resolve simple filenames in same directory', () => {
      expect(manager.resolveTarget('sibling.md', '/workspace/folder'))
        .toBe('/workspace/folder/sibling.md')
    })
  })

  describe('indexFile', () => {
    it('should skip non-markdown files', async () => {
      await manager.indexFile('/workspace/image.png')

      expect(manager.contentCache.has('/workspace/image.png')).toBe(false)
    })

    it('should index markdown file with provided content', async () => {
      const content = '[[Page One]] and [[Page Two]]'
      await manager.indexFile('/workspace/notes.md', content)

      expect(manager.contentCache.get('/workspace/notes.md')).toBe(content)
      expect(manager.forwardLinks.has('/workspace/notes.md')).toBe(true)
    })

    it('should read file content if not provided', async () => {
      readTextFile.mockResolvedValue('[[Referenced Page]]')

      await manager.indexFile('/workspace/notes.md')

      expect(readTextFile).toHaveBeenCalledWith('/workspace/notes.md')
      expect(manager.contentCache.get('/workspace/notes.md')).toBe('[[Referenced Page]]')
    })

    it('should update backlinks correctly', async () => {
      await manager.indexFile('/workspace/file1.md', '[[Target Page]]')

      const backlinks = manager.getBacklinks('/workspace/Target Page')
      expect(backlinks.has('/workspace/file1.md')).toBe(true)
    })

    it('should handle read errors gracefully', async () => {
      readTextFile.mockRejectedValue(new Error('File not found'))

      // Should not throw
      await expect(manager.indexFile('/workspace/missing.md')).resolves.not.toThrow()
    })
  })

  describe('buildIndex', () => {
    it('should index all markdown files', async () => {
      readTextFile.mockImplementation((path) => {
        if (path === '/workspace/file1.md') return Promise.resolve('[[File2]]')
        if (path === '/workspace/file2.md') return Promise.resolve('[[File1]]')
        return Promise.resolve('')
      })

      await manager.buildIndex([
        { path: '/workspace/file1.md' },
        { path: '/workspace/file2.md' },
        { path: '/workspace/image.png' },
      ])

      expect(manager.isIndexed).toBe(true)
      expect(manager.contentCache.size).toBe(2)
    })

    it('should clear previous index before building', async () => {
      manager.contentCache.set('/old/file.md', 'old content')
      readTextFile.mockResolvedValue('')

      await manager.buildIndex([{ path: '/workspace/new.md' }])

      expect(manager.contentCache.has('/old/file.md')).toBe(false)
    })
  })

  describe('findAffectedFiles', () => {
    beforeEach(async () => {
      // Set up some indexed content
      manager.contentCache.set('/workspace/file1.md', '[[Target Page]]')
      manager.contentCache.set('/workspace/file2.md', '[[folder/Target Page]]')
      manager.contentCache.set('/workspace/file3.md', '[[Target Page.md]]')
      manager.contentCache.set('/workspace/file4.md', '[[Other Page]]')
    })

    it('should find files referencing by name', async () => {
      const affected = await manager.findAffectedFiles('/workspace/Target Page.md')

      expect(affected.length).toBeGreaterThan(0)
      expect(affected.some(a => a.filePath === '/workspace/file1.md')).toBe(true)
    })

    it('should find files referencing by path', async () => {
      const affected = await manager.findAffectedFiles('/workspace/folder/Target Page.md')

      const file2 = affected.find(a => a.filePath === '/workspace/file2.md')
      expect(file2).toBeDefined()
    })

    it('should not include files that do not reference target', async () => {
      const affected = await manager.findAffectedFiles('/workspace/Target Page.md')

      expect(affected.some(a => a.filePath === '/workspace/file4.md')).toBe(false)
    })

    it('should not include the target file itself', async () => {
      manager.contentCache.set('/workspace/Target Page.md', '[[Self Reference]]')

      const affected = await manager.findAffectedFiles('/workspace/Target Page.md')

      expect(affected.some(a => a.filePath === '/workspace/Target Page.md')).toBe(false)
    })
  })

  describe('updateReferencesInFile', () => {
    beforeEach(() => {
      writeTextFile.mockResolvedValue(undefined)
    })

    it('should update simple wikilink [[OldName]] -> [[NewName]]', async () => {
      manager.contentCache.set('/workspace/file.md', '[[Old Name]]')

      const updated = await manager.updateReferencesInFile(
        '/workspace/file.md',
        '/workspace/Old Name.md',
        '/workspace/New Name.md'
      )

      expect(updated).toBe(true)
      expect(writeTextFile).toHaveBeenCalled()
      const writtenContent = writeTextFile.mock.calls[0][1]
      expect(writtenContent).toBe('[[New Name]]')
    })

    it('should preserve aliases [[OldName|Alias]] -> [[NewName|Alias]]', async () => {
      manager.contentCache.set('/workspace/file.md', '[[Old Name|Display Text]]')

      await manager.updateReferencesInFile(
        '/workspace/file.md',
        '/workspace/Old Name.md',
        '/workspace/New Name.md'
      )

      const writtenContent = writeTextFile.mock.calls[0][1]
      expect(writtenContent).toBe('[[New Name|Display Text]]')
    })

    it('should preserve heading references [[OldName#Heading]]', async () => {
      manager.contentCache.set('/workspace/file.md', '[[Old Name#Section]]')

      await manager.updateReferencesInFile(
        '/workspace/file.md',
        '/workspace/Old Name.md',
        '/workspace/New Name.md'
      )

      const writtenContent = writeTextFile.mock.calls[0][1]
      expect(writtenContent).toBe('[[New Name#Section]]')
    })

    it('should preserve block references [[OldName^block]]', async () => {
      manager.contentCache.set('/workspace/file.md', '[[Old Name^abc123]]')

      await manager.updateReferencesInFile(
        '/workspace/file.md',
        '/workspace/Old Name.md',
        '/workspace/New Name.md'
      )

      const writtenContent = writeTextFile.mock.calls[0][1]
      expect(writtenContent).toBe('[[New Name^abc123]]')
    })

    it('should update image embeds ![[oldname.png]] -> ![[newname.png]]', async () => {
      manager.contentCache.set('/workspace/file.md', '![[image.png]]')

      await manager.updateReferencesInFile(
        '/workspace/file.md',
        '/workspace/image.png',
        '/workspace/renamed-image.png'
      )

      const writtenContent = writeTextFile.mock.calls[0][1]
      expect(writtenContent).toContain('renamed-image.png')
    })

    it('should return false if no changes were made', async () => {
      manager.contentCache.set('/workspace/file.md', '[[Unrelated Page]]')

      const updated = await manager.updateReferencesInFile(
        '/workspace/file.md',
        '/workspace/Old Name.md',
        '/workspace/New Name.md'
      )

      expect(updated).toBe(false)
      expect(writeTextFile).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      manager.contentCache.clear()
      readTextFile.mockRejectedValue(new Error('File not found'))

      const updated = await manager.updateReferencesInFile(
        '/workspace/missing.md',
        '/workspace/Old.md',
        '/workspace/New.md'
      )

      expect(updated).toBe(false)
    })
  })

  describe('updateAllReferences', () => {
    beforeEach(() => {
      writeTextFile.mockResolvedValue(undefined)
      readTextFile.mockResolvedValue('')
    })

    it('should update all affected files', async () => {
      manager.contentCache.set('/workspace/file1.md', '[[Target]]')
      manager.contentCache.set('/workspace/file2.md', '[[Target]]')

      const result = await manager.updateAllReferences(
        '/workspace/Target.md',
        '/workspace/Renamed.md'
      )

      expect(result.updated).toBe(2)
      expect(result.files).toHaveLength(2)
    })

    it('should remove old path from indexes', async () => {
      manager.backlinks.set('/workspace/Old.md', new Set(['/workspace/file.md']))
      manager.forwardLinks.set('/workspace/Old.md', new Set())
      manager.contentCache.set('/workspace/Old.md', 'content')
      manager.contentCache.set('/workspace/file.md', '[[Other]]')

      await manager.updateAllReferences(
        '/workspace/Old.md',
        '/workspace/New.md'
      )

      expect(manager.backlinks.has('/workspace/Old.md')).toBe(false)
      expect(manager.forwardLinks.has('/workspace/Old.md')).toBe(false)
      expect(manager.contentCache.has('/workspace/Old.md')).toBe(false)
    })

    it('should re-index moved file at new location', async () => {
      manager.contentCache.set('/workspace/file.md', '[[Other]]')
      readTextFile.mockResolvedValue('[[Some Link]]')

      await manager.updateAllReferences(
        '/workspace/Old.md',
        '/workspace/New.md'
      )

      expect(readTextFile).toHaveBeenCalledWith('/workspace/New.md')
    })
  })

  describe('getBacklinks and getForwardLinks', () => {
    it('should return empty set for unknown paths', () => {
      expect(manager.getBacklinks('/unknown/path.md').size).toBe(0)
      expect(manager.getForwardLinks('/unknown/path.md').size).toBe(0)
    })

    it('should return correct backlinks after indexing', async () => {
      await manager.indexFile('/workspace/source.md', '[[Target]]')

      const backlinks = manager.getBacklinks('/workspace/Target')
      expect(backlinks.has('/workspace/source.md')).toBe(true)
    })

    it('should return correct forward links after indexing', async () => {
      await manager.indexFile('/workspace/source.md', '[[Target1]] and [[Target2]]')

      const forwardLinks = manager.getForwardLinks('/workspace/source.md')
      expect(forwardLinks.size).toBe(2)
    })
  })
})
