/**
 * Base Parser
 * Parse and convert .base YAML files to/from JavaScript objects
 * Handles syntax errors gracefully and supports all Lokus base features
 */

import { DEFAULT_BASE_TEMPLATE, BASE_PROPERTY_TYPES } from './BaseSchema.js'
import { baseValidator } from './BaseValidator.js'
import * as yaml from 'js-yaml'

/**
 * YAML parser implementation
 * Simplified YAML parser that handles the subset needed for .base files
 */
class YAMLParser {
  constructor() {
    this.indentSize = 2
    this.maxDepth = 20
  }

  /**
   * Parse YAML string to JavaScript object
   */
  parse(yamlString) {
    if (typeof yamlString !== 'string') {
      throw new Error('Input must be a string')
    }

    try {
      return yaml.load(yamlString)
    } catch (error) {
      throw new ParseError(`YAML parsing failed: ${error.message}`, error.line, error.column)
    }
  }

  /**
   * Convert JavaScript object to YAML string
   */
  stringify(obj, options = {}) {
    if (obj === null || obj === undefined) {
      return 'null'
    }

    const indent = options.indent || 0
    const maxDepth = options.maxDepth || this.maxDepth

    if (indent > maxDepth) {
      throw new Error('Maximum depth exceeded')
    }

    return this.stringifyValue(obj, indent, options)
  }

  /**
   * Internal YAML parsing implementation
   */
  parseYAML(yaml) {
    const lines = yaml.split('\n').map((line, index) => ({ content: line, number: index + 1 }))
    const context = {
      lines,
      index: 0,
      result: null,
      stack: []
    }

    return this.parseDocument(context)
  }

  /**
   * Parse YAML document
   */
  parseDocument(context) {
    // Skip empty lines and comments at the start
    this.skipEmptyAndComments(context)

    if (context.index >= context.lines.length) {
      return null
    }

    const firstLine = context.lines[context.index]
    const trimmed = firstLine.content.trim()

    // Determine root structure type
    if (trimmed.startsWith('[')) {
      return this.parseArray(context, 0)
    } else if (trimmed.includes(':') || this.isObjectStart(context)) {
      return this.parseObject(context, 0)
    } else {
      return this.parseValue(trimmed, firstLine.number)
    }
  }

  /**
   * Parse YAML object
   */
  parseObject(context, baseIndent) {
    const obj = {}

    while (context.index < context.lines.length) {
      const line = context.lines[context.index]
      const { content, number } = line

      if (this.isEmptyOrComment(content)) {
        context.index++
        continue
      }

      const indent = this.getIndentation(content)

      // If indentation is less than base, we've ended this object
      if (indent < baseIndent) {
        break
      }

      // If indentation is more than expected, skip (malformed)
      if (indent > baseIndent && baseIndent > 0) {
        throw new ParseError(`Unexpected indentation`, number, indent)
      }

      const trimmed = content.trim()

      // Parse key-value pair
      const colonIndex = trimmed.indexOf(':')
      if (colonIndex === -1) {
        throw new ParseError(`Expected key-value pair`, number, 0)
      }

      const key = trimmed.substring(0, colonIndex).trim()
      const valueStr = trimmed.substring(colonIndex + 1).trim()

      if (!this.isValidKey(key)) {
        throw new ParseError(`Invalid key: ${key}`, number, 0)
      }

      context.index++

      // Parse value
      let value
      if (valueStr === '') {
        // Value on next line(s)
        value = this.parseNextValue(context, indent + this.indentSize)
      } else {
        // Value on same line
        value = this.parseValue(valueStr, number)
      }

      obj[key] = value
    }

    return obj
  }

  /**
   * Parse YAML array
   */
  parseArray(context, baseIndent) {
    const arr = []

    while (context.index < context.lines.length) {
      const line = context.lines[context.index]
      const { content, number } = line

      if (this.isEmptyOrComment(content)) {
        context.index++
        continue
      }

      const indent = this.getIndentation(content)

      // If indentation is less than base, we've ended this array
      if (indent < baseIndent) {
        break
      }

      const trimmed = content.trim()

      // Check for array item
      if (!trimmed.startsWith('- ')) {
        // Not an array item, end of array
        break
      }

      const valueStr = trimmed.substring(2).trim()
      context.index++

      // Parse array item value
      let value
      if (valueStr === '') {
        // Value on next line(s)
        value = this.parseNextValue(context, indent + this.indentSize)
      } else {
        // Value on same line
        value = this.parseValue(valueStr, number)
      }

      arr.push(value)
    }

    return arr
  }

  /**
   * Parse value on next lines
   */
  parseNextValue(context, expectedIndent) {
    if (context.index >= context.lines.length) {
      return null
    }

    const nextLine = context.lines[context.index]
    const nextContent = nextLine.content
    const nextIndent = this.getIndentation(nextContent)
    const trimmed = nextContent.trim()

    if (trimmed.startsWith('- ')) {
      return this.parseArray(context, expectedIndent - this.indentSize)
    } else if (trimmed.includes(':')) {
      return this.parseObject(context, expectedIndent)
    } else {
      // Simple value
      context.index++
      return this.parseValue(trimmed, nextLine.number)
    }
  }

  /**
   * Parse individual value
   */
  parseValue(str, lineNumber) {
    if (str === '') return null
    if (str === 'null') return null
    if (str === 'true') return true
    if (str === 'false') return false

    // Number parsing
    if (/^-?\d+$/.test(str)) {
      return parseInt(str, 10)
    }
    if (/^-?\d+\.\d+$/.test(str)) {
      return parseFloat(str)
    }

    // String parsing
    if ((str.startsWith('"') && str.endsWith('"')) ||
        (str.startsWith("'") && str.endsWith("'"))) {
      return str.slice(1, -1)
    }

    // Unquoted string
    return str
  }

  /**
   * Convert value to YAML string
   */
  stringifyValue(value, indent, options) {
    const indentStr = ' '.repeat(indent)

    if (value === null || value === undefined) {
      return 'null'
    }

    if (typeof value === 'boolean') {
      return value.toString()
    }

    if (typeof value === 'number') {
      return value.toString()
    }

    if (typeof value === 'string') {
      return this.stringifyString(value)
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '[]'
      }
      return value.map((item, index) => {
        const itemStr = this.stringifyValue(item, indent + this.indentSize, options)
        return `${indentStr}- ${itemStr}`
      }).join('\n')
    }

    if (typeof value === 'object') {
      if (Object.keys(value).length === 0) {
        return '{}'
      }

      return Object.entries(value).map(([key, val]) => {
        const keyStr = this.needsQuotes(key) ? `"${key}"` : key
        const valStr = this.stringifyValue(val, indent + this.indentSize, options)

        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          return `${indentStr}${keyStr}:\n${valStr}`
        } else if (Array.isArray(val) && val.length > 0) {
          return `${indentStr}${keyStr}:\n${valStr}`
        } else {
          return `${indentStr}${keyStr}: ${valStr}`
        }
      }).join('\n')
    }

    throw new Error(`Cannot serialize value of type ${typeof value}`)
  }

  /**
   * Stringify a string value with proper escaping
   */
  stringifyString(str) {
    // Check if string needs quotes
    if (this.needsQuotes(str)) {
      return `"${str.replace(/"/g, '\\"')}"`
    }
    return str
  }

  /**
   * Check if a string needs to be quoted in YAML
   */
  needsQuotes(str) {
    if (typeof str !== 'string') return false

    // Empty string needs quotes
    if (str === '') return true

    // Strings that look like numbers, booleans, or null need quotes
    if (/^(true|false|null|\d+|\d*\.\d+)$/.test(str)) return true

    // Strings with special characters need quotes
    if (/[:\[\]{},#&*!|>'"%@`\n\r\t]/.test(str)) return true

    // Strings starting with special chars need quotes
    if (/^[?-]/.test(str)) return true

    return false
  }

  /**
   * Utility methods
   */
  isEmptyOrComment(line) {
    const trimmed = line.trim()
    return trimmed === '' || trimmed.startsWith('#')
  }

  getIndentation(line) {
    const match = line.match(/^(\s*)/)
    return match ? match[1].length : 0
  }

  skipEmptyAndComments(context) {
    while (context.index < context.lines.length &&
           this.isEmptyOrComment(context.lines[context.index].content)) {
      context.index++
    }
  }

  isValidKey(key) {
    return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(key)
  }

  isObjectStart(context) {
    // Look ahead to see if this looks like an object
    for (let i = context.index; i < Math.min(context.index + 5, context.lines.length); i++) {
      const line = context.lines[i].content.trim()
      if (line && !line.startsWith('#') && line.includes(':')) {
        return true
      }
    }
    return false
  }
}

/**
 * Parse error class
 */
class ParseError extends Error {
  constructor(message, line = null, column = null) {
    super(message)
    this.name = 'ParseError'
    this.line = line
    this.column = column
  }
}

/**
 * Main BaseParser class
 */
export class BaseParser {
  constructor(options = {}) {
    this.strict = options.strict || false
    this.validateOnParse = options.validateOnParse !== false
  }

  /**
   * Parse a .base file content to JavaScript object
   */
  parse(content, options = {}) {
    try {
      if (typeof content !== 'string') {
        throw new Error('Content must be a string')
      }

      // Parse YAML
      const parsed = yaml.load(content)

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Base file must contain a valid YAML object')
      }

      // Apply defaults
      const baseDefinition = this.applyDefaults(parsed)

      // Validate if requested
      if ((this.validateOnParse || options.validate) && options.validate !== false) {
        const validation = baseValidator.validateBase(baseDefinition)
        if (!validation.isValid) {
          validation.errors.forEach((error, index) => {
          })
          const error = new ValidationError('Base validation failed', validation.errors)
          error.validationResult = validation
          throw error
        }
      }

      return {
        success: true,
        data: baseDefinition,
        warnings: [],
        metadata: this.extractMetadata(content, baseDefinition)
      }

    } catch (error) {
      return {
        success: false,
        data: null,
        error: error.message,
        errorType: error.constructor.name,
        line: error.line || null,
        column: error.column || null,
        validationResult: error.validationResult || null
      }
    }
  }

  /**
   * Convert JavaScript object to .base file content
   */
  stringify(baseDefinition, options = {}) {
    try {
      if (!baseDefinition || typeof baseDefinition !== 'object') {
        throw new Error('Base definition must be an object')
      }

      // Validate before stringifying
      if (options.validate !== false) {
        const validation = baseValidator.validateBase(baseDefinition)
        if (!validation.isValid) {
          const error = new ValidationError('Base validation failed', validation.errors)
          error.validationResult = validation
          throw error
        }
      }

      // Clean and prepare data
      const cleanedData = this.prepareForSerialization(baseDefinition)

      // Convert to YAML
      const yamlContent = yaml.dump(cleanedData, options)

      // Add header comment if requested
      const header = options.addHeader ? this.generateHeader(baseDefinition) : ''

      return {
        success: true,
        content: header + yamlContent,
        warnings: []
      }

    } catch (error) {
      return {
        success: false,
        content: null,
        error: error.message,
        errorType: error.constructor.name,
        validationResult: error.validationResult || null
      }
    }
  }

  /**
   * Apply default values to parsed base
   */
  applyDefaults(parsed) {
    const result = { ...DEFAULT_BASE_TEMPLATE }

    // Merge parsed data with defaults
    Object.keys(parsed).forEach(key => {
      if (key === 'properties') {
        result.properties = { ...result.properties, ...parsed.properties }
      } else if (key === 'views') {
        // Views should be kept as an array, not merged as an object
        result.views = Array.isArray(parsed.views) ? parsed.views : (result.views || [])
      } else if (key === 'settings') {
        result.settings = { ...result.settings, ...parsed.settings }
      } else {
        result[key] = parsed[key]
      }
    })

    // Set timestamps if not present
    const now = new Date().toISOString()
    if (!result.created) {
      result.created = now
    }
    if (!result.modified) {
      result.modified = now
    }

    return result
  }

  /**
   * Prepare data for serialization
   */
  prepareForSerialization(data) {
    let cleaned = { ...data }

    // Update modified timestamp
    cleaned.modified = new Date().toISOString()

    // Remove empty or null values if not in strict mode
    if (!this.strict) {
      cleaned = this.removeEmptyValues(cleaned)
    }

    // Sort properties for consistent output
    if (cleaned.properties) {
      const sortedProps = {}
      Object.keys(cleaned.properties).sort().forEach(key => {
        sortedProps[key] = cleaned.properties[key]
      })
      cleaned.properties = sortedProps
    }

    return cleaned
  }

  /**
   * Remove empty values recursively
   */
  removeEmptyValues(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeEmptyValues(item)).filter(item => item !== null)
    }

    if (obj && typeof obj === 'object') {
      const cleaned = {}
      for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined && value !== '' &&
            !(Array.isArray(value) && value.length === 0) &&
            !(typeof value === 'object' && Object.keys(value).length === 0)) {
          cleaned[key] = this.removeEmptyValues(value)
        }
      }
      return cleaned
    }

    return obj
  }

  /**
   * Generate header comment
   */
  generateHeader(baseDefinition) {
    const now = new Date().toISOString()
    const name = baseDefinition.name || 'Unnamed Base'
    const description = baseDefinition.description || ''

    return `# Lokus Base: ${name}\n` +
           (description ? `# ${description}\n` : '') +
           `# Generated: ${now}\n` +
           `# Version: ${baseDefinition.version || '1.0.0'}\n\n`
  }

  /**
   * Extract metadata from content and definition
   */
  extractMetadata(content, definition) {
    const lines = content.split('\n')
    return {
      lineCount: lines.length,
      size: content.length,
      propertyCount: Object.keys(definition.properties || {}).length,
      viewCount: Object.keys(definition.views || {}).length,
      hasFormulas: this.hasFormulas(definition),
      hasFilters: this.hasFilters(definition),
      sourceType: definition.source?.type || 'unknown'
    }
  }

  /**
   * Check if base has formula properties
   */
  hasFormulas(definition) {
    if (!definition.properties) return false
    return Object.values(definition.properties).some(prop =>
      prop.type === BASE_PROPERTY_TYPES.FORMULA
    )
  }

  /**
   * Check if base has filtered views
   */
  hasFilters(definition) {
    if (!definition.views) return false
    return Object.values(definition.views).some(view =>
      view.filters && view.filters.length > 0
    )
  }

  /**
   * Parse base from file path (for use with file system)
   */
  async parseFromPath(filePath) {
    try {
      // This would be implemented with actual file system access
      // For now, return a placeholder
      throw new Error('File system access not implemented in browser environment')
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      }
    }
  }

  /**
   * Save base to file path (for use with file system)
   */
  async saveToPath(baseDefinition, filePath, options = {}) {
    try {
      const result = this.stringify(baseDefinition, options)
      if (!result.success) {
        return result
      }

      // This would be implemented with actual file system access
      // For now, return a placeholder
      throw new Error('File system access not implemented in browser environment')
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      }
    }
  }

  /**
   * Convert legacy formats to current base format
   */
  convertLegacy(legacyData, format) {
    try {
      let converted

      switch (format) {
        case 'obsidian':
          converted = this.convertFromObsidian(legacyData)
          break
        case 'notion':
          converted = this.convertFromNotion(legacyData)
          break
        case 'airtable':
          converted = this.convertFromAirtable(legacyData)
          break
        default:
          throw new Error(`Unsupported legacy format: ${format}`)
      }

      return {
        success: true,
        data: converted,
        warnings: [`Converted from ${format} format`]
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      }
    }
  }

  /**
   * Convert from Obsidian dataview format
   */
  convertFromObsidian(obsidianData) {
    // Placeholder for Obsidian conversion logic
    const base = { ...DEFAULT_BASE_TEMPLATE }
    base.name = obsidianData.name || 'Imported from Obsidian'
    base.description = 'Converted from Obsidian Dataview'

    // Convert properties, views, etc.
    // Implementation would depend on Obsidian's actual format

    return base
  }

  /**
   * Convert from Notion database format
   */
  convertFromNotion(notionData) {
    // Placeholder for Notion conversion logic
    const base = { ...DEFAULT_BASE_TEMPLATE }
    base.name = notionData.name || 'Imported from Notion'
    base.description = 'Converted from Notion Database'

    return base
  }

  /**
   * Convert from Airtable format
   */
  convertFromAirtable(airtableData) {
    // Placeholder for Airtable conversion logic
    const base = { ...DEFAULT_BASE_TEMPLATE }
    base.name = airtableData.name || 'Imported from Airtable'
    base.description = 'Converted from Airtable Base'

    return base
  }
}

/**
 * Validation error class
 */
class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message)
    this.name = 'ValidationError'
    this.errors = errors
  }
}

// Export classes and create default instance
export { ParseError, ValidationError, YAMLParser }
export const baseParser = new BaseParser()

// Helper functions
export function parseBase(content, options = {}) {
  return baseParser.parse(content, options)
}

export function stringifyBase(baseDefinition, options = {}) {
  return baseParser.stringify(baseDefinition, options)
}

export function convertLegacyBase(legacyData, format, options = {}) {
  return baseParser.convertLegacy(legacyData, format, options)
}

export default BaseParser