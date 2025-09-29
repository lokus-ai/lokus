/**
 * Lokus Bases Query Engine Examples
 * Demonstrates usage and capabilities of the query engine
 */

import { createQueryEngine } from './index.js';

/**
 * Sample data for examples
 */
export const sampleNotes = [
  {
    id: 1,
    title: 'Meeting Notes',
    content: 'Discussed project timeline and [[Project Plan]] requirements',
    tags: ['meetings', 'work', 'important'],
    created: new Date('2024-01-15T10:30:00Z'),
    modified: new Date('2024-01-15T14:20:00Z'),
    path: 'work/meetings/meeting-notes.md',
    size: 1250
  },
  {
    id: 2,
    title: 'Project Plan',
    content: 'Comprehensive project planning document with timeline',
    tags: ['project', 'planning', 'work'],
    created: new Date('2024-01-10T09:15:00Z'),
    modified: new Date('2024-01-20T16:45:00Z'),
    path: 'work/projects/project-plan.md',
    size: 3500
  },
  {
    id: 3,
    title: 'Personal Journal',
    content: 'Today was a good day. Weather was nice.',
    tags: ['personal', 'journal'],
    created: new Date('2024-01-25T20:00:00Z'),
    modified: new Date('2024-01-25T20:30:00Z'),
    path: 'personal/journal/2024-01-25.md',
    size: 580
  },
  {
    id: 4,
    title: 'Research Ideas',
    content: 'Links to [[Project Plan]] and references to studies',
    tags: ['research', 'ideas', 'important'],
    created: new Date('2024-01-20T11:00:00Z'),
    modified: new Date('2024-01-22T09:30:00Z'),
    path: 'research/ideas.md',
    size: 920
  },
  {
    id: 5,
    title: 'Empty Note',
    content: '',
    tags: [],
    created: new Date('2024-01-30T08:00:00Z'),
    modified: new Date('2024-01-30T08:00:00Z'),
    path: 'drafts/empty.md',
    size: 0
  }
];

/**
 * Example usage of the query engine
 */
export async function runExamples() {
  console.log('🚀 Lokus Bases Query Engine Examples\n');

  const queryEngine = createQueryEngine();

  // Basic filtering examples
  console.log('📋 Basic Filtering Examples:');

  // Find notes with specific tags
  let result = await queryEngine.execute({
    filter: 'taggedWith(file, "work")'
  }, sampleNotes);
  console.log(`- Notes tagged "work": ${result.items.length} found`);

  // Find notes in specific folder
  result = await queryEngine.execute({
    filter: 'inFolder(file, "work")'
  }, sampleNotes);
  console.log(`- Notes in "work" folder: ${result.items.length} found`);

  // Find notes with links
  result = await queryEngine.execute({
    filter: 'hasLink(file, "Project Plan")'
  }, sampleNotes);
  console.log(`- Notes linking to "Project Plan": ${result.items.length} found`);

  // Complex filtering with AND/OR
  result = await queryEngine.execute({
    filter: 'taggedWith(file, "important") AND NOT isEmpty(file)'
  }, sampleNotes);
  console.log(`- Important non-empty notes: ${result.items.length} found`);

  // Sorting examples
  console.log('\n📊 Sorting Examples:');

  result = await queryEngine.execute({
    sort: [
      { property: 'modified', direction: 'desc' },
      { property: 'title', direction: 'asc' }
    ]
  }, sampleNotes);
  console.log('- Sorted by modified date (desc) then title (asc)');
  result.items.forEach(item => {
    console.log(`  ${item.title} - ${item.modified.toISOString()}`);
  });

  // Formula examples
  console.log('\n🧮 Formula Examples:');

  // String operations
  let formula = 'concat("Note: ", title)';
  let formulaResult = queryEngine.evaluateFormula(formula, { title: 'Test Note' });
  console.log(`- String concat: ${formulaResult}`);

  // Math operations
  formula = 'sum(size, 100) / 2';
  formulaResult = queryEngine.evaluateFormula(formula, { size: 300 });
  console.log(`- Math calculation: ${formulaResult}`);

  // Date operations
  formula = 'formatDate(now(), "YYYY-MM-DD")';
  formulaResult = queryEngine.evaluateFormula(formula);
  console.log(`- Current date: ${formulaResult}`);

  // Pagination example
  console.log('\n📄 Pagination Example:');

  result = await queryEngine.execute({
    sort: [{ property: 'title', direction: 'asc' }],
    limit: 2,
    offset: 1
  }, sampleNotes);
  console.log(`- Page 2 (limit 2, offset 1): ${result.items.length} items`);
  result.items.forEach(item => console.log(`  ${item.title}`));

  // Advanced filtering example
  console.log('\n🔍 Advanced Filtering Example:');

  result = await queryEngine.execute({
    filter: '(taggedWith(file, "work") OR taggedWith(file, "research")) AND largerThan(file, 500)',
    sort: [{ property: 'size', direction: 'desc' }]
  }, sampleNotes);
  console.log(`- Work/research notes larger than 500 bytes: ${result.items.length} found`);

  // Custom context example
  console.log('\n🎯 Context-Aware Filtering Example:');

  result = await queryEngine.execute({
    filter: 'inFolder(file, currentFolder)',
    context: { currentFolder: 'work' }
  }, sampleNotes);
  console.log(`- Notes in current folder context: ${result.items.length} found`);

  // Performance stats
  console.log('\n📈 Performance Stats:');
  console.log(JSON.stringify(queryEngine.getStats(), null, 2));

  // Available capabilities
  console.log('\n🛠️ Available Capabilities:');
  const capabilities = queryEngine.getCapabilities();
  console.log(`- Filter Functions: ${capabilities.filterFunctions.length}`);
  console.log(`- Formula Functions: ${capabilities.formulaFunctions.all.length}`);
  console.log(`- Features: ${Object.keys(capabilities.features).filter(k => capabilities.features[k]).join(', ')}`);

  return {
    message: 'All examples completed successfully!',
    totalNotes: sampleNotes.length,
    capabilities
  };
}

/**
 * Example of custom function registration
 */
export function customFunctionExample() {
  console.log('\n🔧 Custom Function Example:');

  const queryEngine = createQueryEngine();

  // Register custom filter function
  queryEngine.registerFilterFunction('isLongTitle', (file) => {
    return file && file.title && file.title.length > 10;
  });

  // Register custom formula function
  queryEngine.registerFormulaFunction('titleLength', (title) => {
    return String(title || '').length;
  });

  // Use custom functions
  console.log('Custom functions registered and ready to use!');

  return queryEngine;
}

/**
 * Example query configurations for different use cases
 */
export const queryExamples = {
  // Find all meeting notes
  meetingNotes: {
    filter: 'taggedWith(file, "meetings") OR hasContent(file, "meeting")',
    sort: [{ property: 'modified', direction: 'desc' }]
  },

  // Find recent important notes
  recentImportant: {
    filter: 'taggedWith(file, "important") AND modifiedAfter(file, "2024-01-15")',
    sort: [{ property: 'modified', direction: 'desc' }],
    limit: 10
  },

  // Find empty or short notes
  emptyOrShort: {
    filter: 'isEmpty(file) OR wordCount(file) < 20',
    sort: [{ property: 'wordCount', direction: 'asc', type: 'number' }]
  },

  // Find large notes in work folder
  largeWorkNotes: {
    filter: 'inFolder(file, "work") AND largerThan(file, 2000)',
    sort: [{ property: 'size', direction: 'desc', type: 'number' }]
  },

  // Find notes with multiple tags
  multiTagged: {
    filter: 'hasAnyTag(file, ["important", "urgent", "priority"])',
    groupBy: { property: 'tags' }
  },

  // Find markdown files only
  markdownOnly: {
    filter: 'isMarkdown(file)',
    sort: [{ property: 'path', direction: 'asc' }]
  }
};

/**
 * Test various edge cases and error conditions
 */
export async function testEdgeCases() {
  console.log('\n🧪 Testing Edge Cases:');

  const queryEngine = createQueryEngine();

  try {
    // Invalid filter syntax
    await queryEngine.execute({
      filter: 'invalid syntax here ('
    }, sampleNotes);
  } catch (error) {
    console.log(`✓ Invalid syntax handled: ${error.message}`);
  }

  try {
    // Unknown function
    await queryEngine.execute({
      filter: 'unknownFunction(file)'
    }, sampleNotes);
  } catch (error) {
    console.log(`✓ Unknown function handled: ${error.message}`);
  }

  try {
    // Invalid collection
    await queryEngine.execute({}, 'not an array');
  } catch (error) {
    console.log(`✓ Invalid collection handled: ${error.message}`);
  }

  // Empty filter should return all results
  const result = await queryEngine.execute({}, sampleNotes);
  console.log(`✓ Empty filter returns all: ${result.items.length} items`);

  console.log('Edge case testing completed.');
}

// Export for easy usage
export default {
  runExamples,
  customFunctionExample,
  testEdgeCases,
  queryExamples,
  sampleNotes
};