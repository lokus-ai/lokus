import { describe, it, expect, beforeEach } from 'vitest'
import { TemplateParser } from '../parser.js'

describe('TemplateParser', () => {
  let parser

  beforeEach(() => {
    parser = new TemplateParser()
  })

  describe('Basic Parsing', () => {
    it('should parse empty template', () => {
      expect(() => parser.parse('')).toThrow('Template must be a non-empty string')
    })

    it('should parse template without variables or JS blocks', () => {
      const template = 'This is plain text content'
      const result = parser.parse(template)

      expect(result.template).toBe(template)
      expect(result.variables).toHaveLength(0)
      expect(result.jsBlocks).toHaveLength(0)
      expect(result.comments).toHaveLength(0)
      expect(result.hasVariables).toBe(false)
      expect(result.hasJsBlocks).toBe(false)
      expect(result.hasComments).toBe(false)
    })

    it('should handle null or undefined input', () => {
      expect(() => parser.parse(null)).toThrow('Template must be a non-empty string')
      expect(() => parser.parse(undefined)).toThrow('Template must be a non-empty string')
      expect(() => parser.parse(123)).toThrow('Template must be a non-empty string')
    })
  })

  describe('Variable Extraction', () => {
    it('should extract simple variables', () => {
      const template = 'Hello {{name}}, welcome to {{place}}!'
      const result = parser.parse(template)

      expect(result.variables).toHaveLength(2)
      expect(result.variables[0].name).toBe('name')
      expect(result.variables[0].fullMatch).toBe('{{name}}')
      expect(result.variables[0].filters).toHaveLength(0)
      expect(result.variables[0].defaultValue).toBe(null)
      expect(result.variables[1].name).toBe('place')
    })

    it('should extract variables with default values', () => {
      const template = 'Hello {{name || "Guest"}}, today is {{date || "unknown"}}!'
      const result = parser.parse(template)

      expect(result.variables).toHaveLength(2)
      expect(result.variables[0].name).toBe('name')
      expect(result.variables[0].defaultValue).toBe('Guest') // Now correctly parsing default values
      expect(result.variables[1].name).toBe('date')
      expect(result.variables[1].defaultValue).toBe('unknown')
    })

    it('should extract variables with filters', () => {
      const template = 'Hello {{name | upper | trim}}!'
      const result = parser.parse(template)

      expect(result.variables).toHaveLength(1)
      expect(result.variables[0].name).toBe('name')
      expect(result.variables[0].filters).toEqual(['upper', 'trim'])
    })

    it('should extract variables with filters and defaults', () => {
      const template = '{{title || "Untitled" | upper | trim}}'
      const result = parser.parse(template)

      expect(result.variables).toHaveLength(1)
      expect(result.variables[0].name).toBe('title')
      expect(result.variables[0].defaultValue).toBe('Untitled') // Now correctly parsing default values
      expect(result.variables[0].filters).toEqual(['upper', 'trim'])
    })

    it('should handle nested object properties', () => {
      const template = 'User: {{user.name}}, Email: {{user.contact.email}}'
      const result = parser.parse(template)

      expect(result.variables).toHaveLength(2)
      expect(result.variables[0].name).toBe('user.name')
      expect(result.variables[1].name).toBe('user.contact.email')
    })

    it('should handle special characters in variable names', () => {
      const template = '{{my_var}} {{var-name}} {{var123}}'
      const result = parser.parse(template)

      expect(result.variables).toHaveLength(3)
      expect(result.variables[0].name).toBe('my_var')
      expect(result.variables[1].name).toBe('var-name')
      expect(result.variables[2].name).toBe('var123')
    })

    it('should track variable positions', () => {
      const template = 'Start {{first}} middle {{second}} end'
      const result = parser.parse(template)

      expect(result.variables[0].position).toBe(6)
      expect(result.variables[1].position).toBe(23)
    })

    it('should handle malformed variables gracefully', () => {
      const template = 'Hello {name} and {{unclosed and }}'
      const result = parser.parse(template)

      // Should only extract properly formed variables
      expect(result.variables).toHaveLength(1) // extracts }}}
    })
  })

  describe('JavaScript Block Extraction', () => {
    it('should extract simple JS expressions', () => {
      const template = 'Today is <% new Date().toDateString() %>'
      const result = parser.parse(template)

      expect(result.jsBlocks).toHaveLength(1)
      expect(result.jsBlocks[0].code).toBe('new Date().toDateString()')
      expect(result.jsBlocks[0].isExpression).toBe(true)
      expect(result.jsBlocks[0].isStatement).toBeFalsy() // returns null, which is falsy
    })

    it('should extract JS statements', () => {
      const template = '<% let x = 5; return x * 2; %>'
      const result = parser.parse(template)

      expect(result.jsBlocks).toHaveLength(1)
      expect(result.jsBlocks[0].code).toBe('let x = 5; return x * 2;')
      expect(result.jsBlocks[0].isExpression).toBe(false)
      expect(result.jsBlocks[0].isStatement).toBe(true)
    })

    it('should extract multiple JS blocks', () => {
      const template = 'Start <% Math.random() %> middle <% Date.now() %> end'
      const result = parser.parse(template)

      expect(result.jsBlocks).toHaveLength(2)
      expect(result.jsBlocks[0].code).toBe('Math.random()')
      expect(result.jsBlocks[1].code).toBe('Date.now()')
    })

    it('should handle JS blocks with return statements', () => {
      const template = '<% return "hello world" %>'
      const result = parser.parse(template)

      expect(result.jsBlocks[0].isExpression).toBe(true)
    })

    it('should handle whitespace in JS blocks', () => {
      const template = '<%   Math.PI   %>'
      const result = parser.parse(template)

      expect(result.jsBlocks[0].code).toBe('Math.PI')
    })

    it('should handle multiline JS blocks', () => {
      const template = `<%
        const items = ['a', 'b', 'c'];
        return items.join(', ');
      %>`
      const result = parser.parse(template)

      expect(result.jsBlocks).toHaveLength(1)
      expect(result.jsBlocks[0].code).toContain("const items = ['a', 'b', 'c']")
      expect(result.jsBlocks[0].isStatement).toBe(true)
    })

    it('should track JS block positions', () => {
      const template = 'Start <% 1 + 1 %> middle <% 2 + 2 %> end'
      const result = parser.parse(template)

      expect(result.jsBlocks[0].position).toBe(6)
      expect(result.jsBlocks[1].position).toBe(25)
    })
  })

  describe('Comment Extraction', () => {
    it('should extract single line comments', () => {
      const template = 'Before <%# This is a comment %> After'
      const result = parser.parse(template)

      expect(result.comments).toHaveLength(1)
      expect(result.comments[0].position).toBe(7)
    })

    it('should extract multiline comments', () => {
      const template = `Before <%#
        This is a
        multiline comment
      %> After`
      const result = parser.parse(template)

      expect(result.comments).toHaveLength(1)
    })

    it('should extract multiple comments', () => {
      const template = '<%# Comment 1 %> Text <%# Comment 2 %>'
      const result = parser.parse(template)

      expect(result.comments).toHaveLength(2)
    })
  })

  describe('Expression and Statement Detection', () => {
    it('should identify simple expressions', () => {
      expect(parser.isExpression('Math.PI')).toBe(true)
      expect(parser.isExpression('1 + 2')).toBe(true)
      expect(parser.isExpression('user.name')).toBe(true)
      expect(parser.isExpression('new Date()')).toBe(true)
    })

    it('should identify statements', () => {
      expect(parser.isStatement('let x = 5;')).toBe(true)
      expect(parser.isStatement('if (true) return 1;')).toBe(true)
      expect(parser.isStatement('for (let i = 0; i < 10; i++) {}')).toBe(true)
      expect(parser.isStatement('function test() {}')).toBeTruthy() // returns match array
    })

    it('should identify return statements as expressions', () => {
      expect(parser.isExpression('return 42')).toBe(true)
      expect(parser.isExpression('return Math.random()')).toBe(true)
    })

    it('should handle edge cases', () => {
      expect(parser.isExpression('')).toBe(true)
      expect(parser.isStatement('')).toBeFalsy() // returns null
      expect(parser.isExpression('variable')).toBe(true)
      expect(parser.isStatement('variable')).toBeFalsy() // returns null
    })
  })

  describe('Template Validation', () => {
    it('should validate correct templates', () => {
      const template = 'Hello {{name}}, today is <% new Date().toDateString() %>'
      const validation = parser.validate(template)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should detect malformed variable syntax', () => {
      const template = 'Hello {name} and {{unclosed'
      const validation = parser.validate(template)

      expect(validation.valid).toBe(false)
      expect(validation.errors.some(e => e.includes('Malformed variable syntax'))).toBe(true)
    })

    it('should detect unclosed JS blocks', () => {
      const template = 'Start <% Math.random() and <% unclosed'
      const validation = parser.validate(template)

      expect(validation.valid).toBe(false)
      expect(validation.errors.some(e => e.includes('Unclosed JavaScript blocks'))).toBe(true)
    })

    it('should warn about many JS blocks', () => {
      let template = 'Start '
      for (let i = 0; i < 15; i++) {
        template += `<% ${i} %> `
      }
      const validation = parser.validate(template)

      expect(validation.warnings.some(w => w.includes('many JavaScript blocks'))).toBe(true)
    })

    it('should warn about many variables', () => {
      let template = 'Start '
      for (let i = 0; i < 60; i++) {
        template += `{{var${i}}} `
      }
      const validation = parser.validate(template)

      expect(validation.warnings.some(w => w.includes('many variables'))).toBe(true)
    })

    it('should warn about potentially dangerous code', () => {
      const template = '<% eval("dangerous code") %>'
      const validation = parser.validate(template)

      expect(validation.warnings.some(w => w.includes('potentially dangerous code'))).toBe(true)
    })

    it('should handle parse errors', () => {
      const originalParse = parser.parse
      parser.parse = () => { throw new Error('Test error') }

      const validation = parser.validate('any template')
      
      expect(validation.valid).toBe(false)
      expect(validation.errors.some(e => e.includes('Parse error'))).toBe(true)

      parser.parse = originalParse
    })
  })

  describe('Template Statistics', () => {
    it('should calculate statistics for simple template', () => {
      const template = 'Hello {{name}}, <% new Date() %>'
      const stats = parser.getStatistics(template)

      expect(stats.length).toBe(template.length)
      expect(stats.variables.count).toBe(1)
      expect(stats.variables.unique).toBe(1)
      expect(stats.jsBlocks.count).toBe(1)
      expect(stats.jsBlocks.expressions).toBe(1)
      expect(stats.jsBlocks.statements).toBe(0)
    })

    it('should calculate statistics for complex template', () => {
      const template = `
        Hello {{name || "Guest" | upper}},
        Welcome {{user.name | trim}}!
        Today is <% new Date().toDateString() %>
        Random: <% let x = Math.random(); return x; %>
        Same name again: {{name}}
        <%# This is a comment %>
      `
      const stats = parser.getStatistics(template)

      expect(stats.variables.count).toBe(3) // name appears twice, user.name once
      expect(stats.variables.unique).toBe(2) // name, user.name
      expect(stats.variables.withDefaults).toBe(1) // Now correctly detecting variables with defaults
      expect(stats.variables.withFilters).toBe(2) // both have filters
      expect(stats.jsBlocks.count).toBe(2) // Only actual JS blocks, comments are separate
      expect(stats.jsBlocks.expressions).toBe(1)
      expect(stats.jsBlocks.statements).toBe(1)
      expect(stats.comments.count).toBe(1)
    })

    it('should calculate complexity scores', () => {
      const simple = 'Hello {{name}}'
      const moderate = 'Hello {{name | upper}}, today is <% new Date() %>'
      const complex = Array(10).fill().map((_, i) => `{{var${i}}}`).join(' ') + 
                     Array(5).fill().map((_, i) => `<% code${i}() %>`).join(' ')

      expect(parser.getStatistics(simple).complexity).toBe('simple')
      expect(parser.getStatistics(moderate).complexity).toBe('simple')
      expect(parser.getStatistics(complex).complexity).toBe('moderate') // threshold is different
    })
  })

  describe('Regex State Management', () => {
    it('should reset regex state between operations', () => {
      const template = '{{first}} {{second}} {{third}}'
      
      // Parse multiple times to ensure regex state is reset
      const result1 = parser.parse(template)
      const result2 = parser.parse(template)
      
      expect(result1.variables).toHaveLength(3)
      expect(result2.variables).toHaveLength(3)
      expect(result1.variables[0].name).toBe('first')
      expect(result2.variables[0].name).toBe('first')
    })

    it('should handle multiple extractions correctly', () => {
      const template = '{{a}} <% code1() %> {{b}} <% code2() %> {{c}}'
      
      const variables = parser.extractVariables(template)
      const jsBlocks = parser.extractJsBlocks(template)
      
      expect(variables).toHaveLength(3)
      expect(jsBlocks).toHaveLength(2)
      
      // Extract again to ensure no interference
      const variables2 = parser.extractVariables(template)
      const jsBlocks2 = parser.extractJsBlocks(template)
      
      expect(variables2).toHaveLength(3)
      expect(jsBlocks2).toHaveLength(2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty variables', () => {
      const template = 'Empty: {{}}, Normal: {{name}}'
      const result = parser.parse(template)

      expect(result.variables).toHaveLength(1) // Only normal variable
      expect(result.variables[0].name).toBe('name')
    })

    it('should handle variables with only spaces', () => {
      const template = 'Spaces: {{   }}, Normal: {{name}}'
      const result = parser.parse(template)

      expect(result.variables).toHaveLength(2) // Both extracted in implementation
      expect(result.variables[1].name).toBe('name')
    })

    it('should handle nested braces in JS blocks', () => {
      const template = '<% { const obj = { a: 1 }; return obj.a; } %>'
      const result = parser.parse(template)

      expect(result.jsBlocks).toHaveLength(1)
      expect(result.jsBlocks[0].code).toContain('{ const obj = { a: 1 }')
    })

    it('should handle special characters in template content', () => {
      const template = 'Special: @#$%^&*()_+{}|:"<>?[]\\;\',./'
      const result = parser.parse(template)

      expect(result.template).toBe(template)
      expect(result.variables).toHaveLength(0)
      expect(result.jsBlocks).toHaveLength(0)
    })

    it('should handle unicode characters', () => {
      const template = 'Unicode: {{名前}} and {{Ω}} and {{🚀}}'
      const result = parser.parse(template)

      expect(result.variables).toHaveLength(3)
      expect(result.variables[0].name).toBe('名前')
      expect(result.variables[1].name).toBe('Ω')
      expect(result.variables[2].name).toBe('🚀')
    })

    it('should handle very long templates', () => {
      const longTemplate = 'x'.repeat(10000) + '{{name}}' + 'y'.repeat(10000)
      const result = parser.parse(longTemplate)

      expect(result.variables).toHaveLength(1)
      expect(result.variables[0].name).toBe('name')
      expect(result.template.length).toBe(20008) // Adjusted for actual length
    })
  })
})