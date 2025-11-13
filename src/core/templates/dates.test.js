/**
 * Tests for Date Manipulation System
 *
 * Comprehensive test suite for date-fns powered date functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { dateHelpers, getDateHelperCount, getDateHelperNames } from './dates.js';
import { format, addDays, subDays, startOfMonth, endOfMonth } from 'date-fns';

describe('Date Helpers System', () => {
  let testDate;

  beforeEach(() => {
    // Use a fixed date for consistent testing: January 15, 2025 (Wednesday)
    testDate = new Date(2025, 0, 15); // Month is 0-indexed
  });

  // ========================================
  // Meta Tests
  // ========================================

  describe('Meta Functions', () => {
    it('should report correct number of helper functions', () => {
      const count = getDateHelperCount();
      expect(count).toBeGreaterThanOrEqual(50); // We have 50+ functions
    });

    it('should list all helper function names', () => {
      const names = getDateHelperNames();
      expect(names).toContain('now');
      expect(names).toContain('today');
      expect(names).toContain('format');
      expect(names).toContain('tomorrow');
      expect(names).toContain('yesterday');
    });
  });

  // ========================================
  // Current Date/Time Tests
  // ========================================

  describe('Current Date/Time', () => {
    it('should return current date and time with now()', () => {
      const now = dateHelpers.now();
      expect(now).toBeInstanceOf(Date);
      expect(now.getTime()).toBeCloseTo(Date.now(), -2); // Within 100ms
    });

    it('should return current date at start of day with today()', () => {
      const today = dateHelpers.today();
      expect(today).toBeInstanceOf(Date);
      expect(today.getHours()).toBe(0);
      expect(today.getMinutes()).toBe(0);
      expect(today.getSeconds()).toBe(0);
    });

    it('should return current timestamp', () => {
      const timestamp = dateHelpers.timestamp();
      expect(typeof timestamp).toBe('number');
      expect(timestamp).toBeCloseTo(Date.now(), -2);
    });
  });

  // ========================================
  // Date Formatting Tests
  // ========================================

  describe('Date Formatting', () => {
    it('should format date with custom pattern', () => {
      const formatted = dateHelpers.format(testDate, 'yyyy-MM-dd');
      expect(formatted).toBe('2025-01-15');
    });

    it('should format date with different patterns', () => {
      expect(dateHelpers.format(testDate, 'MMMM do, yyyy')).toBe('January 15th, 2025');
      expect(dateHelpers.format(testDate, 'EEE, MMM d')).toBe('Wed, Jan 15');
    });

    it('should convert to ISO string', () => {
      const iso = dateHelpers.toISO(testDate);
      expect(iso).toContain('2025-01-15');
      expect(iso).toContain('T');
    });

    it('should convert to ISO date only', () => {
      const isoDate = dateHelpers.toISODate(testDate);
      expect(isoDate).toBe('2025-01-15');
    });

    it('should format relative time', () => {
      const pastDate = subDays(new Date(), 3);
      const relative = dateHelpers.relative(pastDate);
      expect(relative).toContain('3 days ago');
    });

    it('should format relative to now', () => {
      const yesterday = subDays(new Date(), 1);
      const relative = dateHelpers.relativeToNow(yesterday);
      expect(relative.toLowerCase()).toContain('yesterday');
    });
  });

  // ========================================
  // Date Arithmetic Tests
  // ========================================

  describe('Date Arithmetic', () => {
    it('should add days to a date', () => {
      const result = dateHelpers.addDays(testDate, 5);
      expect(format(result, 'yyyy-MM-dd')).toBe('2025-01-20');
    });

    it('should subtract days from a date', () => {
      const result = dateHelpers.subDays(testDate, 5);
      expect(format(result, 'yyyy-MM-dd')).toBe('2025-01-10');
    });

    it('should add weeks to a date', () => {
      const result = dateHelpers.addWeeks(testDate, 2);
      expect(format(result, 'yyyy-MM-dd')).toBe('2025-01-29');
    });

    it('should subtract weeks from a date', () => {
      const result = dateHelpers.subWeeks(testDate, 1);
      expect(format(result, 'yyyy-MM-dd')).toBe('2025-01-08');
    });

    it('should add months to a date', () => {
      const result = dateHelpers.addMonths(testDate, 2);
      expect(format(result, 'yyyy-MM-dd')).toBe('2025-03-15');
    });

    it('should subtract months from a date', () => {
      const result = dateHelpers.subMonths(testDate, 1);
      expect(format(result, 'yyyy-MM-dd')).toBe('2024-12-15');
    });

    it('should add years to a date', () => {
      const result = dateHelpers.addYears(testDate, 1);
      expect(format(result, 'yyyy-MM-dd')).toBe('2026-01-15');
    });

    it('should subtract years from a date', () => {
      const result = dateHelpers.subYears(testDate, 1);
      expect(format(result, 'yyyy-MM-dd')).toBe('2024-01-15');
    });

    it('should support generic add with different units', () => {
      const days = dateHelpers.add(testDate, 3, 'days');
      expect(format(days, 'yyyy-MM-dd')).toBe('2025-01-18');

      const months = dateHelpers.add(testDate, 2, 'months');
      expect(format(months, 'yyyy-MM-dd')).toBe('2025-03-15');
    });

    it('should support generic subtract with different units', () => {
      const days = dateHelpers.subtract(testDate, 3, 'days');
      expect(format(days, 'yyyy-MM-dd')).toBe('2025-01-12');

      const months = dateHelpers.subtract(testDate, 2, 'months');
      expect(format(months, 'yyyy-MM-dd')).toBe('2024-11-15');
    });
  });

  // ========================================
  // Relative Dates Tests
  // ========================================

  describe('Relative Dates', () => {
    it('should return tomorrow', () => {
      const tomorrow = dateHelpers.tomorrow();
      const expected = addDays(new Date(), 1);
      expect(format(tomorrow, 'yyyy-MM-dd')).toBe(format(expected, 'yyyy-MM-dd'));
    });

    it('should return yesterday', () => {
      const yesterday = dateHelpers.yesterday();
      const expected = subDays(new Date(), 1);
      expect(format(yesterday, 'yyyy-MM-dd')).toBe(format(expected, 'yyyy-MM-dd'));
    });

    it('should return next week', () => {
      const nextWeek = dateHelpers.nextWeek();
      expect(nextWeek).toBeInstanceOf(Date);
    });

    it('should return last week', () => {
      const lastWeek = dateHelpers.lastWeek();
      expect(lastWeek).toBeInstanceOf(Date);
    });

    it('should return next month', () => {
      const nextMonth = dateHelpers.nextMonth();
      expect(nextMonth).toBeInstanceOf(Date);
    });

    it('should return last month', () => {
      const lastMonth = dateHelpers.lastMonth();
      expect(lastMonth).toBeInstanceOf(Date);
    });

    it('should return next year', () => {
      const nextYear = dateHelpers.nextYear();
      expect(nextYear).toBeInstanceOf(Date);
    });

    it('should return last year', () => {
      const lastYear = dateHelpers.lastYear();
      expect(lastYear).toBeInstanceOf(Date);
    });
  });

  // ========================================
  // Start/End of Periods Tests
  // ========================================

  describe('Start/End of Periods', () => {
    it('should get start of day', () => {
      const start = dateHelpers.startOfDay(testDate);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
    });

    it('should get end of day', () => {
      const end = dateHelpers.endOfDay(testDate);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
    });

    it('should get start of month', () => {
      const start = dateHelpers.startOfMonth(testDate);
      expect(format(start, 'yyyy-MM-dd')).toBe('2025-01-01');
    });

    it('should get end of month', () => {
      const end = dateHelpers.endOfMonth(testDate);
      expect(format(end, 'yyyy-MM-dd')).toBe('2025-01-31');
    });

    it('should get start of year', () => {
      const start = dateHelpers.startOfYear(testDate);
      expect(format(start, 'yyyy-MM-dd')).toBe('2025-01-01');
    });

    it('should get end of year', () => {
      const end = dateHelpers.endOfYear(testDate);
      expect(format(end, 'yyyy-MM-dd')).toBe('2025-12-31');
    });

    it('should get start of quarter', () => {
      const start = dateHelpers.startOfQuarter(testDate);
      expect(format(start, 'yyyy-MM-dd')).toBe('2025-01-01');
    });

    it('should get end of quarter', () => {
      const end = dateHelpers.endOfQuarter(testDate);
      expect(format(end, 'yyyy-MM-dd')).toBe('2025-03-31');
    });
  });

  // ========================================
  // Date Comparisons Tests
  // ========================================

  describe('Date Comparisons', () => {
    const futureDate = new Date(2025, 6, 1); // July 1, 2025

    it('should check if date is before another', () => {
      expect(dateHelpers.isBefore(testDate, futureDate)).toBe(true);
      expect(dateHelpers.isBefore(futureDate, testDate)).toBe(false);
    });

    it('should check if date is after another', () => {
      expect(dateHelpers.isAfter(futureDate, testDate)).toBe(true);
      expect(dateHelpers.isAfter(testDate, futureDate)).toBe(false);
    });

    it('should check if dates are equal', () => {
      const sameDate = new Date(testDate);
      expect(dateHelpers.isEqual(testDate, sameDate)).toBe(true);
    });

    it('should check if dates are on same day', () => {
      const sameDayDifferentTime = new Date(2025, 0, 15, 14, 30);
      expect(dateHelpers.isSameDay(testDate, sameDayDifferentTime)).toBe(true);
    });

    it('should check if date is today', () => {
      expect(dateHelpers.isToday(new Date())).toBe(true);
      expect(dateHelpers.isToday(testDate)).toBe(false);
    });

    it('should check if date is weekend', () => {
      const saturday = new Date(2025, 0, 18); // January 18, 2025
      const monday = new Date(2025, 0, 13);   // January 13, 2025
      expect(dateHelpers.isWeekend(saturday)).toBe(true);
      expect(dateHelpers.isWeekend(monday)).toBe(false);
    });

    it('should validate dates', () => {
      expect(dateHelpers.isValid(testDate)).toBe(true);
      expect(dateHelpers.isValid(new Date('invalid'))).toBe(false);
    });
  });

  // ========================================
  // Date Calculations Tests
  // ========================================

  describe('Date Calculations', () => {
    const futureDate = new Date(2025, 0, 20); // 5 days after testDate

    it('should calculate difference in days', () => {
      const diff = dateHelpers.differenceInDays(futureDate, testDate);
      expect(diff).toBe(5);
    });

    it('should calculate difference in weeks', () => {
      const twoWeeksLater = new Date(2025, 0, 29);
      const diff = dateHelpers.differenceInWeeks(twoWeeksLater, testDate);
      expect(diff).toBe(2);
    });

    it('should calculate difference in months', () => {
      const threeMonthsLater = new Date(2025, 3, 15);
      const diff = dateHelpers.differenceInMonths(threeMonthsLater, testDate);
      expect(diff).toBe(3);
    });

    it('should calculate difference in years', () => {
      const twoYearsLater = new Date(2027, 0, 15);
      const diff = dateHelpers.differenceInYears(twoYearsLater, testDate);
      expect(diff).toBe(2);
    });
  });

  // ========================================
  // Weekday Handling Tests
  // ========================================

  describe('Weekday Handling', () => {
    it('should get next Monday', () => {
      // testDate is Wednesday, Jan 15, 2025
      const nextMon = dateHelpers.nextMonday(testDate);
      expect(format(nextMon, 'yyyy-MM-dd')).toBe('2025-01-20');
    });

    it('should get next Friday', () => {
      const nextFri = dateHelpers.nextFriday(testDate);
      expect(format(nextFri, 'yyyy-MM-dd')).toBe('2025-01-17');
    });

    it('should get previous Monday', () => {
      const prevMon = dateHelpers.previousMonday(testDate);
      expect(format(prevMon, 'yyyy-MM-dd')).toBe('2025-01-13');
    });

    it('should get day of week', () => {
      const day = dateHelpers.getDay(testDate);
      expect(day).toBe(3); // Wednesday
    });
  });

  // ========================================
  // Calendar Utilities Tests
  // ========================================

  describe('Calendar Utilities', () => {
    it('should get days in month', () => {
      const days = dateHelpers.getDaysInMonth(testDate);
      expect(days).toBe(31); // January has 31 days
    });

    it('should get days in year', () => {
      const days = dateHelpers.getDaysInYear(testDate);
      expect(days).toBe(365); // 2025 is not a leap year
    });

    it('should check if leap year', () => {
      const leapYear = new Date(2024, 0, 1);
      const nonLeapYear = new Date(2025, 0, 1);
      expect(dateHelpers.isLeapYear(leapYear)).toBe(true);
      expect(dateHelpers.isLeapYear(nonLeapYear)).toBe(false);
    });

    it('should get quarter', () => {
      const q1 = dateHelpers.getQuarter(testDate); // January
      expect(q1).toBe(1);

      const q3 = dateHelpers.getQuarter(new Date(2025, 6, 1)); // July
      expect(q3).toBe(3);
    });

    it('should get week number', () => {
      const week = dateHelpers.getWeek(testDate);
      expect(week).toBeGreaterThan(0);
      expect(week).toBeLessThanOrEqual(53);
    });
  });

  // ========================================
  // Edge Cases Tests
  // ========================================

  describe('Edge Cases', () => {
    it('should handle month boundaries correctly', () => {
      const endOfJan = new Date(2025, 0, 31);
      const nextDay = dateHelpers.addDays(endOfJan, 1);
      expect(format(nextDay, 'yyyy-MM-dd')).toBe('2025-02-01');
    });

    it('should handle year boundaries correctly', () => {
      const endOfYear = new Date(2024, 11, 31);
      const nextDay = dateHelpers.addDays(endOfYear, 1);
      expect(format(nextDay, 'yyyy-MM-dd')).toBe('2025-01-01');
    });

    it('should handle leap year February correctly', () => {
      const feb2024 = new Date(2024, 1, 15);
      const days = dateHelpers.getDaysInMonth(feb2024);
      expect(days).toBe(29); // 2024 is a leap year
    });

    it('should handle string date inputs', () => {
      const result = dateHelpers.format('2025-01-15', 'MMMM d, yyyy');
      expect(result).toBe('January 15, 2025');
    });
  });

  // ========================================
  // Integration Tests
  // ========================================

  describe('Integration Tests', () => {
    it('should chain multiple date operations', () => {
      // Start with today, add 1 week, subtract 2 days, get start of week
      let date = dateHelpers.today();
      date = dateHelpers.addWeeks(date, 1);
      date = dateHelpers.subDays(date, 2);
      date = dateHelpers.startOfWeek(date);

      expect(date).toBeInstanceOf(Date);
    });

    it('should support complex date scenarios', () => {
      // Get the last day of next month
      let date = dateHelpers.nextMonth();
      date = dateHelpers.endOfMonth(date);

      expect(date).toBeInstanceOf(Date);
      expect(date.getHours()).toBe(23);
    });

    it('should work with all comparison operations', () => {
      const date1 = new Date(2025, 0, 15);
      const date2 = new Date(2025, 0, 20);

      expect(dateHelpers.isBefore(date1, date2)).toBe(true);
      expect(dateHelpers.isAfter(date2, date1)).toBe(true);
      expect(dateHelpers.differenceInDays(date2, date1)).toBe(5);
    });
  });
});
