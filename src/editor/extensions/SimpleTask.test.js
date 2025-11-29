import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SimpleTask } from './SimpleTask.js'

describe('SimpleTask Extension', () => {
  it('should have correct name', () => {
    expect(SimpleTask.name).toBe('simpleTask')
  })

  describe('Input Rules', () => {
    it('should have input rules for !task and @task', () => {
      const mockContext = {}
      const rules = SimpleTask.config.addInputRules.call(mockContext)

      expect(Array.isArray(rules)).toBe(true)
      expect(rules).toHaveLength(2)

      // Check patterns
      const patterns = rules.map(rule => rule.find.source)
      expect(patterns).toContain('!task\\s$')
      expect(patterns).toContain('@task\\[')
    })

    it('should handle !task trigger', () => {
      const mockContext = {}
      const rules = SimpleTask.config.addInputRules.call(mockContext)
      const taskRule = rules.find(rule => rule.find.source === '!task\\s$')

      expect(taskRule).toBeDefined()

      // The handler returns false to allow default typing
      const result = taskRule.handler({
        chain: {},
        range: {},
        match: ['!task '],
        editor: {}
      })

      expect(result).toBe(false)
    })

    it('should handle @task trigger', () => {
      const mockContext = {}
      const rules = SimpleTask.config.addInputRules.call(mockContext)
      const taskRule = rules.find(rule => rule.find.source === '@task\\[')

      expect(taskRule).toBeDefined()

      // The handler returns false to allow default typing
      const result = taskRule.handler({
        chain: {},
        range: {},
        match: ['@task['],
        editor: {}
      })

      expect(result).toBe(false)
    })
  })
})