/**
 * Tests for Template Prompts System
 */

import { TemplatePrompts } from './prompts.js';

describe('TemplatePrompts', () => {
  let promptsParser;

  beforeEach(() => {
    promptsParser = new TemplatePrompts();
  });

  describe('parseTextPrompts', () => {
    it('should parse basic text prompt', () => {
      const template = '{{prompt:name:What is your name?:John}}';
      const prompts = promptsParser.parsePrompts(template);

      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toMatchObject({
        type: 'prompt',
        varName: 'name',
        question: 'What is your name?',
        defaultValue: 'John'
      });
    });

    it('should parse text prompt without default', () => {
      const template = '{{prompt:name:What is your name?}}';
      const prompts = promptsParser.parsePrompts(template);

      expect(prompts).toHaveLength(1);
      expect(prompts[0].defaultValue).toBe('');
    });

    it('should parse multiple text prompts', () => {
      const template = '{{prompt:name:Name?:John}} and {{prompt:age:Age?:25}}';
      const prompts = promptsParser.parsePrompts(template);

      expect(prompts).toHaveLength(2);
      expect(prompts[0].varName).toBe('name');
      expect(prompts[1].varName).toBe('age');
    });
  });

  describe('parseSuggestPrompts', () => {
    it('should parse suggest prompt with options', () => {
      const template = '{{suggest:status:Select status:Todo,In Progress,Done:Todo}}';
      const prompts = promptsParser.parsePrompts(template);

      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toMatchObject({
        type: 'suggest',
        varName: 'status',
        question: 'Select status',
        options: ['Todo', 'In Progress', 'Done'],
        defaultValue: 'Todo'
      });
    });

    it('should parse suggest prompt without default', () => {
      const template = '{{suggest:status:Select status:Todo,Done}}';
      const prompts = promptsParser.parsePrompts(template);

      expect(prompts[0].defaultValue).toBe('Todo'); // Uses first option
    });

    it('should handle options with spaces', () => {
      const template = '{{suggest:status:Select:Option 1, Option 2, Option 3:Option 1}}';
      const prompts = promptsParser.parsePrompts(template);

      expect(prompts[0].options).toEqual(['Option 1', 'Option 2', 'Option 3']);
    });
  });

  describe('parseCheckboxPrompts', () => {
    it('should parse checkbox with true default', () => {
      const template = '{{checkbox:public:Make public?:true}}';
      const prompts = promptsParser.parsePrompts(template);

      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toMatchObject({
        type: 'checkbox',
        varName: 'public',
        question: 'Make public?',
        defaultValue: true
      });
    });

    it('should parse checkbox with false default', () => {
      const template = '{{checkbox:public:Make public?:false}}';
      const prompts = promptsParser.parsePrompts(template);

      expect(prompts[0].defaultValue).toBe(false);
    });

    it('should parse checkbox without default', () => {
      const template = '{{checkbox:public:Make public?}}';
      const prompts = promptsParser.parsePrompts(template);

      expect(prompts[0].defaultValue).toBe(false);
    });
  });

  describe('replacePrompts', () => {
    it('should replace text prompts with values', () => {
      const template = 'Hello {{prompt:name:Name?:John}}!';
      const values = { name: 'Alice' };
      const result = promptsParser.replacePrompts(template, values);

      expect(result).toBe('Hello Alice!');
    });

    it('should replace suggest prompts with values', () => {
      const template = 'Status: {{suggest:status:Status?:Todo,Done:Todo}}';
      const values = { status: 'Done' };
      const result = promptsParser.replacePrompts(template, values);

      expect(result).toBe('Status: Done');
    });

    it('should replace checkbox prompts with values', () => {
      const template = 'Public: {{checkbox:public:Public?:false}}';
      const values = { public: true };
      const result = promptsParser.replacePrompts(template, values);

      expect(result).toBe('Public: true');
    });

    it('should use default values when no value provided', () => {
      const template = 'Hello {{prompt:name:Name?:John}}!';
      const values = {};
      const result = promptsParser.replacePrompts(template, values);

      expect(result).toBe('Hello John!');
    });

    it('should handle multiple prompt types', () => {
      const template = `Name: {{prompt:name:Name?:John}}
Status: {{suggest:status:Status?:Active,Inactive:Active}}
Public: {{checkbox:public:Public?:true}}`;

      const values = {
        name: 'Alice',
        status: 'Inactive',
        public: false
      };

      const result = promptsParser.replacePrompts(template, values);

      expect(result).toContain('Name: Alice');
      expect(result).toContain('Status: Inactive');
      expect(result).toContain('Public: false');
    });
  });

  describe('validation', () => {
    it('should validate correct template', () => {
      const template = '{{prompt:name:Name?:John}} {{suggest:status:Status?:A,B:A}}';
      const validation = promptsParser.validate(template);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect suggest prompts without options', () => {
      // Note: The regex requires at least something between the colons, so this test
      // checks a case where the options string exists but has no valid options after splitting
      const template = '{{suggest:status:Status?: :Default}}';
      const validation = promptsParser.validate(template);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Suggest prompts must have at least one option');
    });

    it('should warn about many prompts', () => {
      let template = '';
      for (let i = 0; i < 11; i++) {
        template += `{{prompt:var${i}:Question ${i}?:Default}} `;
      }
      const validation = promptsParser.validate(template);

      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('statistics', () => {
    it('should calculate statistics correctly', () => {
      const template = `
        {{prompt:name:Name?:John}}
        {{prompt:age:Age?:25}}
        {{suggest:status:Status?:A,B,C:A}}
        {{checkbox:public:Public?:true}}
      `;

      const stats = promptsParser.getStatistics(template);

      expect(stats.total).toBe(4);
      expect(stats.byType.prompt).toBe(2);
      expect(stats.byType.suggest).toBe(1);
      expect(stats.byType.checkbox).toBe(1);
      expect(stats.withDefaults).toBe(4);
      expect(stats.uniqueVariables).toBe(4);
    });
  });

  describe('memory feature', () => {
    it('should remember values', () => {
      promptsParser.rememberValue('name', 'Alice');
      expect(promptsParser.getPreviousValue('name')).toBe('Alice');
    });

    it('should clear memory', () => {
      promptsParser.rememberValue('name', 'Alice');
      promptsParser.clearMemory();
      expect(promptsParser.getPreviousValue('name')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty template', () => {
      const prompts = promptsParser.parsePrompts('');
      expect(prompts).toHaveLength(0);
    });

    it('should handle template with no prompts', () => {
      const template = 'Just plain text with {{variables}}';
      const prompts = promptsParser.parsePrompts(template);
      expect(prompts).toHaveLength(0);
    });

    it('should handle duplicate variable names', () => {
      const template = '{{prompt:name:Q1?:A}} {{prompt:name:Q2?:B}}';
      const prompts = promptsParser.parsePrompts(template);
      // Should only return one (duplicates removed)
      expect(prompts).toHaveLength(1);
    });

    it('should handle special characters in questions', () => {
      const template = '{{prompt:name:What\'s your name?:John\'s}}';
      const prompts = promptsParser.parsePrompts(template);
      expect(prompts[0].question).toBe("What's your name?");
    });
  });
});
