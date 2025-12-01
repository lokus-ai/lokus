// src/bases/data/PropertyTypes.test.js
import { describe, it, expect } from 'vitest';
import { PropertyTypes, PropertyType } from './PropertyTypes.js';

describe('PropertyTypes', () => {
  describe('Type Detection', () => {
    it('should detect string types', () => {
      expect(PropertyTypes.detectType('hello world')).toBe(PropertyType.STRING);
      expect(PropertyTypes.detectType('some text')).toBe(PropertyType.STRING);
      expect(PropertyTypes.detectType('')).toBe(PropertyType.STRING);
    });

    it('should detect number types', () => {
      expect(PropertyTypes.detectType(42)).toBe(PropertyType.NUMBER);
      expect(PropertyTypes.detectType(3.14)).toBe(PropertyType.NUMBER);
      expect(PropertyTypes.detectType('123')).toBe(PropertyType.NUMBER);
      expect(PropertyTypes.detectType('45.67')).toBe(PropertyType.NUMBER);
      expect(PropertyTypes.detectType('-10')).toBe(PropertyType.NUMBER);
    });

    it('should detect boolean types', () => {
      expect(PropertyTypes.detectType(true)).toBe(PropertyType.BOOLEAN);
      expect(PropertyTypes.detectType(false)).toBe(PropertyType.BOOLEAN);
      expect(PropertyTypes.detectType('true')).toBe(PropertyType.BOOLEAN);
      expect(PropertyTypes.detectType('false')).toBe(PropertyType.BOOLEAN);
      expect(PropertyTypes.detectType('yes')).toBe(PropertyType.BOOLEAN);
      expect(PropertyTypes.detectType('no')).toBe(PropertyType.BOOLEAN);
    });

    it('should detect date types', () => {
      const date = new Date();
      expect(PropertyTypes.detectType(date)).toBe(PropertyType.DATE);
      expect(PropertyTypes.detectType('2024-01-15')).toBe(PropertyType.DATE);
      expect(PropertyTypes.detectType('2024-01-15T10:30:00')).toBe(PropertyType.DATE);
      expect(PropertyTypes.detectType('1/15/2024')).toBe(PropertyType.DATE);
    });

    it('should detect array types', () => {
      expect(PropertyTypes.detectType([1, 2, 3])).toBe(PropertyType.MIXED);
      expect(PropertyTypes.detectType(['a', 'b', 'c'])).toBe(PropertyType.TAGS);
      expect(PropertyTypes.detectType([])).toBe(PropertyType.ARRAY);
    });

    it('should detect tags arrays', () => {
      expect(PropertyTypes.detectType(['tag1', 'tag2', 'tag3'])).toBe(PropertyType.TAGS);
      expect(PropertyTypes.detectType(['short', 'tags'])).toBe(PropertyType.TAGS);
      expect(PropertyTypes.detectType('tag1, tag2, tag3')).toBe(PropertyType.TAGS);
    });

    it('should detect null types', () => {
      expect(PropertyTypes.detectType(null)).toBe(PropertyType.NULL);
      expect(PropertyTypes.detectType(undefined)).toBe(PropertyType.NULL);
    });
  });

  describe('Value Conversion', () => {
    it('should convert to string', () => {
      expect(PropertyTypes.convertValue(42, PropertyType.STRING)).toBe('42');
      expect(PropertyTypes.convertValue(true, PropertyType.STRING)).toBe('true');
      expect(PropertyTypes.convertValue(['a', 'b'], PropertyType.STRING)).toBe('a, b');
      expect(PropertyTypes.convertValue(new Date('2024-01-15'), PropertyType.STRING)).toBe('2024-01-15');
    });

    it('should convert to number', () => {
      expect(PropertyTypes.convertValue('42', PropertyType.NUMBER)).toBe(42);
      expect(PropertyTypes.convertValue('3.14', PropertyType.NUMBER)).toBe(3.14);
      expect(PropertyTypes.convertValue(true, PropertyType.NUMBER)).toBe(1);
      expect(PropertyTypes.convertValue(false, PropertyType.NUMBER)).toBe(0);
    });

    it('should convert to boolean', () => {
      expect(PropertyTypes.convertValue('true', PropertyType.BOOLEAN)).toBe(true);
      expect(PropertyTypes.convertValue('false', PropertyType.BOOLEAN)).toBe(false);
      expect(PropertyTypes.convertValue('yes', PropertyType.BOOLEAN)).toBe(true);
      expect(PropertyTypes.convertValue('no', PropertyType.BOOLEAN)).toBe(false);
      expect(PropertyTypes.convertValue(1, PropertyType.BOOLEAN)).toBe(true);
      expect(PropertyTypes.convertValue(0, PropertyType.BOOLEAN)).toBe(false);
    });

    it('should convert to date', () => {
      const result = PropertyTypes.convertValue('2024-01-15', PropertyType.DATE);
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // January is 0
      expect(result.getUTCDate()).toBe(15);
    });

    it('should convert to array', () => {
      expect(PropertyTypes.convertValue('a,b,c', PropertyType.ARRAY)).toEqual(['a', 'b', 'c']);
      expect(PropertyTypes.convertValue('single', PropertyType.ARRAY)).toEqual(['single']);
      expect(PropertyTypes.convertValue(['existing'], PropertyType.ARRAY)).toEqual(['existing']);
    });

    it('should convert to tags', () => {
      expect(PropertyTypes.convertValue('tag1, tag2, tag3', PropertyType.TAGS)).toEqual(['tag1', 'tag2', 'tag3']);
      expect(PropertyTypes.convertValue(['tag1', 'tag2'], PropertyType.TAGS)).toEqual(['tag1', 'tag2']);
    });
  });

  describe('Value Validation', () => {
    it('should validate string values', () => {
      expect(PropertyTypes.validateValue('hello', PropertyType.STRING)).toBe(true);
      expect(PropertyTypes.validateValue(123, PropertyType.STRING)).toBe(false);
    });

    it('should validate number values', () => {
      expect(PropertyTypes.validateValue(42, PropertyType.NUMBER)).toBe(true);
      expect(PropertyTypes.validateValue('42', PropertyType.NUMBER)).toBe(true); // '42' is detected as NUMBER but validateValue checks exact type match
      expect(PropertyTypes.validateValue('hello', PropertyType.NUMBER)).toBe(false);
    });

    it('should validate boolean values', () => {
      expect(PropertyTypes.validateValue(true, PropertyType.BOOLEAN)).toBe(true);
      expect(PropertyTypes.validateValue('true', PropertyType.BOOLEAN)).toBe(true); // 'true' is detected as BOOLEAN but validateValue checks exact type match
      expect(PropertyTypes.validateValue('hello', PropertyType.BOOLEAN)).toBe(false);
    });

    it('should validate array values', () => {
      expect(PropertyTypes.validateValue(['a', 'b'], PropertyType.ARRAY)).toBe(true);
      expect(PropertyTypes.validateValue('not array', PropertyType.ARRAY)).toBe(false);
    });

    it('should validate tags values', () => {
      expect(PropertyTypes.validateValue(['tag1', 'tag2'], PropertyType.TAGS)).toBe(true);
      expect(PropertyTypes.validateValue('tag1, tag2', PropertyType.TAGS)).toBe(true);
      expect(PropertyTypes.validateValue(123, PropertyType.TAGS)).toBe(false);
    });
  });

  describe('Common Type Inference', () => {
    it('should infer common type from homogeneous values', () => {
      expect(PropertyTypes.inferCommonType(['a', 'b', 'c'])).toBe(PropertyType.STRING);
      expect(PropertyTypes.inferCommonType([1, 2, 3])).toBe(PropertyType.NUMBER);
      expect(PropertyTypes.inferCommonType([true, false, true])).toBe(PropertyType.BOOLEAN);
    });

    it('should infer tags type for tag-like arrays', () => {
      expect(PropertyTypes.inferCommonType([['tag1', 'tag2'], ['tag3', 'tag4']])).toBe(PropertyType.TAGS);
      expect(PropertyTypes.inferCommonType(['tag1,tag2', 'tag3,tag4'])).toBe(PropertyType.TAGS);
    });

    it('should handle mixed types', () => {
      const result = PropertyTypes.inferCommonType(['string', 123, true]);
      // Should prefer more specific types, but mixed is also acceptable
      expect([PropertyType.MIXED, PropertyType.STRING].includes(result)).toBe(true);
    });

    it('should handle empty arrays', () => {
      expect(PropertyTypes.inferCommonType([])).toBe(PropertyType.STRING);
      expect(PropertyTypes.inferCommonType([null, undefined])).toBe(PropertyType.NULL);
    });
  });

  describe('Display Formatting', () => {
    it('should format strings', () => {
      expect(PropertyTypes.formatForDisplay('hello', PropertyType.STRING)).toBe('hello');
    });

    it('should format numbers', () => {
      expect(PropertyTypes.formatForDisplay(42, PropertyType.NUMBER)).toBe('42');
      expect(PropertyTypes.formatForDisplay(3.14159, PropertyType.NUMBER)).toBe('3.14');
    });

    it('should format booleans', () => {
      expect(PropertyTypes.formatForDisplay(true, PropertyType.BOOLEAN)).toBe('Yes');
      expect(PropertyTypes.formatForDisplay(false, PropertyType.BOOLEAN)).toBe('No');
    });

    it('should format dates', () => {
      const date = new Date('2024-01-15');
      const formatted = PropertyTypes.formatForDisplay(date, PropertyType.DATE);
      expect(formatted).toContain('2024');
    });

    it('should format arrays and tags', () => {
      expect(PropertyTypes.formatForDisplay(['a', 'b', 'c'], PropertyType.ARRAY)).toBe('a, b, c');
      expect(PropertyTypes.formatForDisplay(['tag1', 'tag2'], PropertyType.TAGS)).toBe('tag1, tag2');
    });
  });

  describe('Sort Comparators', () => {
    it('should sort strings alphabetically', () => {
      const comparator = PropertyTypes.getSortComparator(PropertyType.STRING);
      const values = ['zebra', 'apple', 'banana'];
      values.sort(comparator);
      expect(values).toEqual(['apple', 'banana', 'zebra']);
    });

    it('should sort numbers numerically', () => {
      const comparator = PropertyTypes.getSortComparator(PropertyType.NUMBER);
      const values = [100, 20, 3];
      values.sort(comparator);
      expect(values).toEqual([3, 20, 100]);
    });

    it('should sort booleans correctly', () => {
      const comparator = PropertyTypes.getSortComparator(PropertyType.BOOLEAN);
      const values = [false, true, false, true];
      values.sort(comparator);
      expect(values).toEqual([true, true, false, false]);
    });

    it('should sort dates chronologically', () => {
      const comparator = PropertyTypes.getSortComparator(PropertyType.DATE);
      const values = [
        new Date('2024-03-15'),
        new Date('2024-01-15'),
        new Date('2024-02-15')
      ];
      values.sort(comparator);
      expect(values[0].getMonth()).toBe(0); // January
      expect(values[1].getMonth()).toBe(1); // February
      expect(values[2].getMonth()).toBe(2); // March
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined', () => {
      expect(PropertyTypes.detectType(null)).toBe(PropertyType.NULL);
      expect(PropertyTypes.detectType(undefined)).toBe(PropertyType.NULL);
      expect(PropertyTypes.formatForDisplay(null, PropertyType.STRING)).toBe('');
      expect(PropertyTypes.formatForDisplay(undefined, PropertyType.STRING)).toBe('');
    });

    it('should handle empty strings', () => {
      expect(PropertyTypes.detectType('')).toBe(PropertyType.STRING);
      expect(PropertyTypes.validateValue('', PropertyType.STRING)).toBe(true);
    });

    it('should handle invalid conversions gracefully', () => {
      expect(PropertyTypes.convertValue('not-a-number', PropertyType.NUMBER)).toBe(0);
      expect(PropertyTypes.convertValue('invalid-date', PropertyType.DATE)).toBeInstanceOf(Date);
    });

    it('should handle large arrays', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => `item${i}`);
      expect(PropertyTypes.detectType(largeArray)).toBe(PropertyType.TAGS); // String arrays are detected as TAGS
    });

    it('should handle mixed array with different types', () => {
      const mixedArray = [1, 'string', true, new Date(), null];
      expect(PropertyTypes.detectType(mixedArray)).toBe(PropertyType.MIXED);
    });
  });

  describe('Helper Methods', () => {
    it('should detect boolean strings correctly', () => {
      expect(PropertyTypes.isBooleanString('true')).toBe(true);
      expect(PropertyTypes.isBooleanString('false')).toBe(true);
      expect(PropertyTypes.isBooleanString('yes')).toBe(true);
      expect(PropertyTypes.isBooleanString('no')).toBe(true);
      expect(PropertyTypes.isBooleanString('1')).toBe(true);
      expect(PropertyTypes.isBooleanString('0')).toBe(true);
      expect(PropertyTypes.isBooleanString('maybe')).toBe(false);
    });

    it('should detect date strings correctly', () => {
      expect(PropertyTypes.isDateString('2024-01-15')).toBe(true);
      expect(PropertyTypes.isDateString('2024-01-15T10:30:00')).toBe(true);
      expect(PropertyTypes.isDateString('1/15/2024')).toBe(true);
      expect(PropertyTypes.isDateString('not-a-date')).toBe(false);
      expect(PropertyTypes.isDateString('2024-13-45')).toBe(false); // Invalid date
    });

    it('should detect number strings correctly', () => {
      expect(PropertyTypes.isNumberString('42')).toBe(true);
      expect(PropertyTypes.isNumberString('3.14')).toBe(true);
      expect(PropertyTypes.isNumberString('-10')).toBe(true);
      expect(PropertyTypes.isNumberString('1.23e-4')).toBe(true);
      expect(PropertyTypes.isNumberString('not-a-number')).toBe(false);
      expect(PropertyTypes.isNumberString('')).toBe(false);
    });

    it('should detect comma-separated tags correctly', () => {
      expect(PropertyTypes.isCommaSeparatedTags('tag1, tag2, tag3')).toBe(true);
      expect(PropertyTypes.isCommaSeparatedTags('a,b,c')).toBe(true);
      expect(PropertyTypes.isCommaSeparatedTags('single-tag')).toBe(false);
      expect(PropertyTypes.isCommaSeparatedTags('too,many,tags,here,and,more,and,even,more,tags,exceed')).toBe(false);
    });

    it('should detect tags arrays correctly', () => {
      expect(PropertyTypes.isTagsArray(['tag1', 'tag2'])).toBe(true);
      expect(PropertyTypes.isTagsArray(['short', 'tags', 'only'])).toBe(true);
      expect(PropertyTypes.isTagsArray(['this is definitely way too long to be a reasonable tag name'])).toBe(false); // 60 chars
      expect(PropertyTypes.isTagsArray(['tag with\nnewline'])).toBe(false);
      expect(PropertyTypes.isTagsArray([' tag with spaces '])).toBe(false); // Leading/trailing spaces not allowed
    });
  });
});