/**
 * Formula Engine for Lokus Bases
 * Evaluates formula expressions with support for string, math, and date operations
 */

/**
 * Formula tokenizer for mathematical and string expressions
 */
class FormulaTokenizer {
  constructor(expression) {
    this.expression = expression;
    this.position = 0;
    this.tokens = [];
  }

  tokenize() {
    while (this.position < this.expression.length) {
      this.skipWhitespace();

      if (this.position >= this.expression.length) break;

      const char = this.expression[this.position];

      // Handle operators and symbols
      if ('+-*/(),.'.includes(char)) {
        this.tokenizeSymbol();
      }
      // Handle string literals
      else if (char === '"' || char === "'") {
        this.tokenizeString();
      }
      // Handle numbers
      else if (this.isDigit(char)) {
        this.tokenizeNumber();
      }
      // Handle identifiers and functions
      else if (this.isAlpha(char) || char === '_') {
        this.tokenizeIdentifier();
      }
      else {
        throw new Error(`Unexpected character '${char}' at position ${this.position}`);
      }
    }

    this.tokens.push({ type: 'EOF', value: null });
    return this.tokens;
  }

  skipWhitespace() {
    while (this.position < this.expression.length && /\s/.test(this.expression[this.position])) {
      this.position++;
    }
  }

  isDigit(char) {
    return /\d/.test(char);
  }

  isAlpha(char) {
    return /[a-zA-Z]/.test(char);
  }

  isAlphaNumeric(char) {
    return /[a-zA-Z0-9_]/.test(char);
  }

  tokenizeSymbol() {
    const char = this.expression[this.position];
    this.position++;

    const symbolTypes = {
      '+': 'PLUS',
      '-': 'MINUS',
      '*': 'MULTIPLY',
      '/': 'DIVIDE',
      '(': 'LEFT_PAREN',
      ')': 'RIGHT_PAREN',
      ',': 'COMMA',
      '.': 'DOT'
    };

    this.tokens.push({ type: symbolTypes[char], value: char });
  }

  tokenizeString() {
    const quote = this.expression[this.position];
    this.position++; // Skip opening quote

    let value = '';

    while (this.position < this.expression.length && this.expression[this.position] !== quote) {
      if (this.expression[this.position] === '\\') {
        this.position++;
        if (this.position >= this.expression.length) {
          throw new Error('Unterminated string literal');
        }

        const escaped = this.expression[this.position];
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case "'": value += "'"; break;
          default: value += escaped; break;
        }
      } else {
        value += this.expression[this.position];
      }
      this.position++;
    }

    if (this.position >= this.expression.length) {
      throw new Error('Unterminated string literal');
    }

    this.position++; // Skip closing quote
    this.tokens.push({ type: 'STRING', value });
  }

  tokenizeNumber() {
    let value = '';
    let hasDecimal = false;

    while (this.position < this.expression.length) {
      const char = this.expression[this.position];

      if (this.isDigit(char)) {
        value += char;
        this.position++;
      } else if (char === '.' && !hasDecimal) {
        hasDecimal = true;
        value += char;
        this.position++;
      } else {
        break;
      }
    }

    this.tokens.push({ type: 'NUMBER', value: parseFloat(value) });
  }

  tokenizeIdentifier() {
    let value = '';

    while (this.position < this.expression.length &&
           this.isAlphaNumeric(this.expression[this.position])) {
      value += this.expression[this.position];
      this.position++;
    }

    this.tokens.push({ type: 'IDENTIFIER', value });
  }
}

/**
 * Formula AST Node types
 */
export const FormulaNodeType = {
  BINARY_OP: 'BINARY_OP',
  UNARY_OP: 'UNARY_OP',
  FUNCTION_CALL: 'FUNCTION_CALL',
  PROPERTY_ACCESS: 'PROPERTY_ACCESS',
  IDENTIFIER: 'IDENTIFIER',
  LITERAL: 'LITERAL'
};

/**
 * Formula expression parser using precedence climbing
 */
class FormulaParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.position = 0;
  }

  parse() {
    const ast = this.parseExpression(0);

    if (this.currentToken().type !== 'EOF') {
      throw new Error(`Unexpected token '${this.currentToken().value}' at end of expression`);
    }

    return ast;
  }

  currentToken() {
    if (this.position >= this.tokens.length) {
      return { type: 'EOF', value: null };
    }
    return this.tokens[this.position];
  }

  nextToken() {
    this.position++;
    return this.currentToken();
  }

  expectToken(type) {
    const token = this.currentToken();
    if (token.type !== type) {
      throw new Error(`Expected ${type} but found ${token.type}`);
    }
    this.nextToken();
    return token;
  }

  getOperatorPrecedence(tokenType) {
    const precedence = {
      'PLUS': 1,
      'MINUS': 1,
      'MULTIPLY': 2,
      'DIVIDE': 2
    };
    return precedence[tokenType] || 0;
  }

  parseExpression(minPrecedence) {
    let left = this.parsePrimary();

    while (true) {
      const token = this.currentToken();
      const precedence = this.getOperatorPrecedence(token.type);

      if (precedence < minPrecedence) {
        break;
      }

      const operator = token.value;
      this.nextToken();

      const right = this.parseExpression(precedence + 1);

      left = {
        type: FormulaNodeType.BINARY_OP,
        operator,
        left,
        right
      };
    }

    return left;
  }

  parsePrimary() {
    const token = this.currentToken();

    switch (token.type) {
      case 'LEFT_PAREN':
        this.nextToken();
        const expr = this.parseExpression(0);
        this.expectToken('RIGHT_PAREN');
        return expr;

      case 'MINUS':
        this.nextToken();
        const operand = this.parsePrimary();
        return {
          type: FormulaNodeType.UNARY_OP,
          operator: '-',
          operand
        };

      case 'STRING':
      case 'NUMBER':
        this.nextToken();
        return {
          type: FormulaNodeType.LITERAL,
          value: token.value,
          dataType: token.type.toLowerCase()
        };

      case 'IDENTIFIER':
        return this.parseIdentifierOrFunction();

      default:
        throw new Error(`Unexpected token '${token.value}' in expression`);
    }
  }

  parseIdentifierOrFunction() {
    const identifier = this.expectToken('IDENTIFIER');

    // Check for function call
    if (this.currentToken().type === 'LEFT_PAREN') {
      this.nextToken(); // consume '('

      const args = [];

      if (this.currentToken().type !== 'RIGHT_PAREN') {
        args.push(this.parseExpression(0));

        while (this.currentToken().type === 'COMMA') {
          this.nextToken();
          args.push(this.parseExpression(0));
        }
      }

      this.expectToken('RIGHT_PAREN');

      return {
        type: FormulaNodeType.FUNCTION_CALL,
        name: identifier.value,
        arguments: args
      };
    }

    // Check for property access
    if (this.currentToken().type === 'DOT') {
      this.nextToken(); // consume '.'
      const property = this.expectToken('IDENTIFIER');

      return {
        type: FormulaNodeType.PROPERTY_ACCESS,
        object: {
          type: FormulaNodeType.IDENTIFIER,
          name: identifier.value
        },
        property: property.value
      };
    }

    return {
      type: FormulaNodeType.IDENTIFIER,
      name: identifier.value
    };
  }
}

/**
 * Built-in formula functions
 */
class FormulaBuiltins {
  // String functions
  static concat(...args) {
    return args.map(arg => String(arg ?? '')).join('');
  }

  static substring(str, start, length) {
    str = String(str ?? '');
    start = Math.max(0, Math.floor(start ?? 0));

    if (length === undefined) {
      return str.substring(start);
    }

    length = Math.max(0, Math.floor(length));
    return str.substring(start, start + length);
  }

  static length(str) {
    return String(str ?? '').length;
  }

  static upper(str) {
    return String(str ?? '').toUpperCase();
  }

  static lower(str) {
    return String(str ?? '').toLowerCase();
  }

  // Math functions
  static sum(...args) {
    return args.reduce((acc, val) => acc + (Number(val) || 0), 0);
  }

  static avg(...args) {
    if (args.length === 0) return 0;
    const total = args.reduce((acc, val) => acc + (Number(val) || 0), 0);
    return total / args.length;
  }

  static count(...args) {
    return args.filter(arg => arg != null).length;
  }

  static round(num, precision = 0) {
    const multiplier = Math.pow(10, precision);
    return Math.round((num || 0) * multiplier) / multiplier;
  }

  static abs(num) {
    return Math.abs(num || 0);
  }

  static min(...args) {
    const numbers = args.map(arg => Number(arg) || 0);
    return Math.min(...numbers);
  }

  static max(...args) {
    const numbers = args.map(arg => Number(arg) || 0);
    return Math.max(...numbers);
  }

  // Date functions
  static now() {
    return new Date();
  }

  static days(count) {
    const date = new Date();
    date.setDate(date.getDate() + (count || 0));
    return date;
  }

  static months(count) {
    const date = new Date();
    date.setMonth(date.getMonth() + (count || 0));
    return date;
  }

  static formatDate(date, format = 'YYYY-MM-DD') {
    if (!date) return '';

    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  static daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);

    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      return 0;
    }

    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

/**
 * Main FormulaEngine class
 */
export class FormulaEngine {
  constructor() {
    this.builtins = FormulaBuiltins;
    this.customFunctions = new Map();
    this.variables = new Map();
  }

  /**
   * Evaluate a formula expression
   * @param {string} expression - Formula expression to evaluate
   * @param {Object} context - Context variables and data
   * @returns {*} Result of the evaluation
   */
  evaluate(expression, context = {}) {
    try {
      if (!expression || typeof expression !== 'string') {
        throw new Error('Formula expression must be a non-empty string');
      }

      // Set up context variables
      this.setupContext(context);

      // Parse the expression
      const tokenizer = new FormulaTokenizer(expression.trim());
      const tokens = tokenizer.tokenize();

      const parser = new FormulaParser(tokens);
      const ast = parser.parse();

      // Evaluate the AST
      return this.evaluateNode(ast);

    } catch (error) {
      throw new Error(`Formula evaluation error: ${error.message}`);
    }
  }

  /**
   * Setup context variables for evaluation
   * @param {Object} context - Context data
   */
  setupContext(context) {
    this.variables.clear();

    // Add context variables
    Object.entries(context).forEach(([key, value]) => {
      this.variables.set(key, value);
    });

    // Add special 'this' context if available
    if (context.this) {
      this.variables.set('this', context.this);
    }
  }

  /**
   * Evaluate an AST node
   * @param {Object} node - AST node to evaluate
   * @returns {*} Evaluation result
   */
  evaluateNode(node) {
    if (!node || !node.type) {
      throw new Error('Invalid AST node');
    }

    switch (node.type) {
      case FormulaNodeType.LITERAL:
        return node.value;

      case FormulaNodeType.IDENTIFIER:
        return this.evaluateIdentifier(node.name);

      case FormulaNodeType.PROPERTY_ACCESS:
        return this.evaluatePropertyAccess(node);

      case FormulaNodeType.BINARY_OP:
        return this.evaluateBinaryOperation(node);

      case FormulaNodeType.UNARY_OP:
        return this.evaluateUnaryOperation(node);

      case FormulaNodeType.FUNCTION_CALL:
        return this.evaluateFunctionCall(node);

      default:
        throw new Error(`Unknown AST node type: ${node.type}`);
    }
  }

  evaluateIdentifier(name) {
    if (this.variables.has(name)) {
      return this.variables.get(name);
    }

    throw new Error(`Undefined variable: ${name}`);
  }

  evaluatePropertyAccess(node) {
    const object = this.evaluateNode(node.object);

    if (object == null) {
      return undefined;
    }

    if (typeof object === 'object' && node.property in object) {
      return object[node.property];
    }

    // Handle special cases for different data types
    if (typeof object === 'string' && node.property === 'length') {
      return object.length;
    }

    if (Array.isArray(object) && node.property === 'length') {
      return object.length;
    }

    return undefined;
  }

  evaluateBinaryOperation(node) {
    const left = this.evaluateNode(node.left);
    const right = this.evaluateNode(node.right);

    switch (node.operator) {
      case '+':
        // Handle string concatenation vs numeric addition
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left ?? '') + String(right ?? '');
        }
        return (Number(left) || 0) + (Number(right) || 0);

      case '-':
        return (Number(left) || 0) - (Number(right) || 0);

      case '*':
        return (Number(left) || 0) * (Number(right) || 0);

      case '/':
        const divisor = Number(right) || 0;
        if (divisor === 0) {
          throw new Error('Division by zero');
        }
        return (Number(left) || 0) / divisor;

      default:
        throw new Error(`Unknown binary operator: ${node.operator}`);
    }
  }

  evaluateUnaryOperation(node) {
    const operand = this.evaluateNode(node.operand);

    switch (node.operator) {
      case '-':
        return -(Number(operand) || 0);

      case '+':
        return Number(operand) || 0;

      default:
        throw new Error(`Unknown unary operator: ${node.operator}`);
    }
  }

  evaluateFunctionCall(node) {
    const args = node.arguments.map(arg => this.evaluateNode(arg));

    // Check built-in functions
    const builtinName = node.name;
    if (typeof this.builtins[builtinName] === 'function') {
      return this.builtins[builtinName](...args);
    }

    // Check custom functions
    if (this.customFunctions.has(builtinName)) {
      const fn = this.customFunctions.get(builtinName);
      return fn(...args);
    }

    throw new Error(`Unknown function: ${builtinName}`);
  }

  /**
   * Register a custom function
   * @param {string} name - Function name
   * @param {Function} fn - Function implementation
   * @param {Object} options - Function options
   */
  registerFunction(name, fn, options = {}) {
    if (typeof name !== 'string' || !name) {
      throw new Error('Function name must be a non-empty string');
    }

    if (typeof fn !== 'function') {
      throw new Error('Function must be callable');
    }

    // Don't allow overriding built-ins without explicit permission
    if (typeof this.builtins[name] === 'function' && !options.allowOverride) {
      throw new Error(`Cannot override built-in function '${name}' without allowOverride option`);
    }

    this.customFunctions.set(name, fn);
  }

  /**
   * Unregister a custom function
   * @param {string} name - Function name to remove
   */
  unregisterFunction(name) {
    this.customFunctions.delete(name);
  }

  /**
   * Get list of available functions
   * @returns {Object} Available functions information
   */
  getAvailableFunctions() {
    const builtinNames = Object.getOwnPropertyNames(this.builtins)
      .filter(name => typeof this.builtins[name] === 'function');

    const customNames = Array.from(this.customFunctions.keys());

    return {
      builtins: builtinNames,
      custom: customNames,
      all: [...builtinNames, ...customNames]
    };
  }

  /**
   * Validate a formula expression syntax
   * @param {string} expression - Expression to validate
   * @returns {Object} Validation result
   */
  validate(expression) {
    try {
      const tokenizer = new FormulaTokenizer(expression);
      const tokens = tokenizer.tokenize();

      const parser = new FormulaParser(tokens);
      parser.parse();

      return {
        valid: true,
        error: null
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get formula function documentation
   * @returns {Object} Function documentation
   */
  getFunctionDocs() {
    return {
      string: {
        concat: 'concat(...args) - Concatenate strings',
        substring: 'substring(str, start, length?) - Extract substring',
        length: 'length(str) - Get string length',
        upper: 'upper(str) - Convert to uppercase',
        lower: 'lower(str) - Convert to lowercase'
      },
      math: {
        sum: 'sum(...numbers) - Sum of numbers',
        avg: 'avg(...numbers) - Average of numbers',
        count: 'count(...args) - Count non-null values',
        round: 'round(num, precision?) - Round number',
        abs: 'abs(num) - Absolute value',
        min: 'min(...numbers) - Minimum value',
        max: 'max(...numbers) - Maximum value'
      },
      date: {
        now: 'now() - Current date and time',
        days: 'days(count) - Add days to current date',
        months: 'months(count) - Add months to current date',
        formatDate: 'formatDate(date, format?) - Format date string',
        daysBetween: 'daysBetween(date1, date2) - Days between dates'
      }
    };
  }
}

export default FormulaEngine;