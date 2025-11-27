/**
 * Integration Test for Template System
 *
 * Tests all components working together:
 * - Filters (Agent 6)
 * - Conditionals and Loops (Agent 4)
 * - Template Inclusion (Agent 5)
 * - Date Helpers (Agent 3)
 * - Prompts (Agent 2)
 * - Sandbox (Agent 1)
 */

import { IntegratedTemplateProcessor } from './processor-integrated.js';
import { TemplateManager } from './manager.js';
import { exampleTemplates, exampleData } from './examples.js';

/**
 * Test Suite Configuration
 */
const TEST_CONFIG = {
  verbose: true,
  performanceTarget: 100, // ms
  runAllTests: true
};

/**
 * Test Results Tracker
 */
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
  }

  async test(name, fn) {
    const startTime = Date.now();
    try {
      await fn();
      const duration = Date.now() - startTime;
      this.tests.push({ name, status: 'passed', duration });
      this.passed++;
      if (TEST_CONFIG.verbose) {
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.tests.push({ name, status: 'failed', duration, error: error.message });
      this.failed++;
      if (TEST_CONFIG.verbose) {
        console.error(`✗ ${name} (${duration}ms)`);
        console.error(`  Error: ${error.message}`);
      }
    }
  }

  skip(name, reason) {
    this.tests.push({ name, status: 'skipped', reason });
    this.skipped++;
    if (TEST_CONFIG.verbose) {
    }
  }

  summary() {
    const total = this.tests.length;
    const passRate = total > 0 ? ((this.passed / total) * 100).toFixed(1) : 0;

    return {
      total,
      passed: this.passed,
      failed: this.failed,
      skipped: this.skipped,
      passRate: `${passRate}%`,
      tests: this.tests
    };
  }

  print() {
    const summary = this.summary();
    return summary;
  }
}

/**
 * Run all integration tests
 */
export async function runIntegrationTests() {
  const runner = new TestRunner();


  // Test 1: Filter System
  await runner.test('Filters - String filters work correctly', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{name | upper}} {{name | lower}} {{name | capitalize}}';
    const result = await processor.process(template, { name: 'john doe' });

    if (!result.result.includes('JOHN DOE')) throw new Error('upper filter failed');
    if (!result.result.includes('john doe')) throw new Error('lower filter failed');
    if (!result.result.includes('John doe')) throw new Error('capitalize filter failed');
  });

  await runner.test('Filters - Number filters work correctly', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{price | format("$0,0.00")}} {{percent | percentage(1)}}';
    const result = await processor.process(template, { price: 1234.56, percent: 0.8523 });

    if (!result.result.includes('$1,234.56')) throw new Error('format filter failed');
    if (!result.result.includes('85.2%')) throw new Error('percentage filter failed');
  });

  await runner.test('Filters - Array filters work correctly', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{items | join(", ")}} {{items | length}}';
    const result = await processor.process(template, { items: ['a', 'b', 'c'] });

    if (!result.result.includes('a, b, c')) throw new Error('join filter failed');
    if (!result.result.includes('3')) throw new Error('length filter failed');
  });

  await runner.test('Filters - Date filters work correctly', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{date | dateFormat("YYYY-MM-DD")}}';
    const testDate = new Date('2025-01-15');
    const result = await processor.process(template, { date: testDate });

    if (!result.result.includes('2025-01-15')) throw new Error('dateFormat filter failed');
  });

  // Test 2: Conditionals
  await runner.test('Conditionals - Simple if statement', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{#if show}}Visible{{/if}}';
    const result1 = await processor.process(template, { show: true });
    const result2 = await processor.process(template, { show: false });

    if (!result1.result.includes('Visible')) throw new Error('if true failed');
    if (result2.result.includes('Visible')) throw new Error('if false failed');
  });

  await runner.test('Conditionals - If-else statement', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{#if premium}}Premium User{{else}}Free User{{/if}}';
    const result1 = await processor.process(template, { premium: true });
    const result2 = await processor.process(template, { premium: false });

    if (!result1.result.includes('Premium User')) throw new Error('if branch failed');
    if (!result2.result.includes('Free User')) throw new Error('else branch failed');
  });

  await runner.test('Conditionals - If-else if-else statement', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{#if score >= 90}}A{{else if score >= 80}}B{{else if score >= 70}}C{{else}}F{{/if}}';

    const result1 = await processor.process(template, { score: 95 });
    const result2 = await processor.process(template, { score: 85 });
    const result3 = await processor.process(template, { score: 75 });
    const result4 = await processor.process(template, { score: 60 });

    if (!result1.result.includes('A')) throw new Error('first condition failed');
    if (!result2.result.includes('B')) throw new Error('second condition failed');
    if (!result3.result.includes('C')) throw new Error('third condition failed');
    if (!result4.result.includes('F')) throw new Error('else branch failed');
  });

  await runner.test('Conditionals - Comparison operators', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{#if value == 5}}Equal{{/if}} {{#if value != 3}}NotEqual{{/if}} {{#if value > 3}}Greater{{/if}}';
    const result = await processor.process(template, { value: 5 });

    if (!result.result.includes('Equal')) throw new Error('equality failed');
    if (!result.result.includes('NotEqual')) throw new Error('inequality failed');
    if (!result.result.includes('Greater')) throw new Error('greater than failed');
  });

  // Test 3: Loops
  await runner.test('Loops - Simple array iteration', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{#each items}}{{this}}{{/each}}';
    const result = await processor.process(template, { items: ['a', 'b', 'c'] });

    if (!result.result.includes('abc')) throw new Error('array iteration failed');
  });

  await runner.test('Loops - Index access', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{#each items}}{{@index}}: {{this}}\n{{/each}}';
    const result = await processor.process(template, { items: ['a', 'b', 'c'] });

    if (!result.result.includes('0: a')) throw new Error('index 0 failed');
    if (!result.result.includes('1: b')) throw new Error('index 1 failed');
    if (!result.result.includes('2: c')) throw new Error('index 2 failed');
  });

  await runner.test('Loops - First and last markers', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{#each items}}{{#if @first}}First{{/if}}{{#if @last}}Last{{/if}}{{/each}}';
    const result = await processor.process(template, { items: ['a', 'b', 'c'] });

    if (!result.result.includes('First')) throw new Error('first marker failed');
    if (!result.result.includes('Last')) throw new Error('last marker failed');
  });

  await runner.test('Loops - Object iteration', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{#each items}}{{this.name}}: {{this.value}}\n{{/each}}';
    const result = await processor.process(template, {
      items: [
        { name: 'Item1', value: 10 },
        { name: 'Item2', value: 20 }
      ]
    });

    if (!result.result.includes('Item1: 10')) throw new Error('object property access failed');
    if (!result.result.includes('Item2: 20')) throw new Error('object property access failed');
  });

  // Test 4: JavaScript Blocks
  await runner.test('JavaScript - Simple expression', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = 'Result: <% 2 + 2 %>';
    const result = await processor.process(template, {});

    if (!result.result.includes('Result: 4')) throw new Error('JS expression failed');
  });

  await runner.test('JavaScript - Variable access', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '<% x * 2 %>';
    const result = await processor.process(template, { x: 5 });

    if (!result.result.includes('10')) throw new Error('variable access failed');
  });

  await runner.test('JavaScript - Complex calculation', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '<% Math.round(price * (1 + tax)) %>';
    const result = await processor.process(template, { price: 100, tax: 0.15 });

    if (!result.result.includes('115')) throw new Error('complex calculation failed');
  });

  // Test 5: Combined Features
  await runner.test('Combined - Loops with conditionals', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{#each items}}{{#if this.active}}{{this.name}}{{/if}}{{/each}}';
    const result = await processor.process(template, {
      items: [
        { name: 'A', active: true },
        { name: 'B', active: false },
        { name: 'C', active: true }
      ]
    });

    if (!result.result.includes('A')) throw new Error('first active item failed');
    if (result.result.includes('B')) throw new Error('inactive item shown');
    if (!result.result.includes('C')) throw new Error('second active item failed');
  });

  await runner.test('Combined - Loops with filters', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{#each items}}{{this | upper}}, {{/each}}';
    const result = await processor.process(template, { items: ['apple', 'banana'] });

    if (!result.result.includes('APPLE')) throw new Error('filter in loop failed');
    if (!result.result.includes('BANANA')) throw new Error('filter in loop failed');
  });

  await runner.test('Combined - Conditionals with filters', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{#if name}}Hello {{name | capitalize}}!{{/if}}';
    const result = await processor.process(template, { name: 'john' });

    if (!result.result.includes('Hello John!')) throw new Error('conditional with filter failed');
  });

  await runner.test('Combined - All features together', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = `
{{#each items}}
  {{#if this.price > 10}}
    - {{this.name | upper}}: {{this.price | format("$0.00")}}
  {{/if}}
{{/each}}
Total: <% items.filter(i => i.price > 10).reduce((sum, i) => sum + i.price, 0) %>`;

    const result = await processor.process(template, {
      items: [
        { name: 'apple', price: 5 },
        { name: 'banana', price: 15 },
        { name: 'cherry', price: 20 }
      ]
    });

    if (result.result.includes('APPLE')) throw new Error('low price item shown');
    if (!result.result.includes('BANANA')) throw new Error('banana not shown');
    if (!result.result.includes('CHERRY')) throw new Error('cherry not shown');
    if (!result.result.includes('35')) throw new Error('total calculation failed');
  });

  // Test 6: Performance
  await runner.test('Performance - Simple template < 100ms', async () => {
    const processor = new IntegratedTemplateProcessor({ performanceTracking: true });
    const template = '{{name | upper}} - {{date | dateFormat("YYYY-MM-DD")}}';
    const startTime = Date.now();
    await processor.process(template, { name: 'test', date: new Date() });
    const duration = Date.now() - startTime;

    if (duration > TEST_CONFIG.performanceTarget) {
      throw new Error(`Performance too slow: ${duration}ms > ${TEST_CONFIG.performanceTarget}ms`);
    }
  });

  await runner.test('Performance - Complex template < 100ms', async () => {
    const processor = new IntegratedTemplateProcessor({ performanceTracking: true });
    const template = `
{{#each items}}
  {{#if this.active}}
    {{@index + 1}}. {{this.name | capitalize}} - {{this.price | format("$0.00")}}
  {{/if}}
{{/each}}`;

    const startTime = Date.now();
    await processor.process(template, {
      items: Array(20).fill(null).map((_, i) => ({
        name: `item${i}`,
        price: i * 10,
        active: i % 2 === 0
      }))
    });
    const duration = Date.now() - startTime;

    if (duration > TEST_CONFIG.performanceTarget) {
      throw new Error(`Performance too slow: ${duration}ms > ${TEST_CONFIG.performanceTarget}ms`);
    }
  });

  // Test 7: Example Templates
  await runner.test('Examples - Daily Note template', async () => {
    const manager = new TemplateManager();
    await manager.initialize();

    const dailyNote = exampleTemplates.find(t => t.id === 'daily-note');
    await manager.create(dailyNote);

    const result = await manager.process('daily-note', exampleData.dailyNote, {
      enablePrompts: false // Skip prompts in test
    });

    if (!result.result.includes('Daily Note')) throw new Error('template title missing');
    if (!result.result.includes('Great')) throw new Error('mood not processed');
  });

  await runner.test('Examples - Task List template', async () => {
    const manager = new TemplateManager();
    await manager.initialize();

    const taskList = exampleTemplates.find(t => t.id === 'task-list');
    await manager.create(taskList);

    const result = await manager.process('task-list', exampleData.taskList);

    if (!result.result.includes('Task List')) throw new Error('template title missing');
    if (!result.result.includes('Development Tasks')) throw new Error('list name missing');
  });

  // Test 8: Error Handling
  await runner.test('Error Handling - Invalid variable in strict mode', async () => {
    const processor = new IntegratedTemplateProcessor({ strictMode: true });
    const template = '{{nonexistent}}';

    try {
      await processor.process(template, {});
      throw new Error('Should have thrown error');
    } catch (error) {
      if (!error.message.includes('not defined')) {
        throw new Error('Wrong error message');
      }
    }
  });

  await runner.test('Error Handling - Invalid variable in non-strict mode', async () => {
    const processor = new IntegratedTemplateProcessor({ strictMode: false });
    const template = '{{nonexistent}}';
    const result = await processor.process(template, {});

    // Should leave variable as-is
    if (!result.result.includes('{{nonexistent}}')) {
      throw new Error('Should preserve unresolved variable');
    }
  });

  await runner.test('Error Handling - Unclosed conditional', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{#if condition}}Content';

    try {
      await processor.process(template, { condition: true });
      throw new Error('Should have thrown error');
    } catch (error) {
      if (!error.message.includes('Unclosed')) {
        throw new Error('Wrong error type');
      }
    }
  });

  // Test 9: Validation
  await runner.test('Validation - Valid template passes', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{name}} - {{#if active}}Active{{/if}} - {{#each items}}{{this}}{{/each}}';
    const validation = processor.validate(template);

    if (!validation.valid) {
      throw new Error('Valid template marked as invalid');
    }
  });

  await runner.test('Validation - Invalid template detected', async () => {
    const processor = new IntegratedTemplateProcessor();
    const template = '{{#if condition}}{{#each items}}{{/if}}{{/each}}';
    const validation = processor.validate(template);

    if (validation.valid) {
      throw new Error('Invalid template not detected');
    }
  });

  // Test 10: Filter Registration
  await runner.test('Custom Filters - Register and use', async () => {
    const processor = new IntegratedTemplateProcessor();
    processor.registerFilter('double', (value) => Number(value) * 2);

    const template = '{{num | double}}';
    const result = await processor.process(template, { num: 5 });

    if (!result.result.includes('10')) throw new Error('custom filter failed');
  });

  await runner.test('Custom Filters - Override built-in filter', async () => {
    const processor = new IntegratedTemplateProcessor();
    processor.registerFilter('upper', (value) => String(value).toLowerCase());

    const template = '{{text | upper}}';
    const result = await processor.process(template, { text: 'HELLO' });

    if (!result.result.includes('hello')) throw new Error('override failed');
  });

  // Print summary
  return runner.print();
}

/**
 * Run quick smoke tests
 */
export async function runSmokeTests() {

  const tests = [
    {
      name: 'Basic variable substitution',
      template: 'Hello {{name}}!',
      data: { name: 'World' },
      expected: 'Hello World!'
    },
    {
      name: 'Filter application',
      template: '{{name | upper}}',
      data: { name: 'test' },
      expected: 'TEST'
    },
    {
      name: 'Conditional',
      template: '{{#if show}}Visible{{/if}}',
      data: { show: true },
      expected: 'Visible'
    },
    {
      name: 'Loop',
      template: '{{#each items}}{{this}}{{/each}}',
      data: { items: ['a', 'b'] },
      expected: 'ab'
    }
  ];

  const processor = new IntegratedTemplateProcessor();
  let passed = 0;

  for (const test of tests) {
    try {
      const result = await processor.process(test.template, test.data);
      if (result.result.includes(test.expected)) {
        passed++;
      } else {
      }
    } catch (error) {
    }
  }

  return { total: tests.length, passed };
}

/**
 * Main test runner
 */
export async function main() {

  // Run smoke tests first
  const smokeResults = await runSmokeTests();

  if (smokeResults.passed === smokeResults.total) {
    // Run full integration tests
    const results = await runIntegrationTests();
    return results;
  } else {
    return null;
  }
}

// Export for use in other test suites
export default {
  runIntegrationTests,
  runSmokeTests,
  main,
  TestRunner
};
