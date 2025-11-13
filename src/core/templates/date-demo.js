/**
 * Date Helpers Demonstration
 *
 * Run this script to see date helpers in action
 */

import { dateHelpers, getDateHelperCount } from './dates.js';
import { builtinVariables } from './variables.js';

console.log('\n=== Date Manipulation System Demo ===\n');

// System info
console.log(`Total date helper functions: ${getDateHelperCount()}`);
console.log(`Date-fns version: 4.1.0`);
console.log('');

// Current date/time
console.log('--- Current Date/Time ---');
console.log('Now:', dateHelpers.now());
console.log('Today:', dateHelpers.format(dateHelpers.today(), 'yyyy-MM-dd'));
console.log('Timestamp:', dateHelpers.timestamp());
console.log('');

// Formatting
console.log('--- Date Formatting ---');
const now = new Date();
console.log('ISO:', dateHelpers.toISODate(now));
console.log('US Format:', dateHelpers.format(now, 'MM/dd/yyyy'));
console.log('UK Format:', dateHelpers.format(now, 'dd/MM/yyyy'));
console.log('Full:', dateHelpers.format(now, 'EEEE, MMMM do, yyyy'));
console.log('Short:', dateHelpers.format(now, 'MMM d, yyyy'));
console.log('');

// Relative dates
console.log('--- Relative Dates ---');
console.log('Tomorrow:', dateHelpers.format(dateHelpers.tomorrow(), 'yyyy-MM-dd'));
console.log('Yesterday:', dateHelpers.format(dateHelpers.yesterday(), 'yyyy-MM-dd'));
console.log('Next Week:', dateHelpers.format(dateHelpers.nextWeek(), 'yyyy-MM-dd'));
console.log('Last Month:', dateHelpers.format(dateHelpers.lastMonth(), 'yyyy-MM-dd'));
console.log('');

// Arithmetic
console.log('--- Date Arithmetic ---');
console.log('+ 7 days:', dateHelpers.format(dateHelpers.addDays(now, 7), 'yyyy-MM-dd'));
console.log('+ 2 weeks:', dateHelpers.format(dateHelpers.addWeeks(now, 2), 'yyyy-MM-dd'));
console.log('+ 3 months:', dateHelpers.format(dateHelpers.addMonths(now, 3), 'yyyy-MM-dd'));
console.log('- 5 days:', dateHelpers.format(dateHelpers.subDays(now, 5), 'yyyy-MM-dd'));
console.log('');

// Period boundaries
console.log('--- Period Boundaries ---');
console.log('Start of Week:', dateHelpers.format(dateHelpers.startOfWeek(now), 'yyyy-MM-dd'));
console.log('End of Week:', dateHelpers.format(dateHelpers.endOfWeek(now), 'yyyy-MM-dd'));
console.log('Start of Month:', dateHelpers.format(dateHelpers.startOfMonth(now), 'yyyy-MM-dd'));
console.log('End of Month:', dateHelpers.format(dateHelpers.endOfMonth(now), 'yyyy-MM-dd'));
console.log('Start of Year:', dateHelpers.format(dateHelpers.startOfYear(now), 'yyyy-MM-dd'));
console.log('End of Year:', dateHelpers.format(dateHelpers.endOfYear(now), 'yyyy-MM-dd'));
console.log('');

// Weekday helpers
console.log('--- Weekday Helpers ---');
console.log('Next Monday:', dateHelpers.format(dateHelpers.nextMonday(now), 'yyyy-MM-dd'));
console.log('Next Friday:', dateHelpers.format(dateHelpers.nextFriday(now), 'yyyy-MM-dd'));
console.log('Previous Monday:', dateHelpers.format(dateHelpers.previousMonday(now), 'yyyy-MM-dd'));
console.log('');

// Comparisons
console.log('--- Date Comparisons ---');
const tomorrow = dateHelpers.tomorrow();
const yesterday = dateHelpers.yesterday();
console.log('Is tomorrow after now?', dateHelpers.isAfter(tomorrow, now));
console.log('Is yesterday before now?', dateHelpers.isBefore(yesterday, now));
console.log('Is today?', dateHelpers.isToday(now));
console.log('Is weekend?', dateHelpers.isWeekend(now));
console.log('');

// Calculations
console.log('--- Date Calculations ---');
const futureDate = dateHelpers.addMonths(now, 3);
console.log('Days until 3 months from now:', dateHelpers.differenceInDays(futureDate, now));
console.log('Weeks until 3 months from now:', dateHelpers.differenceInWeeks(futureDate, now));
console.log('Months difference:', dateHelpers.differenceInMonths(futureDate, now));
console.log('');

// Calendar utilities
console.log('--- Calendar Utilities ---');
console.log('Current Quarter:', `Q${dateHelpers.getQuarter(now)}`);
console.log('Week Number:', dateHelpers.getWeek(now));
console.log('Days in Month:', dateHelpers.getDaysInMonth(now));
console.log('Days in Year:', dateHelpers.getDaysInYear(now));
console.log('Is Leap Year?', dateHelpers.isLeapYear(now));
console.log('');

// Built-in variables
console.log('--- Built-in Template Variables ---');
const variables = [
  'date', 'date.tomorrow', 'date.yesterday',
  'date.nextWeek', 'date.startOfMonth', 'date.endOfMonth',
  'date.nextMonday', 'date.quarter', 'date.daysInMonth'
];

for (const varName of variables) {
  const value = builtinVariables.resolve(varName);
  console.log(`{{${varName}}} → ${value}`);
}
console.log('');

// Use cases
console.log('--- Common Use Cases ---');

// Task due date
const taskDue = dateHelpers.addDays(now, 7);
console.log('Task due in 7 days:', dateHelpers.format(taskDue, 'MMMM d, yyyy'));

// Meeting schedule
const nextMeeting = dateHelpers.startOfDay(dateHelpers.nextMonday(now));
console.log('Next meeting (Monday 9am):', dateHelpers.format(nextMeeting, 'EEEE, MMM d, yyyy'));

// Project timeline
const projectStart = dateHelpers.startOfMonth(now);
const projectEnd = dateHelpers.endOfMonth(dateHelpers.addMonths(now, 2));
const projectDuration = dateHelpers.differenceInDays(projectEnd, projectStart);
console.log(`Project timeline: ${dateHelpers.format(projectStart, 'MMM d')} - ${dateHelpers.format(projectEnd, 'MMM d, yyyy')} (${projectDuration} days)`);

// Deadline check
const deadline = dateHelpers.addDays(now, 3);
const daysUntil = dateHelpers.differenceInDays(deadline, now);
console.log(`Deadline: ${dateHelpers.format(deadline, 'MMM d')} (${daysUntil} days from now)`);

console.log('\n=== Demo Complete ===\n');

// Stats
const stats = builtinVariables.getStatistics();
console.log('Statistics:');
console.log(`Total built-in variables: ${stats.total}`);
console.log(`Date variables: ${stats.byCategory.date || 0}`);
console.log('');
