import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TemplateSandbox } from '../../../src/core/templates/sandbox.js'

describe('TemplateSandbox', () => {
  let sandbox

  beforeEach(() => {
    sandbox = new TemplateSandbox()
  })

  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      expect(sandbox.timeout).toBe(5000)
      expect(sandbox.maxMemory).toBe(50 * 1024 * 1024)
      expect(sandbox.dryRun).toBe(false)
      expect(sandbox.allowedGlobals.has('Math')).toBe(true)
      expect(sandbox.allowedGlobals.has('Date')).toBe(true)
      expect(sandbox.blockedPatterns).toBeDefined()
    })

    it('should initialize with custom options', () => {
      const options = {
        timeout: 10000,
        maxMemory: 100 * 1024 * 1024,
        dryRun: true,
        allowedGlobals: ['Math', 'Array']
      }
      
      const customSandbox = new TemplateSandbox(options)
      
      expect(customSandbox.timeout).toBe(10000)
      expect(customSandbox.maxMemory).toBe(100 * 1024 * 1024)
      expect(customSandbox.dryRun).toBe(true)
      expect(customSandbox.allowedGlobals.has('Math')).toBe(true)
      expect(customSandbox.allowedGlobals.has('Array')).toBe(true)
      expect(customSandbox.allowedGlobals.has('Date')).toBe(false)
    })
  })

  describe('Code Validation', () => {
    it('should validate safe code', () => {
      const safeCode = 'Math.PI * 2'
      expect(() => sandbox.validateCode(safeCode)).not.toThrow()
    })

    it('should reject code with eval', () => {
      const dangerousCode = 'eval("malicious code")'
      expect(() => sandbox.validateCode(dangerousCode)).toThrow('Blocked code pattern detected')
    })

    it('should reject code with Function constructor', () => {
      const dangerousCode = 'new Function("return 1")()'
      expect(() => sandbox.validateCode(dangerousCode)).toThrow('Blocked code pattern detected')
    })

    it('should reject code with require', () => {
      const dangerousCode = 'require("fs")'
      expect(() => sandbox.validateCode(dangerousCode)).toThrow('Blocked code pattern detected')
    })

    it('should reject code with imports', () => {
      const dangerousCode = 'import fs from "fs"'
      expect(() => sandbox.validateCode(dangerousCode)).toThrow('Blocked code pattern detected')
    })

    it('should reject code with window access', () => {
      const dangerousCode = 'window.location.href'
      expect(() => sandbox.validateCode(dangerousCode)).toThrow('Blocked code pattern detected')
    })

    it('should reject code with global access', () => {
      const dangerousCode = 'global.process'
      expect(() => sandbox.validateCode(dangerousCode)).toThrow('Blocked code pattern detected')
    })

    it('should reject code with process access', () => {
      const dangerousCode = 'process.exit()'
      expect(() => sandbox.validateCode(dangerousCode)).toThrow('Blocked code pattern detected')
    })

    it('should reject overly long code', () => {
      const longCode = 'x'.repeat(10001)
      expect(() => sandbox.validateCode(longCode)).toThrow('Code too long for sandbox execution')
    })

    it('should validate JavaScript syntax', () => {
      const invalidSyntax = 'let x = {'
      expect(() => sandbox.validateCode(invalidSyntax)).toThrow('Invalid JavaScript syntax')
    })

    it('should handle empty or invalid code input', () => {
      expect(() => sandbox.validateCode('')).toThrow('Code must be a non-empty string')
      expect(() => sandbox.validateCode(null)).toThrow('Code must be a non-empty string')
      expect(() => sandbox.validateCode(undefined)).toThrow('Code must be a non-empty string')
      expect(() => sandbox.validateCode(123)).toThrow('Code must be a non-empty string')
    })
  })

  describe('Code Execution', () => {
    it('should execute simple expressions', async () => {
      const result = await sandbox.execute('1 + 1')
      expect(result).toBe(2)
    })

    it('should execute Math operations', async () => {
      const result = await sandbox.execute('Math.PI * 2')
      expect(result).toBeCloseTo(6.283185307179586)
    })

    it('should execute string operations', async () => {
      const result = await sandbox.execute('"hello".toUpperCase()')
      expect(result).toBe('HELLO')
    })

    it('should execute with variables', async () => {
      const variables = { x: 5, y: 10 }
      const result = await sandbox.execute('x + y', variables)
      expect(result).toBe(15)
    })

    it('should execute statements with return', async () => {
      const code = 'let sum = 0; for(let i = 1; i <= 5; i++) sum += i; return sum;'
      const result = await sandbox.execute(code)
      expect(result).toBe(15)
    })

    it('should handle undefined results', async () => {
      const result = await sandbox.execute('undefined')
      expect(result).toBeUndefined()
    })

    it('should handle expressions without explicit return', async () => {
      const result = await sandbox.execute('5 * 5')
      expect(result).toBe(25)
    })

    it('should access utility functions', async () => {
      const result = await sandbox.execute('now().getFullYear()')
      expect(result).toBeGreaterThan(2020)
    })

    it('should generate UUID', async () => {
      const result = await sandbox.execute('uuid()')
      expect(typeof result).toBe('string')
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('should use format function', async () => {
      const result = await sandbox.execute('format("Hello {0}, you are {1} years old", "John", 30)')
      expect(result).toBe('Hello John, you are 30 years old')
    })

    it('should use repeat function', async () => {
      const result = await sandbox.execute('repeat("*", 5)')
      expect(result).toBe('*****')
    })

    it('should limit repeat function', async () => {
      const result = await sandbox.execute('repeat("*", 2000)')
      expect(result.length).toBe(1000) // Limited to 1000
    })

    it('should use truncate function', async () => {
      const result = await sandbox.execute('truncate("hello world", 5)')
      expect(result).toBe('hello')
    })

    it('should use slugify function', async () => {
      const result = await sandbox.execute('slugify("Hello World! @#$")')
      expect(result).toBe('hello-world')
    })

    it('should use random functions', async () => {
      const intResult = await sandbox.execute('random.int(1, 10)')
      expect(intResult).toBeGreaterThanOrEqual(1)
      expect(intResult).toBeLessThanOrEqual(10)
      expect(Number.isInteger(intResult)).toBe(true)

      const floatResult = await sandbox.execute('random.float(0, 1)')
      expect(floatResult).toBeGreaterThanOrEqual(0)
      expect(floatResult).toBeLessThanOrEqual(1)

      const boolResult = await sandbox.execute('random.bool()')
      expect(typeof boolResult).toBe('boolean')

      const choiceResult = await sandbox.execute('random.choice(["a", "b", "c"])')
      expect(['a', 'b', 'c']).toContain(choiceResult)

      const stringResult = await sandbox.execute('random.string(5)')
      expect(typeof stringResult).toBe('string')
      expect(stringResult.length).toBe(5)
    })

    it('should limit random string length', async () => {
      const result = await sandbox.execute('random.string(2000)')
      expect(result.length).toBe(1000) // Limited to 1000
    })

    it('should access console functions', async () => {
      const code = `
        console.log("test message");
        console.warn("test warning");
        console.error("test error");
        return console.getLogs();
      `
      const result = await sandbox.execute(code)
      
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(3)
      expect(result[0].level).toBe('log')
      expect(result[1].level).toBe('warn')
      expect(result[2].level).toBe('error')
    })

    it('should limit console log entries', async () => {
      const code = `
        for(let i = 0; i < 150; i++) {
          console.log(\`Message \${i}\`);
        }
        return console.getLogs().length;
      `
      const result = await sandbox.execute(code)
      expect(result).toBe(100) // Limited to 100 entries
    })
  })

  describe('Error Handling', () => {
    it('should handle execution errors', async () => {
      const code = 'throw new Error("Test error")'
      await expect(sandbox.execute(code)).rejects.toThrow('Sandbox execution failed')
    })

    it('should handle syntax errors', async () => {
      const code = 'let x = {'
      await expect(sandbox.execute(code)).rejects.toThrow('Invalid JavaScript syntax')
    })

    it('should handle reference errors', async () => {
      const code = 'undefinedVariable + 1'
      await expect(sandbox.execute(code)).rejects.toThrow('Sandbox execution failed')
    })

    it('should handle timeout errors', async () => {
      const shortTimeoutSandbox = new TemplateSandbox({ timeout: 100 })
      const code = 'while(true) {}' // Infinite loop
      
      await expect(shortTimeoutSandbox.execute(code)).rejects.toThrow('Code execution timeout')
    }, 10000)
  })

  describe('Restricted Context', () => {
    it('should provide safe global objects', async () => {
      const mathResult = await sandbox.execute('Math.max(1, 2, 3)')
      expect(mathResult).toBe(3)

      const dateResult = await sandbox.execute('new Date(2024, 0, 1).getFullYear()')
      expect(dateResult).toBe(2024)

      const arrayResult = await sandbox.execute('Array.from([1, 2, 3])')
      expect(arrayResult).toEqual([1, 2, 3])

      const jsonResult = await sandbox.execute('JSON.stringify({a: 1})')
      expect(jsonResult).toBe('{"a":1}')
    })

    it('should not have access to dangerous globals', async () => {
      await expect(sandbox.execute('window')).rejects.toThrow()
      await expect(sandbox.execute('global')).rejects.toThrow()
      await expect(sandbox.execute('process')).rejects.toThrow()
      await expect(sandbox.execute('require')).rejects.toThrow()
    })

    it('should support variable injection', async () => {
      const variables = { 
        user: { name: 'John', age: 30 },
        items: ['a', 'b', 'c']
      }
      
      const nameResult = await sandbox.execute('user.name', variables)
      expect(nameResult).toBe('John')

      const ageResult = await sandbox.execute('user.age * 2', variables)
      expect(ageResult).toBe(60)

      const itemsResult = await sandbox.execute('items.join("-")', variables)
      expect(itemsResult).toBe('a-b-c')
    })
  })

  describe('Code Wrapping', () => {
    it('should wrap simple expressions', () => {
      const wrapped = sandbox.wrapCode('1 + 1')
      expect(wrapped).toContain('return (1 + 1)')
      expect(wrapped).toContain('"use strict"')
    })

    it('should wrap statements', () => {
      const wrapped = sandbox.wrapCode('let x = 5; return x * 2;')
      expect(wrapped).toContain('let x = 5; return x * 2;')
      expect(wrapped).toContain('"use strict"')
      expect(wrapped).not.toContain('return (')
    })

    it('should detect expressions vs statements', () => {
      expect(sandbox.wrapCode('Math.PI')).toContain('return (Math.PI)')
      expect(sandbox.wrapCode('user.name')).toContain('return (user.name)')
      expect(sandbox.wrapCode('1 + 2 + 3')).toContain('return (1 + 2 + 3)')
      
      expect(sandbox.wrapCode('let x = 5;')).not.toContain('return (')
      expect(sandbox.wrapCode('if (true) return 1;')).not.toContain('return (')
      expect(sandbox.wrapCode('for (let i = 0; i < 10; i++) {}')).not.toContain('return (')
    })
  })

  describe('Dry Run Mode', () => {
    it('should perform dry run analysis', async () => {
      const dryRunSandbox = new TemplateSandbox({ dryRun: true })
      const result = await dryRunSandbox.execute('Math.PI * 2')
      
      expect(result.dryRun).toBe(true)
      expect(result.code).toBe('Math.PI * 2')
      expect(result.estimatedResult).toContain('DRY RUN')
      expect(result.security.safe).toBe(true)
    })

    it('should analyze potential security issues in dry run', async () => {
      const dryRunSandbox = new TemplateSandbox({ dryRun: true })
      const result = await dryRunSandbox.execute('for(let i = 0; i < 1000; i++) { /* work */ }')
      
      expect(result.security.warnings.some(w => w.includes('loops'))).toBe(true)
    })

    it('should warn about large code blocks', async () => {
      const dryRunSandbox = new TemplateSandbox({ dryRun: true })
      const largeCode = 'x'.repeat(1500)
      const result = await dryRunSandbox.execute(largeCode)
      
      expect(result.security.warnings.some(w => w.includes('Large code block'))).toBe(true)
    })
  })

  describe('Testing Utilities', () => {
    it('should test code execution safely', async () => {
      const successResult = await sandbox.test('1 + 1')
      expect(successResult.success).toBe(true)
      expect(successResult.result).toBe(2)
      expect(successResult.error).toBe(null)

      const errorResult = await sandbox.test('throw new Error("test")')
      expect(errorResult.success).toBe(false)
      expect(errorResult.result).toBe(null)
      expect(errorResult.error).toBeDefined()
    })
  })

  describe('Capabilities and Configuration', () => {
    it('should return sandbox capabilities', () => {
      const capabilities = sandbox.getCapabilities()
      
      expect(capabilities.timeout).toBe(5000)
      expect(capabilities.maxMemory).toBe(50 * 1024 * 1024)
      expect(Array.isArray(capabilities.allowedGlobals)).toBe(true)
      expect(capabilities.allowedGlobals.includes('Math')).toBe(true)
      expect(capabilities.features.variables).toBe(true)
      expect(capabilities.features.functions).toBe(true)
      expect(capabilities.restrictions.fileSystem).toBe(false)
      expect(capabilities.restrictions.network).toBe(false)
    })

    it('should configure sandbox settings', () => {
      sandbox.configure({
        timeout: 8000,
        maxMemory: 75 * 1024 * 1024,
        allowedGlobals: ['Math', 'String']
      })
      
      expect(sandbox.timeout).toBe(8000)
      expect(sandbox.maxMemory).toBe(75 * 1024 * 1024)
      expect(sandbox.allowedGlobals.has('Math')).toBe(true)
      expect(sandbox.allowedGlobals.has('String')).toBe(true)
      expect(sandbox.allowedGlobals.has('Date')).toBe(false)
    })

    it('should enforce configuration limits', () => {
      sandbox.configure({
        timeout: 50, // Below minimum
        maxMemory: 500000 // Below minimum
      })
      
      expect(sandbox.timeout).toBe(100) // Minimum enforced
      expect(sandbox.maxMemory).toBe(1024 * 1024) // Minimum enforced

      sandbox.configure({
        timeout: 50000, // Above maximum
        maxMemory: 200 * 1024 * 1024 // Above maximum
      })
      
      expect(sandbox.timeout).toBe(30000) // Maximum enforced
      expect(sandbox.maxMemory).toBe(100 * 1024 * 1024) // Maximum enforced
    })

    it('should reset sandbox state', () => {
      expect(() => sandbox.reset()).not.toThrow()
    })
  })

  describe('Helper Functions', () => {
    it('should generate valid UUIDs', () => {
      const uuid1 = sandbox.generateUUID()
      const uuid2 = sandbox.generateUUID()
      
      expect(typeof uuid1).toBe('string')
      expect(typeof uuid2).toBe('string')
      expect(uuid1).not.toBe(uuid2)
      expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('should slugify strings correctly', () => {
      expect(sandbox.slugify('Hello World')).toBe('hello-world')
      expect(sandbox.slugify('  Multiple   Spaces  ')).toBe('multiple-spaces')
      expect(sandbox.slugify('Special!@#$%Characters')).toBe('specialcharacters')
      expect(sandbox.slugify('Numbers123AndText')).toBe('numbers123andtext')
      expect(sandbox.slugify('')).toBe('')
    })

    it('should create format function correctly', () => {
      const format = sandbox.createFormatFunction()
      
      expect(format('Hello {0}', 'World')).toBe('Hello World')
      expect(format('{0} + {1} = {2}', 1, 2, 3)).toBe('1 + 2 = 3')
      expect(format('No placeholders')).toBe('No placeholders')
      expect(format('{0} {1} {2}', 'a')).toBe('a {1} {2}') // Missing args
    })

    it('should create random function with proper limits', () => {
      const random = sandbox.createRandomFunction()
      
      // Test integer generation
      for (let i = 0; i < 10; i++) {
        const num = random.int(5, 10)
        expect(num).toBeGreaterThanOrEqual(5)
        expect(num).toBeLessThanOrEqual(10)
        expect(Number.isInteger(num)).toBe(true)
      }

      // Test float generation
      for (let i = 0; i < 10; i++) {
        const num = random.float(0.5, 1.5)
        expect(num).toBeGreaterThanOrEqual(0.5)
        expect(num).toBeLessThanOrEqual(1.5)
      }

      // Test boolean generation
      const bools = Array(20).fill().map(() => random.bool())
      expect(bools.some(b => b === true)).toBe(true)
      expect(bools.some(b => b === false)).toBe(true)

      // Test choice function
      const choices = ['a', 'b', 'c']
      for (let i = 0; i < 10; i++) {
        const choice = random.choice(choices)
        expect(choices).toContain(choice)
      }

      // Test string generation
      const str = random.string(10)
      expect(typeof str).toBe('string')
      expect(str.length).toBe(10)
      expect(str).toMatch(/^[A-Za-z0-9]+$/)
    })

    it('should create restricted console correctly', () => {
      const console = sandbox.createRestrictedConsole()
      
      console.log('test1')
      console.warn('test2')
      console.error('test3')
      
      const logs = console.getLogs()
      expect(logs).toHaveLength(3)
      expect(logs[0].level).toBe('log')
      expect(logs[1].level).toBe('warn')
      expect(logs[2].level).toBe('error')
      
      console.clear()
      expect(console.getLogs()).toHaveLength(0)
    })
  })

  describe('Edge Cases and Security', () => {
    it('should handle edge cases in execution', async () => {
      // Empty variable object
      const result1 = await sandbox.execute('1 + 1', {})
      expect(result1).toBe(2)

      // Null variables
      const result2 = await sandbox.execute('typeof nullVar', { nullVar: null })
      expect(result2).toBe('object')

      // Undefined variables
      const result3 = await sandbox.execute('typeof undefinedVar', { undefinedVar: undefined })
      expect(result3).toBe('undefined')
    })

    it('should prevent prototype pollution attempts', async () => {
      const maliciousCode = 'Object.prototype.polluted = "bad"'
      await expect(sandbox.execute(maliciousCode)).rejects.toThrow()
    })

    it('should handle very nested object access', async () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep'
              }
            }
          }
        }
      }
      
      const result = await sandbox.execute('obj.level1.level2.level3.level4.value', { obj: deepObject })
      expect(result).toBe('deep')
    })

    it('should handle array manipulations safely', async () => {
      const variables = { arr: [1, 2, 3, 4, 5] }
      
      const filterResult = await sandbox.execute('arr.filter(x => x > 2)', variables)
      expect(filterResult).toEqual([3, 4, 5])

      const mapResult = await sandbox.execute('arr.map(x => x * 2)', variables)
      expect(mapResult).toEqual([2, 4, 6, 8, 10])

      const reduceResult = await sandbox.execute('arr.reduce((a, b) => a + b, 0)', variables)
      expect(reduceResult).toBe(15)
    })

    it('should handle string manipulations safely', async () => {
      const variables = { text: 'Hello World' }
      
      const upperResult = await sandbox.execute('text.toUpperCase()', variables)
      expect(upperResult).toBe('HELLO WORLD')

      const sliceResult = await sandbox.execute('text.slice(0, 5)', variables)
      expect(sliceResult).toBe('Hello')

      const splitResult = await sandbox.execute('text.split(" ")', variables)
      expect(splitResult).toEqual(['Hello', 'World'])
    })
  })

  describe('Performance and Resource Management', () => {
    it('should handle resource-intensive operations within limits', async () => {
      // Test array creation limits
      const arrayCode = 'Array(1000).fill(0).map((_, i) => i)'
      const result = await sandbox.execute(arrayCode)
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(1000)
    })

    it('should prevent excessive string operations', async () => {
      // This should complete within timeout
      const stringCode = '"x".repeat(1000)'
      const result = await sandbox.execute(stringCode)
      expect(result.length).toBe(1000)
    })

    it('should handle complex computations', async () => {
      const fibCode = `
        function fib(n) {
          if (n <= 1) return n;
          return fib(n - 1) + fib(n - 2);
        }
        return fib(10);
      `
      
      const result = await sandbox.execute(fibCode)
      expect(result).toBe(55) // 10th Fibonacci number
    })
  })
})