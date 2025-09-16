/**
 * Template System Integration Test
 * 
 * This file demonstrates how the template system works and can be used
 * for testing the integration with the editor.
 */

import { TemplateManager } from './manager.js';
import { builtinVariables } from './variables.js';

/**
 * Demo templates for testing
 */
const demoTemplates = [
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    content: `# {{title || "Meeting Notes"}}

**Date:** {{date}}
**Time:** {{time}}
**Attendees:** {{attendees || "Add attendees here"}}

## Agenda
{{agenda || "Add agenda items here"}}

## Notes
{{cursor}}

## Action Items
- [ ] {{action1 || "First action item"}}
- [ ] {{action2 || "Second action item"}}

## Next Meeting
**Date:** {{nextMeeting || "TBD"}}`,
    category: 'notes',
    tags: ['meeting', 'work', 'notes'],
    metadata: {
      description: 'Template for meeting notes with agenda and action items'
    }
  },
  {
    id: 'daily-journal',
    name: 'Daily Journal',
    content: `# Daily Journal - {{date.long}}

## Today's Focus
{{focus || "What is your main focus for today?"}}

## Mood
{{mood || "How are you feeling today?"}} ⭐⭐⭐⭐⭐

## Gratitude
- {{gratitude1 || "Something you're grateful for"}}
- {{gratitude2 || "Another thing you're grateful for"}}
- {{gratitude3 || "One more thing you're grateful for"}}

## Today's Achievements
{{cursor}}

## Tomorrow's Plan
{{tomorrow || "What do you want to accomplish tomorrow?"}}

---
*Created by {{user}} at {{time}}*`,
    category: 'personal',
    tags: ['journal', 'daily', 'reflection'],
    metadata: {
      description: 'Daily journal template with mood tracking and gratitude'
    }
  },
  {
    id: 'project-readme',
    name: 'Project README',
    content: `# {{projectName || "Project Name"}}

{{description || "Brief description of the project"}}

## Installation

\`\`\`bash
{{installCommand || "npm install"}
\`\`\`

## Usage

\`\`\`{{language || "javascript"}}
{{usageExample || "// Add usage example here"}
\`\`\`

## Features

- {{feature1 || "First feature"}}
- {{feature2 || "Second feature"}}
- {{feature3 || "Third feature"}}

## Configuration

{{cursor}}

## Contributing

{{contributingGuidelines || "Please read CONTRIBUTING.md for details on our code of conduct."}}

## License

This project is licensed under the {{license || "MIT"}} License.

---
Generated on {{date}} by {{user}}`,
    category: 'documentation',
    tags: ['readme', 'documentation', 'project'],
    metadata: {
      description: 'Template for creating project README files'
    }
  },
  {
    id: 'bug-report',
    name: 'Bug Report',
    content: `# Bug Report

**Reporter:** {{reporter || user}}
**Date:** {{date}}
**Priority:** {{priority || "Medium"}}

## Summary
{{summary || "Brief description of the bug"}}

## Steps to Reproduce
1. {{step1 || "First step"}}
2. {{step2 || "Second step"}}
3. {{step3 || "Third step"}}

## Expected Behavior
{{expected || "What should happen"}}

## Actual Behavior
{{actual || "What actually happens"}}

## Environment
- **OS:** {{os || "Operating system"}}
- **Browser:** {{browser || "Browser name and version"}}
- **Version:** {{version || "App version"}}

## Additional Information
{{cursor}}

## Screenshots
{{screenshots || "Add screenshots if applicable"}}`,
    category: 'reports',
    tags: ['bug', 'report', 'issue'],
    metadata: {
      description: 'Template for reporting bugs and issues'
    }
  },
  {
    id: 'email-template',
    name: 'Professional Email',
    content: `Subject: {{subject || "Email Subject"}}

Dear {{recipient || "Recipient Name"}},

{{greeting || "I hope this email finds you well."}

{{body || "Email body content goes here. {{cursor}}"}

{{closing || "Thank you for your time and consideration."}

Best regards,
{{sender || user}}

<%# This is a comment - add signature block below %>
{{signature || "Your Company Name\nYour Title\nContact Information"}}`,
    category: 'letters',
    tags: ['email', 'professional', 'communication'],
    metadata: {
      description: 'Template for professional email communication'
    }
  }
];

/**
 * Initialize template system with demo data
 */
export async function initializeTemplateSystem() {
  console.log('🚀 Initializing Template System...');
  
  const manager = new TemplateManager();
  
  // Create demo templates
  for (const templateData of demoTemplates) {
    try {
      await manager.create(templateData);
      console.log(`✅ Created template: ${templateData.name}`);
    } catch (error) {
      console.error(`❌ Failed to create template ${templateData.name}:`, error.message);
    }
  }
  
  console.log('📊 Template System Statistics:');
  const stats = manager.getStatistics();
  console.log(stats);
  
  return manager;
}

/**
 * Test template processing
 */
export async function testTemplateProcessing(manager) {
  console.log('\n🧪 Testing Template Processing...');
  
  const testVariables = {
    title: 'Weekly Team Sync',
    attendees: 'John, Jane, Mike, Sarah',
    agenda: '1. Sprint review\n2. Planning next sprint\n3. Blockers discussion',
    action1: 'Update project timeline',
    action2: 'Schedule client demo',
    nextMeeting: 'Next Friday at 2 PM'
  };
  
  try {
    const result = await manager.process('meeting-notes', testVariables);
    console.log('✅ Template processed successfully:');
    console.log('---');
    console.log(result.content);
    console.log('---');
    
    if (result.cursorPosition) {
      console.log(`📍 Cursor position: ${result.cursorPosition}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Template processing failed:', error.message);
    return null;
  }
}

/**
 * Test built-in variables
 */
export function testBuiltinVariables() {
  console.log('\n🔧 Testing Built-in Variables...');
  
  const variables = builtinVariables.resolveAll();
  console.log('Available built-in variables:');
  
  Object.entries(variables).forEach(([name, value]) => {
    console.log(`  ${name}: ${value}`);
  });
  
  // Test variable categories
  const categories = builtinVariables.listByCategory();
  console.log('\nVariables by category:');
  
  Object.entries(categories).forEach(([category, vars]) => {
    console.log(`  ${category}: ${vars.length} variables`);
  });
  
  return variables;
}

/**
 * Test template validation
 */
export function testTemplateValidation(manager) {
  console.log('\n✅ Testing Template Validation...');
  
  const testCases = [
    {
      name: 'Valid template',
      content: 'Hello {{name}}, today is {{date}}!'
    },
    {
      name: 'Template with JavaScript',
      content: 'Result: <% 2 + 2 %>'
    },
    {
      name: 'Template with comment',
      content: 'Hello world! <%# This is a comment %>'
    },
    {
      name: 'Invalid template (unclosed variable)',
      content: 'Hello {{name, today is {{date}}!'
    },
    {
      name: 'Invalid template (unclosed JS block)',
      content: 'Result: <% 2 + 2'
    }
  ];
  
  testCases.forEach(testCase => {
    const validation = manager.validate(testCase.content);
    console.log(`\n${testCase.name}:`);
    console.log(`  Valid: ${validation.valid}`);
    
    if (validation.errors.length > 0) {
      console.log(`  Errors: ${validation.errors.join(', ')}`);
    }
    
    if (validation.warnings.length > 0) {
      console.log(`  Warnings: ${validation.warnings.join(', ')}`);
    }
  });
}

/**
 * Demo template search functionality
 */
export function testTemplateSearch(manager) {
  console.log('\n🔍 Testing Template Search...');
  
  const searchQueries = ['meeting', 'project', 'daily'];
  
  searchQueries.forEach(query => {
    const results = manager.search(query);
    console.log(`\nSearch for "${query}": ${results.templates.length} results`);
    
    results.templates.forEach(template => {
      console.log(`  - ${template.name} (${template.category})`);
    });
  });
}

/**
 * Run complete integration test
 */
export async function runIntegrationTest() {
  console.log('🎯 Running Template System Integration Test\n');
  
  try {
    // Initialize system
    const manager = await initializeTemplateSystem();
    
    // Test built-in variables
    testBuiltinVariables();
    
    // Test template processing
    await testTemplateProcessing(manager);
    
    // Test validation
    testTemplateValidation(manager);
    
    // Test search
    testTemplateSearch(manager);
    
    console.log('\n🎉 Integration test completed successfully!');
    
    // Return manager for further testing if needed
    return manager;
    
  } catch (error) {
    console.error('\n💥 Integration test failed:', error);
    throw error;
  }
}

/**
 * Browser-friendly test runner
 */
export function runBrowserTest() {
  if (typeof window !== 'undefined') {
    console.log('🌐 Running template system test in browser...');
    runIntegrationTest().catch(console.error);
  }
}

// Auto-run if in browser environment
if (typeof window !== 'undefined' && window.location) {
  // Only run if not in production
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    setTimeout(runBrowserTest, 1000);
  }
}

export default {
  initializeTemplateSystem,
  testTemplateProcessing,
  testBuiltinVariables,
  testTemplateValidation,
  testTemplateSearch,
  runIntegrationTest,
  runBrowserTest,
  demoTemplates
};