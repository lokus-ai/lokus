import { describe, it, expect, beforeEach } from 'vitest'
import { TemplateProcessor } from '../processor.js'

describe('Template Variables System', () => {
  let processor

  beforeEach(() => {
    processor = new TemplateProcessor({ strictMode: false })
  })

  describe('Basic Variable Substitution', () => {
    it('should substitute simple string variables', async () => {
      const template = 'Hello {{name}}!'
      const variables = { name: 'John' }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Hello John!')
    })

    it('should substitute multiple variables', async () => {
      const template = '{{greeting}} {{name}}, welcome to {{place}}!'
      const variables = { 
        greeting: 'Hello',
        name: 'Alice', 
        place: 'Wonderland' 
      }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Hello Alice, welcome to Wonderland!')
    })

    it('should substitute number variables', async () => {
      const template = 'Age: {{age}}, Score: {{score}}'
      const variables = { age: 25, score: 98.5 }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Age: 25, Score: 98.5')
    })

    it('should substitute boolean variables', async () => {
      const template = 'Active: {{isActive}}, Complete: {{isComplete}}'
      const variables = { isActive: true, isComplete: false }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Active: true, Complete: false')
    })

    it('should substitute array variables', async () => {
      const template = 'Items: {{items}}'
      const variables = { items: [1, 2, 3] }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Items: 1,2,3')
    })

    it('should substitute object variables as string', async () => {
      const template = 'Data: {{data}}'
      const variables = { data: { key: 'value' } }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Data: [object Object]')
    })
  })

  describe('Nested Object Access', () => {
    it('should access nested object properties', async () => {
      const template = 'User: {{user.name}}, Email: {{user.contact.email}}'
      const variables = {
        user: {
          name: 'John Doe',
          contact: {
            email: 'john@example.com',
            phone: '123-456-7890'
          }
        }
      }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('User: John Doe, Email: john@example.com')
    })

    it('should access array elements', async () => {
      const template = 'First: {{items.0}}, Last: {{items.2}}'
      const variables = { items: ['apple', 'banana', 'cherry'] }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('First: apple, Last: cherry')
    })

    it('should handle deep nesting', async () => {
      const template = 'Value: {{level1.level2.level3.value}}'
      const variables = {
        level1: {
          level2: {
            level3: {
              value: 'deep'
            }
          }
        }
      }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Value: deep')
    })

    it('should handle null/undefined in nested access gracefully', async () => {
      const template = 'Value: {{user.profile.name}}'
      const variables = { 
        user: { 
          profile: null 
        } 
      }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Value: {{user.profile.name}}')
    })

    it('should handle missing intermediate properties', async () => {
      const template = 'Value: {{user.nonexistent.name}}'
      const variables = { user: {} }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Value: {{user.nonexistent.name}}')
    })
  })

  describe('Default Values', () => {
    it('should use default values for undefined variables', async () => {
      const template = 'Hello {{name || "Guest"}}!'
      const variables = {}
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Hello Guest!')
    })

    it('should use default values for null variables', async () => {
      const template = 'Status: {{status || "Unknown"}}'
      const variables = { status: null }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Status: Unknown')
    })

    it('should not use default values for falsy but defined values', async () => {
      const template = 'Count: {{count || "N/A"}}, Flag: {{flag || "default"}}'
      const variables = { count: 0, flag: false }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Count: 0, Flag: false')
    })

    it('should handle quoted default values', async () => {
      const template = 'Name: {{name || "Anonymous User"}}'
      const variables = {}
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Name: Anonymous User')
    })

    it('should handle single-quoted default values', async () => {
      const template = "Type: {{type || 'Unknown'}}"
      const variables = {}
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Type: Unknown')
    })

    it('should handle numeric default values', async () => {
      const template = 'Score: {{score || 0}}'
      const variables = {}
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Score: 0')
    })

    it('should prioritize actual values over defaults', async () => {
      const template = 'Welcome {{name || "Guest"}}!'
      const variables = { name: 'Alice' }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Welcome Alice!')
    })
  })

  describe('Filter Application', () => {
    it('should apply string filters', async () => {
      const template = '{{text | upper}}, {{text | lower}}, {{text | capitalize}}'
      const variables = { text: 'Hello World' }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('HELLO WORLD, hello world, Hello world')
    })

    it('should apply trim filter', async () => {
      const template = 'Trimmed: "{{text | trim}}"'
      const variables = { text: '  spaces around  ' }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Trimmed: "spaces around"')
    })

    it('should apply number filters', async () => {
      const template = '{{num | round}}, {{num | floor}}, {{num | ceil}}'
      const variables = { num: 3.7 }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('4, 3, 4')
    })

    it('should apply date filters', async () => {
      const date = new Date('2024-01-15T10:30:00.000Z')
      const template = '{{date | date}}'
      const variables = { date }
      
      const result = await processor.process(template, variables)
      expect(result.result).toContain('2024') // Date format varies by locale
    })

    it('should apply ISO date filter', async () => {
      const date = new Date('2024-01-15T10:30:00.000Z')
      const template = '{{date | iso}}'
      const variables = { date }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('2024-01-15T10:30:00.000Z')
    })

    it('should apply array filters', async () => {
      const template = '{{items | join}}, Length: {{items | length}}'
      const variables = { items: ['apple', 'banana', 'cherry'] }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('apple, banana, cherry, Length: 3')
    })

    it('should apply custom join separator', async () => {
      const template = '{{items | join}}'
      const variables = { items: ['a', 'b', 'c'] }
      const options = { separator: ' | ' }
      
      const result = await processor.process(template, variables, options)
      expect(result.result).toBe('a | b | c')
    })

    it('should apply JSON filters', async () => {
      const template = 'Compact: {{data | json}}, Pretty: {{data | pretty}}'
      const variables = { data: { name: 'test', value: 123 } }
      
      const result = await processor.process(template, variables)
      expect(result.result).toContain('{"name":"test","value":123}')
      expect(result.result).toContain('{\n  "name": "test",\n  "value": 123\n}')
    })

    it('should apply encoding filters', async () => {
      const template = 'Encoded: {{text | encode}}, Decoded: {{encoded | decode}}'
      const variables = { 
        text: 'hello world', 
        encoded: 'hello%20world' 
      }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Encoded: hello%20world, Decoded: hello world')
    })

    it('should apply multiple filters in sequence', async () => {
      const template = '{{text | trim | upper}}'
      const variables = { text: '  hello world  ' }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('HELLO WORLD')
    })

    it('should apply filters with default values', async () => {
      const template = '{{name || "guest" | upper}}'
      const variables = {}
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('GUEST')
    })
  })

  describe('Built-in Variables and Functions', () => {
    it('should provide date/time variables when used with JS blocks', async () => {
      const template = 'Today: <% today() %>, Time: <% time() %>'
      
      // Mock the sandbox to return expected values
      processor.sandbox.execute = async (code) => {
        if (code.includes('today()')) return 'Mon Jan 15 2024'
        if (code.includes('time()')) return '10:30:00'
        return ''
      }
      
      const result = await processor.process(template)
      expect(result.result).toBe('Today: Mon Jan 15 2024, Time: 10:30:00')
    })

    it('should provide timestamp when used with JS blocks', async () => {
      const template = 'Timestamp: <% timestamp() %>'
      
      processor.sandbox.execute = async () => 1705312200000
      
      const result = await processor.process(template)
      expect(result.result).toBe('Timestamp: 1705312200000')
    })

    it('should provide UUID generation when used with JS blocks', async () => {
      const template = 'ID: <% uuid() %>'
      
      processor.sandbox.execute = async () => '123e4567-e89b-12d3-a456-426614174000'
      
      const result = await processor.process(template)
      expect(result.result).toBe('ID: 123e4567-e89b-12d3-a456-426614174000')
    })
  })

  describe('Variable Resolution Edge Cases', () => {
    it('should handle empty variable names', async () => {
      const template = 'Empty: {{}}, Normal: {{name}}'
      const variables = { name: 'test' }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Empty: {{}}, Normal: test')
    })

    it('should handle whitespace-only variable names', async () => {
      const template = 'Spaces: {{   }}, Normal: {{name}}'
      const variables = { name: 'test' }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Spaces: {{   }}, Normal: test')
    })

    it('should handle variables with special characters', async () => {
      const template = 'Special: {{my-var}}, Underscore: {{my_var}}, Numbers: {{var123}}'
      const variables = { 
        'my-var': 'dash',
        'my_var': 'underscore',
        'var123': 'numbers'
      }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Special: dash, Underscore: underscore, Numbers: numbers')
    })

    it('should handle unicode variable names', async () => {
      const template = 'Unicode: {{名前}}, Symbol: {{∑}}, Emoji: {{🚀}}'
      const variables = { 
        '名前': 'name',
        '∑': 'sum',
        '🚀': 'rocket'
      }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Unicode: name, Symbol: sum, Emoji: rocket')
    })

    it('should handle circular variable references', async () => {
      const template = '{{a}}'
      const variables = { 
        a: '{{b}}',
        b: '{{a}}'
      }
      
      processor.strictMode = false
      processor.maxIterations = 5
      
      await expect(processor.process(template, variables)).rejects.toThrow('Maximum template processing iterations exceeded')
    })

    it('should handle self-referencing variables', async () => {
      const template = '{{name}}'
      const variables = { name: 'Hello {{name}}!' }
      
      processor.strictMode = false
      processor.maxIterations = 3
      
      await expect(processor.process(template, variables)).rejects.toThrow('Maximum template processing iterations exceeded')
    })

    it('should handle deeply nested variable resolution', async () => {
      const template = '{{level1}}'
      const variables = { 
        level1: '{{level2}}',
        level2: '{{level3}}',
        level3: 'final value'
      }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('final value')
    })
  })

  describe('Variable Context and Scoping', () => {
    it('should maintain variable isolation between processing calls', async () => {
      const template = 'Value: {{value}}'
      
      const result1 = await processor.process(template, { value: 'first' })
      const result2 = await processor.process(template, { value: 'second' })
      
      expect(result1.result).toBe('Value: first')
      expect(result2.result).toBe('Value: second')
    })

    it('should not modify original variable object', async () => {
      const template = 'Name: {{name}}'
      const originalVars = { name: 'original' }
      
      await processor.process(template, originalVars)
      
      expect(originalVars.name).toBe('original')
    })

    it('should handle variable objects with prototype pollution attempts', async () => {
      const template = 'Value: {{value}}'
      const variables = Object.create(null)
      variables.value = 'safe'
      variables.__proto__ = { dangerous: 'bad' }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Value: safe')
    })

    it('should handle variables with null prototype', async () => {
      const template = 'Value: {{value}}'
      const variables = Object.create(null)
      variables.value = 'test'
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Value: test')
    })
  })

  describe('Filter Error Handling', () => {
    it('should handle filter errors in non-strict mode', async () => {
      // Register a filter that throws an error
      processor.registerFilter('errorFilter', () => {
        throw new Error('Filter error')
      })
      
      processor.strictMode = false
      const template = '{{text | errorFilter}}'
      const variables = { text: 'test' }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('test') // Should return original value
    })

    it('should throw filter errors in strict mode', async () => {
      processor.registerFilter('errorFilter', () => {
        throw new Error('Filter error')
      })
      
      processor.strictMode = true
      const template = '{{text | errorFilter}}'
      const variables = { text: 'test' }
      
      await expect(processor.process(template, variables)).rejects.toThrow('Filter \'errorFilter\' failed')
    })

    it('should handle unknown filters gracefully in non-strict mode', async () => {
      processor.strictMode = false
      const template = '{{text | unknownFilter}}'
      const variables = { text: 'test' }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('test')
    })

    it('should throw on unknown filters in strict mode', async () => {
      processor.strictMode = true
      const template = '{{text | unknownFilter}}'
      const variables = { text: 'test' }
      
      await expect(processor.process(template, variables)).rejects.toThrow('Unknown filter: unknownFilter')
    })
  })

  describe('Performance and Memory', () => {
    it('should handle large numbers of variables efficiently', async () => {
      let template = 'Values: '
      const variables = {}
      
      // Create template with 100 variables
      for (let i = 0; i < 100; i++) {
        template += `{{var${i}}} `
        variables[`var${i}`] = i
      }
      
      const startTime = Date.now()
      const result = await processor.process(template, variables)
      const endTime = Date.now()
      
      expect(result.result).toContain('Values: 0 1 2')
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should handle large variable values', async () => {
      const largeValue = 'x'.repeat(10000)
      const template = 'Large: {{large}}'
      const variables = { large: largeValue }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe(`Large: ${largeValue}`)
    })

    it('should handle deeply nested objects without stack overflow', async () => {
      // Create deeply nested object
      let deep = { value: 'found' }
      for (let i = 0; i < 100; i++) {
        deep = { next: deep }
      }
      
      // Build path string
      let path = 'deep'
      for (let i = 0; i < 100; i++) {
        path += '.next'
      }
      path += '.value'
      
      const template = `Value: {{${path}}}`
      const variables = { deep }
      
      const result = await processor.process(template, variables)
      expect(result.result).toBe('Value: found')
    })
  })

  describe('Variable Metadata and Analytics', () => {
    it('should track variable usage in result metadata', async () => {
      const template = 'Hello {{name}}, age {{age}}'
      const variables = { name: 'John', age: 30, unused: 'value' }
      
      const result = await processor.process(template, variables)
      
      expect(result.variables).toEqual(variables)
      expect(result.metadata.hasUnresolvedVariables).toBe(false)
    })

    it('should detect unresolved variables', async () => {
      processor.strictMode = false
      const template = 'Hello {{name}}, missing {{missing}}'
      const variables = { name: 'John' }
      
      const result = await processor.process(template, variables)
      
      expect(result.metadata.hasUnresolvedVariables).toBe(true)
    })

    it('should track processing iterations', async () => {
      const template = '{{a}}'
      const variables = { 
        a: '{{b}}',
        b: '{{c}}',
        c: 'final'
      }
      
      const result = await processor.process(template, variables)
      
      expect(result.metadata.iterations).toBeGreaterThan(1)
      expect(result.result).toBe('final')
    })
  })
})