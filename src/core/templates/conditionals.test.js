/**
 * Tests for Template Conditionals
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateConditionals } from './conditionals.js';

describe('TemplateConditionals', () => {
  let conditionals;

  beforeEach(() => {
    conditionals = new TemplateConditionals();
  });

  describe('parseCondition', () => {
    it('should parse simple equality condition', () => {
      const result = conditionals.parseCondition('status == "Done"');
      expect(result.type).toBe('comparison');
      expect(result.operator).toBe('==');
      expect(result.left.type).toBe('variable');
      expect(result.right.value).toBe('Done');
    });

    it('should parse inequality condition', () => {
      const result = conditionals.parseCondition('count != 0');
      expect(result.type).toBe('comparison');
      expect(result.operator).toBe('!=');
    });

    it('should parse greater than condition', () => {
      const result = conditionals.parseCondition('age > 18');
      expect(result.type).toBe('comparison');
      expect(result.operator).toBe('>');
      expect(result.right.value).toBe(18);
    });

    it('should parse less than or equal condition', () => {
      const result = conditionals.parseCondition('score <= 100');
      expect(result.type).toBe('comparison');
      expect(result.operator).toBe('<=');
    });

    it('should parse AND condition', () => {
      const result = conditionals.parseCondition('age > 18 && status == "active"');
      expect(result.type).toBe('and');
      expect(result.left.type).toBe('comparison');
      expect(result.right.type).toBe('comparison');
    });

    it('should parse OR condition', () => {
      const result = conditionals.parseCondition('status == "Done" || status == "Complete"');
      expect(result.type).toBe('or');
    });

    it('should parse truthiness check', () => {
      const result = conditionals.parseCondition('isActive');
      expect(result.type).toBe('truthiness');
      expect(result.value.type).toBe('variable');
    });

    it('should parse boolean literals', () => {
      const trueResult = conditionals.parseCondition('true');
      expect(trueResult.type).toBe('truthiness');
      expect(trueResult.value.value).toBe(true);

      const falseResult = conditionals.parseCondition('false');
      expect(falseResult.value.value).toBe(false);
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate equality correctly', () => {
      const condition = conditionals.parseCondition('status == "Done"');
      const variables = { status: 'Done' };
      expect(conditionals.evaluateCondition(condition, variables)).toBe(true);

      const variables2 = { status: 'Pending' };
      expect(conditionals.evaluateCondition(condition, variables2)).toBe(false);
    });

    it('should evaluate inequality correctly', () => {
      const condition = conditionals.parseCondition('count != 0');
      expect(conditionals.evaluateCondition(condition, { count: 5 })).toBe(true);
      expect(conditionals.evaluateCondition(condition, { count: 0 })).toBe(false);
    });

    it('should evaluate comparison operators correctly', () => {
      const gt = conditionals.parseCondition('age > 18');
      expect(conditionals.evaluateCondition(gt, { age: 25 })).toBe(true);
      expect(conditionals.evaluateCondition(gt, { age: 15 })).toBe(false);

      const lte = conditionals.parseCondition('score <= 100');
      expect(conditionals.evaluateCondition(lte, { score: 90 })).toBe(true);
      expect(conditionals.evaluateCondition(lte, { score: 100 })).toBe(true);
      expect(conditionals.evaluateCondition(lte, { score: 110 })).toBe(false);
    });

    it('should evaluate AND conditions correctly', () => {
      const condition = conditionals.parseCondition('age > 18 && status == "active"');
      expect(conditionals.evaluateCondition(condition, { age: 25, status: 'active' })).toBe(true);
      expect(conditionals.evaluateCondition(condition, { age: 15, status: 'active' })).toBe(false);
      expect(conditionals.evaluateCondition(condition, { age: 25, status: 'inactive' })).toBe(false);
    });

    it('should evaluate OR conditions correctly', () => {
      const condition = conditionals.parseCondition('status == "Done" || status == "Complete"');
      expect(conditionals.evaluateCondition(condition, { status: 'Done' })).toBe(true);
      expect(conditionals.evaluateCondition(condition, { status: 'Complete' })).toBe(true);
      expect(conditionals.evaluateCondition(condition, { status: 'Pending' })).toBe(false);
    });

    it('should evaluate truthiness correctly', () => {
      const condition = conditionals.parseCondition('isActive');
      expect(conditionals.evaluateCondition(condition, { isActive: true })).toBe(true);
      expect(conditionals.evaluateCondition(condition, { isActive: false })).toBe(false);
      expect(conditionals.evaluateCondition(condition, { isActive: 'yes' })).toBe(true);
      expect(conditionals.evaluateCondition(condition, { isActive: '' })).toBe(false);
      expect(conditionals.evaluateCondition(condition, { isActive: 0 })).toBe(false);
      expect(conditionals.evaluateCondition(condition, { isActive: null })).toBe(false);
    });

    it('should support dot notation in variables', () => {
      const condition = conditionals.parseCondition('user.status == "active"');
      const variables = { user: { status: 'active' } };
      expect(conditionals.evaluateCondition(condition, variables)).toBe(true);
    });
  });

  describe('processTemplate - simple if/else', () => {
    it('should process simple if block (true condition)', () => {
      const template = '{{#if status == "Done"}}✅ Complete{{/if}}';
      const variables = { status: 'Done' };
      const result = conditionals.processTemplate(template, variables);
      expect(result).toBe('✅ Complete');
    });

    it('should process simple if block (false condition)', () => {
      const template = '{{#if status == "Done"}}✅ Complete{{/if}}';
      const variables = { status: 'Pending' };
      const result = conditionals.processTemplate(template, variables);
      expect(result).toBe('');
    });

    it('should process if/else block (true condition)', () => {
      const template = '{{#if status == "Done"}}✅ Complete{{else}}⏳ In progress{{/if}}';
      const variables = { status: 'Done' };
      const result = conditionals.processTemplate(template, variables);
      expect(result).toBe('✅ Complete');
    });

    it('should process if/else block (false condition)', () => {
      const template = '{{#if status == "Done"}}✅ Complete{{else}}⏳ In progress{{/if}}';
      const variables = { status: 'Pending' };
      const result = conditionals.processTemplate(template, variables);
      expect(result).toBe('⏳ In progress');
    });
  });

  describe('processTemplate - else if', () => {
    it('should process if/else if/else block (first condition true)', () => {
      const template = `{{#if priority == "High"}}🔴 High Priority{{else if priority == "Medium"}}🟡 Medium Priority{{else}}🟢 Low Priority{{/if}}`;
      const variables = { priority: 'High' };
      const result = conditionals.processTemplate(template, variables);
      expect(result).toBe('🔴 High Priority');
    });

    it('should process if/else if/else block (second condition true)', () => {
      const template = `{{#if priority == "High"}}🔴 High Priority{{else if priority == "Medium"}}🟡 Medium Priority{{else}}🟢 Low Priority{{/if}}`;
      const variables = { priority: 'Medium' };
      const result = conditionals.processTemplate(template, variables);
      expect(result).toBe('🟡 Medium Priority');
    });

    it('should process if/else if/else block (else branch)', () => {
      const template = `{{#if priority == "High"}}🔴 High Priority{{else if priority == "Medium"}}🟡 Medium Priority{{else}}🟢 Low Priority{{/if}}`;
      const variables = { priority: 'Low' };
      const result = conditionals.processTemplate(template, variables);
      expect(result).toBe('🟢 Low Priority');
    });

    it('should process multiple else if branches', () => {
      const template = `{{#if score >= 90}}A{{else if score >= 80}}B{{else if score >= 70}}C{{else if score >= 60}}D{{else}}F{{/if}}`;

      expect(conditionals.processTemplate(template, { score: 95 })).toBe('A');
      expect(conditionals.processTemplate(template, { score: 85 })).toBe('B');
      expect(conditionals.processTemplate(template, { score: 75 })).toBe('C');
      expect(conditionals.processTemplate(template, { score: 65 })).toBe('D');
      expect(conditionals.processTemplate(template, { score: 55 })).toBe('F');
    });
  });

  describe('processTemplate - nested conditionals', () => {
    it('should process nested if statements', () => {
      const template = `{{#if isLoggedIn == true}}Welcome! {{#if isPremium == true}}Premium User{{else}}Free User{{/if}}{{else}}Please login{{/if}}`;

      const result1 = conditionals.processTemplate(template, { isLoggedIn: true, isPremium: true });
      expect(result1).toBe('Welcome! Premium User');

      const result2 = conditionals.processTemplate(template, { isLoggedIn: true, isPremium: false });
      expect(result2).toBe('Welcome! Free User');

      const result3 = conditionals.processTemplate(template, { isLoggedIn: false });
      expect(result3).toBe('Please login');
    });

    it('should process deeply nested conditionals', () => {
      const template = `{{#if level == 1}}{{#if sublevel == 1}}L1-S1{{else}}L1-S2{{/if}}{{else}}{{#if level == 2}}L2{{else}}L3{{/if}}{{/if}}`;

      expect(conditionals.processTemplate(template, { level: 1, sublevel: 1 })).toBe('L1-S1');
      expect(conditionals.processTemplate(template, { level: 1, sublevel: 2 })).toBe('L1-S2');
      expect(conditionals.processTemplate(template, { level: 2 })).toBe('L2');
      expect(conditionals.processTemplate(template, { level: 3 })).toBe('L3');
    });
  });

  describe('processTemplate - complex conditions', () => {
    it('should process AND conditions', () => {
      const template = `{{#if age >= 18 && hasLicense == true}}Can drive{{else}}Cannot drive{{/if}}`;

      expect(conditionals.processTemplate(template, { age: 20, hasLicense: true })).toBe('Can drive');
      expect(conditionals.processTemplate(template, { age: 16, hasLicense: true })).toBe('Cannot drive');
      expect(conditionals.processTemplate(template, { age: 20, hasLicense: false })).toBe('Cannot drive');
    });

    it('should process OR conditions', () => {
      const template = `{{#if role == "admin" || role == "moderator"}}Access granted{{else}}Access denied{{/if}}`;

      expect(conditionals.processTemplate(template, { role: 'admin' })).toBe('Access granted');
      expect(conditionals.processTemplate(template, { role: 'moderator' })).toBe('Access granted');
      expect(conditionals.processTemplate(template, { role: 'user' })).toBe('Access denied');
    });
  });

  describe('processTemplate - multiple conditionals', () => {
    it('should process multiple independent conditionals in one template', () => {
      const template = `Status: {{#if status == "Done"}}✅{{else}}⏳{{/if}} Priority: {{#if priority == "High"}}🔴{{else}}🟢{{/if}}`;

      const result = conditionals.processTemplate(template, { status: 'Done', priority: 'High' });
      expect(result).toBe('Status: ✅ Priority: 🔴');
    });
  });

  describe('findConditionalBlocks', () => {
    it('should find simple conditional block', () => {
      const template = '{{#if test == true}}content{{/if}}';
      const blocks = conditionals.findConditionalBlocks(template);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].condition).toBe('test == true');
      expect(blocks[0].branches).toHaveLength(1);
    });

    it('should find conditional with else', () => {
      const template = '{{#if test}}content1{{else}}content2{{/if}}';
      const blocks = conditionals.findConditionalBlocks(template);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].branches).toHaveLength(2);
      expect(blocks[0].branches[0].type).toBe('if');
      expect(blocks[0].branches[1].type).toBe('else');
    });

    it('should find conditional with else if', () => {
      const template = '{{#if a == 1}}A{{else if b == 2}}B{{else}}C{{/if}}';
      const blocks = conditionals.findConditionalBlocks(template);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].branches).toHaveLength(3);
      expect(blocks[0].branches[1].type).toBe('elseif');
      expect(blocks[0].branches[1].condition).toBe('b == 2');
    });

    it('should throw error on unclosed conditional', () => {
      const template = '{{#if test}}content';
      expect(() => conditionals.findConditionalBlocks(template)).toThrow('Unclosed conditional block');
    });

    it('should throw error on unexpected closing tag', () => {
      const template = 'content{{/if}}';
      expect(() => conditionals.findConditionalBlocks(template)).toThrow('Unexpected {{/if}}');
    });
  });

  describe('validate', () => {
    it('should validate correct template', () => {
      const template = '{{#if status == "Done"}}✅ Complete{{else}}⏳ Pending{{/if}}';
      const result = conditionals.validate(template);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect unclosed conditionals', () => {
      const template = '{{#if status == "Done"}}content';
      const result = conditionals.validate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect empty conditions', () => {
      const template = '{{#if }}content{{/if}}';
      const result = conditionals.validate(template);
      expect(result.valid).toBe(false);
    });
  });

  describe('getStatistics', () => {
    it('should return statistics for template with conditionals', () => {
      const template = `
        {{#if status == "Done"}}✅{{else}}⏳{{/if}}
        {{#if priority == "High"}}🔴{{else if priority == "Medium"}}🟡{{else}}🟢{{/if}}
      `;
      const stats = conditionals.getStatistics(template);
      expect(stats.totalConditionals).toBe(2);
      expect(stats.elseIfCount).toBe(1);
      expect(stats.elseCount).toBe(2);
    });

    it('should return zero statistics for template without conditionals', () => {
      const template = 'Just plain text';
      const stats = conditionals.getStatistics(template);
      expect(stats.totalConditionals).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty template', () => {
      const result = conditionals.processTemplate('', {});
      expect(result).toBe('');
    });

    it('should handle template with no conditionals', () => {
      const template = 'Just plain text';
      const result = conditionals.processTemplate(template, {});
      expect(result).toBe('Just plain text');
    });

    it('should handle undefined variables in non-strict mode', () => {
      const nonStrictConditionals = new TemplateConditionals({ strictMode: false });
      const template = '{{#if undefinedVar == "test"}}yes{{else}}no{{/if}}';
      const result = nonStrictConditionals.processTemplate(template, {});
      expect(result).toBe('no');
    });

    it('should handle null values', () => {
      const template = '{{#if value == null}}is null{{else}}not null{{/if}}';
      expect(conditionals.processTemplate(template, { value: null })).toBe('is null');
      expect(conditionals.processTemplate(template, { value: 'something' })).toBe('not null');
    });
  });
});
