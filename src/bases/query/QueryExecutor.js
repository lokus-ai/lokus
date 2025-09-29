/**
 * Query Executor for Lokus Bases
 * Executes filters against note collections with sorting, grouping, and pagination
 */

import { FilterParser, NodeType } from './FilterParser.js';
import { FormulaEngine } from './FormulaEngine.js';
import { BaseFilterFunctions } from './FilterFunctions.js';

/**
 * Query result wrapper
 */
class QueryResult {
  constructor(items, totalCount, query) {
    this.items = items;
    this.totalCount = totalCount;
    this.query = query;
    this.executionTime = 0;
    this.fromCache = false;
  }

  /**
   * Get result metadata
   */
  getMetadata() {
    return {
      count: this.items.length,
      totalCount: this.totalCount,
      hasMore: this.items.length < this.totalCount,
      executionTime: this.executionTime,
      fromCache: this.fromCache,
      query: this.query
    };
  }
}

/**
 * Query performance optimizer
 */
class QueryOptimizer {
  constructor() {
    this.indexedProperties = new Set(['title', 'tags', 'created', 'modified', 'path']);
  }

  /**
   * Optimize query execution plan
   * @param {Object} ast - Filter AST
   * @param {Array} collection - Data collection
   * @returns {Object} Optimization suggestions
   */
  optimize(ast, collection) {
    const plan = {
      useIndex: false,
      indexProperty: null,
      estimatedComplexity: 0,
      optimizations: []
    };

    if (!ast) {
      return plan;
    }

    // Analyze AST for indexable operations
    this.analyzeNode(ast, plan);

    // Suggest index usage for large collections
    if (collection.length > 1000 && plan.indexProperty) {
      plan.useIndex = true;
      plan.optimizations.push(`Using index on property: ${plan.indexProperty}`);
    }

    // Estimate complexity
    plan.estimatedComplexity = this.estimateComplexity(ast, collection.length);

    return plan;
  }

  analyzeNode(node, plan) {
    if (!node) return;

    switch (node.type) {
      case NodeType.BINARY_OP:
        if (['==', '!=', '>', '<', '>=', '<='].includes(node.operator)) {
          if (node.left.type === NodeType.IDENTIFIER &&
              this.indexedProperties.has(node.left.name)) {
            plan.indexProperty = node.left.name;
          }
        }
        this.analyzeNode(node.left, plan);
        this.analyzeNode(node.right, plan);
        break;

      case NodeType.UNARY_OP:
        this.analyzeNode(node.operand, plan);
        break;

      case NodeType.FUNCTION_CALL:
        // Function calls are generally more expensive
        plan.estimatedComplexity += 2;
        node.arguments.forEach(arg => this.analyzeNode(arg, plan));
        break;
    }
  }

  estimateComplexity(node, collectionSize) {
    if (!node) return 0;

    let complexity = 1;

    switch (node.type) {
      case NodeType.BINARY_OP:
        complexity = this.estimateComplexity(node.left, collectionSize) +
                    this.estimateComplexity(node.right, collectionSize);
        break;

      case NodeType.UNARY_OP:
        complexity = this.estimateComplexity(node.operand, collectionSize);
        break;

      case NodeType.FUNCTION_CALL:
        complexity = 5; // Functions are more expensive
        break;
    }

    return complexity * Math.log(collectionSize + 1);
  }
}

/**
 * Result cache for query optimization
 */
class QueryCache {
  constructor(maxSize = 100, ttl = 300000) { // 5 minutes TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Generate cache key from query
   */
  generateKey(query) {
    return JSON.stringify({
      filter: query.filter,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset,
      context: query.context
    });
  }

  /**
   * Get cached result
   */
  get(query) {
    const key = this.generateKey(query);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * Set cache entry
   */
  set(query, result) {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    const key = this.generateKey(query);
    this.cache.set(key, {
      result: { ...result, fromCache: true },
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
  }
}

/**
 * Main QueryExecutor class
 */
export class QueryExecutor {
  constructor(options = {}) {
    this.filterParser = new FilterParser();
    this.formulaEngine = new FormulaEngine();
    this.filterFunctions = new BaseFilterFunctions();
    this.optimizer = new QueryOptimizer();
    this.cache = new QueryCache(options.cacheSize, options.cacheTtl);

    this.options = {
      enableCache: options.enableCache !== false,
      enableOptimization: options.enableOptimization !== false,
      maxExecutionTime: options.maxExecutionTime || 30000, // 30 seconds
      ...options
    };
  }

  /**
   * Execute a query against a collection of items
   * @param {Object} query - Query configuration
   * @param {Array} collection - Collection of items to query
   * @returns {QueryResult} Query result
   */
  async execute(query, collection) {
    const startTime = Date.now();

    try {
      // Validate input
      this.validateQuery(query);
      this.validateCollection(collection);

      // Check cache first
      if (this.options.enableCache) {
        const cachedResult = this.cache.get(query);
        if (cachedResult) {
          return cachedResult;
        }
      }

      // Parse filter if provided
      let filterAST = null;
      if (query.filter) {
        const parseResult = this.filterParser.parse(query.filter);
        if (!parseResult.success) {
          throw new Error(`Filter parse error: ${parseResult.error}`);
        }
        filterAST = parseResult.ast;
      }

      // Optimize query execution
      let optimizationPlan = null;
      if (this.options.enableOptimization && filterAST) {
        optimizationPlan = this.optimizer.optimize(filterAST, collection);
      }

      // Execute the query steps
      let results = [...collection]; // Make a copy
      let totalCount = results.length;

      // Apply filters
      if (filterAST) {
        results = await this.applyFilter(results, filterAST, query.context || {});
        totalCount = results.length;
      }

      // Apply sorting
      if (query.sort && query.sort.length > 0) {
        results = this.applySorting(results, query.sort);
      }

      // Apply grouping
      if (query.groupBy) {
        results = this.applyGrouping(results, query.groupBy);
      }

      // Apply pagination
      let paginatedResults = results;
      if (query.limit || query.offset) {
        const offset = Math.max(0, query.offset || 0);
        const limit = query.limit ? Math.max(1, query.limit) : results.length;
        paginatedResults = results.slice(offset, offset + limit);
      }

      // Create result
      const result = new QueryResult(paginatedResults, totalCount, query);
      result.executionTime = Date.now() - startTime;

      // Cache result
      if (this.options.enableCache) {
        this.cache.set(query, result);
      }

      return result;

    } catch (error) {
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  /**
   * Apply filter to collection
   */
  async applyFilter(collection, filterAST, context) {
    const filtered = [];

    for (const item of collection) {
      const itemContext = this.createItemContext(item, context);

      try {
        if (await this.evaluateFilter(filterAST, itemContext)) {
          filtered.push(item);
        }
      } catch (error) {
        // Log error but continue processing other items
        console.warn(`Filter evaluation error for item:`, error.message);
      }
    }

    return filtered;
  }

  /**
   * Evaluate filter AST against an item
   */
  async evaluateFilter(node, context) {
    if (!node) return true;

    switch (node.type) {
      case NodeType.BINARY_OP:
        return await this.evaluateBinaryFilter(node, context);

      case NodeType.UNARY_OP:
        const operandResult = await this.evaluateFilter(node.operand, context);
        return node.operator === 'NOT' || node.operator === '!' ? !operandResult : operandResult;

      case NodeType.FUNCTION_CALL:
        return await this.evaluateFunctionCall(node, context);

      case NodeType.IDENTIFIER:
        return this.getContextValue(node.name, context);

      case NodeType.LITERAL:
        return node.value;

      case NodeType.PROPERTY_ACCESS:
        const obj = this.getContextValue(node.object.name, context);
        return obj && typeof obj === 'object' ? obj[node.property] : undefined;

      default:
        throw new Error(`Unknown filter node type: ${node.type}`);
    }
  }

  async evaluateBinaryFilter(node, context) {
    const left = await this.evaluateFilter(node.left, context);
    const right = await this.evaluateFilter(node.right, context);

    switch (node.operator) {
      case '==':
      case '=':
        return this.compareValues(left, right) === 0;

      case '!=':
        return this.compareValues(left, right) !== 0;

      case '>':
        return this.compareValues(left, right) > 0;

      case '<':
        return this.compareValues(left, right) < 0;

      case '>=':
        return this.compareValues(left, right) >= 0;

      case '<=':
        return this.compareValues(left, right) <= 0;

      case 'contains':
        return String(left || '').toLowerCase().includes(String(right || '').toLowerCase());

      case 'startsWith':
        return String(left || '').toLowerCase().startsWith(String(right || '').toLowerCase());

      case 'AND':
      case '&&':
        return Boolean(left) && Boolean(right);

      case 'OR':
      case '||':
        return Boolean(left) || Boolean(right);

      default:
        throw new Error(`Unknown binary operator: ${node.operator}`);
    }
  }

  async evaluateFunctionCall(node, context) {
    const args = [];
    for (const arg of node.arguments) {
      args.push(await this.evaluateFilter(arg, context));
    }

    // Check if it's a filter function
    const functionName = node.name;
    if (this.filterFunctions.hasFunction(functionName)) {
      return this.filterFunctions.call(functionName, ...args);
    }

    throw new Error(`Unknown filter function: ${functionName}`);
  }

  /**
   * Apply sorting to results
   */
  applySorting(results, sortConfig) {
    return results.sort((a, b) => {
      for (const sort of sortConfig) {
        const { property, direction = 'asc', type = 'auto' } = sort;

        let valueA = this.getPropertyValue(a, property);
        let valueB = this.getPropertyValue(b, property);

        // Handle type conversion
        if (type === 'number') {
          valueA = Number(valueA) || 0;
          valueB = Number(valueB) || 0;
        } else if (type === 'date') {
          valueA = new Date(valueA);
          valueB = new Date(valueB);
        } else if (type === 'string') {
          valueA = String(valueA || '');
          valueB = String(valueB || '');
        }

        const comparison = this.compareValues(valueA, valueB);

        if (comparison !== 0) {
          return direction === 'desc' ? -comparison : comparison;
        }
      }

      return 0;
    });
  }

  /**
   * Apply grouping to results
   */
  applyGrouping(results, groupConfig) {
    if (!groupConfig || !groupConfig.property) {
      return results;
    }

    const groups = new Map();

    for (const item of results) {
      const groupValue = this.getPropertyValue(item, groupConfig.property);
      const key = String(groupValue || 'Ungrouped');

      if (!groups.has(key)) {
        groups.set(key, {
          group: key,
          items: []
        });
      }

      groups.get(key).items.push(item);
    }

    return Array.from(groups.values());
  }

  /**
   * Create item context for evaluation
   */
  createItemContext(item, globalContext = {}) {
    return {
      ...globalContext,
      this: item,
      file: item,
      item: item,
      // Add common properties for easy access
      title: item.title,
      tags: item.tags,
      created: item.created,
      modified: item.modified,
      path: item.path,
      content: item.content
    };
  }

  /**
   * Get context value with fallback
   */
  getContextValue(name, context) {
    if (context.hasOwnProperty(name)) {
      return context[name];
    }

    // Try to get from 'this' object
    if (context.this && typeof context.this === 'object' && context.this.hasOwnProperty(name)) {
      return context.this[name];
    }

    return undefined;
  }

  /**
   * Get property value with dot notation support
   */
  getPropertyValue(obj, property) {
    if (!obj || !property) return undefined;

    // Handle dot notation (e.g., "metadata.tags")
    const parts = property.split('.');
    let value = obj;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Compare two values with type coercion
   */
  compareValues(a, b) {
    // Handle null/undefined
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;

    // Handle dates
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() - b.getTime();
    }

    // Handle numbers
    if (!isNaN(a) && !isNaN(b)) {
      return Number(a) - Number(b);
    }

    // Handle strings (case-insensitive)
    const strA = String(a).toLowerCase();
    const strB = String(b).toLowerCase();

    if (strA < strB) return -1;
    if (strA > strB) return 1;
    return 0;
  }

  /**
   * Validate query object
   */
  validateQuery(query) {
    if (!query || typeof query !== 'object') {
      throw new Error('Query must be an object');
    }

    // Validate sort configuration
    if (query.sort && !Array.isArray(query.sort)) {
      throw new Error('Sort must be an array of sort objects');
    }

    // Validate limit and offset
    if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1)) {
      throw new Error('Limit must be a positive integer');
    }

    if (query.offset !== undefined && (!Number.isInteger(query.offset) || query.offset < 0)) {
      throw new Error('Offset must be a non-negative integer');
    }
  }

  /**
   * Validate collection
   */
  validateCollection(collection) {
    if (!Array.isArray(collection)) {
      throw new Error('Collection must be an array');
    }
  }

  /**
   * Clear query cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get query execution statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.cache.size,
      cacheEnabled: this.options.enableCache,
      optimizationEnabled: this.options.enableOptimization,
      maxExecutionTime: this.options.maxExecutionTime
    };
  }

  /**
   * Register custom filter function
   */
  registerFilterFunction(name, fn) {
    this.filterFunctions.register(name, fn);
  }

  /**
   * Register custom formula function
   */
  registerFormulaFunction(name, fn, options = {}) {
    this.formulaEngine.registerFunction(name, fn, options);
  }

  /**
   * Get available query capabilities
   */
  getCapabilities() {
    return {
      operators: this.filterParser.getSyntaxInfo().operators,
      filterFunctions: this.filterFunctions.getRegisteredFunctions(),
      formulaFunctions: this.formulaEngine.getAvailableFunctions(),
      features: {
        filtering: true,
        sorting: true,
        grouping: true,
        pagination: true,
        caching: this.options.enableCache,
        optimization: this.options.enableOptimization
      }
    };
  }
}

export default QueryExecutor;