/**
 * Usage Examples for SecureTemplateSandbox
 *
 * Demonstrates how to use the secure template sandbox for executing
 * user-provided JavaScript code safely.
 */

import { SecureTemplateSandbox } from './sandbox-isolated.js';

// Example 1: Basic Usage
async function example1() {
  console.log('=== Example 1: Basic Usage ===');

  const sandbox = new SecureTemplateSandbox({
    memoryLimit: 128, // 128MB
    timeout: 5000 // 5 seconds
  });

  await sandbox.initialize();

  // Execute simple math
  const result1 = await sandbox.execute('2 + 2');
  console.log('2 + 2 =', result1); // 4

  // Execute with variables
  const result2 = await sandbox.execute('x * y', { x: 5, y: 10 });
  console.log('5 * 10 =', result2); // 50

  sandbox.dispose();
}

// Example 2: Using Helper Functions
async function example2() {
  console.log('\n=== Example 2: Helper Functions ===');

  const sandbox = new SecureTemplateSandbox();
  await sandbox.initialize();

  // UUID generation
  const uuid = await sandbox.execute('uuid()');
  console.log('UUID:', uuid);

  // Date helpers
  const today = await sandbox.execute('today()');
  console.log('Today:', today);

  // String helpers
  const slugified = await sandbox.execute('slugify("Hello World!")');
  console.log('Slugified:', slugified); // hello-world

  // Random helpers
  const randomInt = await sandbox.execute('random.int(1, 100)');
  console.log('Random int:', randomInt);

  sandbox.dispose();
}

// Example 3: Array and Object Operations
async function example3() {
  console.log('\n=== Example 3: Arrays and Objects ===');

  const sandbox = new SecureTemplateSandbox();
  await sandbox.initialize();

  // Array operations
  const doubled = await sandbox.execute('[1, 2, 3, 4, 5].map(x => x * 2)');
  console.log('Doubled:', doubled); // [2, 4, 6, 8, 10]

  // Object operations
  const keys = await sandbox.execute('Object.keys({ name: "John", age: 30 })');
  console.log('Keys:', keys); // ['name', 'age']

  // Filtering
  const evens = await sandbox.execute('[1, 2, 3, 4, 5, 6].filter(x => x % 2 === 0)');
  console.log('Even numbers:', evens); // [2, 4, 6]

  sandbox.dispose();
}

// Example 4: Security - Blocked Operations
async function example4() {
  console.log('\n=== Example 4: Security - Blocked Operations ===');

  const sandbox = new SecureTemplateSandbox();
  await sandbox.initialize();

  // These will all throw errors
  const dangerousCodes = [
    'eval("1 + 1")',
    'require("fs")',
    'process.exit()',
    'import fs from "fs"',
    'Function("return 1")()'
  ];

  for (const code of dangerousCodes) {
    try {
      await sandbox.execute(code);
      console.log(`FAILED: ${code} should have been blocked!`);
    } catch (error) {
      console.log(`BLOCKED: ${code} - ${error.message}`);
    }
  }

  sandbox.dispose();
}

// Example 5: Timeout Protection
async function example5() {
  console.log('\n=== Example 5: Timeout Protection ===');

  const sandbox = new SecureTemplateSandbox({ timeout: 1000 });
  await sandbox.initialize();

  try {
    // This will timeout after 1 second
    await sandbox.execute('while(true) {}');
    console.log('FAILED: Infinite loop should have timed out!');
  } catch (error) {
    console.log('PROTECTED:', error.message);
  }

  sandbox.dispose();
}

// Example 6: Complex Template Processing
async function example6() {
  console.log('\n=== Example 6: Template Processing ===');

  const sandbox = new SecureTemplateSandbox();
  await sandbox.initialize();

  const templateData = {
    user: {
      name: 'Alice',
      email: 'alice@example.com'
    },
    date: new Date().toISOString().split('T')[0]
  };

  // Process a template expression
  const greeting = await sandbox.execute(
    'format("Hello {0}, your email is {1}", user.name, user.email)',
    templateData
  );
  console.log('Greeting:', greeting);

  // Generate a filename
  const filename = await sandbox.execute(
    'slugify(user.name) + "-" + date + ".txt"',
    templateData
  );
  console.log('Filename:', filename);

  sandbox.dispose();
}

// Example 7: Test Mode
async function example7() {
  console.log('\n=== Example 7: Test Mode ===');

  const sandbox = new SecureTemplateSandbox();
  await sandbox.initialize();

  // Test safe code
  const test1 = await sandbox.test('1 + 1');
  console.log('Test 1:', test1); // { success: true, result: 2, error: null }

  // Test dangerous code
  const test2 = await sandbox.test('eval("1+1")');
  console.log('Test 2:', test2); // { success: false, result: null, error: '...' }

  sandbox.dispose();
}

// Run all examples
async function runAllExamples() {
  try {
    await example1();
    await example2();
    await example3();
    await example4();
    await example5();
    await example6();
    await example7();

    console.log('\n=== All Examples Completed Successfully ===');
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Uncomment to run examples
// runAllExamples();

export { runAllExamples };
