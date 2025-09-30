/**
 * Lokus Bases Query Engine
 * Complete query and formula engine for filtering, sorting, and processing note collections
 */

export { FilterParser, NodeType } from './FilterParser.js';
export { FormulaEngine, FormulaNodeType } from './FormulaEngine.js';
export { QueryExecutor } from './QueryExecutor.js';
// export { FilterFunctions } from './FilterFunctions.js';

/**
 * Create a complete query engine instance with all components
 * @param {Object} options - Configuration options
 * @returns {Object} Configured query engine
 */
export function createQueryEngine(options = {}) {
  const executor = new QueryExecutor(options);

  return {
    // Main query execution
    execute: (query, collection) => executor.execute(query, collection),

    // Component access
    parser: executor.filterParser,
    formula: executor.formulaEngine,
    functions: executor.filterFunctions,
    executor,

    // Utility methods
    parseFilter: (expression) => executor.filterParser.parse(expression),
    evaluateFormula: (expression, context) => executor.formulaEngine.evaluate(expression, context),

    // Configuration
    registerFilterFunction: (name, fn) => executor.registerFilterFunction(name, fn),
    registerFormulaFunction: (name, fn, opts) => executor.registerFormulaFunction(name, fn, opts),

    // Information
    getCapabilities: () => executor.getCapabilities(),
    getStats: () => executor.getStats(),

    // Cache management
    clearCache: () => executor.clearCache()
  };
}

/**
 * Default query engine instance
 */
export const queryEngine = createQueryEngine({
  enableCache: true,
  enableOptimization: true,
  cacheSize: 100,
  cacheTtl: 300000 // 5 minutes
});

export default queryEngine;