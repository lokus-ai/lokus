/**
 * Demo: Template Conditionals and Loops
 *
 * This file demonstrates the conditional and loop features of the template system.
 * Run with: node src/core/templates/demo.js
 */

import { TemplateConditionals } from './conditionals.js';
import { TemplateLoops } from './loops.js';

console.log('========================================');
console.log('Template Conditionals and Loops Demo');
console.log('========================================\n');

// Initialize processors
const conditionals = new TemplateConditionals();
const loops = new TemplateLoops();

// ============================================
// CONDITIONALS EXAMPLES
// ============================================

console.log('--- CONDITIONALS ---\n');

// Example 1: Simple if/else
console.log('1. Simple if/else:');
const template1 = '{{#if status == "Done"}}✅ Complete{{else}}⏳ In progress{{/if}}';
const vars1 = { status: 'Done' };
console.log(`Template: ${template1}`);
console.log(`Variables: ${JSON.stringify(vars1)}`);
console.log(`Result: ${conditionals.processTemplate(template1, vars1)}\n`);

// Example 2: Else if
console.log('2. Multiple conditions (else if):');
const template2 = `{{#if priority == "High"}}🔴 High Priority{{else if priority == "Medium"}}🟡 Medium Priority{{else}}🟢 Low Priority{{/if}}`;
const vars2a = { priority: 'High' };
const vars2b = { priority: 'Medium' };
const vars2c = { priority: 'Low' };
console.log(`Template: ${template2}`);
console.log(`Variables: ${JSON.stringify(vars2a)}`);
console.log(`Result: ${conditionals.processTemplate(template2, vars2a)}`);
console.log(`Variables: ${JSON.stringify(vars2b)}`);
console.log(`Result: ${conditionals.processTemplate(template2, vars2b)}`);
console.log(`Variables: ${JSON.stringify(vars2c)}`);
console.log(`Result: ${conditionals.processTemplate(template2, vars2c)}\n`);

// Example 3: Logical operators
console.log('3. Logical operators (AND/OR):');
const template3 = '{{#if age >= 18 && hasLicense == true}}Can drive{{else}}Cannot drive{{/if}}';
const vars3a = { age: 20, hasLicense: true };
const vars3b = { age: 16, hasLicense: true };
console.log(`Template: ${template3}`);
console.log(`Variables: ${JSON.stringify(vars3a)}`);
console.log(`Result: ${conditionals.processTemplate(template3, vars3a)}`);
console.log(`Variables: ${JSON.stringify(vars3b)}`);
console.log(`Result: ${conditionals.processTemplate(template3, vars3b)}\n`);

// Example 4: Nested conditionals
console.log('4. Nested conditionals:');
const template4 = `{{#if isLoggedIn == true}}Welcome! {{#if isPremium == true}}Premium User{{else}}Free User{{/if}}{{else}}Please login{{/if}}`;
const vars4a = { isLoggedIn: true, isPremium: true };
const vars4b = { isLoggedIn: true, isPremium: false };
const vars4c = { isLoggedIn: false };
console.log(`Template: ${template4}`);
console.log(`Variables: ${JSON.stringify(vars4a)}`);
console.log(`Result: ${conditionals.processTemplate(template4, vars4a)}`);
console.log(`Variables: ${JSON.stringify(vars4b)}`);
console.log(`Result: ${conditionals.processTemplate(template4, vars4b)}`);
console.log(`Variables: ${JSON.stringify(vars4c)}`);
console.log(`Result: ${conditionals.processTemplate(template4, vars4c)}\n`);

// ============================================
// LOOPS EXAMPLES
// ============================================

console.log('\n--- LOOPS ---\n');

// Example 5: Simple array iteration
console.log('5. Simple array iteration:');
const template5 = '{{#each items}}{{this}} {{/each}}';
const vars5 = { items: ['apple', 'banana', 'orange'] };
console.log(`Template: ${template5}`);
console.log(`Variables: ${JSON.stringify(vars5)}`);
console.log(`Result: ${loops.processTemplate(template5, vars5)}\n`);

// Example 6: Array of objects
console.log('6. Array of objects:');
const template6 = '{{#each tasks}}• {{this.title}} - {{this.status}}\n{{/each}}';
const vars6 = {
  tasks: [
    { title: 'Write code', status: 'Done' },
    { title: 'Write tests', status: 'In Progress' },
    { title: 'Deploy', status: 'Pending' }
  ]
};
console.log(`Template: ${template6.replace(/\n/g, '\\n')}`);
console.log(`Variables: ${JSON.stringify(vars6)}`);
console.log('Result:');
console.log(loops.processTemplate(template6, vars6));

// Example 7: Using @index
console.log('7. Using @index for numbering:');
const template7 = '{{#each tasks}}{{@index + 1}}. {{this.title}}\n{{/each}}';
const vars7 = {
  tasks: [
    { title: 'First task' },
    { title: 'Second task' },
    { title: 'Third task' }
  ]
};
console.log(`Template: ${template7.replace(/\n/g, '\\n')}`);
console.log(`Variables: ${JSON.stringify(vars7)}`);
console.log('Result:');
console.log(loops.processTemplate(template7, vars7));

// Example 8: Using aliases
console.log('8. Using aliases:');
const template8 = '{{#each users as user}}{{user.name}} ({{user.role}})\n{{/each}}';
const vars8 = {
  users: [
    { name: 'Alice', role: 'Admin' },
    { name: 'Bob', role: 'User' },
    { name: 'Charlie', role: 'Moderator' }
  ]
};
console.log(`Template: ${template8.replace(/\n/g, '\\n')}`);
console.log(`Variables: ${JSON.stringify(vars8)}`);
console.log('Result:');
console.log(loops.processTemplate(template8, vars8));

// ============================================
// COMBINED EXAMPLE
// ============================================

console.log('\n--- COMBINED: LOOPS + CONDITIONALS ---\n');

// Example 9: Task list with conditional status icons
console.log('9. Task list with conditional formatting:');
const template9 = '{{#each tasks}}{{@index + 1}}. {{this.title}} - {{#if this.status == "Done"}}✅{{else if this.status == "In Progress"}}⏳{{else}}⏸️{{/if}}\n{{/each}}';
const vars9 = {
  tasks: [
    { title: 'Design UI', status: 'Done' },
    { title: 'Implement features', status: 'In Progress' },
    { title: 'Write documentation', status: 'Pending' },
    { title: 'Deploy to production', status: 'Pending' }
  ]
};
console.log(`Template: ${template9.replace(/\n/g, '\\n')}`);
console.log(`Variables: ${JSON.stringify(vars9)}`);
console.log('Result:');
// First process loops, then conditionals
let result9 = loops.processTemplate(template9, vars9);
result9 = conditionals.processTemplate(result9, vars9);
console.log(result9);

// ============================================
// STATISTICS
// ============================================

console.log('\n--- TEMPLATE STATISTICS ---\n');

// Conditional statistics
const condTemplate = `{{#if score >= 90}}A{{else if score >= 80}}B{{else if score >= 70}}C{{else}}F{{/if}}`;
const condStats = conditionals.getStatistics(condTemplate);
console.log('Conditional template statistics:');
console.log(JSON.stringify(condStats, null, 2));

// Loop statistics
const loopTemplate = `{{#each items}}{{@index}}: {{this.name}}\n{{/each}}`;
const loopStats = loops.getStatistics(loopTemplate);
console.log('\nLoop template statistics:');
console.log(JSON.stringify(loopStats, null, 2));

// ============================================
// VALIDATION
// ============================================

console.log('\n--- TEMPLATE VALIDATION ---\n');

// Valid template
const validTemplate = '{{#if test == true}}valid{{/if}}';
const validResult = conditionals.validate(validTemplate);
console.log('Valid template check:');
console.log(`Template: ${validTemplate}`);
console.log(`Valid: ${validResult.valid}`);
console.log(`Errors: ${validResult.errors.length}`);

// Invalid template (unclosed)
const invalidTemplate = '{{#if test == true}}invalid';
const invalidResult = conditionals.validate(invalidTemplate);
console.log('\nInvalid template check:');
console.log(`Template: ${invalidTemplate}`);
console.log(`Valid: ${invalidResult.valid}`);
console.log(`Errors: ${invalidResult.errors.join(', ')}`);

console.log('\n========================================');
console.log('Demo Complete!');
console.log('========================================');
