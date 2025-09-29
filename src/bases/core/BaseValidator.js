/**
 * Base Validator
 * Comprehensive validation for .base files and their components
 */

import {
  BASE_FILE_SCHEMA,
  BASE_ENTRY_SCHEMA,
  BASE_PROPERTY_TYPES,
  FILTER_OPERATORS,
  SORT_DIRECTIONS,
  VIEW_TYPES,
  CHART_TYPES,
  FORMULA_FUNCTIONS,
  FORMULA_VALIDATION_RULES,
  PROPERTY_TYPE_CONFIGS
} from './BaseSchema.js'

import {
  isValidFilePath,
  isValidFileName,
  isValidUrl,
  isValidEmail,
  isValidSearchQuery
} from '../../core/security/validator.js'

/**
 * Validation result structure
 */
class ValidationResult {
  constructor() {
    this.isValid = true
    this.errors = []
    this.warnings = []
  }

  addError(path, message, code = null) {
    this.isValid = false
    this.errors.push({ path, message, code, type: 'error' })
  }

  addWarning(path, message, code = null) {
    this.warnings.push({ path, message, code, type: 'warning' })
  }

  merge(other) {
    if (!other.isValid) {
      this.isValid = false
    }
    this.errors.push(...other.errors)
    this.warnings.push(...other.warnings)
  }

  hasErrorsOfType(code) {
    return this.errors.some(error => error.code === code)
  }

  getErrorsByPath(path) {
    return this.errors.filter(error => error.path.startsWith(path))
  }

  toObject() {
    return {
      isValid: this.isValid,
      errors: this.errors,
      warnings: this.warnings,
      errorCount: this.errors.length,
      warningCount: this.warnings.length
    }
  }
}

/**
 * Main Base Validator class
 */
export class BaseValidator {
  constructor(options = {}) {
    this.strict = options.strict || false
    this.allowExtraProperties = options.allowExtraProperties || false
    this.maxDepth = options.maxDepth || 10
  }

  /**
   * Validate a complete base definition
   */
  validateBase(baseDefinition, path = '') {
    const result = new ValidationResult()

    if (!baseDefinition || typeof baseDefinition !== 'object') {
      result.addError(path, 'Base definition must be an object')
      return result
    }

    // Validate against schema structure
    result.merge(this.validateSchema(baseDefinition, BASE_FILE_SCHEMA, path))

    if (!result.isValid) {
      return result
    }

    // Additional business logic validation
    result.merge(this.validateBaseBusinessLogic(baseDefinition, path))

    return result
  }

  /**
   * Validate base business logic
   */
  validateBaseBusinessLogic(base, path = '') {
    const result = new ValidationResult()

    // Validate source configuration
    result.merge(this.validateSource(base.source, `${path}.source`))

    // Validate properties
    if (base.properties) {
      result.merge(this.validateProperties(base.properties, `${path}.properties`))
    }

    // Validate views
    if (base.views) {
      result.merge(this.validateViews(base.views, base.properties || {}, `${path}.views`))
    }

    // Validate settings
    if (base.settings) {
      result.merge(this.validateSettings(base.settings, base.views || {}, `${path}.settings`))
    }

    return result
  }

  /**
   * Validate source configuration
   */
  validateSource(source, path = '') {
    const result = new ValidationResult()

    if (!source || typeof source !== 'object') {
      result.addError(path, 'Source configuration is required')
      return result
    }

    const { type, path: sourcePath, tag, query, recursive } = source

    switch (type) {
      case 'folder':
        if (!sourcePath) {
          result.addError(`${path}.path`, 'Folder path is required for folder source')
        } else if (!isValidFilePath(sourcePath)) {
          result.addError(`${path}.path`, 'Invalid folder path')
        }
        if (typeof recursive !== 'undefined' && typeof recursive !== 'boolean') {
          result.addError(`${path}.recursive`, 'Recursive must be a boolean')
        }
        break

      case 'tag':
        if (!tag) {
          result.addError(`${path}.tag`, 'Tag is required for tag source')
        } else if (typeof tag !== 'string' || tag.length === 0) {
          result.addError(`${path}.tag`, 'Tag must be a non-empty string')
        }
        break

      case 'search':
        if (!query) {
          result.addError(`${path}.query`, 'Query is required for search source')
        } else if (!isValidSearchQuery(query)) {
          result.addError(`${path}.query`, 'Invalid search query')
        }
        break

      case 'manual':
        // No additional validation required for manual sources
        break

      default:
        result.addError(`${path}.type`, `Unsupported source type: ${type}`)
    }

    return result
  }

  /**
   * Validate property definitions
   */
  validateProperties(properties, path = '') {
    const result = new ValidationResult()

    if (typeof properties !== 'object') {
      result.addError(path, 'Properties must be an object')
      return result
    }

    // Check for reserved property names
    const reservedNames = ['id', 'file', 'path', 'name', 'created', 'modified']

    for (const [propName, propDef] of Object.entries(properties)) {
      const propPath = `${path}.${propName}`

      if (reservedNames.includes(propName)) {
        result.addWarning(propPath, `Property name '${propName}' is reserved and may cause conflicts`)
      }

      result.merge(this.validateProperty(propDef, propName, propPath))
    }

    return result
  }

  /**
   * Validate a single property definition
   */
  validateProperty(property, name, path = '') {
    const result = new ValidationResult()

    if (!property || typeof property !== 'object') {
      result.addError(path, 'Property definition must be an object')
      return result
    }

    const { type, options, min, max, format, formula, relation } = property

    // Validate property type
    if (!type || !Object.values(BASE_PROPERTY_TYPES).includes(type)) {
      result.addError(`${path}.type`, `Invalid property type: ${type}`)
      return result
    }

    const config = PROPERTY_TYPE_CONFIGS[type]
    if (!config) {
      result.addError(`${path}.type`, `Unsupported property type: ${type}`)
      return result
    }

    // Check required fields for this type
    if (config.required) {
      for (const required of config.required) {
        if (!(required in property)) {
          result.addError(`${path}.${required}`, `Property '${required}' is required for type '${type}'`)
        }
      }
    }

    // Type-specific validations
    switch (type) {
      case BASE_PROPERTY_TYPES.SELECT:
      case BASE_PROPERTY_TYPES.MULTI_SELECT:
        if (options && (!Array.isArray(options) || options.length === 0)) {
          result.addError(`${path}.options`, 'Options must be a non-empty array')
        }
        break

      case BASE_PROPERTY_TYPES.NUMBER:
      case BASE_PROPERTY_TYPES.RATING:
        if (min !== undefined && typeof min !== 'number') {
          result.addError(`${path}.min`, 'Min value must be a number')
        }
        if (max !== undefined && typeof max !== 'number') {
          result.addError(`${path}.max`, 'Max value must be a number')
        }
        if (min !== undefined && max !== undefined && min >= max) {
          result.addError(`${path}`, 'Min value must be less than max value')
        }
        break

      case BASE_PROPERTY_TYPES.FORMULA:
        if (!formula) {
          result.addError(`${path}.formula`, 'Formula is required for formula type')
        } else {
          result.merge(this.validateFormula(formula, `${path}.formula`))
        }
        break

      case BASE_PROPERTY_TYPES.RELATION:
        if (!relation || typeof relation !== 'object') {
          result.addError(`${path}.relation`, 'Relation configuration is required')
        } else {
          result.merge(this.validateRelation(relation, `${path}.relation`))
        }
        break

      case BASE_PROPERTY_TYPES.URL:
        // No additional validation needed, handled by schema
        break

      case BASE_PROPERTY_TYPES.EMAIL:
        // No additional validation needed, handled by schema
        break
    }

    return result
  }

  /**
   * Validate formula expression
   */
  validateFormula(formula, path = '') {
    const result = new ValidationResult()

    if (typeof formula !== 'string') {
      result.addError(path, 'Formula must be a string')
      return result
    }

    if (formula.length > FORMULA_VALIDATION_RULES.maxLength) {
      result.addError(path, `Formula exceeds maximum length of ${FORMULA_VALIDATION_RULES.maxLength} characters`)
    }

    // Check for forbidden patterns
    for (const pattern of FORMULA_VALIDATION_RULES.forbiddenPatterns) {
      if (pattern.test(formula)) {
        result.addError(path, 'Formula contains forbidden patterns')
        break
      }
    }

    // Basic syntax validation (simplified)
    try {
      this.validateFormulaSyntax(formula, path, result)
    } catch (error) {
      result.addError(path, `Formula syntax error: ${error.message}`)
    }

    return result
  }

  /**
   * Basic formula syntax validation
   */
  validateFormulaSyntax(formula, path, result) {
    // Check balanced parentheses
    let parenthesesCount = 0
    let inString = false
    let stringChar = null

    for (let i = 0; i < formula.length; i++) {
      const char = formula[i]
      const prevChar = formula[i - 1]

      // Handle string literals
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true
          stringChar = char
        } else if (char === stringChar) {
          inString = false
          stringChar = null
        }
      }

      if (!inString) {
        if (char === '(') {
          parenthesesCount++
        } else if (char === ')') {
          parenthesesCount--
          if (parenthesesCount < 0) {
            result.addError(path, 'Unmatched closing parenthesis')
            return
          }
        }
      }
    }

    if (parenthesesCount !== 0) {
      result.addError(path, 'Unmatched parentheses in formula')
    }

    if (inString) {
      result.addError(path, 'Unterminated string in formula')
    }

    // Check for valid function calls
    const functionPattern = /(\w+)\s*\(/g
    let match
    while ((match = functionPattern.exec(formula)) !== null) {
      const funcName = match[1]
      if (!FORMULA_VALIDATION_RULES.allowedFunctions.includes(funcName)) {
        result.addWarning(path, `Unknown function: ${funcName}`)
      }
    }
  }

  /**
   * Validate relation configuration
   */
  validateRelation(relation, path = '') {
    const result = new ValidationResult()

    if (!relation.target || typeof relation.target !== 'string') {
      result.addError(`${path}.target`, 'Relation target is required and must be a string')
    }

    if (relation.property && typeof relation.property !== 'string') {
      result.addError(`${path}.property`, 'Relation property must be a string')
    }

    return result
  }

  /**
   * Validate view definitions
   */
  validateViews(views, properties, path = '') {
    const result = new ValidationResult()

    if (typeof views !== 'object') {
      result.addError(path, 'Views must be an object')
      return result
    }

    if (Object.keys(views).length === 0) {
      result.addWarning(path, 'No views defined')
    }

    const propertyNames = Object.keys(properties)

    for (const [viewName, viewDef] of Object.entries(views)) {
      const viewPath = `${path}.${viewName}`
      result.merge(this.validateView(viewDef, propertyNames, viewPath))
    }

    return result
  }

  /**
   * Validate a single view definition
   */
  validateView(view, propertyNames, path = '') {
    const result = new ValidationResult()

    if (!view || typeof view !== 'object') {
      result.addError(path, 'View definition must be an object')
      return result
    }

    const { type, filters, sort, groupBy, display } = view

    // Validate view type
    if (!Object.values(VIEW_TYPES).includes(type)) {
      result.addError(`${path}.type`, `Invalid view type: ${type}`)
    }

    // Validate filters
    if (filters) {
      result.merge(this.validateFilters(filters, propertyNames, `${path}.filters`))
    }

    // Validate sort
    if (sort) {
      result.merge(this.validateSort(sort, propertyNames, `${path}.sort`))
    }

    // Validate groupBy
    if (groupBy && !propertyNames.includes(groupBy)) {
      result.addError(`${path}.groupBy`, `Group by property '${groupBy}' does not exist`)
    }

    // Validate display options
    if (display) {
      result.merge(this.validateViewDisplay(display, type, propertyNames, `${path}.display`))
    }

    return result
  }

  /**
   * Validate view filters
   */
  validateFilters(filters, propertyNames, path = '') {
    const result = new ValidationResult()

    if (!Array.isArray(filters)) {
      result.addError(path, 'Filters must be an array')
      return result
    }

    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i]
      const filterPath = `${path}[${i}]`

      if (!filter || typeof filter !== 'object') {
        result.addError(filterPath, 'Filter must be an object')
        continue
      }

      const { property, operator, value, condition } = filter

      // Validate property exists
      if (!property) {
        result.addError(`${filterPath}.property`, 'Filter property is required')
      } else if (!propertyNames.includes(property) && !this.isBuiltInProperty(property)) {
        result.addWarning(`${filterPath}.property`, `Filter property '${property}' does not exist`)
      }

      // Validate operator
      if (!operator) {
        result.addError(`${filterPath}.operator`, 'Filter operator is required')
      } else if (!Object.values(FILTER_OPERATORS).includes(operator)) {
        result.addError(`${filterPath}.operator`, `Invalid filter operator: ${operator}`)
      }

      // Validate value based on operator
      if (operator && this.requiresValue(operator) && value === undefined) {
        result.addError(`${filterPath}.value`, `Filter value is required for operator '${operator}'`)
      }

      // Validate condition
      if (condition && !['AND', 'OR'].includes(condition)) {
        result.addError(`${filterPath}.condition`, `Invalid filter condition: ${condition}`)
      }
    }

    return result
  }

  /**
   * Validate sort configuration
   */
  validateSort(sort, propertyNames, path = '') {
    const result = new ValidationResult()

    if (!Array.isArray(sort)) {
      result.addError(path, 'Sort must be an array')
      return result
    }

    for (let i = 0; i < sort.length; i++) {
      const sortItem = sort[i]
      const sortPath = `${path}[${i}]`

      if (!sortItem || typeof sortItem !== 'object') {
        result.addError(sortPath, 'Sort item must be an object')
        continue
      }

      const { property, direction } = sortItem

      // Validate property
      if (!property) {
        result.addError(`${sortPath}.property`, 'Sort property is required')
      } else if (!propertyNames.includes(property) && !this.isBuiltInProperty(property)) {
        result.addWarning(`${sortPath}.property`, `Sort property '${property}' does not exist`)
      }

      // Validate direction
      if (direction && !Object.values(SORT_DIRECTIONS).includes(direction)) {
        result.addError(`${sortPath}.direction`, `Invalid sort direction: ${direction}`)
      }
    }

    return result
  }

  /**
   * Validate view display options
   */
  validateViewDisplay(display, viewType, propertyNames, path = '') {
    const result = new ValidationResult()

    if (typeof display !== 'object') {
      result.addError(path, 'Display options must be an object')
      return result
    }

    const { columns, pageSize, chartType, xAxis, yAxis, dateProperty, statusProperty } = display

    // Validate columns for table view
    if (columns) {
      if (!Array.isArray(columns)) {
        result.addError(`${path}.columns`, 'Columns must be an array')
      } else {
        for (let i = 0; i < columns.length; i++) {
          const column = columns[i]
          const columnPath = `${path}.columns[${i}]`

          if (!column.property) {
            result.addError(`${columnPath}.property`, 'Column property is required')
          } else if (!propertyNames.includes(column.property) && !this.isBuiltInProperty(column.property)) {
            result.addWarning(`${columnPath}.property`, `Column property '${column.property}' does not exist`)
          }

          if (column.width !== undefined && (typeof column.width !== 'number' || column.width < 0)) {
            result.addError(`${columnPath}.width`, 'Column width must be a positive number')
          }
        }
      }
    }

    // Validate page size
    if (pageSize !== undefined) {
      if (typeof pageSize !== 'number' || pageSize < 1 || pageSize > 1000) {
        result.addError(`${path}.pageSize`, 'Page size must be a number between 1 and 1000')
      }
    }

    // Chart-specific validations
    if (viewType === VIEW_TYPES.CHART) {
      if (chartType && !Object.values(CHART_TYPES).includes(chartType)) {
        result.addError(`${path}.chartType`, `Invalid chart type: ${chartType}`)
      }

      if (xAxis && !propertyNames.includes(xAxis) && !this.isBuiltInProperty(xAxis)) {
        result.addError(`${path}.xAxis`, `X-axis property '${xAxis}' does not exist`)
      }

      if (yAxis && !propertyNames.includes(yAxis) && !this.isBuiltInProperty(yAxis)) {
        result.addError(`${path}.yAxis`, `Y-axis property '${yAxis}' does not exist`)
      }
    }

    // Calendar-specific validations
    if (viewType === VIEW_TYPES.CALENDAR) {
      if (dateProperty && !propertyNames.includes(dateProperty) && !this.isBuiltInProperty(dateProperty)) {
        result.addError(`${path}.dateProperty`, `Date property '${dateProperty}' does not exist`)
      }
    }

    // Kanban-specific validations
    if (viewType === VIEW_TYPES.KANBAN) {
      if (statusProperty && !propertyNames.includes(statusProperty) && !this.isBuiltInProperty(statusProperty)) {
        result.addError(`${path}.statusProperty`, `Status property '${statusProperty}' does not exist`)
      }
    }

    return result
  }

  /**
   * Validate settings configuration
   */
  validateSettings(settings, views, path = '') {
    const result = new ValidationResult()

    if (typeof settings !== 'object') {
      result.addError(path, 'Settings must be an object')
      return result
    }

    const { defaultView, refreshInterval } = settings

    // Validate default view exists
    if (defaultView && !views[defaultView]) {
      result.addError(`${path}.defaultView`, `Default view '${defaultView}' does not exist`)
    }

    // Validate refresh interval
    if (refreshInterval !== undefined) {
      if (typeof refreshInterval !== 'number' || refreshInterval < 1000) {
        result.addError(`${path}.refreshInterval`, 'Refresh interval must be at least 1000ms')
      }
    }

    return result
  }

  /**
   * Validate against JSON schema
   */
  validateSchema(data, schema, path = '', depth = 0) {
    const result = new ValidationResult()

    if (depth > this.maxDepth) {
      result.addError(path, 'Maximum validation depth exceeded')
      return result
    }

    // Basic type validation
    if (schema.type) {
      const actualType = Array.isArray(data) ? 'array' : typeof data
      if (actualType !== schema.type) {
        result.addError(path, `Expected type ${schema.type}, got ${actualType}`)
        return result
      }
    }

    // Required properties
    if (schema.required && Array.isArray(schema.required)) {
      for (const required of schema.required) {
        if (!(required in data)) {
          result.addError(`${path}.${required}`, `Required property '${required}' is missing`)
        }
      }
    }

    // Validate properties
    if (schema.properties && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        const keyPath = path ? `${path}.${key}` : key
        const keySchema = schema.properties[key]

        if (keySchema) {
          result.merge(this.validateSchema(value, keySchema, keyPath, depth + 1))
        } else if (!schema.additionalProperties && !this.allowExtraProperties) {
          result.addWarning(keyPath, `Property '${key}' is not defined in schema`)
        }
      }
    }

    return result
  }

  /**
   * Check if a property is a built-in system property
   */
  isBuiltInProperty(property) {
    const builtInProperties = [
      'id', 'file', 'path', 'name', 'extension', 'size', 'created', 'modified', 'title', 'content', 'tags'
    ]
    return builtInProperties.includes(property)
  }

  /**
   * Check if an operator requires a value
   */
  requiresValue(operator) {
    const noValueOperators = [
      FILTER_OPERATORS.IS_EMPTY,
      FILTER_OPERATORS.IS_NOT_EMPTY
    ]
    return !noValueOperators.includes(operator)
  }

  /**
   * Validate a base entry/row
   */
  validateEntry(entry, baseDefinition, path = '') {
    const result = new ValidationResult()

    if (!entry || typeof entry !== 'object') {
      result.addError(path, 'Entry must be an object')
      return result
    }

    // Validate against entry schema
    result.merge(this.validateSchema(entry, BASE_ENTRY_SCHEMA, path))

    // Validate property values against base definition
    if (entry.properties && baseDefinition.properties) {
      result.merge(this.validateEntryProperties(
        entry.properties,
        baseDefinition.properties,
        `${path}.properties`
      ))
    }

    return result
  }

  /**
   * Validate entry property values
   */
  validateEntryProperties(entryProps, propDefinitions, path = '') {
    const result = new ValidationResult()

    for (const [propName, value] of Object.entries(entryProps)) {
      const propDef = propDefinitions[propName]
      const propPath = `${path}.${propName}`

      if (!propDef) {
        result.addWarning(propPath, `Property '${propName}' is not defined in base`)
        continue
      }

      // Validate value against property type
      result.merge(this.validatePropertyValue(value, propDef, propPath))
    }

    // Check for required properties
    for (const [propName, propDef] of Object.entries(propDefinitions)) {
      if (propDef.required && !(propName in entryProps)) {
        result.addError(`${path}.${propName}`, `Required property '${propName}' is missing`)
      }
    }

    return result
  }

  /**
   * Validate a property value against its definition
   */
  validatePropertyValue(value, propDef, path = '') {
    const result = new ValidationResult()
    const { type, options, min, max } = propDef

    // Skip validation for formula and rollup types (computed)
    if (type === BASE_PROPERTY_TYPES.FORMULA || type === BASE_PROPERTY_TYPES.ROLLUP) {
      return result
    }

    // Handle null/undefined values
    if (value == null) {
      if (propDef.required) {
        result.addError(path, 'Value is required')
      }
      return result
    }

    // Type-specific validation
    switch (type) {
      case BASE_PROPERTY_TYPES.TEXT:
        if (typeof value !== 'string') {
          result.addError(path, 'Value must be a string')
        } else if (value.length > 1000) {
          result.addError(path, 'Text exceeds maximum length of 1000 characters')
        }
        break

      case BASE_PROPERTY_TYPES.NUMBER:
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          result.addError(path, 'Value must be a finite number')
        } else {
          if (min !== undefined && value < min) {
            result.addError(path, `Value must be at least ${min}`)
          }
          if (max !== undefined && value > max) {
            result.addError(path, `Value must be at most ${max}`)
          }
        }
        break

      case BASE_PROPERTY_TYPES.BOOLEAN:
        if (typeof value !== 'boolean') {
          result.addError(path, 'Value must be a boolean')
        }
        break

      case BASE_PROPERTY_TYPES.DATE:
        if (typeof value !== 'string' || isNaN(Date.parse(value))) {
          result.addError(path, 'Value must be a valid ISO date string')
        }
        break

      case BASE_PROPERTY_TYPES.SELECT:
        if (typeof value !== 'string') {
          result.addError(path, 'Value must be a string')
        } else if (options && !options.includes(value)) {
          result.addError(path, `Value must be one of: ${options.join(', ')}`)
        }
        break

      case BASE_PROPERTY_TYPES.MULTI_SELECT:
        if (!Array.isArray(value)) {
          result.addError(path, 'Value must be an array')
        } else if (options) {
          for (const item of value) {
            if (!options.includes(item)) {
              result.addError(path, `Item '${item}' is not a valid option`)
            }
          }
        }
        break

      case BASE_PROPERTY_TYPES.URL:
        if (typeof value !== 'string' || !isValidUrl(value)) {
          result.addError(path, 'Value must be a valid URL')
        }
        break

      case BASE_PROPERTY_TYPES.EMAIL:
        if (typeof value !== 'string' || !isValidEmail(value)) {
          result.addError(path, 'Value must be a valid email address')
        }
        break

      case BASE_PROPERTY_TYPES.RATING:
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          result.addError(path, 'Rating must be a finite number')
        } else {
          const minRating = min !== undefined ? min : 0
          const maxRating = max !== undefined ? max : 5
          if (value < minRating || value > maxRating) {
            result.addError(path, `Rating must be between ${minRating} and ${maxRating}`)
          }
        }
        break
    }

    return result
  }
}

// Export validation result class and create default instance
export { ValidationResult }
export const baseValidator = new BaseValidator()

// Helper functions
export function validateBase(baseDefinition, options = {}) {
  const validator = new BaseValidator(options)
  return validator.validateBase(baseDefinition)
}

export function validateEntry(entry, baseDefinition, options = {}) {
  const validator = new BaseValidator(options)
  return validator.validateEntry(entry, baseDefinition)
}

export function validateFormula(formula, options = {}) {
  const validator = new BaseValidator(options)
  return validator.validateFormula(formula)
}

export default BaseValidator