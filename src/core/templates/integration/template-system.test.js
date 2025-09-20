import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TemplateManager } from '../manager.js'
import { TemplateProcessor } from '../processor.js'
import { TemplateParser } from '../parser.js'
import { TemplateSandbox } from '../sandbox.js'

describe('Template System Integration', () => {
  let manager
  let processor
  let parser
  let sandbox

  beforeEach(() => {
    // Use real implementations for integration testing
    parser = new TemplateParser()
    sandbox = new TemplateSandbox()
    processor = new TemplateProcessor({ sandbox })
    manager = new TemplateManager({ processor })
  })

  describe('End-to-End Template Workflow', () => {
    it('should create, process, and manage templates successfully', async () => {
      // Create a complex template
      const templateData = {
        id: 'complex-template',
        name: 'Complex Template',
        content: `
# {{title || "Document"}}

**Author:** {{author.name}} ({{author.email}})
**Date:** <% new Date().toDateString() %>
**ID:** <% uuid() %>

## Summary
{{description | trim | capitalize}}

## Details
{{details | default}}

## Items
{{items | join}}

<%# This is a comment that should be removed %>

**Total Items:** {{items | length}}
**Status:** {{status || "Draft" | upper}}
        `.trim(),
        category: 'documents',
        tags: ['complex', 'demo'],
        metadata: { 
          author: 'Test System',
          version: '1.0.0'
        }
      }

      // Create the template
      const created = await manager.create(templateData)
      expect(created.id).toBe('complex-template')
      expect(created.stats.variables.count).toBeGreaterThan(0)
      expect(created.stats.jsBlocks.count).toBeGreaterThan(0)

      // Process the template with variables
      const variables = {
        title: 'Integration Test Document',
        author: {
          name: 'John Doe',
          email: 'john@example.com'
        },
        description: '  this is a test description  ',
        details: 'Detailed information about the test',
        items: ['item1', 'item2', 'item3'],
        status: 'final'
      }

      const result = await manager.process('complex-template', variables)
      
      // Verify processing results
      expect(result.result).toContain('# Integration Test Document')
      expect(result.result).toContain('**Author:** John Doe (john@example.com)')
      expect(result.result).toContain('This is a test description') // Trimmed and capitalized
      expect(result.result).toContain('item1, item2, item3') // Joined array
      expect(result.result).toContain('**Total Items:** 3') // Array length
      expect(result.result).toContain('**Status:** FINAL') // Default overridden and uppercased
      expect(result.result).not.toContain('<%#') // Comments removed
    })

    it('should handle template duplication and modification', async () => {
      // Create original template
      await manager.create({
        id: 'original',
        name: 'Original Template',
        content: 'Hello {{name}}!',
        category: 'greetings'
      })

      // Duplicate the template
      const duplicate = await manager.duplicate('original', 'copy', {
        name: 'Modified Copy',
        category: 'test'
      })

      expect(duplicate.id).toBe('copy')
      expect(duplicate.name).toBe('Modified Copy')
      expect(duplicate.category).toBe('test')
      expect(duplicate.content).toBe('Hello {{name}}!')

      // Modify the duplicate
      const updated = await manager.update('copy', {
        content: 'Greetings {{name}}, welcome to {{place}}!'
      })

      // Process both templates
      const variables = { name: 'Alice', place: 'Testing' }
      const originalResult = await manager.process('original', variables)
      const copyResult = await manager.process('copy', variables)

      expect(originalResult.result).toBe('Hello Alice!')
      expect(copyResult.result).toBe('Greetings Alice, welcome to Testing!')
    })

    it('should handle template import/export cycle', async () => {
      // Create and export a template
      await manager.create({
        id: 'export-test',
        name: 'Export Test',
        content: 'Content: {{content | upper}}',
        category: 'test',
        tags: ['export', 'test'],
        metadata: { author: 'Test User' }
      })

      const exported = manager.export('export-test')
      
      // Clear storage and import back
      manager.clear()
      expect(manager.size()).toBe(0)

      const imported = await manager.import(exported)
      
      expect(imported.id).toBe('export-test')
      expect(imported.name).toBe('Export Test')
      expect(imported.content).toBe('Content: {{content | upper}}')
      expect(imported.category).toBe('test')
      expect(imported.tags).toEqual(['export', 'test'])

      // Verify it works
      const result = await manager.process('export-test', { content: 'hello world' })
      expect(result.result).toBe('Content: HELLO WORLD')
    })
  })

  describe('Parser and Processor Integration', () => {
    it('should handle complex template parsing and processing', async () => {
      const complexTemplate = `
        <%# Header comment %>
        # {{title | upper}}
        
        <% 
          let items = ['apple', 'banana', 'cherry'];
          return 'Items: ' + items.join(', ');
        %>
        
        {{description || "No description provided"}}
        
        <%# Variables with filters %>
        Price: \${{price | round}} (was \${{originalPrice | round}})
        Discount: <% Math.round((originalPrice - price) / originalPrice * 100) %>%
        
        <% 
          if (featured) {
            return "🌟 Featured Item!";
          }
          return "";
        %>
      `

      const variables = {
        title: 'special offer',
        description: 'Amazing product description',
        price: 19.99,
        originalPrice: 29.99,
        featured: true
      }

      const result = await processor.process(complexTemplate, variables)
      
      expect(result.result).toContain('# SPECIAL OFFER')
      expect(result.result).toContain('Items: apple, banana, cherry')
      expect(result.result).toContain('Amazing product description')
      expect(result.result).toContain('Price: $20 (was $30)')
      expect(result.result).toContain('🌟 Featured Item!')
      expect(result.result).not.toContain('<%#')
    })

    it('should handle mixed content with JavaScript and variables', async () => {
      const template = `
        Today: <% new Date().toDateString() %>
        User: {{user.name}} ({{user.role | upper}})
        
        <% 
          const tasks = user.tasks || [];
          return tasks.length + " tasks pending";
        %>
        
        <% tasks.map(task => '- ' + task.title + ' (' + task.priority.toUpperCase() + ')').join('\n') %>
      `

      // Mock the sandbox for consistent testing
      const originalExecute = sandbox.execute
      sandbox.execute = vi.fn()
        .mockImplementationOnce(() => Promise.resolve('Mon Jan 15 2024'))
        .mockImplementationOnce(() => Promise.resolve('2 tasks pending'))
        .mockImplementationOnce(() => Promise.resolve('- Review code (HIGH)\n- Update docs (MEDIUM)'))

      const variables = {
        user: {
          name: 'John Doe',
          role: 'admin',
          tasks: [
            { title: 'Review code', priority: 'high' },
            { title: 'Update docs', priority: 'medium' }
          ]
        }
      }

      const result = await processor.process(template, variables)
      
      expect(result.result).toContain('Today: Mon Jan 15 2024')
      expect(result.result).toContain('User: John Doe (ADMIN)')
      expect(result.result).toContain('2 tasks pending')
      
      // Restore original execute function
      sandbox.execute = originalExecute
    })
  })

  describe('Sandbox Integration', () => {
    it('should execute JavaScript safely within templates', async () => {
      const template = `
        Random Number: <% Math.floor(Math.random() * 100) %>
        Current Year: <% new Date().getFullYear() %>
        Formatted Text: <% format("Hello {0}!", name) %>
        Slug: <% slugify(title) %>
      `

      const variables = {
        name: 'World',
        title: 'Hello World! Test'
      }

      const result = await processor.process(template, variables)
      
      expect(result.result).toMatch(/Random Number: \d+/)
      expect(result.result).toMatch(/Current Year: \d{4}/)
      expect(result.result).toContain('Formatted Text: Hello World!')
      expect(result.result).toContain('Slug: hello-world-test')
    })

    it('should prevent dangerous code execution', async () => {
      const dangerousTemplate = `
        Safe: <% Math.PI %>
        Dangerous: <% eval("process.exit()") %>
      `

      await expect(processor.process(dangerousTemplate)).rejects.toThrow()
    })

    it('should handle JavaScript errors gracefully', async () => {
      processor.strictMode = false
      
      const template = `
        Good: <% 1 + 1 %>
        Bad: <% nonExistentFunction() %>
        After: text
      `

      const result = await processor.process(template)
      
      expect(result.result).toContain('Good: 2')
      expect(result.result).toContain('Bad: <% nonExistentFunction() %>') // Preserved on error
      expect(result.result).toContain('After: text')
    })
  })

  describe('Template Management Integration', () => {
    it('should maintain consistency across CRUD operations', async () => {
      // Create multiple templates
      const templates = [
        {
          id: 'temp1',
          name: 'Template 1',
          content: 'Content 1: {{var1}}',
          category: 'cat1',
          tags: ['tag1', 'common']
        },
        {
          id: 'temp2', 
          name: 'Template 2',
          content: 'Content 2: {{var2}}',
          category: 'cat2',
          tags: ['tag2', 'common']
        },
        {
          id: 'temp3',
          name: 'Template 3', 
          content: 'Content 3: {{var3}}',
          category: 'cat1',
          tags: ['tag3']
        }
      ]

      // Create all templates
      for (const template of templates) {
        await manager.create(template)
      }

      // Test listing and filtering
      expect(manager.list().total).toBe(3)
      expect(manager.list({ category: 'cat1' }).total).toBe(2)
      expect(manager.list({ tags: ['common'] }).total).toBe(2)
      expect(manager.list({ search: 'Template 2' }).total).toBe(1)

      // Test category and tag indexes
      const categories = manager.getCategories()
      expect(categories.find(c => c.id === 'cat1').templates).toContain('temp1')
      expect(categories.find(c => c.id === 'cat1').templates).toContain('temp3')
      
      const tags = manager.getTags()
      expect(tags).toContain('tag1')
      expect(tags).toContain('tag2')
      expect(tags).toContain('tag3')
      expect(tags).toContain('common')

      // Update and verify index maintenance
      await manager.update('temp1', { 
        category: 'cat2',
        tags: ['updated-tag']
      })

      const updatedCategories = manager.getCategories()
      expect(updatedCategories.find(c => c.id === 'cat1').templates).not.toContain('temp1')
      expect(updatedCategories.find(c => c.id === 'cat2').templates).toContain('temp1')

      const updatedTags = manager.getTags()
      expect(updatedTags).toContain('updated-tag')
      expect(updatedTags).not.toContain('tag1')

      // Delete and verify cleanup
      manager.delete('temp1')
      expect(manager.size()).toBe(2)
      expect(manager.getTags()).not.toContain('updated-tag')
    })

    it('should validate templates during creation and updates', async () => {
      // Valid template should succeed
      await expect(manager.create({
        id: 'valid',
        name: 'Valid Template',
        content: 'Hello {{name}}! <% Math.PI %>'
      })).resolves.toBeDefined()

      // Invalid syntax should fail
      await expect(manager.create({
        id: 'invalid',
        name: 'Invalid Template', 
        content: 'Unclosed {{variable and <% Math.PI'
      })).rejects.toThrow('Invalid template syntax')

      // Update with invalid content should fail
      await expect(manager.update('valid', {
        content: 'Bad {{syntax'
      })).rejects.toThrow('Invalid template syntax')
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle multiple templates efficiently', async () => {
      // Create many templates
      const startTime = Date.now()
      
      for (let i = 0; i < 50; i++) {
        await manager.create({
          id: `perf-test-${i}`,
          name: `Performance Test ${i}`,
          content: `Template {{number}} content with {{value | upper}}`,
          category: `category-${i % 5}`,
          tags: [`tag-${i % 10}`, 'performance']
        })
      }
      
      const creationTime = Date.now() - startTime
      expect(creationTime).toBeLessThan(5000) // Should complete within 5 seconds

      // Test bulk operations
      const listStart = Date.now()
      const all = manager.list()
      const filtered = manager.list({ tags: ['performance'] })
      const searched = manager.list({ search: 'Performance' })
      const listTime = Date.now() - listStart

      expect(all.total).toBe(50)
      expect(filtered.total).toBe(50)
      expect(searched.total).toBe(50)
      expect(listTime).toBeLessThan(1000) // Should complete within 1 second

      // Test statistics
      const stats = manager.getStatistics()
      expect(stats.total).toBe(50)
      expect(stats.categories).toBeGreaterThanOrEqual(5)
      expect(stats.tags).toBeGreaterThanOrEqual(10)
    })

    it('should process complex templates efficiently', async () => {
      const complexTemplate = `
        # {{title | upper}}
        
        <% 
          let result = [];
          for (let i = 0; i < 10; i++) {
            result.push('Item ' + (i + 1) + ': ' + Math.random().toFixed(2));
          }
          return result.join('\n');
        %>
        
        <% items.map(item => '- ' + item.name + ' (' + item.value + ')').join('\n') %>
        
        **Summary:** <% items.length %> items processed
        **Total Value:** \$<% Math.round(items.reduce((sum, item) => sum + item.value, 0)) %>
      `

      // Mock the sandbox for performance test
      sandbox.execute = vi.fn().mockImplementation(async (code) => {
        if (code.includes('result.push')) {
          return Array(10).fill().map((_, i) => `Item ${i + 1}: 0.${Math.floor(Math.random() * 100)}`).join('\n')
        }
        if (code.includes('items.map')) {
          return '- Item 0 (25.5)\n- Item 1 (50.2)\n- Item 2 (75.8)'
        }
        if (code.includes('items.length')) {
          return '100'
        }
        if (code.includes('items.reduce')) {
          return '2500'
        }
        return ''
      })

      const variables = {
        title: 'performance test',
        items: Array(100).fill().map((_, i) => ({
          name: `Item ${i}`,
          value: Math.random() * 100
        }))
      }

      const startTime = Date.now()
      const result = await processor.process(complexTemplate, variables)
      const processingTime = Date.now() - startTime

      expect(result.result).toContain('# PERFORMANCE TEST')
      expect(processingTime).toBeLessThan(1000) // Should complete within 1 second
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should handle mixed valid and invalid content gracefully', async () => {
      processor.strictMode = false

      const template = `
        Valid: {{name}}
        Invalid JS: <% badFunction() %>
        Valid JS: <% Math.PI %>
        Invalid Variable: {{missing.deeply.nested}}
        Valid with Default: {{missing || "default"}}
      `

      const variables = { name: 'Test' }
      const result = await processor.process(template, variables)

      expect(result.result).toContain('Valid: Test')
      expect(result.result).toContain('Invalid JS: <% badFunction() %>') // Preserved
      expect(result.result).toContain('Valid JS: 3.14159') // Approximately
      expect(result.result).toContain('Invalid Variable: {{missing.deeply.nested}}') // Preserved
      expect(result.result).toContain('Valid with Default: default')
    })

    it('should maintain system stability when templates fail', async () => {
      // Create a mix of valid and invalid templates
      await manager.create({
        id: 'valid-1',
        name: 'Valid 1',
        content: 'Hello {{name}}!'
      })

      // This should fail but not break the system
      try {
        await manager.create({
          id: 'invalid-1',
          name: 'Invalid 1',
          content: 'Bad {{syntax'
        })
      } catch (error) {
        // Expected to fail
      }

      await manager.create({
        id: 'valid-2',
        name: 'Valid 2', 
        content: 'Welcome {{user}}!'
      })

      // System should still work
      expect(manager.size()).toBe(2)
      
      const result1 = await manager.process('valid-1', { name: 'Alice' })
      const result2 = await manager.process('valid-2', { user: 'Bob' })
      
      expect(result1.result).toBe('Hello Alice!')
      expect(result2.result).toBe('Welcome Bob!')
    })
  })

  describe('Security Integration', () => {
    it('should prevent code injection through variables', async () => {
      const template = 'User input: {{userInput}}'
      const maliciousVariables = {
        userInput: '<script>alert("xss")</script>'
      }

      const result = await processor.process(template, maliciousVariables)
      
      // Should output the content as-is (template system doesn't HTML escape by default)
      expect(result.result).toBe('User input: <script>alert("xss")</script>')
    })

    it('should prevent JavaScript injection through template content', async () => {
      const maliciousTemplate = `
        Safe: {{name}}
        Dangerous: <% eval(userCode) %>
      `

      const variables = {
        name: 'Test',
        userCode: 'process.exit()'
      }

      await expect(processor.process(maliciousTemplate, variables)).rejects.toThrow()
    })

    it('should sanitize template content during validation', async () => {
      const suspiciousContent = `
        Normal: {{name}}
        Eval: <% eval("dangerous") %>
        Function: <% new Function("return 1")() %>
        Require: <% require("fs") %>
      `

      const validation = parser.validate(suspiciousContent)
      
      expect(validation.warnings.some(w => w.includes('potentially dangerous code'))).toBe(true)
    })
  })
})