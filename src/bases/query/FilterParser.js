/**
 * Filter Parser for Lokus Bases
 * Parses filter expressions from YAML into AST for efficient execution
 */

/**
 * Tokenizes filter expression string into tokens
 */
class FilterTokenizer {
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

      // Handle operators
      if (this.isOperatorStart(char)) {
        this.tokenizeOperator();
      }
      // Handle string literals (quoted)
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
      // Handle parentheses
      else if (char === '(') {
        this.tokens.push({ type: 'LEFT_PAREN', value: '(' });
        this.position++;
      }
      else if (char === ')') {
        this.tokens.push({ type: 'RIGHT_PAREN', value: ')' });
        this.position++;
      }
      // Handle commas
      else if (char === ',') {
        this.tokens.push({ type: 'COMMA', value: ',' });
        this.position++;
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

  isOperatorStart(char) {
    return ['=', '!', '>', '<', '&', '|'].includes(char);
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

  tokenizeOperator() {
    const start = this.position;
    const char = this.expression[this.position];

    switch (char) {
      case '=':
        if (this.peek() === '=') {
          this.position += 2;
          this.tokens.push({ type: 'EQUALS', value: '==' });
        } else {
          this.position++;
          this.tokens.push({ type: 'EQUALS', value: '=' });
        }
        break;

      case '!':
        if (this.peek() === '=') {
          this.position += 2;
          this.tokens.push({ type: 'NOT_EQUALS', value: '!=' });
        } else {
          this.position++;
          this.tokens.push({ type: 'NOT', value: '!' });
        }
        break;

      case '>':
        if (this.peek() === '=') {
          this.position += 2;
          this.tokens.push({ type: 'GREATER_EQUAL', value: '>=' });
        } else {
          this.position++;
          this.tokens.push({ type: 'GREATER', value: '>' });
        }
        break;

      case '<':
        if (this.peek() === '=') {
          this.position += 2;
          this.tokens.push({ type: 'LESS_EQUAL', value: '<=' });
        } else {
          this.position++;
          this.tokens.push({ type: 'LESS', value: '<' });
        }
        break;

      case '&':
        if (this.peek() === '&') {
          this.position += 2;
          this.tokens.push({ type: 'AND', value: '&&' });
        } else {
          throw new Error(`Expected '&&' but found '&' at position ${this.position}`);
        }
        break;

      case '|':
        if (this.peek() === '|') {
          this.position += 2;
          this.tokens.push({ type: 'OR', value: '||' });
        } else {
          throw new Error(`Expected '||' but found '|' at position ${this.position}`);
        }
        break;

      default:
        throw new Error(`Unknown operator '${char}' at position ${this.position}`);
    }
  }

  tokenizeString() {
    const quote = this.expression[this.position];
    this.position++; // Skip opening quote

    let value = '';

    while (this.position < this.expression.length && this.expression[this.position] !== quote) {
      if (this.expression[this.position] === '\\') {
        // Handle escape sequences
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

    while (this.position < this.expression.length &&
           (this.isDigit(this.expression[this.position]) || this.expression[this.position] === '.')) {
      value += this.expression[this.position];
      this.position++;
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

    // Check for reserved keywords
    const keywords = {
      'AND': 'AND',
      'OR': 'OR',
      'NOT': 'NOT',
      'contains': 'CONTAINS',
      'startsWith': 'STARTS_WITH',
      'true': 'BOOLEAN',
      'false': 'BOOLEAN'
    };

    const tokenType = keywords[value] || 'IDENTIFIER';
    const tokenValue = tokenType === 'BOOLEAN' ? (value === 'true') : value;

    this.tokens.push({ type: tokenType, value: tokenValue });
  }

  peek() {
    if (this.position + 1 >= this.expression.length) {
      return null;
    }
    return this.expression[this.position + 1];
  }
}

/**
 * AST Node types
 */
export const NodeType = {
  BINARY_OP: 'BINARY_OP',
  UNARY_OP: 'UNARY_OP',
  FUNCTION_CALL: 'FUNCTION_CALL',
  IDENTIFIER: 'IDENTIFIER',
  LITERAL: 'LITERAL',
  PROPERTY_ACCESS: 'PROPERTY_ACCESS'
};

/**
 * Recursive descent parser for filter expressions
 */
class FilterExpressionParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.position = 0;
  }

  parse() {
    const ast = this.parseOrExpression();

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

  parseOrExpression() {
    let left = this.parseAndExpression();

    while (this.currentToken().type === 'OR') {
      const operator = this.currentToken().value;
      this.nextToken();
      const right = this.parseAndExpression();

      left = {
        type: NodeType.BINARY_OP,
        operator,
        left,
        right
      };
    }

    return left;
  }

  parseAndExpression() {
    let left = this.parseNotExpression();

    while (this.currentToken().type === 'AND') {
      const operator = this.currentToken().value;
      this.nextToken();
      const right = this.parseNotExpression();

      left = {
        type: NodeType.BINARY_OP,
        operator,
        left,
        right
      };
    }

    return left;
  }

  parseNotExpression() {
    if (this.currentToken().type === 'NOT') {
      const operator = this.currentToken().value;
      this.nextToken();
      const operand = this.parseNotExpression();

      return {
        type: NodeType.UNARY_OP,
        operator,
        operand
      };
    }

    return this.parseComparisonExpression();
  }

  parseComparisonExpression() {
    let left = this.parsePrimaryExpression();

    const comparisonOps = ['EQUALS', 'NOT_EQUALS', 'GREATER', 'LESS', 'GREATER_EQUAL', 'LESS_EQUAL', 'CONTAINS', 'STARTS_WITH'];

    if (comparisonOps.includes(this.currentToken().type)) {
      const operator = this.currentToken().value;
      this.nextToken();
      const right = this.parsePrimaryExpression();

      return {
        type: NodeType.BINARY_OP,
        operator,
        left,
        right
      };
    }

    return left;
  }

  parsePrimaryExpression() {
    const token = this.currentToken();

    switch (token.type) {
      case 'LEFT_PAREN':
        this.nextToken();
        const expr = this.parseOrExpression();
        this.expectToken('RIGHT_PAREN');
        return expr;

      case 'STRING':
      case 'NUMBER':
      case 'BOOLEAN':
        this.nextToken();
        return {
          type: NodeType.LITERAL,
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

    // Check if this is a function call
    if (this.currentToken().type === 'LEFT_PAREN') {
      this.nextToken(); // consume '('

      const args = [];

      if (this.currentToken().type !== 'RIGHT_PAREN') {
        args.push(this.parseOrExpression());

        while (this.currentToken().type === 'COMMA') {
          this.nextToken();
          args.push(this.parseOrExpression());
        }
      }

      this.expectToken('RIGHT_PAREN');

      return {
        type: NodeType.FUNCTION_CALL,
        name: identifier.value,
        arguments: args
      };
    }

    // Check if this is property access (e.g., file.title)
    if (this.currentToken().type === 'IDENTIFIER' && this.currentToken().value === '.') {
      // This would need more sophisticated tokenization to handle properly
      // For now, treat as simple identifier
    }

    return {
      type: NodeType.IDENTIFIER,
      name: identifier.value
    };
  }
}

/**
 * Main FilterParser class
 */
export class FilterParser {
  constructor() {
    this.supportedOperators = [
      '==', '!=', '>', '<', '>=', '<=',
      'contains', 'startsWith', 'AND', 'OR', 'NOT'
    ];

    this.supportedFunctions = [
      'taggedWith', 'inFolder', 'hasLink', 'linksTo'
    ];
  }

  /**
   * Parse filter expression string into AST
   * @param {string} expression - Filter expression to parse
   * @returns {Object} AST representation of the filter
   */
  parse(expression) {
    try {
      if (!expression || typeof expression !== 'string') {
        throw new Error('Filter expression must be a non-empty string');
      }

      // Tokenize the expression
      const tokenizer = new FilterTokenizer(expression.trim());
      const tokens = tokenizer.tokenize();

      // Parse tokens into AST
      const parser = new FilterExpressionParser(tokens);
      const ast = parser.parse();

      // Validate the AST
      this.validateAST(ast);

      return {
        success: true,
        ast,
        expression
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        expression
      };
    }
  }

  /**
   * Parse filter from YAML configuration
   * @param {Object} yamlConfig - YAML configuration object
   * @returns {Object} Parsed filter result
   */
  parseFromYAML(yamlConfig) {
    if (!yamlConfig || typeof yamlConfig !== 'object') {
      throw new Error('YAML config must be an object');
    }

    if (!yamlConfig.filter) {
      return {
        success: true,
        ast: null,
        expression: null
      };
    }

    return this.parse(yamlConfig.filter);
  }

  /**
   * Validate AST structure and semantics
   * @param {Object} ast - AST to validate
   */
  validateAST(ast) {
    if (!ast) {
      throw new Error('AST cannot be null');
    }

    this.validateNode(ast);
  }

  validateNode(node) {
    if (!node || !node.type) {
      throw new Error('Invalid AST node: missing type');
    }

    switch (node.type) {
      case NodeType.BINARY_OP:
        if (!node.operator || !node.left || !node.right) {
          throw new Error('Binary operation node must have operator, left, and right properties');
        }

        if (!this.supportedOperators.includes(node.operator) &&
            !['contains', 'startsWith'].includes(node.operator)) {
          throw new Error(`Unsupported operator: ${node.operator}`);
        }

        this.validateNode(node.left);
        this.validateNode(node.right);
        break;

      case NodeType.UNARY_OP:
        if (!node.operator || !node.operand) {
          throw new Error('Unary operation node must have operator and operand properties');
        }

        if (node.operator !== 'NOT' && node.operator !== '!') {
          throw new Error(`Unsupported unary operator: ${node.operator}`);
        }

        this.validateNode(node.operand);
        break;

      case NodeType.FUNCTION_CALL:
        if (!node.name || !Array.isArray(node.arguments)) {
          throw new Error('Function call node must have name and arguments properties');
        }

        if (!this.supportedFunctions.includes(node.name)) {
          throw new Error(`Unsupported function: ${node.name}`);
        }

        // Validate function argument count
        this.validateFunctionArguments(node.name, node.arguments);

        node.arguments.forEach(arg => this.validateNode(arg));
        break;

      case NodeType.IDENTIFIER:
        if (!node.name) {
          throw new Error('Identifier node must have name property');
        }
        break;

      case NodeType.LITERAL:
        if (node.value === undefined) {
          throw new Error('Literal node must have value property');
        }
        break;

      case NodeType.PROPERTY_ACCESS:
        if (!node.object || !node.property) {
          throw new Error('Property access node must have object and property');
        }
        this.validateNode(node.object);
        break;

      default:
        throw new Error(`Unknown AST node type: ${node.type}`);
    }
  }

  validateFunctionArguments(functionName, args) {
    const argCounts = {
      'taggedWith': 2,    // taggedWith(file, tag)
      'inFolder': 2,      // inFolder(file, path)
      'hasLink': 2,       // hasLink(file, target)
      'linksTo': 2        // linksTo(file, target)
    };

    const expectedCount = argCounts[functionName];
    if (expectedCount && args.length !== expectedCount) {
      throw new Error(`Function ${functionName} expects ${expectedCount} arguments, got ${args.length}`);
    }
  }

  /**
   * Get information about supported syntax
   * @returns {Object} Syntax information
   */
  getSyntaxInfo() {
    return {
      operators: this.supportedOperators,
      functions: this.supportedFunctions.map(name => ({
        name,
        description: this.getFunctionDescription(name),
        argumentCount: this.getFunctionArgumentCount(name)
      })),
      examples: [
        'title == "My Note"',
        'tags contains "important"',
        'taggedWith(file, "project") AND inFolder(file, "work")',
        'NOT (status == "done")',
        'created > "2024-01-01" OR modified >= "2024-06-01"'
      ]
    };
  }

  getFunctionDescription(name) {
    const descriptions = {
      'taggedWith': 'Check if file has a specific tag',
      'inFolder': 'Check if file is in a specific folder path',
      'hasLink': 'Check if file contains a link to target',
      'linksTo': 'Check if file links to target (same as hasLink)'
    };
    return descriptions[name] || '';
  }

  getFunctionArgumentCount(name) {
    const counts = {
      'taggedWith': 2,
      'inFolder': 2,
      'hasLink': 2,
      'linksTo': 2
    };
    return counts[name] || 0;
  }
}

export default FilterParser;