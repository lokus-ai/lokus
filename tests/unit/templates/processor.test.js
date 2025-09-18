import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TemplateProcessor } from '../../../src/core/templates/processor.js'
import { TemplateSandbox } from '../../../src/core/templates/sandbox.js'

// Mock the sandbox
vi.mock('../../../src/core/templates/sandbox.js', () => ({
  TemplateSandbox: vi.fn().mockImplementation(() => ({
    execute: vi.fn()
  }))
}))

describe('TemplateProcessor', () => {
  let processor
  let mockSandbox

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks()
    
    // Create mock sandbox
    mockSandbox = {
      execute: vi.fn()
    }
    
    // Mock the constructor
    TemplateSandbox.mockImplementation(() => mockSandbox)
    
    processor = new TemplateProcessor()
  })

  describe('Basic Processing', () => {
    it('should process simple template without variables', async () => {
      const template = 'Hello, world!'
      const result = await processor.process(template)

      expect(result.result).toBe('Hello, world!')
      expect(result.variables).toEqual({})
      expect(result.metadata.iterations).toBeGreaterThan(0)
    })

    it('should throw error for invalid template input', async () => {
      await expect(processor.process('')).rejects.toThrow('Template must be a non-empty string')
      await expect(processor.process(null)).rejects.toThrow('Template must be a non-empty string')
      await expect(processor.process(undefined)).rejects.toThrow('Template must be a non-empty string')
      await expect(processor.process(123)).rejects.toThrow('Template must be a non-empty string')
    })

    it('should process template with context variables', async () => {
      const template = 'Hello, world!'
      const variables = { name: 'John' }
      const options = { test: true }
      
      const result = await processor.process(template, variables, options)

      expect(result.variables.name).toBe('John')
    })
  })

  describe('Comment Removal', () => {
    it('should remove single line comments', async () => {
      const template = 'Before <%# This is a comment %> After'
      const result = await processor.process(template)

      expect(result.result).toBe('Before  After')
    })

    it('should remove multiline comments', async () => {
      const template = `Before <%#
        This is a
        multiline comment
      %> After`
      const result = await processor.process(template)

      expect(result.result).toBe('Before  After')
    })

    it('should remove multiple comments', async () => {
      const template = '<%# Comment 1 %> Text <%# Comment 2 %>'
      const result = await processor.process(template)

      expect(result.result).toBe(' Text ')
    })
  })

  describe('Variable Processing', () => {
    it('should substitute simple variables', async () => {
      const template = 'Hello {{name}}, welcome to {{place}}!'
      const variables = { name: 'John', place: 'Lokus' }
      
      const result = await processor.process(template, variables)

      expect(result.result).toBe('Hello John, welcome to Lokus!')
    })

    it('should handle nested object properties', async () => {
      const template = 'User: {{user.name}}, Email: {{user.contact.email}}'
      const variables = {
        user: {
          name: 'John Doe',
          contact: {
            email: 'john@example.com'
          }
        }
      }
      
      const result = await processor.process(template, variables)

      expect(result.result).toBe('User: John Doe, Email: john@example.com')
    })

    it('should use default values for undefined variables', async () => {
      const template = 'Hello {{name || "Guest"}}, age {{age || "unknown"}}!'
      const variables = { name: 'John' } // age is missing
      
      const result = await processor.process(template, variables)

      expect(result.result).toBe('Hello John, age unknown!')
    })

    it('should apply filters to variables', async () => {
      const template = 'Hello {{name | upper | trim}}!'
      const variables = { name: '  john  ' }
      
      const result = await processor.process(template, variables)

      expect(result.result).toBe('Hello JOHN!')
    })

    it('should handle missing variables in strict mode', async () => {
      processor.strictMode = true
      const template = 'Hello {{missing}}!'
      
      await expect(processor.process(template)).rejects.toThrow('Variable \'missing\' is not defined')
    })

    it('should handle missing variables in non-strict mode', async () => {
      processor.strictMode = false
      const template = 'Hello {{missing}}!'
      
      const result = await processor.process(template)

      expect(result.result).toBe('Hello {{missing}}!')
    })

    it('should handle null and undefined values', async () => {
      const template = 'Value: {{value}}, Null: {{nullValue}}'
      const variables = { value: undefined, nullValue: null }
      
      processor.strictMode = false
      const result = await processor.process(template, variables)

      expect(result.result).toBe('Value: {{value}}, Null: {{nullValue}}')
    })

    it('should convert non-string values to strings', async () => {
      const template = 'Number: {{num}}, Boolean: {{bool}}, Array: {{arr}}'
      const variables = { 
        num: 42, 
        bool: true, 
        arr: [1, 2, 3] 
      }
      
      const result = await processor.process(template, variables)

      expect(result.result).toBe('Number: 42, Boolean: true, Array: 1,2,3')
    })
  })

  describe('JavaScript Block Processing', () => {
    it('should execute simple JavaScript expressions', async () => {
      mockSandbox.execute.mockResolvedValue('2024-01-01')
      
      const template = 'Today is <% new Date().toDateString() %>'
      const result = await processor.process(template)

      expect(mockSandbox.execute).toHaveBeenCalledWith('new Date().toDateString()', {})
      expect(result.result).toBe('Today is 2024-01-01')
    })

    it('should execute multiple JavaScript blocks', async () => {
      mockSandbox.execute
        .mockResolvedValueOnce('Hello')
        .mockResolvedValueOnce('World')
      
      const template = '<% "Hello" %> <% "World" %>!'
      const result = await processor.process(template)

      expect(mockSandbox.execute).toHaveBeenCalledTimes(2)
      expect(result.result).toBe('Hello World!')
    })

    it('should handle JavaScript execution errors in strict mode', async () => {
      processor.strictMode = true
      mockSandbox.execute.mockRejectedValue(new Error('Execution failed'))
      
      const template = 'Result: <% badCode() %>'
      
      await expect(processor.process(template)).rejects.toThrow('JavaScript execution failed')
    })

    it('should handle JavaScript execution errors in non-strict mode', async () => {
      processor.strictMode = false
      mockSandbox.execute.mockRejectedValue(new Error('Execution failed'))
      
      const template = 'Result: <% badCode() %>'
      const result = await processor.process(template)

      expect(result.result).toBe('Result: <% badCode() %>')
    })

    it('should handle undefined JavaScript results', async () => {
      mockSandbox.execute.mockResolvedValue(undefined)
      
      const template = 'Result: <% undefined %>'
      const result = await processor.process(template)

      expect(result.result).toBe('Result: ')
    })

    it('should convert JavaScript results to strings', async () => {
      mockSandbox.execute.mockResolvedValue(42)
      
      const template = 'Answer: <% 42 %>'
      const result = await processor.process(template)

      expect(result.result).toBe('Answer: 42')
    })
  })

  describe('Filter System', () => {
    it('should apply built-in string filters', async () => {
      const template = '{{text | upper}}, {{text | lower}}, {{text | capitalize}}'
      const variables = { text: 'HeLLo WoRLd' }
      
      const result = await processor.process(template, variables)

      expect(result.result).toBe('HELLO WORLD, hello world, Hello world')
    })

    it('should apply built-in number filters', async () => {
      const template = '{{num | round}}, {{num | floor}}, {{num | ceil}}'
      const variables = { num: 3.7 }
      
      const result = await processor.process(template, variables)

      expect(result.result).toBe('4, 3, 4')
    })

    it('should apply built-in date filters', async () => {
      const date = new Date('2024-01-01T12:30:45.000Z')
      const template = '{{date | date}}'
      const variables = { date }
      
      const result = await processor.process(template, variables)

      expect(result.result).toContain('2024') // Date format varies by locale
    })

    it('should apply built-in array filters', async () => {
      const template = '{{items | join}}, {{items | length}}'
      const variables = { items: ['a', 'b', 'c'] }
      
      const result = await processor.process(template, variables)

      expect(result.result).toBe('a, b, c, 3')
    })

    it('should apply custom join separator', async () => {
      const template = '{{items | join}}'
      const variables = { items: ['a', 'b', 'c'] }
      const options = { separator: ' | ' }
      
      const result = await processor.process(template, variables, options)

      expect(result.result).toBe('a | b | c')
    })

    it('should apply multiple filters in sequence', async () => {
      const template = '{{text | trim | upper}}'
      const variables = { text: '  hello world  ' }
      
      const result = await processor.process(template, variables)

      expect(result.result).toBe('HELLO WORLD')
    })

    it('should handle unknown filters in strict mode', async () => {
      processor.strictMode = true
      const template = '{{text | unknownFilter}}'
      const variables = { text: 'hello' }
      
      await expect(processor.process(template, variables)).rejects.toThrow('Unknown filter: unknownFilter')
    })

    it('should handle unknown filters in non-strict mode', async () => {
      processor.strictMode = false
      const template = '{{text | unknownFilter}}'
      const variables = { text: 'hello' }
      
      const result = await processor.process(template, variables)

      expect(result.result).toBe('hello')
    })

    it('should handle filter errors in strict mode', async () => {
      // Register a failing filter
      processor.registerFilter('failingFilter', () => {
        throw new Error('Filter failed')
      })
      
      processor.strictMode = true
      const template = '{{text | failingFilter}}'
      const variables = { text: 'hello' }
      
      await expect(processor.process(template, variables)).rejects.toThrow('Filter \'failingFilter\' failed')
    })

    it('should handle filter errors in non-strict mode', async () => {
      // Register a failing filter
      processor.registerFilter('failingFilter', () => {
        throw new Error('Filter failed')
      })
      
      processor.strictMode = false
      const template = '{{text | failingFilter}}'
      const variables = { text: 'hello' }
      
      const result = await processor.process(template, variables)

      expect(result.result).toBe('hello')
    })
  })

  describe('Filter Management', () => {
    it('should register custom filters', () => {
      const customFilter = (value) => `custom:${value}`
      processor.registerFilter('custom', customFilter)

      expect(processor.filters.has('custom')).toBe(true)
    })

    it('should reject non-function filters', () => {
      expect(() => processor.registerFilter('invalid', 'not a function')).toThrow('Filter must be a function')
    })

    it('should remove filters', () => {
      processor.registerFilter('temp', () => 'temp')
      expect(processor.filters.has('temp')).toBe(true)
      
      const removed = processor.removeFilter('temp')
      expect(removed).toBe(true)
      expect(processor.filters.has('temp')).toBe(false)
    })

    it('should get list of available filters', () => {
      const filters = processor.getFilters()
      
      expect(Array.isArray(filters)).toBe(true)
      expect(filters.includes('upper')).toBe(true)
      expect(filters.includes('lower')).toBe(true)
      expect(filters.includes('trim')).toBe(true)
    })

    it('should apply custom registered filters', async () => {
      processor.registerFilter('reverse', (value) => String(value).split('').reverse().join(''))
      
      const template = '{{text | reverse}}'
      const variables = { text: 'hello' }
      
      const result = await processor.process(template, variables)

      expect(result.result).toBe('olleh')
    })
  })

  describe('Complex Processing Scenarios', () => {
    it('should process template with mixed content', async () => {
      mockSandbox.execute.mockResolvedValue('42')
      
      const template = `
        Hello {{name}}!
        Today is <% new Date().toDateString() %>
        Your age next year will be <% age + 1 %>
        <%# This is a comment %>
        Welcome to {{place | upper}}!
      `.trim()
      
      const variables = { name: 'John', age: 30, place: 'lokus' }
      const result = await processor.process(template, variables)

      expect(result.result).toContain('Hello John!')
      expect(result.result).toContain('42') // From JS execution
      expect(result.result).toContain('LOKUS') // Filtered
      expect(result.result).not.toContain('comment') // Comment removed
    })

    it('should handle iterative variable resolution', async () => {
      const template = '{{greeting}} {{name}}!'
      const variables = { 
        greeting: 'Hello {{title}}',
        title: 'Mr.',
        name: 'Smith'
      }
      
      const result = await processor.process(template, variables)

      expect(result.result).toBe('Hello Mr. Smith!')
      expect(result.metadata.iterations).toBeGreaterThan(1)
    })

    it('should prevent infinite loops in variable resolution', async () => {
      const template = '{{a}}'
      const variables = { 
        a: '{{b}}',
        b: '{{a}}'
      }
      
      await expect(processor.process(template, variables)).rejects.toThrow('Maximum template processing iterations exceeded')
    })

    it('should detect unresolved variables', async () => {
      const template = 'Hello {{name}}!'
      const variables = {}
      
      processor.strictMode = false
      const result = await processor.process(template, variables)

      expect(result.metadata.hasUnresolvedVariables).toBe(true)
    })

    it('should validate processing results', async () => {
      // Mock a scenario where processing doesn't return a string
      const originalValidate = processor.validateResult
      processor.validateResult = vi.fn()
      
      const template = 'Hello world!'
      await processor.process(template)

      expect(processor.validateResult).toHaveBeenCalled()
      
      processor.validateResult = originalValidate
    })
  })

  describe('Preview and Analysis', () => {
    it('should preview template processing', async () => {
      const template = 'Hello {{name}}!'
      const variables = { name: 'John' }
      
      const result = await processor.preview(template, variables)

      expect(result.preview).toBe(true)
      expect(result.result).toBeDefined()
    })

    it('should handle preview errors gracefully', async () => {
      const template = '{{invalid.deeply.nested.property}}'
      
      const result = await processor.preview(template)

      expect(result.preview).toBe(true)
      expect(result.error).toBeDefined()
    })

    it('should analyze template performance', async () => {
      const template = 'Hello {{name}}!'
      const variables = { name: 'John' }
      
      const analysis = await processor.analyze(template, variables)

      expect(analysis.success).toBe(true)
      expect(analysis.processingTime).toBeGreaterThanOrEqual(0)
      expect(analysis.originalLength).toBe(template.length)
      expect(analysis.variablesUsed).toBe(1)
    })

    it('should analyze failed template processing', async () => {
      processor.strictMode = true
      const template = '{{undefined}}'
      
      const analysis = await processor.analyze(template)

      expect(analysis.success).toBe(false)
      expect(analysis.error).toBeDefined()
      expect(analysis.processingTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Configuration and Options', () => {
    it('should respect maxIterations setting', async () => {
      const processor = new TemplateProcessor({ maxIterations: 5 })
      const template = '{{a}}'
      const variables = { 
        a: '{{b}}',
        b: '{{c}}',
        c: '{{d}}',
        d: '{{e}}',
        e: '{{f}}',
        f: '{{g}}'
      }
      
      await expect(processor.process(template, variables)).rejects.toThrow('Maximum template processing iterations exceeded')
    })

    it('should handle different processor configurations', () => {
      const config = {
        strictMode: false,
        maxIterations: 50,
        sandbox: { timeout: 10000 }
      }
      
      const processor = new TemplateProcessor(config)
      
      expect(processor.strictMode).toBe(false)
      expect(processor.maxIterations).toBe(50)
    })
  })

  describe('Variable Resolution Edge Cases', () => {
    it('should handle empty variable paths', async () => {
      const value = processor.getVariableValue('', { name: 'John' })
      expect(value).toBeUndefined()
    })

    it('should handle null variable objects', async () => {
      const value = processor.getVariableValue('name', null)
      expect(value).toBeUndefined()
    })

    it('should handle deep null property access', async () => {
      const variables = { user: null }
      const value = processor.getVariableValue('user.name.first', variables)
      expect(value).toBeUndefined()
    })

    it('should handle array index access', async () => {
      const variables = { items: ['a', 'b', 'c'] }
      const value = processor.getVariableValue('items.0', variables)
      expect(value).toBe('a')
    })
  })

  describe('Result Validation', () => {
    it('should validate string results', () => {
      expect(() => processor.validateResult('valid string', 'template')).not.toThrow()
    })

    it('should reject non-string results', () => {
      expect(() => processor.validateResult(123, 'template')).toThrow('Processing result must be a string')
    })

    it('should detect unresolved variables in strict mode', () => {
      processor.strictMode = true
      expect(() => processor.validateResult('{{unresolved}}', '{{unresolved}}')).toThrow('Unresolved variables')
    })

    it('should allow unresolved variables in non-strict mode', () => {
      processor.strictMode = false
      expect(() => processor.validateResult('{{unresolved}}', '{{unresolved}}')).not.toThrow()
    })
  })
})