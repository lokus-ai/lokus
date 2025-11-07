/**
 * Tests for Enhanced Date Variables
 *
 * Test suite for date-fns powered built-in variables
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BuiltinVariables } from './variables.js';
import { format, addDays } from 'date-fns';

describe('Enhanced Date Variables', () => {
  let variables;

  beforeEach(() => {
    variables = new BuiltinVariables();
  });

  // ========================================
  // Basic Date Variables (Backward Compatibility)
  // ========================================

  describe('Basic Date Variables', () => {
    it('should resolve basic date', () => {
      const date = variables.resolve('date');
      expect(typeof date).toBe('string');
      expect(date.length).toBeGreaterThan(0);
    });

    it('should resolve time', () => {
      const time = variables.resolve('time');
      expect(typeof time).toBe('string');
    });

    it('should resolve timestamp', () => {
      const timestamp = variables.resolve('timestamp');
      expect(typeof timestamp).toBe('number');
      expect(timestamp).toBeCloseTo(Date.now(), -2);
    });

    it('should resolve isodate', () => {
      const isodate = variables.resolve('isodate');
      expect(isodate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should resolve date.year', () => {
      const year = variables.resolve('date.year');
      expect(year).toBe(String(new Date().getFullYear()));
    });

    it('should resolve date.month', () => {
      const month = variables.resolve('date.month');
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
    });

    it('should resolve date.day', () => {
      const day = variables.resolve('date.day');
      expect(typeof day).toBe('string');
    });

    it('should resolve date.weekday', () => {
      const weekday = variables.resolve('date.weekday');
      expect(typeof weekday).toBe('string');
      expect(weekday.length).toBeGreaterThan(0);
    });
  });

  // ========================================
  // Enhanced Date Variables
  // ========================================

  describe('Relative Date Variables', () => {
    it('should resolve date.tomorrow', () => {
      const tomorrow = variables.resolve('date.tomorrow');
      const expected = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      expect(tomorrow).toBe(expected);
    });

    it('should resolve date.yesterday', () => {
      const yesterday = variables.resolve('date.yesterday');
      expect(yesterday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should resolve date.nextWeek', () => {
      const nextWeek = variables.resolve('date.nextWeek');
      expect(nextWeek).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should resolve date.lastWeek', () => {
      const lastWeek = variables.resolve('date.lastWeek');
      expect(lastWeek).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should resolve date.nextMonth', () => {
      const nextMonth = variables.resolve('date.nextMonth');
      expect(nextMonth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should resolve date.lastMonth', () => {
      const lastMonth = variables.resolve('date.lastMonth');
      expect(lastMonth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Period Boundary Variables', () => {
    it('should resolve date.startOfWeek', () => {
      const startOfWeek = variables.resolve('date.startOfWeek');
      expect(startOfWeek).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should resolve date.endOfWeek', () => {
      const endOfWeek = variables.resolve('date.endOfWeek');
      expect(endOfWeek).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should resolve date.startOfMonth', () => {
      const startOfMonth = variables.resolve('date.startOfMonth');
      expect(startOfMonth).toMatch(/^\d{4}-\d{2}-01$/);
    });

    it('should resolve date.endOfMonth', () => {
      const endOfMonth = variables.resolve('date.endOfMonth');
      expect(endOfMonth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should resolve date.startOfYear', () => {
      const startOfYear = variables.resolve('date.startOfYear');
      expect(startOfYear).toMatch(/^\d{4}-01-01$/);
    });

    it('should resolve date.endOfYear', () => {
      const endOfYear = variables.resolve('date.endOfYear');
      expect(endOfYear).toMatch(/^\d{4}-12-31$/);
    });
  });

  describe('Weekday Helper Variables', () => {
    it('should resolve date.nextMonday', () => {
      const nextMonday = variables.resolve('date.nextMonday');
      expect(nextMonday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should resolve date.nextFriday', () => {
      const nextFriday = variables.resolve('date.nextFriday');
      expect(nextFriday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should resolve date.previousMonday', () => {
      const previousMonday = variables.resolve('date.previousMonday');
      expect(previousMonday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Date Format Variables', () => {
    it('should resolve date.iso', () => {
      const iso = variables.resolve('date.iso');
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should resolve date.us', () => {
      const us = variables.resolve('date.us');
      expect(us).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    it('should resolve date.uk', () => {
      const uk = variables.resolve('date.uk');
      expect(uk).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    it('should resolve date.full', () => {
      const full = variables.resolve('date.full');
      expect(full).toMatch(/\w+, \w+ \d+(st|nd|rd|th), \d{4}/);
    });

    it('should resolve date.monthYear', () => {
      const monthYear = variables.resolve('date.monthYear');
      expect(monthYear).toMatch(/\w+ \d{4}/);
    });

    it('should resolve date.quarter', () => {
      const quarter = variables.resolve('date.quarter');
      expect(quarter).toMatch(/^Q[1-4]$/);
    });

    it('should resolve date.week', () => {
      const week = variables.resolve('date.week');
      expect(week).toMatch(/^Week \d+$/);
    });
  });

  describe('Calendar Utility Variables', () => {
    it('should resolve date.daysInMonth', () => {
      const daysInMonth = variables.resolve('date.daysInMonth');
      expect(daysInMonth).toBeGreaterThanOrEqual(28);
      expect(daysInMonth).toBeLessThanOrEqual(31);
    });

    it('should resolve date.isLeapYear', () => {
      const isLeapYear = variables.resolve('date.isLeapYear');
      expect(typeof isLeapYear).toBe('boolean');
    });
  });

  // ========================================
  // Date Helpers Access
  // ========================================

  describe('Date Helpers Access', () => {
    it('should provide access to date helpers', () => {
      const helpers = variables.getDateHelpers();
      expect(helpers).toBeDefined();
      expect(typeof helpers.format).toBe('function');
      expect(typeof helpers.add).toBe('function');
      expect(typeof helpers.subtract).toBe('function');
    });

    it('should have all expected helper functions', () => {
      const helpers = variables.getDateHelpers();
      const expectedFunctions = [
        'now', 'today', 'format', 'add', 'subtract',
        'tomorrow', 'yesterday', 'nextWeek', 'lastWeek',
        'startOfDay', 'endOfDay', 'startOfWeek', 'endOfWeek',
        'isBefore', 'isAfter', 'differenceInDays'
      ];

      for (const func of expectedFunctions) {
        expect(helpers[func]).toBeDefined();
        expect(typeof helpers[func]).toBe('function');
      }
    });
  });

  // ========================================
  // Variable Registry Tests
  // ========================================

  describe('Variable Registry', () => {
    it('should list all date variables', () => {
      const all = variables.list();
      const dateVars = all.filter(v => v.category === 'date');
      expect(dateVars.length).toBeGreaterThan(20);
    });

    it('should categorize date variables correctly', () => {
      const byCategory = variables.listByCategory();
      expect(byCategory.date).toBeDefined();
      expect(byCategory.date.length).toBeGreaterThan(20);
    });

    it('should have descriptions for all date variables', () => {
      const all = variables.list();
      const dateVars = all.filter(v => v.category === 'date');

      for (const dateVar of dateVars) {
        expect(dateVar.description).toBeDefined();
        expect(dateVar.description.length).toBeGreaterThan(0);
      }
    });

    it('should search date variables', () => {
      const results = variables.search('tomorrow');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(v => v.name === 'date.tomorrow')).toBe(true);
    });
  });

  // ========================================
  // Resolve All Tests
  // ========================================

  describe('Resolve All', () => {
    it('should resolve all date variables at once', () => {
      const resolved = variables.resolveAll();

      expect(resolved.date).toBeDefined();
      expect(resolved.time).toBeDefined();
      expect(resolved['date.tomorrow']).toBeDefined();
      expect(resolved['date.yesterday']).toBeDefined();
      expect(resolved['date.startOfMonth']).toBeDefined();
      expect(resolved['date.endOfMonth']).toBeDefined();
    });

    it('should have all date variables in resolved object', () => {
      const resolved = variables.resolveAll();
      const dateKeys = Object.keys(resolved).filter(k => k.startsWith('date') || k === 'timestamp');

      expect(dateKeys.length).toBeGreaterThan(25);
    });
  });

  // ========================================
  // Statistics Tests
  // ========================================

  describe('Statistics', () => {
    it('should report correct statistics', () => {
      const stats = variables.getStatistics();
      expect(stats.total).toBeGreaterThan(30);
      expect(stats.byCategory.date).toBeGreaterThan(20);
    });
  });

  // ========================================
  // Integration Tests
  // ========================================

  describe('Integration', () => {
    it('should work seamlessly with all date variables', () => {
      const dateVarNames = [
        'date', 'time', 'datetime', 'timestamp', 'isodate',
        'date.tomorrow', 'date.yesterday', 'date.nextWeek',
        'date.startOfMonth', 'date.endOfMonth', 'date.nextMonday'
      ];

      for (const name of dateVarNames) {
        const value = variables.resolve(name);
        expect(value).toBeDefined();
      }
    });

    it('should maintain backward compatibility', () => {
      // Old variables should still work
      const oldVars = ['date', 'time', 'datetime', 'timestamp', 'isodate'];

      for (const name of oldVars) {
        expect(variables.has(name)).toBe(true);
        const value = variables.resolve(name);
        expect(value).toBeDefined();
      }
    });
  });
});
