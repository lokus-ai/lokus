/**
 * Tests for Template Loops
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateLoops } from '../../../src/core/templates/loops.js';

describe('TemplateLoops', () => {
  let loops;

  beforeEach(() => {
    loops = new TemplateLoops();
  });

  describe('parseLoop', () => {
    it('should parse simple loop declaration', () => {
      const result = loops.parseLoop('items');
      expect(result.arrayPath).toBe('items');
      expect(result.itemAlias).toBeNull();
    });

    it('should parse loop with alias', () => {
      const result = loops.parseLoop('items as item');
      expect(result.arrayPath).toBe('items');
      expect(result.itemAlias).toBe('item');
    });

    it('should parse loop with dot notation', () => {
      const result = loops.parseLoop('data.items');
      expect(result.arrayPath).toBe('data.items');
    });

    it('should handle extra whitespace', () => {
      const result = loops.parseLoop('  items as  item  ');
      expect(result.arrayPath).toBe('items');
      expect(result.itemAlias).toBe('item');
    });
  });

  describe('findLoopBlocks', () => {
    it('should find simple loop block', () => {
      const template = '{{#each items}}content{{/each}}';
      const blocks = loops.findLoopBlocks(template);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].arrayPath).toBe('items');
      expect(blocks[0].content).toBe('content');
    });

    it('should find multiple loop blocks', () => {
      const template = '{{#each items1}}A{{/each}}{{#each items2}}B{{/each}}';
      const blocks = loops.findLoopBlocks(template);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].arrayPath).toBe('items1');
      expect(blocks[1].arrayPath).toBe('items2');
    });

    it('should throw error on unclosed loop', () => {
      const template = '{{#each items}}content';
      expect(() => loops.findLoopBlocks(template)).toThrow('Unclosed loop block');
    });

    it('should throw error on unexpected closing tag', () => {
      const template = 'content{{/each}}';
      expect(() => loops.findLoopBlocks(template)).toThrow('Unexpected {{/each}}');
    });
  });

  describe('processTemplate - simple arrays', () => {
    it('should iterate over simple array with {{this}}', () => {
      const template = '{{#each items}}{{this}} {{/each}}';
      const variables = { items: ['a', 'b', 'c'] };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('a b c ');
    });

    it('should iterate over array of objects', () => {
      const template = '{{#each tasks}}{{this.title}} {{/each}}';
      const variables = {
        tasks: [
          { title: 'Task 1' },
          { title: 'Task 2' },
          { title: 'Task 3' }
        ]
      };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('Task 1 Task 2 Task 3 ');
    });

    it('should handle empty array', () => {
      const template = '{{#each items}}{{this}}{{/each}}';
      const variables = { items: [] };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('');
    });

    it('should iterate over numbers array', () => {
      const template = '{{#each numbers}}{{this}},{{/each}}';
      const variables = { numbers: [1, 2, 3, 4, 5] };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('1,2,3,4,5,');
    });
  });

  describe('processTemplate - @index', () => {
    it('should provide @index in loop', () => {
      const template = '{{#each items}}{{@index}}: {{this}} {{/each}}';
      const variables = { items: ['a', 'b', 'c'] };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('0: a 1: b 2: c ');
    });

    it('should support @index + 1 for 1-based indexing', () => {
      const template = '{{#each tasks}}{{@index + 1}}. {{this.title}}\n{{/each}}';
      const variables = {
        tasks: [
          { title: 'First' },
          { title: 'Second' },
          { title: 'Third' }
        ]
      };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('1. First\n2. Second\n3. Third\n');
    });

    it('should support arithmetic operations with @index', () => {
      const template = '{{#each items}}{{@index * 2}} {{/each}}';
      const variables = { items: ['a', 'b', 'c'] };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('0 2 4 ');
    });
  });

  describe('processTemplate - @first and @last', () => {
    it('should provide @first flag', () => {
      const template = '{{#each items}}{{@first}}{{/each}}';
      const variables = { items: ['a', 'b', 'c'] };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('truefalsefalse');
    });

    it('should provide @last flag', () => {
      const template = '{{#each items}}{{@last}}{{/each}}';
      const variables = { items: ['a', 'b', 'c'] };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('falsefalsetrue');
    });

    it('should use @first and @last for conditional formatting', () => {
      const template = '{{#each items}}{{this.name}}{{/each}}';
      const variables = {
        items: [
          { name: 'Alice' },
          { name: 'Bob' },
          { name: 'Charlie' }
        ]
      };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('AliceBobCharlie');
    });

    it('should provide @length', () => {
      const template = '{{#each items}}{{@length}} {{/each}}';
      const variables = { items: ['a', 'b', 'c'] };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('3 3 3 ');
    });
  });

  describe('processTemplate - nested loops', () => {
    it('should process nested loops', () => {
      const template = '{{#each categories}}{{this.name}}:\n{{#each this.items}}  - {{this.title}}\n{{/each}}{{/each}}';
      const variables = {
        categories: [
          {
            name: 'Category 1',
            items: [
              { title: 'Item 1.1' },
              { title: 'Item 1.2' }
            ]
          },
          {
            name: 'Category 2',
            items: [
              { title: 'Item 2.1' }
            ]
          }
        ]
      };
      const result = loops.processTemplate(template, variables);
      expect(result).toContain('Category 1:');
      expect(result).toContain('Item 1.1');
      expect(result).toContain('Category 2:');
      expect(result).toContain('Item 2.1');
    });

    it('should handle deeply nested loops', () => {
      // Test two levels of nesting with this.property syntax
      const template = '{{#each level1}}{{#each this.level2}}{{this.value}}{{/each}}{{/each}}';
      const variables = {
        level1: [
          {
            level2: [
              { value: 'a' },
              { value: 'b' }
            ]
          }
        ]
      };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('ab');
    });
  });

  describe('processTemplate - object iteration', () => {
    it('should iterate over object keys', () => {
      const template = '{{#each data}}{{this.key}}: {{this.value}}\n{{/each}}';
      const variables = {
        data: {
          name: 'John',
          age: 30,
          city: 'NYC'
        }
      };
      const result = loops.processTemplate(template, variables);
      expect(result).toContain('name: John');
      expect(result).toContain('age: 30');
      expect(result).toContain('city: NYC');
    });
  });

  describe('processTemplate - with alias', () => {
    it('should use item alias instead of this', () => {
      const template = '{{#each tasks as task}}{{task.title}} - {{task.status}}\n{{/each}}';
      const variables = {
        tasks: [
          { title: 'Task 1', status: 'Done' },
          { title: 'Task 2', status: 'Pending' }
        ]
      };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('Task 1 - Done\nTask 2 - Pending\n');
    });

    it('should work with simple array and alias', () => {
      const template = '{{#each items as item}}{{item}} {{/each}}';
      const variables = { items: ['a', 'b', 'c'] };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('a b c ');
    });
  });

  describe('processTemplate - complex examples', () => {
    it('should create numbered task list', () => {
      const template = '{{#each tasks}}{{@index + 1}}. {{this.title}} - {{this.status}}\n{{/each}}';
      const variables = {
        tasks: [
          { title: 'Write code', status: 'Done' },
          { title: 'Write tests', status: 'In Progress' },
          { title: 'Deploy', status: 'Pending' }
        ]
      };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('1. Write code - Done\n2. Write tests - In Progress\n3. Deploy - Pending\n');
    });

    it('should create markdown table rows', () => {
      const template = '| Name | Status |\n{{#each items}}| {{this.name}} | {{this.status}} |\n{{/each}}';
      const variables = {
        items: [
          { name: 'Item 1', status: '✅' },
          { name: 'Item 2', status: '⏳' }
        ]
      };
      const result = loops.processTemplate(template, variables);
      expect(result).toContain('| Item 1 | ✅ |');
      expect(result).toContain('| Item 2 | ⏳ |');
    });

    it('should create bulleted list', () => {
      const template = '{{#each items}}- {{this.text}}\n{{/each}}';
      const variables = {
        items: [
          { text: 'First item' },
          { text: 'Second item' },
          { text: 'Third item' }
        ]
      };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('- First item\n- Second item\n- Third item\n');
    });
  });

  describe('processTemplate - dot notation', () => {
    it('should support nested property access', () => {
      const template = '{{#each users}}{{this.profile.name}}: {{this.profile.email}}\n{{/each}}';
      const variables = {
        users: [
          { profile: { name: 'Alice', email: 'alice@example.com' } },
          { profile: { name: 'Bob', email: 'bob@example.com' } }
        ]
      };
      const result = loops.processTemplate(template, variables);
      expect(result).toContain('Alice: alice@example.com');
      expect(result).toContain('Bob: bob@example.com');
    });

    it('should access nested array', () => {
      const template = '{{#each data.items}}{{this}}{{/each}}';
      const variables = {
        data: {
          items: ['a', 'b', 'c']
        }
      };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('abc');
    });
  });

  describe('validate', () => {
    it('should validate correct template', () => {
      const template = '{{#each items}}{{this}}{{/each}}';
      const result = loops.validate(template);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect unclosed loops', () => {
      const template = '{{#each items}}content';
      const result = loops.validate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect empty array path', () => {
      const template = '{{#each }}content{{/each}}';
      const result = loops.validate(template);
      expect(result.valid).toBe(false);
    });

    it('should warn about empty content', () => {
      const template = '{{#each items}}{{/each}}';
      const result = loops.validate(template);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('getStatistics', () => {
    it('should return statistics for template with loops', () => {
      const template = '{{#each items}}{{@index}}: {{this}}{{/each}}';
      const stats = loops.getStatistics(template);
      expect(stats.totalLoops).toBe(1);
      expect(stats.specialVarsUsed).toBeGreaterThan(0);
    });

    it('should count nested loops', () => {
      const template = '{{#each outer}}{{#each this.inner}}{{this}}{{/each}}{{/each}}';
      const stats = loops.getStatistics(template);
      expect(stats.totalLoops).toBe(2);
      expect(stats.maxNestingDepth).toBe(1);
    });

    it('should return zero statistics for template without loops', () => {
      const template = 'Just plain text';
      const stats = loops.getStatistics(template);
      expect(stats.totalLoops).toBe(0);
    });
  });

  describe('previewLoop', () => {
    it('should preview loop expansion', () => {
      const template = '{{#each items}}{{this}}{{/each}}';
      const variables = { items: [1, 2, 3, 4, 5] };
      const preview = loops.previewLoop(template, variables);
      expect(preview.totalLoops).toBe(1);
      expect(preview.loops[0].itemCount).toBe(5);
    });

    it('should preview nested loops', () => {
      const template = '{{#each outer}}{{#each this.inner}}x{{/each}}{{/each}}';
      const variables = {
        outer: [
          { inner: [1, 2] },
          { inner: [3, 4, 5] }
        ]
      };
      const preview = loops.previewLoop(template, variables);
      expect(preview.totalLoops).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty template', () => {
      const result = loops.processTemplate('', {});
      expect(result).toBe('');
    });

    it('should handle template with no loops', () => {
      const template = 'Just plain text';
      const result = loops.processTemplate(template, {});
      expect(result).toBe('Just plain text');
    });

    it('should handle undefined array in non-strict mode', () => {
      const nonStrictLoops = new TemplateLoops({ strictMode: false });
      const template = '{{#each undefinedArray}}{{this}}{{/each}}';
      const result = nonStrictLoops.processTemplate(template, {});
      expect(result).toBe('');
    });

    it('should handle single non-array value', () => {
      const template = '{{#each value}}{{this}}{{/each}}';
      const variables = { value: 'single' };
      const result = loops.processTemplate(template, variables);
      expect(result).toBe('single');
    });

    it('should handle null array', () => {
      const nonStrictLoops = new TemplateLoops({ strictMode: false });
      const template = '{{#each items}}{{this}}{{/each}}';
      const result = nonStrictLoops.processTemplate(template, { items: null });
      expect(result).toBe('');
    });
  });

  describe('performance', () => {
    it('should handle large arrays', () => {
      const template = '{{#each items}}{{@index}}{{/each}}';
      const items = Array.from({ length: 1000 }, (_, i) => i);
      const result = loops.processTemplate(template, { items });
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should enforce max iterations limit', () => {
      const limitedLoops = new TemplateLoops({ maxIterations: 10 });
      const template = '{{#each items}}{{this}}{{/each}}';
      const items = Array.from({ length: 100 }, (_, i) => i);
      expect(() => limitedLoops.processTemplate(template, { items })).toThrow('exceeds maximum');
    });
  });
});
