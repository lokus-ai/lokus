/**
 * Base Schema Definitions
 * Defines the complete schema for Lokus .base files
 * Based on Obsidian Bases functionality but adapted for Lokus architecture
 */

/**
 * Base property types supported in .base files
 */
export const BASE_PROPERTY_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  BOOLEAN: 'boolean',
  SELECT: 'select',
  MULTI_SELECT: 'multi-select',
  FILE: 'file',
  URL: 'url',
  EMAIL: 'email',
  PHONE: 'phone',
  RATING: 'rating',
  FORMULA: 'formula',
  ROLLUP: 'rollup',
  RELATION: 'relation'
}

/**
 * Filter operators supported in base queries
 */
export const FILTER_OPERATORS = {
  // Equality
  EQUALS: '==',
  NOT_EQUALS: '!=',

  // Comparison
  GREATER_THAN: '>',
  GREATER_EQUAL: '>=',
  LESS_THAN: '<',
  LESS_EQUAL: '<=',

  // Text operations
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not-contains',
  STARTS_WITH: 'starts-with',
  ENDS_WITH: 'ends-with',
  MATCHES: 'matches',

  // Array operations
  IN: 'in',
  NOT_IN: 'not-in',

  // Special operations
  IS_EMPTY: 'is-empty',
  IS_NOT_EMPTY: 'is-not-empty',

  // Lokus-specific operations
  TAGGED_WITH: 'taggedWith',
  NOT_TAGGED_WITH: 'not-taggedWith',
  IN_FOLDER: 'inFolder',
  NOT_IN_FOLDER: 'not-inFolder',
  HAS_OUTLINK: 'hasOutlink',
  HAS_BACKLINK: 'hasBacklink',

  // Date operations
  BEFORE: 'before',
  AFTER: 'after',
  ON: 'on',
  BETWEEN: 'between'
}

/**
 * Sort directions
 */
export const SORT_DIRECTIONS = {
  ASC: 'asc',
  DESC: 'desc'
}

/**
 * View types supported
 */
export const VIEW_TYPES = {
  TABLE: 'table',
  LIST: 'list',
  GALLERY: 'gallery',
  CALENDAR: 'calendar',
  KANBAN: 'kanban',
  TIMELINE: 'timeline',
  CHART: 'chart'
}

/**
 * Chart types for chart views
 */
export const CHART_TYPES = {
  BAR: 'bar',
  LINE: 'line',
  PIE: 'pie',
  DOUGHNUT: 'doughnut',
  SCATTER: 'scatter',
  AREA: 'area'
}

/**
 * Formula functions available
 */
export const FORMULA_FUNCTIONS = {
  // Math functions
  SUM: 'sum',
  AVERAGE: 'average',
  MIN: 'min',
  MAX: 'max',
  COUNT: 'count',
  ROUND: 'round',
  CEIL: 'ceil',
  FLOOR: 'floor',
  ABS: 'abs',
  SQRT: 'sqrt',
  POWER: 'power',

  // Text functions
  CONCAT: 'concat',
  LENGTH: 'length',
  UPPER: 'upper',
  LOWER: 'lower',
  TRIM: 'trim',
  SUBSTRING: 'substring',
  REPLACE: 'replace',
  SPLIT: 'split',
  JOIN: 'join',

  // Date functions
  NOW: 'now',
  TODAY: 'today',
  YEAR: 'year',
  MONTH: 'month',
  DAY: 'day',
  WEEKDAY: 'weekday',
  DATE_ADD: 'dateAdd',
  DATE_DIFF: 'dateDiff',
  FORMAT_DATE: 'formatDate',

  // Logical functions
  IF: 'if',
  AND: 'and',
  OR: 'or',
  NOT: 'not',
  SWITCH: 'switch',

  // Array functions
  FILTER: 'filter',
  MAP: 'map',
  REDUCE: 'reduce',
  FIRST: 'first',
  LAST: 'last',
  SORT: 'sort',
  UNIQUE: 'unique',

  // Lokus-specific functions
  NOTE_TITLE: 'noteTitle',
  NOTE_PATH: 'notePath',
  NOTE_TAGS: 'noteTags',
  NOTE_CREATED: 'noteCreated',
  NOTE_MODIFIED: 'noteModified',
  BACKLINKS: 'backlinks',
  OUTLINKS: 'outlinks'
}

/**
 * Complete schema for a .base file
 */
export const BASE_FILE_SCHEMA = {
  type: 'object',
  required: ['name', 'source'],
  additionalProperties: false,
  properties: {
    // Basic metadata
    name: {
      type: 'string',
      description: 'Display name for the base',
      minLength: 1,
      maxLength: 100
    },

    description: {
      type: 'string',
      description: 'Optional description of the base',
      maxLength: 500
    },

    // Data source configuration
    source: {
      type: 'object',
      required: ['type'],
      properties: {
        type: {
          type: 'string',
          enum: ['folder', 'tag', 'search', 'manual'],
          description: 'Type of data source'
        },
        path: {
          type: 'string',
          description: 'Folder path when type is folder'
        },
        tag: {
          type: 'string',
          description: 'Tag name when type is tag'
        },
        query: {
          type: 'string',
          description: 'Search query when type is search'
        },
        recursive: {
          type: 'boolean',
          default: true,
          description: 'Include subfolders when type is folder'
        }
      }
    },

    // Property definitions
    properties: {
      type: 'object',
      description: 'Custom property definitions',
      additionalProperties: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            enum: Object.values(BASE_PROPERTY_TYPES),
            description: 'Property data type'
          },
          name: {
            type: 'string',
            description: 'Display name for the property'
          },
          description: {
            type: 'string',
            description: 'Property description'
          },
          required: {
            type: 'boolean',
            default: false,
            description: 'Whether property is required'
          },
          default: {
            description: 'Default value for the property'
          },
          // Type-specific options
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Options for select/multi-select types'
          },
          min: {
            type: 'number',
            description: 'Minimum value for number/rating types'
          },
          max: {
            type: 'number',
            description: 'Maximum value for number/rating types'
          },
          format: {
            type: 'string',
            description: 'Format string for dates/numbers'
          },
          formula: {
            type: 'string',
            description: 'Formula expression for formula type'
          },
          relation: {
            type: 'object',
            properties: {
              target: { type: 'string' },
              property: { type: 'string' }
            },
            description: 'Relation configuration'
          }
        }
      }
    },

    // View definitions
    views: {
      type: 'object',
      description: 'View configurations',
      additionalProperties: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            enum: Object.values(VIEW_TYPES),
            description: 'View type'
          },
          name: {
            type: 'string',
            description: 'Display name for the view'
          },
          description: {
            type: 'string',
            description: 'View description'
          },

          // Filtering
          filters: {
            type: 'array',
            items: {
              type: 'object',
              required: ['property', 'operator'],
              properties: {
                property: {
                  type: 'string',
                  description: 'Property to filter on'
                },
                operator: {
                  type: 'string',
                  enum: Object.values(FILTER_OPERATORS),
                  description: 'Filter operator'
                },
                value: {
                  description: 'Filter value'
                },
                condition: {
                  type: 'string',
                  enum: ['AND', 'OR'],
                  default: 'AND',
                  description: 'Logical condition with next filter'
                }
              }
            }
          },

          // Sorting
          sort: {
            type: 'array',
            items: {
              type: 'object',
              required: ['property'],
              properties: {
                property: {
                  type: 'string',
                  description: 'Property to sort by'
                },
                direction: {
                  type: 'string',
                  enum: Object.values(SORT_DIRECTIONS),
                  default: 'asc',
                  description: 'Sort direction'
                }
              }
            }
          },

          // Grouping
          groupBy: {
            type: 'string',
            description: 'Property to group by'
          },

          // Display options
          display: {
            type: 'object',
            properties: {
              columns: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['property'],
                  properties: {
                    property: { type: 'string' },
                    width: { type: 'number' },
                    visible: { type: 'boolean', default: true }
                  }
                },
                description: 'Column configuration for table view'
              },
              pageSize: {
                type: 'number',
                minimum: 1,
                maximum: 1000,
                default: 50,
                description: 'Number of items per page'
              },
              showTotal: {
                type: 'boolean',
                default: true,
                description: 'Show total count'
              },

              // Chart-specific options
              chartType: {
                type: 'string',
                enum: Object.values(CHART_TYPES),
                description: 'Chart type for chart views'
              },
              xAxis: {
                type: 'string',
                description: 'X-axis property for charts'
              },
              yAxis: {
                type: 'string',
                description: 'Y-axis property for charts'
              },

              // Calendar-specific options
              dateProperty: {
                type: 'string',
                description: 'Date property for calendar view'
              },

              // Kanban-specific options
              statusProperty: {
                type: 'string',
                description: 'Status property for kanban view'
              }
            }
          }
        }
      }
    },

    // Base-level settings
    settings: {
      type: 'object',
      properties: {
        defaultView: {
          type: 'string',
          description: 'Default view to show'
        },
        allowCreate: {
          type: 'boolean',
          default: true,
          description: 'Allow creating new notes from base'
        },
        allowEdit: {
          type: 'boolean',
          default: true,
          description: 'Allow editing notes from base'
        },
        allowDelete: {
          type: 'boolean',
          default: false,
          description: 'Allow deleting notes from base'
        },
        template: {
          type: 'string',
          description: 'Template to use for new notes'
        },
        autoRefresh: {
          type: 'boolean',
          default: false,
          description: 'Auto-refresh base data'
        },
        refreshInterval: {
          type: 'number',
          minimum: 1000,
          default: 30000,
          description: 'Auto-refresh interval in milliseconds'
        }
      }
    },

    // Metadata
    created: {
      type: 'string',
      format: 'date-time',
      description: 'Creation timestamp'
    },

    modified: {
      type: 'string',
      format: 'date-time',
      description: 'Last modification timestamp'
    },

    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$',
      default: '1.0.0',
      description: 'Base schema version'
    }
  }
}

/**
 * Schema for individual base entries/rows
 */
export const BASE_ENTRY_SCHEMA = {
  type: 'object',
  required: ['id', 'file'],
  properties: {
    id: {
      type: 'string',
      description: 'Unique identifier for the entry'
    },
    file: {
      type: 'object',
      required: ['path', 'name'],
      properties: {
        path: { type: 'string' },
        name: { type: 'string' },
        extension: { type: 'string' },
        size: { type: 'number' },
        created: { type: 'string', format: 'date-time' },
        modified: { type: 'string', format: 'date-time' }
      }
    },
    properties: {
      type: 'object',
      description: 'Property values for this entry',
      additionalProperties: true
    },
    computed: {
      type: 'object',
      description: 'Computed property values',
      additionalProperties: true
    }
  }
}

/**
 * Validation rules for formula expressions
 */
export const FORMULA_VALIDATION_RULES = {
  maxLength: 1000,
  allowedFunctions: Object.values(FORMULA_FUNCTIONS),
  allowedOperators: ['+', '-', '*', '/', '%', '==', '!=', '>', '<', '>=', '<=', '&&', '||', '!'],
  allowedConstants: ['true', 'false', 'null', 'undefined'],
  forbiddenPatterns: [
    /eval\s*\(/,
    /Function\s*\(/,
    /setTimeout\s*\(/,
    /setInterval\s*\(/,
    /fetch\s*\(/,
    /XMLHttpRequest/,
    /import\s*\(/,
    /require\s*\(/,
    /process\./,
    /global\./,
    /window\./,
    /document\./
  ]
}

/**
 * Default base template
 */
export const DEFAULT_BASE_TEMPLATE = {
  name: 'New Base',
  description: '',
  source: {
    type: 'folder',
    path: '/',
    recursive: true
  },
  properties: {
    title: {
      type: BASE_PROPERTY_TYPES.TEXT,
      name: 'Title',
      description: 'Note title'
    },
    created: {
      type: BASE_PROPERTY_TYPES.DATE,
      name: 'Created',
      description: 'Creation date'
    },
    modified: {
      type: BASE_PROPERTY_TYPES.DATE,
      name: 'Modified',
      description: 'Last modification date'
    },
    tags: {
      type: BASE_PROPERTY_TYPES.MULTI_SELECT,
      name: 'Tags',
      description: 'Note tags'
    }
  },
  views: {
    default: {
      type: VIEW_TYPES.TABLE,
      name: 'All Notes',
      description: 'Default table view',
      sort: [
        {
          property: 'modified',
          direction: SORT_DIRECTIONS.DESC
        }
      ],
      display: {
        columns: [
          { property: 'title', width: 200, visible: true },
          { property: 'tags', width: 150, visible: true },
          { property: 'created', width: 120, visible: true },
          { property: 'modified', width: 120, visible: true }
        ],
        pageSize: 50,
        showTotal: true
      }
    }
  },
  settings: {
    defaultView: 'default',
    allowCreate: true,
    allowEdit: true,
    allowDelete: false,
    autoRefresh: false
  },
  version: '1.0.0'
}

/**
 * Property type configurations
 */
export const PROPERTY_TYPE_CONFIGS = {
  [BASE_PROPERTY_TYPES.TEXT]: {
    defaultValue: '',
    validation: { maxLength: 1000 }
  },
  [BASE_PROPERTY_TYPES.NUMBER]: {
    defaultValue: 0,
    validation: { type: 'number' }
  },
  [BASE_PROPERTY_TYPES.DATE]: {
    defaultValue: null,
    validation: { format: 'date-time' }
  },
  [BASE_PROPERTY_TYPES.BOOLEAN]: {
    defaultValue: false,
    validation: { type: 'boolean' }
  },
  [BASE_PROPERTY_TYPES.SELECT]: {
    defaultValue: null,
    validation: { enum: [] }, // populated from options
    required: ['options']
  },
  [BASE_PROPERTY_TYPES.MULTI_SELECT]: {
    defaultValue: [],
    validation: { type: 'array', items: { type: 'string' } },
    required: ['options']
  },
  [BASE_PROPERTY_TYPES.FILE]: {
    defaultValue: null,
    validation: { type: 'string', format: 'path' }
  },
  [BASE_PROPERTY_TYPES.URL]: {
    defaultValue: '',
    validation: { type: 'string', format: 'uri' }
  },
  [BASE_PROPERTY_TYPES.EMAIL]: {
    defaultValue: '',
    validation: { type: 'string', format: 'email' }
  },
  [BASE_PROPERTY_TYPES.PHONE]: {
    defaultValue: '',
    validation: { type: 'string', pattern: '^[+]?[0-9\\s\\-\\(\\)]+$' }
  },
  [BASE_PROPERTY_TYPES.RATING]: {
    defaultValue: 0,
    validation: { type: 'number', minimum: 0, maximum: 5 },
    required: ['min', 'max']
  },
  [BASE_PROPERTY_TYPES.FORMULA]: {
    defaultValue: null,
    validation: { computed: true },
    required: ['formula']
  },
  [BASE_PROPERTY_TYPES.ROLLUP]: {
    defaultValue: null,
    validation: { computed: true },
    required: ['relation', 'property']
  },
  [BASE_PROPERTY_TYPES.RELATION]: {
    defaultValue: null,
    validation: { type: 'string' },
    required: ['relation']
  }
}

export default {
  BASE_PROPERTY_TYPES,
  FILTER_OPERATORS,
  SORT_DIRECTIONS,
  VIEW_TYPES,
  CHART_TYPES,
  FORMULA_FUNCTIONS,
  BASE_FILE_SCHEMA,
  BASE_ENTRY_SCHEMA,
  FORMULA_VALIDATION_RULES,
  DEFAULT_BASE_TEMPLATE,
  PROPERTY_TYPE_CONFIGS
}