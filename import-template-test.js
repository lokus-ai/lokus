/**
 * Test script to import and process template
 * Run this to test if the template system is working
 */

import { TemplateManager } from './src/core/templates/manager.js';
import { TemplateStorage } from './src/core/templates/storage.js';
import { readFileSync } from 'fs';

async function testTemplate() {

  // Initialize storage and manager
  const storage = new TemplateStorage();
  await storage.initialize();

  const manager = new TemplateManager({
    storage: storage,
    maxTemplates: 1000
  });

  await manager.initialize();


  // Read the template file
  const templateContent = readFileSync('/Users/pratham/Desktop/My Knowledge Base/templates/test-template-simple.md', 'utf-8');


  // Create/register the template
  try {
    // Check if template already exists
    const existing = manager.read('test-template-simple');
    if (existing) {
      await manager.update('test-template-simple', {
        content: templateContent
      });
    } else {
      await manager.create({
        id: 'test-template-simple',
        name: 'Template Test - Simple',
        content: templateContent,
        category: 'general',
        tags: ['test', 'demo'],
        metadata: {
          description: 'Test template with all features'
        }
      });
    }

  } catch (error) {
    console.error('❌ Error registering template:', error.message);
    return;
  }

  // Now process the template

  try {
    const result = await manager.process('test-template-simple', {}, {
      promptValues: {
        projectName: 'Test Project',
        projectType: 'Work',
        isPublic: false,
        priority: 'High'
      }
    });

  } catch (error) {
    console.error('❌ Error processing template:', error);
    console.error('Stack:', error.stack);
  }
}

testTemplate().catch(console.error);
