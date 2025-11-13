# Date Helpers Usage Guide

Comprehensive documentation for the date-fns powered date manipulation system.

## Overview

The date helpers system provides 50+ functions for powerful date manipulation, including:
- Date arithmetic (add/subtract days, weeks, months, years)
- Custom formatting with any pattern
- Relative dates (tomorrow, yesterday, next week, etc.)
- Period boundaries (start/end of week, month, year)
- Date comparisons and validations
- Weekday helpers (next Monday, previous Friday, etc.)
- Calendar utilities (leap years, days in month, etc.)

## Quick Start

### Import the Date Helpers

```javascript
import { dateHelpers } from './dates.js';
// or
import { builtinVariables } from './variables.js';
const dateHelpers = builtinVariables.getDateHelpers();
```

## Built-in Variables

All date variables are automatically available in templates:

### Basic Date Variables

```
{{date}}              → Local date (e.g., "11/5/2025")
{{time}}              → Local time (e.g., "6:00:00 PM")
{{datetime}}          → Date and time combined
{{timestamp}}         → Unix timestamp in milliseconds
{{isodate}}           → ISO date (2025-11-05)
{{isotime}}           → ISO datetime with timezone
```

### Date Component Variables

```
{{date.year}}         → 2025
{{date.month}}        → 11 (1-12)
{{date.day}}          → 5
{{date.weekday}}      → Tuesday
```

### Date Formatting Variables

```
{{date.short}}        → Nov 5, 2025
{{date.long}}         → Tuesday, November 5, 2025
{{date.iso}}          → 2025-11-05
{{date.us}}           → 11/05/2025
{{date.uk}}           → 05/11/2025
{{date.full}}         → Tuesday, November 5th, 2025
{{date.monthYear}}    → November 2025
```

### Relative Date Variables

```
{{date.tomorrow}}     → 2025-11-06
{{date.yesterday}}    → 2025-11-04
{{date.nextWeek}}     → 2025-11-12
{{date.lastWeek}}     → 2025-10-29
{{date.nextMonth}}    → 2025-12-05
{{date.lastMonth}}    → 2025-10-05
```

### Period Boundary Variables

```
{{date.startOfWeek}}   → 2025-11-03 (Sunday)
{{date.endOfWeek}}     → 2025-11-09 (Saturday)
{{date.startOfMonth}}  → 2025-11-01
{{date.endOfMonth}}    → 2025-11-30
{{date.startOfYear}}   → 2025-01-01
{{date.endOfYear}}     → 2025-12-31
```

### Weekday Helper Variables

```
{{date.nextMonday}}      → 2025-11-10
{{date.nextFriday}}      → 2025-11-07
{{date.previousMonday}}  → 2025-11-03
```

### Calendar Utility Variables

```
{{date.quarter}}       → Q4
{{date.week}}          → Week 45
{{date.daysInMonth}}   → 30
{{date.isLeapYear}}    → false
```

## Programmatic Usage

### Current Date/Time

```javascript
// Get current date and time
dateHelpers.now()           // → Date object

// Get current date at start of day
dateHelpers.today()         // → Date object (00:00:00)

// Get timestamp
dateHelpers.timestamp()     // → 1699228800000
```

### Date Formatting

```javascript
// Format with custom patterns
dateHelpers.format(new Date(), 'yyyy-MM-dd')          // → "2025-11-05"
dateHelpers.format(new Date(), 'MMMM do, yyyy')      // → "November 5th, 2025"
dateHelpers.format(new Date(), 'EEE, MMM d')         // → "Tue, Nov 5"
dateHelpers.format(new Date(), 'h:mm a')             // → "6:00 PM"

// Common formats
dateHelpers.toISODate()                              // → "2025-11-05"
dateHelpers.toISO()                                  // → "2025-11-05T18:00:00.000Z"

// Relative formatting
dateHelpers.relative(someDate)                       // → "3 days ago"
dateHelpers.relativeToNow(someDate)                  // → "yesterday at 6:00 PM"
```

### Date Arithmetic

```javascript
// Add time
dateHelpers.addDays(new Date(), 7)      // Add 7 days
dateHelpers.addWeeks(new Date(), 2)     // Add 2 weeks
dateHelpers.addMonths(new Date(), 3)    // Add 3 months
dateHelpers.addYears(new Date(), 1)     // Add 1 year

// Subtract time
dateHelpers.subDays(new Date(), 5)      // Subtract 5 days
dateHelpers.subWeeks(new Date(), 1)     // Subtract 1 week
dateHelpers.subMonths(new Date(), 2)    // Subtract 2 months
dateHelpers.subYears(new Date(), 1)     // Subtract 1 year

// Generic add/subtract
dateHelpers.add(new Date(), 10, 'days')
dateHelpers.subtract(new Date(), 3, 'months')
```

### Relative Dates

```javascript
dateHelpers.tomorrow()      // Tomorrow's date
dateHelpers.yesterday()     // Yesterday's date
dateHelpers.nextWeek()      // Date one week from now
dateHelpers.lastWeek()      // Date one week ago
dateHelpers.nextMonth()     // Date one month from now
dateHelpers.lastMonth()     // Date one month ago
dateHelpers.nextYear()      // Date one year from now
dateHelpers.lastYear()      // Date one year ago
```

### Period Boundaries

```javascript
// Day boundaries
dateHelpers.startOfDay(date)     // 00:00:00
dateHelpers.endOfDay(date)       // 23:59:59.999

// Week boundaries
dateHelpers.startOfWeek(date)    // Sunday of current week
dateHelpers.endOfWeek(date)      // Saturday of current week

// Month boundaries
dateHelpers.startOfMonth(date)   // First day of month
dateHelpers.endOfMonth(date)     // Last day of month

// Year boundaries
dateHelpers.startOfYear(date)    // January 1st
dateHelpers.endOfYear(date)      // December 31st

// Quarter boundaries
dateHelpers.startOfQuarter(date)
dateHelpers.endOfQuarter(date)
```

### Date Comparisons

```javascript
// Comparison checks
dateHelpers.isBefore(date1, date2)      // true if date1 < date2
dateHelpers.isAfter(date1, date2)       // true if date1 > date2
dateHelpers.isEqual(date1, date2)       // true if dates are equal

// Same period checks
dateHelpers.isSameDay(date1, date2)     // Same calendar day
dateHelpers.isSameWeek(date1, date2)    // Same week
dateHelpers.isSameMonth(date1, date2)   // Same month
dateHelpers.isSameYear(date1, date2)    // Same year

// Special checks
dateHelpers.isToday(date)               // Is today
dateHelpers.isTomorrow(date)            // Is tomorrow
dateHelpers.isYesterday(date)           // Is yesterday
dateHelpers.isWeekend(date)             // Is Saturday or Sunday
dateHelpers.isValid(date)               // Is valid date
```

### Date Calculations

```javascript
// Calculate differences
dateHelpers.differenceInDays(date1, date2)      // Difference in days
dateHelpers.differenceInWeeks(date1, date2)     // Difference in weeks
dateHelpers.differenceInMonths(date1, date2)    // Difference in months
dateHelpers.differenceInYears(date1, date2)     // Difference in years
dateHelpers.differenceInHours(date1, date2)     // Difference in hours
dateHelpers.differenceInMinutes(date1, date2)   // Difference in minutes
```

### Weekday Helpers

```javascript
// Next weekday
dateHelpers.nextMonday()
dateHelpers.nextTuesday()
dateHelpers.nextWednesday()
dateHelpers.nextThursday()
dateHelpers.nextFriday()
dateHelpers.nextSaturday()
dateHelpers.nextSunday()

// Previous weekday
dateHelpers.previousMonday()
dateHelpers.previousTuesday()
dateHelpers.previousWednesday()
dateHelpers.previousThursday()
dateHelpers.previousFriday()
dateHelpers.previousSaturday()
dateHelpers.previousSunday()
```

### Date Components

```javascript
// Get components
dateHelpers.getDay(date)        // Day of week (0-6, Sunday is 0)
dateHelpers.getDate(date)       // Day of month (1-31)
dateHelpers.getMonth(date)      // Month (0-11, January is 0)
dateHelpers.getYear(date)       // Year (e.g., 2025)
dateHelpers.getWeek(date)       // Week number (1-53)
dateHelpers.getQuarter(date)    // Quarter (1-4)
```

### Calendar Utilities

```javascript
// Calendar information
dateHelpers.getDaysInMonth(date)    // 28, 29, 30, or 31
dateHelpers.getDaysInYear(date)     // 365 or 366
dateHelpers.isLeapYear(date)        // true or false
```

### Parsing

```javascript
// Parse dates
dateHelpers.parseISO('2025-11-05')                           // Parse ISO string
dateHelpers.parse('05/11/2025', 'MM/dd/yyyy', new Date())   // Parse with format
```

## Common Use Cases

### Task Due Dates

```javascript
// Due in 3 days
const dueDate = dateHelpers.addDays(new Date(), 3);
const formatted = dateHelpers.format(dueDate, 'MMMM d, yyyy');

// Due next Friday
const nextFriday = dateHelpers.nextFriday();
```

### Date Ranges

```javascript
// Current week range
const weekStart = dateHelpers.startOfWeek(new Date());
const weekEnd = dateHelpers.endOfWeek(new Date());

// Current month range
const monthStart = dateHelpers.startOfMonth(new Date());
const monthEnd = dateHelpers.endOfMonth(new Date());

// Last 30 days
const thirtyDaysAgo = dateHelpers.subDays(new Date(), 30);
```

### Age Calculation

```javascript
const birthDate = new Date(1990, 0, 15);
const ageInYears = dateHelpers.differenceInYears(new Date(), birthDate);
```

### Deadline Checking

```javascript
const deadline = new Date(2025, 11, 31);
const isOverdue = dateHelpers.isBefore(deadline, new Date());
const daysUntil = dateHelpers.differenceInDays(deadline, new Date());
```

### Meeting Scheduling

```javascript
// Next Monday at start of day
const nextMeeting = dateHelpers.startOfDay(dateHelpers.nextMonday());

// Two weeks from today
const followUp = dateHelpers.addWeeks(new Date(), 2);
```

## Format Patterns

Common date-fns format patterns:

| Pattern | Result | Description |
|---------|--------|-------------|
| `yyyy-MM-dd` | 2025-11-05 | ISO date |
| `MM/dd/yyyy` | 11/05/2025 | US format |
| `dd/MM/yyyy` | 05/11/2025 | UK format |
| `MMMM d, yyyy` | November 5, 2025 | Long format |
| `MMM d, yyyy` | Nov 5, 2025 | Short format |
| `EEE, MMM d` | Tue, Nov 5 | Abbreviated weekday |
| `EEEE, MMMM do` | Tuesday, November 5th | Full with ordinal |
| `h:mm a` | 6:00 PM | 12-hour time |
| `HH:mm:ss` | 18:00:00 | 24-hour time |
| `yyyy-MM-dd HH:mm` | 2025-11-05 18:00 | Datetime |

See [date-fns format documentation](https://date-fns.org/docs/format) for all available patterns.

## Edge Cases Handled

All date helpers properly handle:
- Month boundaries (Jan 31 + 1 month = Feb 28/29)
- Year boundaries (Dec 31 + 1 day = Jan 1)
- Leap years (Feb 29 in leap years)
- Daylight saving time transitions
- Invalid dates (isValid check)
- String date inputs (auto-parsed with parseISO)

## Performance Notes

- All date operations are immutable (return new Date objects)
- Date helpers are lightweight and optimized
- No caching is needed for most operations
- For bulk operations, consider memoization

## Testing

Comprehensive test suites are available:
- `dates.test.js` - 64 tests covering all date helper functions
- `variables-dates.test.js` - 43 tests for built-in date variables

Run tests:
```bash
npm test -- src/core/templates/dates.test.js
npm test -- src/core/templates/variables-dates.test.js
```

## Total Function Count

The date helpers system includes **50+ functions** across all categories:
- Current date/time: 3 functions
- Formatting: 5 functions
- Arithmetic: 10 functions
- Relative dates: 8 functions
- Period boundaries: 10 functions
- Comparisons: 10 functions
- Calculations: 6 functions
- Weekday helpers: 14 functions
- Date components: 6 functions
- Calendar utilities: 3 functions
- Parsing: 2 functions

Plus **25+ built-in template variables** for easy access to common date values.
