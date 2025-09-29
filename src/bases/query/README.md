# Lokus Bases Query Engine

A powerful and flexible query engine for filtering, sorting, and processing note collections in Lokus Bases. Inspired by Obsidian Dataview with enhanced capabilities for complex queries and formula evaluation.

## Features

### 🔍 Advanced Filtering
- **Comparison Operators**: `==`, `!=`, `>`, `<`, `>=`, `<=`
- **Text Operators**: `contains`, `startsWith`
- **Logical Operators**: `AND`, `OR`, `NOT`
- **Built-in Functions**: `taggedWith()`, `inFolder()`, `hasLink()`, `linksTo()`
- **Custom Functions**: Register your own filter functions

### 🧮 Formula Engine
- **String Operations**: `concat()`, `substring()`, `length()`, `upper()`, `lower()`
- **Math Operations**: `+`, `-`, `*`, `/`, `sum()`, `avg()`, `count()`, `round()`, `abs()`, `min()`, `max()`
- **Date Operations**: `now()`, `days()`, `months()`, `formatDate()`, `daysBetween()`
- **Variable Support**: Access context variables and file properties

### 📊 Query Capabilities
- **Sorting**: Multi-level sorting with direction and type control
- **Grouping**: Group results by properties
- **Pagination**: Limit and offset support for large datasets
- **Context Variables**: Support for `this` and custom context
- **Performance Optimization**: Query caching and execution optimization

## Quick Start

```javascript
import { createQueryEngine } from './src/bases/query/index.js';

// Create query engine instance
const queryEngine = createQueryEngine();

// Execute a simple query
const result = await queryEngine.execute({
  filter: 'taggedWith(file, "important") AND NOT isEmpty(file)',
  sort: [{ property: 'modified', direction: 'desc' }],
  limit: 10
}, noteCollection);

console.log(`Found ${result.items.length} important notes`);
```

## Query Syntax

### Basic Filtering

```javascript
// Tag filtering
taggedWith(file, "work")
hasAnyTag(file, ["urgent", "important"])
hasAllTags(file, ["work", "project"])

// Content filtering
hasContent(file, "meeting")
isEmpty(file)
wordCount(file) > 100

// Location filtering
inFolder(file, "projects")
hasExtension(file, "md")

// Link filtering
hasLink(file, "Project Plan")
linksTo(file, "[[Important Note]]")

// Date filtering
createdAfter(file, "2024-01-01")
isToday(file, "modified")
isThisWeek(file, "created")

// Size filtering
largerThan(file, 1000)
smallerThan(file, 5000)
```

### Logical Combinations

```javascript
// AND operations
taggedWith(file, "work") AND NOT isEmpty(file)

// OR operations
taggedWith(file, "urgent") OR taggedWith(file, "important")

// Complex combinations
(inFolder(file, "work") OR inFolder(file, "projects")) AND largerThan(file, 500)
```

### Formula Expressions

```javascript
// String operations
concat("Note: ", title)
upper(substring(title, 0, 10))
length(content) > 100

// Math operations
(wordCount(file) + 10) * 2
sum(size, 100, 200)
avg(1, 2, 3, 4, 5)

// Date operations
formatDate(now(), "YYYY-MM-DD")
daysBetween(created, now())
days(7) // Date 7 days from now
```

## API Reference

### QueryEngine

#### `execute(query, collection)`
Execute a query against a note collection.

```javascript
const result = await queryEngine.execute({
  filter: 'taggedWith(file, "work")',
  sort: [{ property: 'title', direction: 'asc' }],
  limit: 20,
  offset: 0,
  context: { currentFolder: 'work' }
}, notes);
```

**Query Options:**
- `filter`: Filter expression string
- `sort`: Array of sort configurations
- `groupBy`: Grouping configuration
- `limit`: Maximum number of results
- `offset`: Number of results to skip
- `context`: Context variables for evaluation

#### `parseFilter(expression)`
Parse a filter expression into AST.

```javascript
const result = queryEngine.parseFilter('taggedWith(file, "work")');
console.log(result.ast);
```

#### `evaluateFormula(expression, context)`
Evaluate a formula expression.

```javascript
const result = queryEngine.evaluateFormula('concat("Hello ", name)', { name: "World" });
// Returns: "Hello World"
```

### Custom Functions

#### Register Filter Function
```javascript
queryEngine.registerFilterFunction('isLongTitle', (file) => {
  return file.title && file.title.length > 20;
});

// Use in queries
const result = await queryEngine.execute({
  filter: 'isLongTitle(file)'
}, notes);
```

#### Register Formula Function
```javascript
queryEngine.registerFormulaFunction('reverse', (str) => {
  return String(str).split('').reverse().join('');
});

// Use in formulas
const result = queryEngine.evaluateFormula('reverse(title)', { title: "Hello" });
// Returns: "olleH"
```

## Built-in Filter Functions

### File Metadata
- `taggedWith(file, tag)` - Check if file has specific tag
- `hasAnyTag(file, tags)` - Check if file has any of the tags
- `hasAllTags(file, tags)` - Check if file has all tags
- `inFolder(file, path)` - Check if file is in folder
- `hasProperty(file, property)` - Check if file has property

### Content Analysis
- `hasContent(file, content)` - Check if file contains content
- `isEmpty(file)` - Check if file is empty
- `wordCount(file)` - Get word count
- `hasLink(file, target)` - Check if file links to target
- `linksTo(file, target)` - Same as hasLink

### Date Functions
- `createdAfter(file, date)` - Check if created after date
- `createdBefore(file, date)` - Check if created before date
- `modifiedAfter(file, date)` - Check if modified after date
- `modifiedBefore(file, date)` - Check if modified before date
- `isToday(file, field)` - Check if date is today
- `isThisWeek(file, field)` - Check if date is this week

### File Properties
- `isMarkdown(file)` - Check if file is markdown
- `hasExtension(file, ext)` - Check file extension
- `largerThan(file, size)` - Check if file is larger than size
- `smallerThan(file, size)` - Check if file is smaller than size

## Built-in Formula Functions

### String Functions
- `concat(...args)` - Concatenate strings
- `substring(str, start, length)` - Extract substring
- `length(str)` - Get string length
- `upper(str)` - Convert to uppercase
- `lower(str)` - Convert to lowercase

### Math Functions
- `sum(...numbers)` - Sum of numbers
- `avg(...numbers)` - Average of numbers
- `count(...args)` - Count non-null values
- `round(num, precision)` - Round number
- `abs(num)` - Absolute value
- `min(...numbers)` - Minimum value
- `max(...numbers)` - Maximum value

### Date Functions
- `now()` - Current date and time
- `days(count)` - Add days to current date
- `months(count)` - Add months to current date
- `formatDate(date, format)` - Format date string
- `daysBetween(date1, date2)` - Days between dates

## Performance

### Optimization Features
- **Query Caching**: Automatic caching of query results
- **Execution Planning**: Optimization suggestions for large collections
- **Index Usage**: Smart indexing for common operations
- **Complexity Analysis**: Performance estimation for queries

### Cache Management
```javascript
// Clear cache
queryEngine.clearCache();

// Get performance stats
const stats = queryEngine.getStats();
console.log(stats);
```

### Configuration Options
```javascript
const queryEngine = createQueryEngine({
  enableCache: true,          // Enable query caching
  enableOptimization: true,   // Enable query optimization
  cacheSize: 100,            // Maximum cache entries
  cacheTtl: 300000,          // Cache TTL in milliseconds
  maxExecutionTime: 30000    // Maximum execution time
});
```

## Examples

See `examples.js` for comprehensive usage examples including:
- Basic filtering and sorting
- Complex logical combinations
- Formula evaluations
- Custom function registration
- Performance testing
- Error handling

## Error Handling

The query engine provides detailed error messages for:
- Invalid syntax in filters and formulas
- Unknown functions or operators
- Type conversion errors
- Execution timeouts
- Invalid query parameters

```javascript
try {
  const result = await queryEngine.execute({
    filter: 'invalid syntax here ('
  }, notes);
} catch (error) {
  console.error('Query failed:', error.message);
}
```

## File Structure

```
/src/bases/query/
├── FilterParser.js     - Parse filter expressions into AST
├── FormulaEngine.js    - Evaluate formula expressions
├── QueryExecutor.js    - Execute queries against collections
├── FilterFunctions.js  - Built-in filter function implementations
├── index.js           - Main exports and factory functions
├── examples.js        - Usage examples and tests
└── README.md          - This documentation
```

## License

Part of the Lokus application. See main project license for details.