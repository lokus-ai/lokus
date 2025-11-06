/**
 * Date Manipulation System
 *
 * Comprehensive date handling powered by date-fns
 * Provides 30+ functions for date arithmetic, formatting, comparisons, and calculations
 */

import {
  format,
  parse,
  parseISO,
  isValid,
  add,
  sub,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  endOfDay,
  endOfWeek,
  endOfMonth,
  endOfYear,
  isBefore,
  isAfter,
  isEqual,
  isSameDay,
  isSameWeek,
  isSameMonth,
  isSameYear,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  differenceInYears,
  differenceInHours,
  differenceInMinutes,
  getDay,
  getDate,
  getMonth,
  getYear,
  setDay,
  setDate,
  setMonth,
  setYear,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  nextSunday,
  previousMonday,
  previousTuesday,
  previousWednesday,
  previousThursday,
  previousFriday,
  previousSaturday,
  previousSunday,
  formatDistance,
  formatRelative,
  isToday,
  isTomorrow,
  isYesterday,
  isWeekend,
  getDaysInMonth,
  getDaysInYear,
  isLeapYear,
  getWeek,
  getQuarter,
  startOfQuarter,
  endOfQuarter
} from 'date-fns';

/**
 * Date Helpers Object
 *
 * Provides comprehensive date manipulation functionality
 */
export const dateHelpers = {
  // ========================================
  // Current Date/Time
  // ========================================

  /**
   * Get current date and time
   */
  now: () => new Date(),

  /**
   * Get current date at start of day (00:00:00)
   */
  today: () => startOfDay(new Date()),

  /**
   * Get current timestamp in milliseconds
   */
  timestamp: () => Date.now(),

  // ========================================
  // Date Formatting
  // ========================================

  /**
   * Format a date with a custom pattern
   * @param {Date|string|number} date - Date to format
   * @param {string} pattern - Format pattern (e.g., 'yyyy-MM-dd', 'MMMM do, yyyy')
   * @returns {string} Formatted date string
   *
   * Common patterns:
   * - 'yyyy-MM-dd' -> 2023-01-15
   * - 'MMMM do, yyyy' -> January 15th, 2023
   * - 'EEE, MMM d' -> Mon, Jan 15
   * - 'h:mm a' -> 2:30 PM
   */
  format: (date, pattern = 'yyyy-MM-dd') => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return format(d, pattern);
  },

  /**
   * Format date as ISO string (YYYY-MM-DDTHH:mm:ss.sssZ)
   */
  toISO: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return d.toISOString();
  },

  /**
   * Format date as ISO date only (YYYY-MM-DD)
   */
  toISODate: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return format(d, 'yyyy-MM-dd');
  },

  /**
   * Format relative time (e.g., "2 days ago", "in 3 hours")
   */
  relative: (date, baseDate = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return formatDistance(d, baseDate, { addSuffix: true });
  },

  /**
   * Format date relative to now (e.g., "yesterday at 10:30 AM")
   */
  relativeToNow: (date) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return formatRelative(d, new Date());
  },

  // ========================================
  // Date Arithmetic
  // ========================================

  /**
   * Add time to a date
   * @param {Date|string|number} date - Base date
   * @param {number} amount - Amount to add
   * @param {string} unit - Unit ('days', 'weeks', 'months', 'years', 'hours', 'minutes')
   */
  add: (date = new Date(), amount = 1, unit = 'days') => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return add(d, { [unit]: amount });
  },

  /**
   * Subtract time from a date
   * @param {Date|string|number} date - Base date
   * @param {number} amount - Amount to subtract
   * @param {string} unit - Unit ('days', 'weeks', 'months', 'years', 'hours', 'minutes')
   */
  subtract: (date = new Date(), amount = 1, unit = 'days') => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return sub(d, { [unit]: amount });
  },

  /**
   * Add days to a date
   */
  addDays: (date = new Date(), days = 1) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return addDays(d, days);
  },

  /**
   * Add weeks to a date
   */
  addWeeks: (date = new Date(), weeks = 1) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return addWeeks(d, weeks);
  },

  /**
   * Add months to a date
   */
  addMonths: (date = new Date(), months = 1) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return addMonths(d, months);
  },

  /**
   * Add years to a date
   */
  addYears: (date = new Date(), years = 1) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return addYears(d, years);
  },

  /**
   * Subtract days from a date
   */
  subDays: (date = new Date(), days = 1) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return subDays(d, days);
  },

  /**
   * Subtract weeks from a date
   */
  subWeeks: (date = new Date(), weeks = 1) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return subWeeks(d, weeks);
  },

  /**
   * Subtract months from a date
   */
  subMonths: (date = new Date(), months = 1) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return subMonths(d, months);
  },

  /**
   * Subtract years from a date
   */
  subYears: (date = new Date(), years = 1) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return subYears(d, years);
  },

  // ========================================
  // Relative Dates
  // ========================================

  /**
   * Get tomorrow's date
   */
  tomorrow: () => addDays(new Date(), 1),

  /**
   * Get yesterday's date
   */
  yesterday: () => subDays(new Date(), 1),

  /**
   * Get date one week from now
   */
  nextWeek: () => addWeeks(new Date(), 1),

  /**
   * Get date one week ago
   */
  lastWeek: () => subWeeks(new Date(), 1),

  /**
   * Get date one month from now
   */
  nextMonth: () => addMonths(new Date(), 1),

  /**
   * Get date one month ago
   */
  lastMonth: () => subMonths(new Date(), 1),

  /**
   * Get date one year from now
   */
  nextYear: () => addYears(new Date(), 1),

  /**
   * Get date one year ago
   */
  lastYear: () => subYears(new Date(), 1),

  // ========================================
  // Start/End of Periods
  // ========================================

  /**
   * Get start of day (00:00:00)
   */
  startOfDay: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return startOfDay(d);
  },

  /**
   * Get end of day (23:59:59.999)
   */
  endOfDay: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return endOfDay(d);
  },

  /**
   * Get start of week (Sunday by default)
   */
  startOfWeek: (date = new Date(), options = {}) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return startOfWeek(d, options);
  },

  /**
   * Get end of week
   */
  endOfWeek: (date = new Date(), options = {}) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return endOfWeek(d, options);
  },

  /**
   * Get start of month
   */
  startOfMonth: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return startOfMonth(d);
  },

  /**
   * Get end of month
   */
  endOfMonth: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return endOfMonth(d);
  },

  /**
   * Get start of year
   */
  startOfYear: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return startOfYear(d);
  },

  /**
   * Get end of year
   */
  endOfYear: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return endOfYear(d);
  },

  /**
   * Get start of quarter
   */
  startOfQuarter: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return startOfQuarter(d);
  },

  /**
   * Get end of quarter
   */
  endOfQuarter: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return endOfQuarter(d);
  },

  // ========================================
  // Date Comparisons
  // ========================================

  /**
   * Check if date is before another date
   */
  isBefore: (date1, date2 = new Date()) => {
    const d1 = typeof date1 === 'string' ? parseISO(date1) : new Date(date1);
    const d2 = typeof date2 === 'string' ? parseISO(date2) : new Date(date2);
    return isBefore(d1, d2);
  },

  /**
   * Check if date is after another date
   */
  isAfter: (date1, date2 = new Date()) => {
    const d1 = typeof date1 === 'string' ? parseISO(date1) : new Date(date1);
    const d2 = typeof date2 === 'string' ? parseISO(date2) : new Date(date2);
    return isAfter(d1, d2);
  },

  /**
   * Check if two dates are equal
   */
  isEqual: (date1, date2 = new Date()) => {
    const d1 = typeof date1 === 'string' ? parseISO(date1) : new Date(date1);
    const d2 = typeof date2 === 'string' ? parseISO(date2) : new Date(date2);
    return isEqual(d1, d2);
  },

  /**
   * Check if two dates are on the same day
   */
  isSameDay: (date1, date2 = new Date()) => {
    const d1 = typeof date1 === 'string' ? parseISO(date1) : new Date(date1);
    const d2 = typeof date2 === 'string' ? parseISO(date2) : new Date(date2);
    return isSameDay(d1, d2);
  },

  /**
   * Check if two dates are in the same week
   */
  isSameWeek: (date1, date2 = new Date()) => {
    const d1 = typeof date1 === 'string' ? parseISO(date1) : new Date(date1);
    const d2 = typeof date2 === 'string' ? parseISO(date2) : new Date(date2);
    return isSameWeek(d1, d2);
  },

  /**
   * Check if two dates are in the same month
   */
  isSameMonth: (date1, date2 = new Date()) => {
    const d1 = typeof date1 === 'string' ? parseISO(date1) : new Date(date1);
    const d2 = typeof date2 === 'string' ? parseISO(date2) : new Date(date2);
    return isSameMonth(d1, d2);
  },

  /**
   * Check if two dates are in the same year
   */
  isSameYear: (date1, date2 = new Date()) => {
    const d1 = typeof date1 === 'string' ? parseISO(date1) : new Date(date1);
    const d2 = typeof date2 === 'string' ? parseISO(date2) : new Date(date2);
    return isSameYear(d1, d2);
  },

  /**
   * Check if date is today
   */
  isToday: (date) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isToday(d);
  },

  /**
   * Check if date is tomorrow
   */
  isTomorrow: (date) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isTomorrow(d);
  },

  /**
   * Check if date is yesterday
   */
  isYesterday: (date) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isYesterday(d);
  },

  /**
   * Check if date falls on a weekend
   */
  isWeekend: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isWeekend(d);
  },

  /**
   * Check if date is valid
   */
  isValid: (date) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isValid(d);
  },

  // ========================================
  // Date Calculations
  // ========================================

  /**
   * Calculate difference in days between two dates
   */
  differenceInDays: (date1, date2 = new Date()) => {
    const d1 = typeof date1 === 'string' ? parseISO(date1) : new Date(date1);
    const d2 = typeof date2 === 'string' ? parseISO(date2) : new Date(date2);
    return differenceInDays(d1, d2);
  },

  /**
   * Calculate difference in weeks between two dates
   */
  differenceInWeeks: (date1, date2 = new Date()) => {
    const d1 = typeof date1 === 'string' ? parseISO(date1) : new Date(date1);
    const d2 = typeof date2 === 'string' ? parseISO(date2) : new Date(date2);
    return differenceInWeeks(d1, d2);
  },

  /**
   * Calculate difference in months between two dates
   */
  differenceInMonths: (date1, date2 = new Date()) => {
    const d1 = typeof date1 === 'string' ? parseISO(date1) : new Date(date1);
    const d2 = typeof date2 === 'string' ? parseISO(date2) : new Date(date2);
    return differenceInMonths(d1, d2);
  },

  /**
   * Calculate difference in years between two dates
   */
  differenceInYears: (date1, date2 = new Date()) => {
    const d1 = typeof date1 === 'string' ? parseISO(date1) : new Date(date1);
    const d2 = typeof date2 === 'string' ? parseISO(date2) : new Date(date2);
    return differenceInYears(d1, d2);
  },

  /**
   * Calculate difference in hours between two dates
   */
  differenceInHours: (date1, date2 = new Date()) => {
    const d1 = typeof date1 === 'string' ? parseISO(date1) : new Date(date1);
    const d2 = typeof date2 === 'string' ? parseISO(date2) : new Date(date2);
    return differenceInHours(d1, d2);
  },

  /**
   * Calculate difference in minutes between two dates
   */
  differenceInMinutes: (date1, date2 = new Date()) => {
    const d1 = typeof date1 === 'string' ? parseISO(date1) : new Date(date1);
    const d2 = typeof date2 === 'string' ? parseISO(date2) : new Date(date2);
    return differenceInMinutes(d1, d2);
  },

  // ========================================
  // Weekday Handling
  // ========================================

  /**
   * Get next Monday
   */
  nextMonday: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return nextMonday(d);
  },

  /**
   * Get next Tuesday
   */
  nextTuesday: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return nextTuesday(d);
  },

  /**
   * Get next Wednesday
   */
  nextWednesday: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return nextWednesday(d);
  },

  /**
   * Get next Thursday
   */
  nextThursday: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return nextThursday(d);
  },

  /**
   * Get next Friday
   */
  nextFriday: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return nextFriday(d);
  },

  /**
   * Get next Saturday
   */
  nextSaturday: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return nextSaturday(d);
  },

  /**
   * Get next Sunday
   */
  nextSunday: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return nextSunday(d);
  },

  /**
   * Get previous Monday
   */
  previousMonday: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return previousMonday(d);
  },

  /**
   * Get previous Tuesday
   */
  previousTuesday: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return previousTuesday(d);
  },

  /**
   * Get previous Wednesday
   */
  previousWednesday: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return previousWednesday(d);
  },

  /**
   * Get previous Thursday
   */
  previousThursday: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return previousThursday(d);
  },

  /**
   * Get previous Friday
   */
  previousFriday: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return previousFriday(d);
  },

  /**
   * Get previous Saturday
   */
  previousSaturday: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return previousSaturday(d);
  },

  /**
   * Get previous Sunday
   */
  previousSunday: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return previousSunday(d);
  },

  // ========================================
  // Date Component Getters
  // ========================================

  /**
   * Get day of week (0-6, Sunday is 0)
   */
  getDay: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return getDay(d);
  },

  /**
   * Get day of month (1-31)
   */
  getDate: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return getDate(d);
  },

  /**
   * Get month (0-11, January is 0)
   */
  getMonth: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return getMonth(d);
  },

  /**
   * Get year
   */
  getYear: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return getYear(d);
  },

  /**
   * Get week number of the year
   */
  getWeek: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return getWeek(d);
  },

  /**
   * Get quarter (1-4)
   */
  getQuarter: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return getQuarter(d);
  },

  // ========================================
  // Convenience Properties (for current date)
  // ========================================

  /**
   * Get current week number
   */
  get week() {
    return getWeek(new Date());
  },

  /**
   * Get current quarter (1-4)
   */
  get quarter() {
    return getQuarter(new Date());
  },

  /**
   * Get current weekday (0-6, where 0 is Sunday)
   */
  get weekday() {
    return getDay(new Date());
  },

  // ========================================
  // Calendar Utilities
  // ========================================

  /**
   * Get number of days in a month
   */
  getDaysInMonth: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return getDaysInMonth(d);
  },

  /**
   * Get number of days in a year
   */
  getDaysInYear: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return getDaysInYear(d);
  },

  /**
   * Check if year is a leap year
   */
  isLeapYear: (date = new Date()) => {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isLeapYear(d);
  },

  // ========================================
  // Parsing
  // ========================================

  /**
   * Parse ISO date string
   */
  parseISO: (dateString) => parseISO(dateString),

  /**
   * Parse date string with custom format
   */
  parse: (dateString, formatString, referenceDate = new Date()) => {
    return parse(dateString, formatString, referenceDate);
  }
};

/**
 * Get all available date helper function names
 */
export function getDateHelperNames() {
  return Object.keys(dateHelpers);
}

/**
 * Get total count of date helper functions
 */
export function getDateHelperCount() {
  return Object.keys(dateHelpers).length;
}

export default dateHelpers;
