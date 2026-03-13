/**
 * ExpressionEngine.js
 *
 * Wraps math.js to provide expression parsing, compilation, and evaluation
 * for a Desmos-like mathematical graphing system. Bridges user-typed math
 * expressions to evaluable JavaScript functions that JSXGraph can consume.
 *
 * Supported expression forms:
 *   Explicit:    y = sin(x)   |  f(x)   |  x = f(y)
 *   Implicit:    x^2 + y^2 = 1
 *   Parametric:  (cos(t), sin(t))
 *   Polar:       r = 1 + cos(θ)
 *   Point:       (2, 3)
 *   Constant:    a = 5
 */

import { create, all } from 'mathjs';

// ---------------------------------------------------------------------------
// Math.js instance
// ---------------------------------------------------------------------------

const math = create(all, {
  number: 'number',
  precision: 64,
});

// Add Unicode symbol aliases that math.js does not define by default.
// tau, pi, e are already present — only add the Unicode variants.
math.import(
  {
    π: Math.PI,
    τ: 2 * Math.PI,
  },
  // override: false — silently skip if they already exist in a future version
  { override: false, silent: true }
);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Maximum safe value before we consider a result "blown up". */
const MAX_VALUE = 1e15;

/**
 * Guard a raw evaluation result so JSXGraph never receives ±Infinity or NaN
 * from arithmetic errors — it returns NaN instead, which JSXGraph skips.
 *
 * @param {*} raw - Value returned from math.js evaluation
 * @returns {number}
 */
function guardNumber(raw) {
  if (raw === null || raw === undefined) return NaN;

  // math.js can return a Complex number for things like sqrt(-1)
  if (typeof raw === 'object' && 'im' in raw) {
    // Only accept purely real results
    if (raw.im !== 0) return NaN;
    raw = raw.re;
  }

  const n = Number(raw);
  if (!isFinite(n) || isNaN(n)) return NaN;
  if (n > MAX_VALUE) return MAX_VALUE;
  if (n < -MAX_VALUE) return -MAX_VALUE;
  return n;
}

// ---------------------------------------------------------------------------
// Regex patterns used across parsing/detection
// ---------------------------------------------------------------------------

/**
 * Parse a string of the form "(expr1, expr2)" where expr1/expr2 may contain
 * nested parentheses. Finds the top-level comma that separates the two parts.
 *
 * Returns null if the string doesn't match the outer (…,…) shape.
 * Returns { left, right } on success.
 *
 * @param {string} s - Normalized/trimmed string
 * @returns {{ left: string, right: string } | null}
 */
function parseParenPair(s) {
  const trimmed = s.trim();
  if (trimmed[0] !== '(' || trimmed[trimmed.length - 1] !== ')') return null;

  // Strip the outer parens
  const inner = trimmed.slice(1, trimmed.length - 1);

  // Find the top-level comma (depth === 0 means we are not inside nested parens)
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      return {
        left: inner.slice(0, i).trim(),
        right: inner.slice(i + 1).trim(),
      };
    }
  }
  return null;
}

/** Simple check: does the string start with '(' and end with ')'? */
const RE_OUTER_PARENS = /^\s*\(.*\)\s*$/s;

/** Matches explicit form where LHS is exactly `y` or `x`. */
const RE_EXPLICIT_Y = /^\s*y\s*=/i;
const RE_EXPLICIT_X = /^\s*x\s*=/i;

/** Matches polar form: r = ... */
const RE_POLAR = /^\s*r\s*=/i;

/** Matches a constant assignment: identifier = number */
const RE_CONSTANT_ASSIGN = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/;

/** Standard graphing variables — not considered user parameters. */
const GRAPH_VARIABLES = new Set(['x', 'y', 'z', 't', 'θ', 'theta', 'r', 'i', 'e', 'pi', 'π', 'tau', 'τ', 'inf', 'Inf', 'Infinity']);

/** mathjs built-in function names (subset) — not user parameters. */
const BUILTIN_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'sqrt', 'cbrt', 'abs', 'sign', 'floor', 'ceil', 'round',
  'log', 'log2', 'log10', 'exp', 'pow',
  'min', 'max', 'mod', 'factorial', 'nthRoot',
  're', 'im', 'arg', 'conj',
]);

/**
 * Normalize common Unicode math symbols and shorthand so math.js can parse.
 *
 * @param {string} str
 * @returns {string}
 */
function normalizeExpr(str) {
  return str
    .replace(/π/g, 'pi')
    .replace(/θ/g, 'theta')
    .replace(/τ/g, 'tau')
    .replace(/\^/g, '^')        // already valid in mathjs, kept for clarity
    .replace(/÷/g, '/')
    .replace(/×/g, '*')
    .replace(/−/g, '-')         // Unicode minus
    .replace(/\u2212/g, '-')    // U+2212 MINUS SIGN
    .trim();
}

/**
 * Walk a math.js parse tree and collect all SymbolNode names that are not
 * built-in functions, operators, or graph variables.
 *
 * @param {import('mathjs').MathNode} node
 * @param {Set<string>} out
 */
function collectSymbols(node, out) {
  if (!node) return;

  if (node.type === 'SymbolNode') {
    const name = node.name;
    if (!GRAPH_VARIABLES.has(name) && !BUILTIN_FUNCTIONS.has(name)) {
      out.add(name);
    }
    return;
  }

  // FunctionNode: skip the function name itself, visit args
  if (node.type === 'FunctionNode') {
    // node.name is the function name — skip it, descend into args
    if (node.args) node.args.forEach(arg => collectSymbols(arg, out));
    return;
  }

  // Recurse into all child nodes generically
  if (node.forEach) {
    node.forEach(child => collectSymbols(child, out));
  }
}

// ---------------------------------------------------------------------------
// ExpressionEngine
// ---------------------------------------------------------------------------

export class ExpressionEngine {
  constructor() {
    // Cache compiled math.js nodes to avoid re-parsing the same string
    this._compileCache = new Map();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Parse and compile an expression string for evaluation.
   *
   * @param {string} expressionStr - Raw user input (e.g. "sin(x)", "x^2 + y^2 = 1")
   * @returns {{
   *   fn: import('mathjs').EvalFunction | null,
   *   variables: Set<string>,
   *   type: string,
   *   error: string | null,
   *   _parsed: object | null
   * }}
   */
  compile(expressionStr) {
    const cacheKey = expressionStr;
    if (this._compileCache.has(cacheKey)) {
      return this._compileCache.get(cacheKey);
    }

    const result = this._compileInternal(expressionStr);
    // Cap cache size to prevent unbounded growth across many expressions
    if (this._compileCache.size >= 512) {
      const firstKey = this._compileCache.keys().next().value;
      this._compileCache.delete(firstKey);
    }
    this._compileCache.set(cacheKey, result);
    return result;
  }

  /**
   * Evaluate a compiled expression with given variable values.
   *
   * @param {{ fn: import('mathjs').EvalFunction, type: string, _parsed: object }} compiled
   * @param {Record<string, number>} scope
   * @returns {number}
   */
  evaluate(compiled, scope = {}) {
    if (!compiled || !compiled.fn || compiled.error) return NaN;

    // Alias theta <-> θ so callers can use either
    const fullScope = { ...scope };
    if ('theta' in fullScope && !('θ' in fullScope)) fullScope['θ'] = fullScope.theta;
    if ('θ' in fullScope && !('theta' in fullScope)) fullScope.theta = fullScope['θ'];

    try {
      const raw = compiled.fn.evaluate(fullScope);
      return guardNumber(raw);
    } catch {
      return NaN;
    }
  }

  /**
   * Create a function suitable for JSXGraph plotting.
   *
   * - Explicit (y = f(x)):  (x) => number
   * - Explicit (x = f(y)):  (y) => number   (returned under key xOfY)
   * - Implicit F(x,y)=0:    (x, y) => number  (0 on the curve)
   * - Parametric:           { x: (t) => number, y: (t) => number }
   * - Polar:                (theta) => number
   * - Point:                { x: number, y: number }
   * - Constant:             { name: string, value: number }
   *
   * @param {{ fn: *, type: string, _parsed: object, error: string|null }} compiled
   * @param {Record<string, number>} variableValues - Values for slider/parameter variables
   * @returns {Function | { x: Function, y: Function } | { x: number, y: number } | { name: string, value: number } | null}
   */
  createPlotFunction(compiled, variableValues = {}) {
    if (!compiled || compiled.error) return null;

    const { type, _parsed } = compiled;

    switch (type) {
      case 'explicit': {
        if (_parsed.solveFor === 'y') {
          // y = f(x): standard function graph
          const rhsCompiled = _parsed.rhsCompiled;
          return (x) => {
            try {
              return guardNumber(rhsCompiled.evaluate({ ...variableValues, x }));
            } catch {
              return NaN;
            }
          };
        } else {
          // x = f(y): sideways function
          const rhsCompiled = _parsed.rhsCompiled;
          const fn = (y) => {
            try {
              return guardNumber(rhsCompiled.evaluate({ ...variableValues, y }));
            } catch {
              return NaN;
            }
          };
          fn.xOfY = true;
          return fn;
        }
      }

      case 'implicit': {
        // F(x, y) - G(x, y) = 0 — returns value; JSXGraph contour at 0
        const diffCompiled = _parsed.diffCompiled;
        return (x, y) => {
          try {
            return guardNumber(diffCompiled.evaluate({ ...variableValues, x, y }));
          } catch {
            return NaN;
          }
        };
      }

      case 'parametric': {
        const xCompiled = _parsed.xCompiled;
        const yCompiled = _parsed.yCompiled;
        return {
          x: (t) => {
            try {
              return guardNumber(xCompiled.evaluate({ ...variableValues, t }));
            } catch {
              return NaN;
            }
          },
          y: (t) => {
            try {
              return guardNumber(yCompiled.evaluate({ ...variableValues, t }));
            } catch {
              return NaN;
            }
          },
        };
      }

      case 'polar': {
        const rhsCompiled = _parsed.rhsCompiled;
        return (theta) => {
          try {
            return guardNumber(rhsCompiled.evaluate({ ...variableValues, theta, θ: theta }));
          } catch {
            return NaN;
          }
        };
      }

      case 'point': {
        return { x: _parsed.x, y: _parsed.y };
      }

      case 'constant': {
        return { name: _parsed.name, value: _parsed.value };
      }

      case 'surface3d': {
        // z = f(x, y) → returns (x, y) => z
        const rhsCompiled = _parsed.rhsCompiled;
        return (x, y) => {
          try {
            return guardNumber(rhsCompiled.evaluate({ ...variableValues, x, y }));
          } catch {
            return NaN;
          }
        };
      }

      default:
        return null;
    }
  }

  /**
   * Detect the expression type from raw string.
   *
   * @param {string} expressionStr
   * @returns {'explicit' | 'implicit' | 'parametric' | 'polar' | 'point' | 'constant' | 'unknown'}
   */
  detectType(expressionStr) {
    const s = expressionStr.trim();
    return this._detectType(s);
  }

  /**
   * Parse an expression string into a normalized structural form.
   *
   * @param {string} expressionStr
   * @returns {object | null}
   */
  parseExpression(expressionStr) {
    const s = expressionStr.trim();
    const type = this._detectType(s);

    switch (type) {
      case 'parametric': {
        const pair = parseParenPair(normalizeExpr(s));
        if (!pair) return null;
        return { x: pair.left, y: pair.right, param: 't' };
      }

      case 'polar': {
        const eqIdx = s.indexOf('=');
        return { lhs: s.slice(0, eqIdx).trim(), rhs: s.slice(eqIdx + 1).trim() };
      }

      case 'point': {
        const pair = parseParenPair(normalizeExpr(s));
        if (!pair) return null;
        return { x: parseFloat(pair.left), y: parseFloat(pair.right) };
      }

      case 'constant': {
        const m = RE_CONSTANT_ASSIGN.exec(s);
        if (!m) return null;
        return { lhs: m[1].trim(), rhs: m[2].trim() };
      }

      case 'explicit':
      case 'implicit':
      case 'unknown':
      default: {
        const eqIdx = s.indexOf('=');
        if (eqIdx === -1) {
          // Bare expression treated as y = expr
          return { lhs: 'y', rhs: s };
        }
        return { lhs: s.slice(0, eqIdx).trim(), rhs: s.slice(eqIdx + 1).trim() };
      }
    }
  }

  /**
   * Get free (user-defined parameter/slider) variables in an expression,
   * excluding standard graph variables and math built-ins.
   *
   * @param {string} expressionStr
   * @returns {string[]}
   */
  getParameters(expressionStr) {
    try {
      const normalized = normalizeExpr(expressionStr);
      const found = new Set();

      // For parametric (expr, expr), analyse both sub-expressions individually
      if (RE_OUTER_PARENS.test(normalized)) {
        const pair = parseParenPair(normalized);
        if (pair) {
          collectSymbols(math.parse(pair.left), found);
          collectSymbols(math.parse(pair.right), found);
          found.delete('t');
          return Array.from(found).sort();
        }
      }

      // Strip the LHS assignment to focus on the RHS body
      const body = normalized.includes('=')
        ? normalized.slice(normalized.indexOf('=') + 1).trim()
        : normalized;

      collectSymbols(math.parse(body), found);
      return Array.from(found).sort();
    } catch {
      return [];
    }
  }

  /**
   * Validate an expression string.
   *
   * @param {string} expressionStr
   * @returns {{ valid: boolean, error: string | null }}
   */
  validate(expressionStr) {
    if (!expressionStr || !expressionStr.trim()) {
      return { valid: false, error: 'Expression is empty' };
    }

    const compiled = this.compile(expressionStr);
    if (compiled.error) {
      return { valid: false, error: compiled.error };
    }
    return { valid: true, error: null };
  }

  // -------------------------------------------------------------------------
  // Internal implementation
  // -------------------------------------------------------------------------

  /**
   * Internal compile — builds the `fn` and `_parsed` structures.
   *
   * @param {string} expressionStr
   * @returns {object}
   */
  _compileInternal(expressionStr) {
    const raw = expressionStr.trim();

    if (!raw) {
      return { fn: null, variables: new Set(), type: 'unknown', error: 'Empty expression', _parsed: null };
    }

    const type = this._detectType(raw);

    try {
      switch (type) {
        case 'parametric':
          return this._compileParametric(raw);
        case 'polar':
          return this._compilePolar(raw);
        case 'point':
          return this._compilePoint(raw);
        case 'constant':
          return this._compileConstant(raw);
        case 'explicit':
          return this._compileExplicit(raw);
        case 'implicit':
          return this._compileImplicit(raw);
        case 'surface3d':
          return this._compileSurface3d(raw);
        default:
          // Treat bare expression as y = expr
          return this._compileExplicit(raw);
      }
    } catch (err) {
      return {
        fn: null,
        variables: new Set(),
        type,
        error: this._friendlyError(err),
        _parsed: null,
      };
    }
  }

  /**
   * Determine expression type from its string form.
   *
   * @param {string} s - Already trimmed
   * @returns {string}
   */
  _detectType(s) {
    const normalized = normalizeExpr(s);

    // Parametric / point: (expr, expr) — detect before splitting on =
    if (RE_OUTER_PARENS.test(normalized)) {
      const pair = parseParenPair(normalized);
      if (pair) {
        if (this._isNumericLiteral(pair.left) && this._isNumericLiteral(pair.right)) {
          return 'point';
        }
        return 'parametric';
      }
    }

    // Polar: r = f(θ)
    if (RE_POLAR.test(normalized)) {
      return 'polar';
    }

    const eqIdx = normalized.indexOf('=');

    if (eqIdx === -1) {
      // No equals sign — bare expression, treat as y = expr
      return 'explicit';
    }

    const lhs = normalized.slice(0, eqIdx).trim();
    const rhs = normalized.slice(eqIdx + 1).trim();

    // Explicit: y = f(x)
    if (lhs === 'y') return 'explicit';
    // x = ... expressions
    if (lhs === 'x') {
      // If RHS contains x, it's an equation like x = x^2 → implicit
      if (/\bx\b/.test(rhs)) return 'implicit';
      // Otherwise x = f(y) or x = constant (vertical line)
      return 'explicit';
    }
    // Surface: z = f(x, y) → 3D surface
    if (lhs === 'z') {
      return 'surface3d';
    }

    // Constant: single identifier = expression with no graph vars
    const lhsIsIdentifier = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(lhs);
    if (lhsIsIdentifier && !GRAPH_VARIABLES.has(lhs)) {
      return 'constant';
    }

    // Implicit: equation involving both x and y on same side, or multi-var LHS
    const hasX = /\bx\b/.test(lhs) || /\bx\b/.test(rhs);
    const hasY = /\by\b/.test(lhs) || /\by\b/.test(rhs);
    if (hasX && hasY) return 'implicit';

    // Fall-through: treat as implicit (catches edge cases)
    return 'implicit';
  }

  /**
   * True when the string is a plain numeric literal (possibly negative).
   *
   * @param {string} s
   * @returns {boolean}
   */
  _isNumericLiteral(s) {
    return /^-?\s*\d+(\.\d+)?$/.test(s.trim());
  }

  // -- Specific compilers ----------------------------------------------------

  /**
   * @param {string} raw
   * @returns {object}
   */
  _compileParametric(raw) {
    const normalized = normalizeExpr(raw);
    const pair = parseParenPair(normalized);
    if (!pair) throw new Error('Invalid parametric form — expected (f(t), g(t))');

    const xExpr = pair.left;
    const yExpr = pair.right;

    const xNode = math.parse(xExpr);
    const yNode = math.parse(yExpr);
    const xCompiled = xNode.compile();
    const yCompiled = yNode.compile();

    const variables = new Set();
    collectSymbols(xNode, variables);
    collectSymbols(yNode, variables);
    // 't' is the parameter, not a user variable
    variables.delete('t');

    // The `fn` for parametric is a scope evaluator returning { x, y }
    const fn = {
      evaluate(scope) {
        return {
          x: xCompiled.evaluate(scope),
          y: yCompiled.evaluate(scope),
        };
      },
    };

    return {
      fn,
      variables,
      type: 'parametric',
      error: null,
      _parsed: { xExpr, yExpr, xCompiled, yCompiled },
    };
  }

  /**
   * @param {string} raw
   * @returns {object}
   */
  _compilePolar(raw) {
    const normalized = normalizeExpr(raw);
    const eqIdx = normalized.indexOf('=');
    if (eqIdx === -1) throw new Error('Polar expression must contain "="');

    const rhsStr = normalized.slice(eqIdx + 1).trim();
    const rhsNode = math.parse(rhsStr);
    const rhsCompiled = rhsNode.compile();

    const variables = new Set();
    collectSymbols(rhsNode, variables);
    variables.delete('theta');
    variables.delete('t');

    const fn = {
      evaluate(scope) {
        return rhsCompiled.evaluate(scope);
      },
    };

    return {
      fn,
      variables,
      type: 'polar',
      error: null,
      _parsed: { rhsStr, rhsCompiled },
    };
  }

  /**
   * @param {string} raw
   * @returns {object}
   */
  _compilePoint(raw) {
    const normalized = normalizeExpr(raw);
    const pair = parseParenPair(normalized);
    if (!pair) throw new Error('Invalid point form — expected (a, b)');

    const xVal = guardNumber(math.evaluate(pair.left));
    const yVal = guardNumber(math.evaluate(pair.right));

    if (isNaN(xVal) || isNaN(yVal)) throw new Error('Point coordinates must be numeric');

    return {
      fn: { evaluate: () => ({ x: xVal, y: yVal }) },
      variables: new Set(),
      type: 'point',
      error: null,
      _parsed: { x: xVal, y: yVal },
    };
  }

  /**
   * @param {string} raw
   * @returns {object}
   */
  _compileConstant(raw) {
    const normalized = normalizeExpr(raw);
    const m = RE_CONSTANT_ASSIGN.exec(normalized);
    if (!m) throw new Error('Invalid constant form — expected "name = value"');

    const name = m[1].trim();
    const rhsStr = m[2].trim();

    const rhsNode = math.parse(rhsStr);
    const rhsCompiled = rhsNode.compile();

    // Evaluate immediately if possible (no free vars)
    let value = NaN;
    try {
      value = guardNumber(rhsCompiled.evaluate({}));
    } catch {
      // Value depends on other constants — leave as NaN until scope is provided
    }

    const variables = new Set();
    collectSymbols(rhsNode, variables);

    return {
      fn: { evaluate: (scope) => rhsCompiled.evaluate(scope) },
      variables,
      type: 'constant',
      error: null,
      _parsed: { name, rhsStr, rhsCompiled, value },
    };
  }

  /**
   * @param {string} raw
   * @returns {object}
   */
  _compileExplicit(raw) {
    const normalized = normalizeExpr(raw);
    const eqIdx = normalized.indexOf('=');

    let rhsStr;
    let solveFor = 'y'; // default: solve for y given x

    if (eqIdx === -1) {
      // Bare expression → y = expr
      rhsStr = normalized;
    } else {
      const lhs = normalized.slice(0, eqIdx).trim();
      rhsStr = normalized.slice(eqIdx + 1).trim();

      if (lhs === 'x') {
        solveFor = 'x'; // x = f(y)
      } else if (lhs !== 'y') {
        // Unusual LHS — try to rearrange: lhs - rhs = 0 evaluated for y
        // Treat as implicit if both vars present
        if (/\bx\b/.test(lhs) || /\by\b/.test(lhs)) {
          return this._compileImplicit(raw);
        }
        // Otherwise treat RHS as the expression for y
      }
    }

    const rhsNode = math.parse(rhsStr);
    const rhsCompiled = rhsNode.compile();

    const variables = new Set();
    collectSymbols(rhsNode, variables);
    variables.delete('x');
    variables.delete('y');

    const fn = {
      evaluate(scope) {
        return rhsCompiled.evaluate(scope);
      },
    };

    return {
      fn,
      variables,
      type: 'explicit',
      error: null,
      _parsed: { rhsStr, rhsCompiled, solveFor },
    };
  }

  /**
   * @param {string} raw
   * @returns {object}
   */
  _compileImplicit(raw) {
    const normalized = normalizeExpr(raw);
    const eqIdx = normalized.indexOf('=');

    let lhsStr, rhsStr;

    if (eqIdx === -1) {
      // No equals — treat as F(x,y) = 0
      lhsStr = normalized;
      rhsStr = '0';
    } else {
      lhsStr = normalized.slice(0, eqIdx).trim();
      rhsStr = normalized.slice(eqIdx + 1).trim();
    }

    // Build: lhs - rhs (so curve is where this equals 0)
    const diffExpr = `(${lhsStr}) - (${rhsStr})`;
    const diffNode = math.parse(diffExpr);
    const diffCompiled = diffNode.compile();

    const variables = new Set();
    collectSymbols(diffNode, variables);
    variables.delete('x');
    variables.delete('y');

    const fn = {
      evaluate(scope) {
        return diffCompiled.evaluate(scope);
      },
    };

    return {
      fn,
      variables,
      type: 'implicit',
      error: null,
      _parsed: { lhsStr, rhsStr, diffExpr, diffCompiled },
    };
  }

  /**
   * @param {string} raw
   * @returns {object}
   */
  _compileSurface3d(raw) {
    const normalized = normalizeExpr(raw);
    const eqIdx = normalized.indexOf('=');
    if (eqIdx === -1) throw new Error('Surface expression must contain "="');

    const rhsStr = normalized.slice(eqIdx + 1).trim();
    const rhsNode = math.parse(rhsStr);
    const rhsCompiled = rhsNode.compile();

    const variables = new Set();
    collectSymbols(rhsNode, variables);
    variables.delete('x');
    variables.delete('y');
    variables.delete('z');

    const fn = {
      evaluate(scope) {
        return rhsCompiled.evaluate(scope);
      },
    };

    return {
      fn,
      variables,
      type: 'surface3d',
      error: null,
      _parsed: { rhsStr, rhsCompiled },
    };
  }

  /**
   * Convert math.js parse errors into user-friendly messages.
   *
   * @param {Error} err
   * @returns {string}
   */
  _friendlyError(err) {
    const msg = err.message || String(err);

    if (msg.includes('Unexpected end of expression')) {
      return 'Incomplete expression';
    }
    if (msg.includes('Value expected')) {
      return 'Missing value or operand';
    }
    if (msg.includes('Parenthesis ) expected')) {
      return 'Missing closing parenthesis';
    }
    if (msg.includes('Parenthesis ( expected')) {
      return 'Missing opening parenthesis';
    }
    if (msg.includes('undefined symbol')) {
      const sym = msg.match(/undefined symbol\s+(\S+)/)?.[1];
      return sym ? `Unknown symbol: ${sym}` : 'Unknown symbol in expression';
    }
    if (msg.includes('Too many arguments')) {
      return 'Too many arguments to function';
    }

    // Strip internal math.js stack info for cleanliness
    return msg.split('\n')[0];
  }
}

// ---------------------------------------------------------------------------
// Default export (singleton for app-wide use) + named export for testing
// ---------------------------------------------------------------------------

export default new ExpressionEngine();
