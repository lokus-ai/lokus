import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TemplateManager } from '../../../src/core/templates/manager.js'
import { TemplateParser } from '../../../src/core/templates/parser.js'
import { TemplateProcessor } from '../../../src/core/templates/processor.js'

// Mock dependencies
vi.mock('../../../src/core/templates/parser.js', () => ({
  TemplateParser: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
    getStatistics: vi.fn().mockReturnValue({
      length: 100,
      variables: { count: 2, unique: 2, withDefaults: 0, withFilters: 1 },
      jsBlocks: { count: 1, expressions: 1, statements: 0, totalCodeLength: 20 },
      comments: { count: 0 },
      complexity: 'simple'
    })
  }))
}))

vi.mock('../../../src/core/templates/processor.js', () => ({
  TemplateProcessor: vi.fn().mockImplementation(() => ({
    process: vi.fn().mockResolvedValue({
      result: 'processed content',
      variables: {},
      metadata: { iterations: 1, hasUnresolvedVariables: false }
    }),
    preview: vi.fn().mockResolvedValue({
      result: 'preview content',
      preview: true
    })
  }))
}))

describe('TemplateManager', () => {
  let manager
  let mockParser
  let mockProcessor

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Get mock instances
    mockParser = {
      validate: vi.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
      getStatistics: vi.fn().mockReturnValue({
        length: 100,
        variables: { count: 2, unique: 2, withDefaults: 0, withFilters: 1 },
        jsBlocks: { count: 1, expressions: 1, statements: 0, totalCodeLength: 20 },
        comments: { count: 0 },
        complexity: 'simple'
      })
    }
    
    mockProcessor = {
      process: vi.fn().mockResolvedValue({
        result: 'processed content',
        variables: {},
        metadata: { iterations: 1, hasUnresolvedVariables: false }
      }),
      preview: vi.fn().mockResolvedValue({
        result: 'preview content',
        preview: true
      })
    }
    
    TemplateParser.mockImplementation(() => mockParser)
    TemplateProcessor.mockImplementation(() => mockProcessor)
    
    manager = new TemplateManager()
  })

  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      expect(manager.storage).toBeDefined()
      expect(manager.parser).toBeDefined()
      expect(manager.processor).toBeDefined()
      expect(manager.categories).toBeDefined()
      expect(manager.tags).toBeDefined()
      expect(manager.maxTemplates).toBe(1000)
    })

    it('should initialize with custom options', () => {
      const customStorage = new Map()
      const customOptions = {
        storage: customStorage,
        maxTemplates: 500,
        processor: { strictMode: false }
      }
      
      const customManager = new TemplateManager(customOptions)
      
      expect(customManager.storage).toBe(customStorage)
      expect(customManager.maxTemplates).toBe(500)
    })

    it('should initialize default categories', () => {
      const categories = manager.getCategories()
      
      expect(categories.length).toBeGreaterThan(0)
      expect(categories.some(cat => cat.id === 'general')).toBe(true)
      expect(categories.some(cat => cat.id === 'notes')).toBe(true)
      expect(categories.some(cat => cat.id === 'documentation')).toBe(true)
    })
  })

  describe('Template Creation', () => {
    it('should create a valid template', async () => {
      const templateData = {
        id: 'test-template',
        name: 'Test Template',
        content: 'Hello {{name}}!',
        category: 'general',
        tags: ['test', 'greeting'],
        metadata: { author: 'Test User' }
      }
      
      const created = await manager.create(templateData)
      
      expect(created.id).toBe('test-template')
      expect(created.name).toBe('Test Template')
      expect(created.content).toBe('Hello {{name}}!')
      expect(created.category).toBe('general')
      expect(created.tags).toEqual(['test', 'greeting'])
      expect(created.metadata.author).toBe('Test User')
      expect(created.metadata.createdAt).toBeDefined()
      expect(created.metadata.updatedAt).toBeDefined()
      expect(created.metadata.version).toBe('1.0.0')
      expect(created.stats).toBeDefined()
    })

    it('should require mandatory fields', async () => {
      const invalidData = { name: 'Test' } // missing id and content
      
      await expect(manager.create(invalidData)).rejects.toThrow('Template ID, name, and content are required')
    })

    it('should prevent duplicate IDs', async () => {
      const templateData = {
        id: 'duplicate',
        name: 'First Template',
        content: 'Content'
      }
      
      await manager.create(templateData)
      
      await expect(manager.create(templateData)).rejects.toThrow('Template with ID \'duplicate\' already exists')
    })

    it('should enforce template limit', async () => {
      const smallManager = new TemplateManager({ maxTemplates: 2 })
      
      await smallManager.create({ id: '1', name: 'One', content: 'Content 1' })
      await smallManager.create({ id: '2', name: 'Two', content: 'Content 2' })
      
      await expect(smallManager.create({ id: '3', name: 'Three', content: 'Content 3' }))
        .rejects.toThrow('Maximum number of templates (2) reached')
    })

    it('should validate template syntax', async () => {
      mockParser.validate.mockReturnValue({ valid: false, errors: ['Syntax error'], warnings: [] })
      
      const templateData = {
        id: 'invalid',
        name: 'Invalid Template',
        content: 'Invalid {{syntax'
      }
      
      await expect(manager.create(templateData)).rejects.toThrow('Invalid template syntax: Syntax error')
    })

    it('should use default category if not provided', async () => {
      const templateData = {
        id: 'test',
        name: 'Test',
        content: 'Content'
      }
      
      const created = await manager.create(templateData)
      
      expect(created.category).toBe('general')
      expect(created.tags).toEqual([])
    })

    it('should update category and tag indexes', async () => {
      const templateData = {
        id: 'test',
        name: 'Test',
        content: 'Content',
        category: 'custom',
        tags: ['tag1', 'tag2']
      }
      
      await manager.create(templateData)
      
      const categories = manager.getCategories()
      const tags = manager.getTags()
      
      expect(categories.some(cat => cat.id === 'custom')).toBe(true)
      expect(tags.includes('tag1')).toBe(true)
      expect(tags.includes('tag2')).toBe(true)
    })
  })

  describe('Template Reading', () => {
    it('should read existing template', async () => {
      const templateData = {
        id: 'test',
        name: 'Test',
        content: 'Content'
      }
      
      await manager.create(templateData)
      const retrieved = manager.read('test')
      
      expect(retrieved).toBeDefined()
      expect(retrieved.id).toBe('test')
      expect(retrieved.name).toBe('Test')
    })

    it('should return null for non-existent template', () => {
      const retrieved = manager.read('non-existent')
      
      expect(retrieved).toBe(null)
    })
  })

  describe('Template Updates', () => {
    beforeEach(async () => {
      await manager.create({
        id: 'update-test',
        name: 'Original Name',
        content: 'Original content',
        category: 'general',
        tags: ['original'],
        metadata: { version: '1.0.0' }
      })
    })

    it('should update template name', async () => {
      const updated = await manager.update('update-test', { name: 'New Name' })
      
      expect(updated.name).toBe('New Name')
      expect(updated.content).toBe('Original content') // unchanged
      expect(updated.metadata.version).toBe('1.0.1') // version incremented
      expect(updated.metadata.updatedAt).toBeDefined()
    })

    it('should update template content', async () => {
      const updated = await manager.update('update-test', { content: 'New content' })
      
      expect(updated.content).toBe('New content')
      expect(mockParser.getStatistics).toHaveBeenCalledWith('New content')
      expect(updated.stats).toBeDefined()
    })

    it('should update category and maintain indexes', async () => {
      const updated = await manager.update('update-test', { category: 'notes' })
      
      expect(updated.category).toBe('notes')
      
      const categories = manager.getCategories()
      const notesCategory = categories.find(cat => cat.id === 'notes')
      expect(notesCategory.templates).toContain('update-test')
    })

    it('should update tags and maintain indexes', async () => {
      const updated = await manager.update('update-test', { tags: ['new-tag'] })
      
      expect(updated.tags).toEqual(['new-tag'])
      
      const tags = manager.getTags()
      expect(tags.includes('new-tag')).toBe(true)
      expect(tags.includes('original')).toBe(false) // old tag removed
    })

    it('should validate new content during update', async () => {
      mockParser.validate.mockReturnValue({ valid: false, errors: ['Invalid syntax'], warnings: [] })
      
      await expect(manager.update('update-test', { content: 'Invalid {{content' }))
        .rejects.toThrow('Invalid template syntax: Invalid syntax')
    })

    it('should throw error for non-existent template', async () => {
      await expect(manager.update('non-existent', { name: 'New Name' }))
        .rejects.toThrow('Template \'non-existent\' not found')
    })

    it('should increment version correctly', async () => {
      await manager.update('update-test', { name: 'Version 1' })
      await manager.update('update-test', { name: 'Version 2' })
      const updated = await manager.update('update-test', { name: 'Version 3' })
      
      expect(updated.metadata.version).toBe('1.0.3')
    })
  })

  describe('Template Deletion', () => {
    beforeEach(async () => {
      await manager.create({
        id: 'delete-test',
        name: 'Delete Test',
        content: 'Content',
        category: 'custom-delete',
        tags: ['delete-tag']
      })
    })

    it('should delete existing template', () => {
      const deleted = manager.delete('delete-test')
      
      expect(deleted).toBe(true)
      expect(manager.read('delete-test')).toBe(null)
    })

    it('should clean up category index', () => {
      manager.delete('delete-test')
      
      const categories = manager.getCategories()
      expect(categories.some(cat => cat.id === 'custom-delete')).toBe(false)
    })

    it('should clean up tag index', () => {
      manager.delete('delete-test')
      
      const tags = manager.getTags()
      expect(tags.includes('delete-tag')).toBe(false)
    })

    it('should return false for non-existent template', () => {
      const deleted = manager.delete('non-existent')
      
      expect(deleted).toBe(false)
    })
  })

  describe('Template Listing', () => {
    beforeEach(async () => {
      await manager.create({
        id: 'list-1',
        name: 'First Template',
        content: 'Content 1',
        category: 'notes',
        tags: ['tag1', 'common']
      })
      
      await manager.create({
        id: 'list-2',
        name: 'Second Template',
        content: 'Content 2',
        category: 'general',
        tags: ['tag2', 'common']
      })
      
      await manager.create({
        id: 'list-3',
        name: 'Third Template',
        content: 'Content 3',
        category: 'notes',
        tags: ['tag3']
      })
    })

    it('should list all templates', () => {
      const result = manager.list()
      
      expect(result.templates).toHaveLength(3)
      expect(result.total).toBe(3)
      expect(result.offset).toBe(0)
      expect(result.limit).toBe(3)
    })

    it('should filter by category', () => {
      const result = manager.list({ category: 'notes' })
      
      expect(result.templates).toHaveLength(2)
      expect(result.templates.every(t => t.category === 'notes')).toBe(true)
    })

    it('should filter by tags', () => {
      const result = manager.list({ tags: ['common'] })
      
      expect(result.templates).toHaveLength(2)
      expect(result.templates.every(t => t.tags.includes('common'))).toBe(true)
    })

    it('should search in name and content', () => {
      const result = manager.list({ search: 'First' })
      
      expect(result.templates).toHaveLength(1)
      expect(result.templates[0].name).toBe('First Template')
    })

    it('should search in tags', () => {
      const result = manager.list({ search: 'tag2' })
      
      expect(result.templates).toHaveLength(1)
      expect(result.templates[0].tags.includes('tag2')).toBe(true)
    })

    it('should sort by name', () => {
      const result = manager.list({ sortBy: 'name', sortOrder: 'asc' })
      
      expect(result.templates[0].name).toBe('First Template')
      expect(result.templates[1].name).toBe('Second Template')
      expect(result.templates[2].name).toBe('Third Template')
    })

    it('should sort in descending order', () => {
      const result = manager.list({ sortBy: 'name', sortOrder: 'desc' })
      
      expect(result.templates[0].name).toBe('Third Template')
      expect(result.templates[2].name).toBe('First Template')
    })

    it('should handle pagination', () => {
      const result = manager.list({ limit: 2, offset: 1 })
      
      expect(result.templates).toHaveLength(2)
      expect(result.total).toBe(3)
      expect(result.offset).toBe(1)
      expect(result.limit).toBe(2)
    })

    it('should combine filters', () => {
      const result = manager.list({ 
        category: 'notes', 
        tags: ['common'],
        search: 'First'
      })
      
      expect(result.templates).toHaveLength(1)
      expect(result.templates[0].id).toBe('list-1')
    })
  })

  describe('Template Processing', () => {
    beforeEach(async () => {
      await manager.create({
        id: 'process-test',
        name: 'Process Test',
        content: 'Hello {{name}}!'
      })
    })

    it('should process template with variables', async () => {
      const variables = { name: 'John' }
      const result = await manager.process('process-test', variables)
      
      expect(mockProcessor.process).toHaveBeenCalledWith('Hello {{name}}!', variables, {})
      expect(result.result).toBe('processed content')
    })

    it('should handle processing options', async () => {
      const variables = { name: 'John' }
      const options = { strictMode: false }
      
      await manager.process('process-test', variables, options)
      
      expect(mockProcessor.process).toHaveBeenCalledWith('Hello {{name}}!', variables, options)
    })

    it('should throw error for non-existent template', async () => {
      await expect(manager.process('non-existent')).rejects.toThrow('Template \'non-existent\' not found')
    })
  })

  describe('Template Preview', () => {
    beforeEach(async () => {
      await manager.create({
        id: 'preview-test',
        name: 'Preview Test',
        content: 'Hello {{name}}!'
      })
    })

    it('should preview template processing', async () => {
      const variables = { name: 'John' }
      const result = await manager.preview('preview-test', variables)
      
      expect(mockProcessor.preview).toHaveBeenCalledWith('Hello {{name}}!', variables)
      expect(result.preview).toBe(true)
    })

    it('should throw error for non-existent template', async () => {
      await expect(manager.preview('non-existent')).rejects.toThrow('Template \'non-existent\' not found')
    })
  })

  describe('Template Duplication', () => {
    beforeEach(async () => {
      await manager.create({
        id: 'original',
        name: 'Original Template',
        content: 'Original content',
        category: 'notes',
        tags: ['original-tag'],
        metadata: { author: 'Original Author' }
      })
    })

    it('should duplicate template with default options', async () => {
      const duplicate = await manager.duplicate('original', 'copy')
      
      expect(duplicate.id).toBe('copy')
      expect(duplicate.name).toBe('Original Template (Copy)')
      expect(duplicate.content).toBe('Original content')
      expect(duplicate.category).toBe('notes')
      expect(duplicate.tags).toEqual(['original-tag'])
      expect(duplicate.metadata.originalId).toBe('original')
    })

    it('should duplicate template with custom options', async () => {
      const options = {
        name: 'Custom Copy Name',
        category: 'general',
        tags: ['copy-tag'],
        metadata: { author: 'Copy Author' }
      }
      
      const duplicate = await manager.duplicate('original', 'custom-copy', options)
      
      expect(duplicate.name).toBe('Custom Copy Name')
      expect(duplicate.category).toBe('general')
      expect(duplicate.tags).toEqual(['copy-tag'])
      expect(duplicate.metadata.author).toBe('Copy Author')
      expect(duplicate.metadata.originalId).toBe('original')
    })

    it('should throw error for non-existent template', async () => {
      await expect(manager.duplicate('non-existent', 'copy')).rejects.toThrow('Template \'non-existent\' not found')
    })
  })

  describe('Template Import/Export', () => {
    beforeEach(async () => {
      await manager.create({
        id: 'export-test',
        name: 'Export Test',
        content: 'Export content',
        metadata: { author: 'Test Author' }
      })
    })

    it('should export template', () => {
      const exported = manager.export('export-test')
      
      expect(exported.id).toBe('export-test')
      expect(exported.name).toBe('Export Test')
      expect(exported.content).toBe('Export content')
      expect(exported.exportedAt).toBeDefined()
      expect(exported.exportVersion).toBe('1.0.0')
    })

    it('should throw error when exporting non-existent template', () => {
      expect(() => manager.export('non-existent')).toThrow('Template \'non-existent\' not found')
    })

    it('should import template', async () => {
      const templateData = {
        id: 'imported',
        name: 'Imported Template',
        content: 'Imported content',
        category: 'custom',
        tags: ['imported-tag']
      }
      
      const imported = await manager.import(templateData)
      
      expect(imported.id).toBe('imported')
      expect(imported.name).toBe('Imported Template')
      expect(imported.content).toBe('Imported content')
      expect(imported.category).toBe('custom')
      expect(imported.tags).toEqual(['imported-tag'])
      expect(imported.metadata.importedAt).toBeDefined()
    })

    it('should use default values for missing import fields', async () => {
      const templateData = {
        id: 'minimal-import',
        name: 'Minimal Import',
        content: 'Minimal content'
      }
      
      const imported = await manager.import(templateData)
      
      expect(imported.category).toBe('imported')
      expect(imported.tags).toEqual(['imported'])
    })

    it('should prevent importing over existing template without overwrite', async () => {
      const templateData = {
        id: 'export-test',
        name: 'Conflict Template',
        content: 'Conflict content'
      }
      
      await expect(manager.import(templateData)).rejects.toThrow('Template \'export-test\' already exists')
    })

    it('should allow overwriting existing template', async () => {
      const templateData = {
        id: 'export-test',
        name: 'Overwritten Template',
        content: 'Overwritten content'
      }
      
      const imported = await manager.import(templateData, { overwrite: true })
      
      expect(imported.name).toBe('Overwritten Template')
      expect(imported.content).toBe('Overwritten content')
    })

    it('should validate imported template data', async () => {
      const invalidData = { name: 'Missing ID' }
      
      await expect(manager.import(invalidData)).rejects.toThrow('Invalid template data: missing required fields')
    })
  })

  describe('Statistics and Information', () => {
    beforeEach(async () => {
      await manager.create({
        id: 'stats-1',
        name: 'Stats Template 1',
        content: 'Content 1',
        category: 'notes',
        tags: ['tag1', 'common']
      })
      
      await manager.create({
        id: 'stats-2',
        name: 'Stats Template 2',
        content: 'Content 2 is longer',
        category: 'general',
        tags: ['tag2', 'common']
      })
    })

    it('should get template statistics', () => {
      const stats = manager.getStatistics()
      
      expect(stats.total).toBe(2)
      expect(stats.categories).toBeGreaterThanOrEqual(2)
      expect(stats.tags).toBeGreaterThanOrEqual(2)
      expect(stats.categoryStats.notes).toBe(1)
      expect(stats.categoryStats.general).toBe(1)
      expect(stats.tagStats.common).toBe(2)
      expect(stats.averageSize).toBeGreaterThan(0)
    })

    it('should get all categories', () => {
      const categories = manager.getCategories()
      
      expect(Array.isArray(categories)).toBe(true)
      expect(categories.every(cat => cat.id && cat.name)).toBe(true)
    })

    it('should get all tags', () => {
      const tags = manager.getTags()
      
      expect(Array.isArray(tags)).toBe(true)
      expect(tags.includes('common')).toBe(true)
      expect(tags.includes('tag1')).toBe(true)
      expect(tags.includes('tag2')).toBe(true)
    })

    it('should search templates', () => {
      const result = manager.search('Stats', { limit: 10 })
      
      expect(result.templates).toHaveLength(2)
      expect(result.templates.every(t => t.name.includes('Stats'))).toBe(true)
    })

    it('should validate template content', () => {
      const validation = manager.validate('{{valid}} template')
      
      expect(mockParser.validate).toHaveBeenCalledWith('{{valid}} template')
      expect(validation.valid).toBe(true)
    })

    it('should get storage size', () => {
      const size = manager.size()
      
      expect(size).toBe(2)
    })
  })

  describe('Cleanup Operations', () => {
    beforeEach(async () => {
      await manager.create({
        id: 'clear-test-1',
        name: 'Clear Test 1',
        content: 'Content 1',
        category: 'test-category',
        tags: ['test-tag']
      })
      
      await manager.create({
        id: 'clear-test-2',
        name: 'Clear Test 2',
        content: 'Content 2',
        category: 'test-category',
        tags: ['test-tag']
      })
    })

    it('should clear all templates', () => {
      expect(manager.size()).toBe(2)
      
      manager.clear()
      
      expect(manager.size()).toBe(0)
      expect(manager.getTags()).toHaveLength(0)
      
      // Should still have default categories
      const categories = manager.getCategories()
      expect(categories.some(cat => cat.id === 'general')).toBe(true)
    })
  })

  describe('Private Methods', () => {
    it('should get correct sort values', () => {
      const template = {
        name: 'Test Template',
        category: 'notes',
        metadata: {
          createdAt: '2024-01-01',
          updatedAt: '2024-01-02'
        },
        content: 'Test content',
        stats: { complexity: 'simple' }
      }
      
      expect(manager.getSortValue(template, 'name')).toBe('Test Template')
      expect(manager.getSortValue(template, 'category')).toBe('notes')
      expect(manager.getSortValue(template, 'created')).toBe('2024-01-01')
      expect(manager.getSortValue(template, 'updated')).toBe('2024-01-02')
      expect(manager.getSortValue(template, 'size')).toBe(12)
      expect(manager.getSortValue(template, 'complexity')).toBe('simple')
      expect(manager.getSortValue(template, 'unknown')).toBe('Test Template')
    })

    it('should increment version correctly', () => {
      expect(manager.incrementVersion('1.0.0')).toBe('1.0.1')
      expect(manager.incrementVersion('1.0.9')).toBe('1.0.10')
      expect(manager.incrementVersion('1.0')).toBe('1.0.1')
      expect(manager.incrementVersion('1')).toBe('1.0.1')
    })
  })

  describe('Index Management', () => {
    it('should maintain category index correctly', async () => {
      await manager.create({
        id: 'index-test',
        name: 'Index Test',
        content: 'Content',
        category: 'custom-category'
      })
      
      const categories = manager.getCategories()
      const customCategory = categories.find(cat => cat.id === 'custom-category')
      
      expect(customCategory).toBeDefined()
      expect(customCategory.templates).toContain('index-test')
      
      // Update to different category
      await manager.update('index-test', { category: 'general' })
      
      const updatedCategories = manager.getCategories()
      const generalCategory = updatedCategories.find(cat => cat.id === 'general')
      const oldCustomCategory = updatedCategories.find(cat => cat.id === 'custom-category')
      
      expect(generalCategory.templates).toContain('index-test')
      expect(oldCustomCategory).toBeUndefined() // Should be removed when empty
    })

    it('should maintain tag index correctly', async () => {
      await manager.create({
        id: 'tag-test',
        name: 'Tag Test',
        content: 'Content',
        tags: ['unique-tag']
      })
      
      expect(manager.getTags()).toContain('unique-tag')
      
      // Update tags
      await manager.update('tag-test', { tags: ['different-tag'] })
      
      const tags = manager.getTags()
      expect(tags).toContain('different-tag')
      expect(tags).not.toContain('unique-tag')
    })
  })
})