# Date Helpers - Quick Reference

Quick reference card for date manipulation functions and template variables.

## Quick Import

```javascript
import { dateHelpers } from './dates.js';
// or
import { builtinVariables } from './variables.js';
const helpers = builtinVariables.getDateHelpers();
```

## Template Variables Cheat Sheet

### Most Used Variables

```
{{date}}                  → 11/5/2025
{{date.tomorrow}}         → 2025-11-06
{{date.yesterday}}        → 2025-11-04
{{date.nextWeek}}         → 2025-11-12
{{date.nextFriday}}       → 2025-11-07
{{date.startOfMonth}}     → 2025-11-01
{{date.endOfMonth}}       → 2025-11-30
```

### All Variables Grouped

```
Basic:           date, time, datetime, timestamp, isodate, isotime
Components:      date.year, date.month, date.day, date.weekday
Formats:         date.short, date.long, date.iso, date.us, date.uk, date.full
Relative:        date.tomorrow, date.yesterday, date.nextWeek, date.lastWeek
Periods:         date.startOfWeek, date.endOfWeek, date.startOfMonth, date.endOfMonth
Weekdays:        date.nextMonday, date.nextFriday, date.previousMonday
Calendar:        date.quarter, date.week, date.daysInMonth, date.isLeapYear
```

## Function Categories

### Formatting
```javascript
format(date, 'yyyy-MM-dd')           → "2025-11-05"
toISODate(date)                       → "2025-11-05"
relative(date)                        → "3 days ago"
```

### Arithmetic
```javascript
addDays(date, 7)                      // Add 7 days
subMonths(date, 2)                    // Subtract 2 months
add(date, 3, 'weeks')                 // Generic add
```

### Relative
```javascript
tomorrow()                            // Tomorrow's date
nextWeek()                            // One week from now
nextMonday()                          // Next Monday
```

### Boundaries
```javascript
startOfDay(date)                      // 00:00:00
endOfMonth(date)                      // Last day of month
startOfYear(date)                     // January 1st
```

### Comparisons
```javascript
isBefore(date1, date2)                // Is date1 before date2?
isSameDay(date1, date2)               // Same calendar day?
isToday(date)                         // Is today?
```

### Calculations
```javascript
differenceInDays(date1, date2)        // Days between dates
differenceInMonths(date1, date2)      // Months between dates
```

## Common Patterns

### Due Dates
```javascript
// 7 days from now
const due = format(addDays(new Date(), 7), 'yyyy-MM-dd');

// Next Friday
const friday = format(nextFriday(), 'MMM d, yyyy');
```

### Date Ranges
```javascript
// This week
const weekStart = startOfWeek(new Date());
const weekEnd = endOfWeek(new Date());

// This month
const monthStart = startOfMonth(new Date());
const monthEnd = endOfMonth(new Date());
```

### Deadlines
```javascript
// Is overdue?
const overdue = isBefore(deadline, new Date());

// Days until deadline
const days = differenceInDays(deadline, new Date());
```

### Age/Duration
```javascript
// Age in years
const age = differenceInYears(new Date(), birthDate);

// Project duration
const duration = differenceInMonths(endDate, startDate);
```

## Format Patterns

```
Date:
yyyy-MM-dd           → 2025-11-05
MM/dd/yyyy           → 11/05/2025
dd/MM/yyyy           → 05/11/2025
MMMM d, yyyy         → November 5, 2025
MMM d, yyyy          → Nov 5, 2025
EEEE, MMMM do        → Tuesday, November 5th

Time:
h:mm a               → 6:00 PM
HH:mm:ss             → 18:00:00
h:mm:ss a            → 6:00:00 PM

Combined:
yyyy-MM-dd HH:mm     → 2025-11-05 18:00
MMM d, h:mm a        → Nov 5, 6:00 PM
```

## All Functions by Category

### Current (3)
```javascript
now(), today(), timestamp()
```

### Formatting (5)
```javascript
format(), toISO(), toISODate(), relative(), relativeToNow()
```

### Arithmetic (10)
```javascript
add(), subtract()
addDays(), addWeeks(), addMonths(), addYears()
subDays(), subWeeks(), subMonths(), subYears()
```

### Relative (8)
```javascript
tomorrow(), yesterday()
nextWeek(), lastWeek()
nextMonth(), lastMonth()
nextYear(), lastYear()
```

### Boundaries (10)
```javascript
startOfDay(), endOfDay()
startOfWeek(), endOfWeek()
startOfMonth(), endOfMonth()
startOfYear(), endOfYear()
startOfQuarter(), endOfQuarter()
```

### Comparisons (12)
```javascript
isBefore(), isAfter(), isEqual()
isSameDay(), isSameWeek(), isSameMonth(), isSameYear()
isToday(), isTomorrow(), isYesterday()
isWeekend(), isValid()
```

### Calculations (6)
```javascript
differenceInDays(), differenceInWeeks()
differenceInMonths(), differenceInYears()
differenceInHours(), differenceInMinutes()
```

### Weekdays (14)
```javascript
nextMonday() ... nextSunday()          // 7 functions
previousMonday() ... previousSunday()  // 7 functions
```

### Components (6)
```javascript
getDay(), getDate(), getMonth(), getYear()
getWeek(), getQuarter()
```

### Calendar (3)
```javascript
getDaysInMonth(), getDaysInYear(), isLeapYear()
```

### Parsing (2)
```javascript
parseISO(), parse()
```

## Edge Cases Handled

- Month boundaries (Jan 31 + 1 month = correct Feb date)
- Year boundaries (Dec 31 + 1 day = Jan 1 next year)
- Leap years (Feb 29 handled correctly)
- String inputs (auto-parsed)
- Invalid dates (isValid check)

## Tips

1. All functions accept Date objects, timestamps, or ISO strings
2. All operations are immutable (return new dates)
3. Use `format()` for custom output patterns
4. Chain operations for complex calculations
5. Check `isValid()` when parsing user input

## Examples in Context

### Meeting Notes Template
```markdown
# Meeting - {{date.full}}

**Date:** {{date}}
**Time:** {{time}}

## Action Items
- [ ] Review by {{date.nextFriday}}
- [ ] Follow up in {{date.nextWeek}}

---
*Next meeting: {{date.nextMonday}}*
```

### Project Planning
```javascript
const project = {
  start: startOfWeek(new Date()),
  end: addWeeks(new Date(), 4),
  milestones: [
    addWeeks(new Date(), 1),
    addWeeks(new Date(), 2),
    addWeeks(new Date(), 3)
  ]
};

const duration = differenceInDays(project.end, project.start);
console.log(`Project duration: ${duration} days`);
```

### Task Management
```javascript
const task = {
  created: new Date(),
  due: addDays(new Date(), 7),
  priority: 'high'
};

const overdue = isBefore(task.due, new Date());
const daysLeft = differenceInDays(task.due, new Date());

if (overdue) {
  console.log('Task is overdue!');
} else {
  console.log(`${daysLeft} days remaining`);
}
```

## Testing

Run tests:
```bash
npm test -- src/core/templates/dates.test.js
npm test -- src/core/templates/variables-dates.test.js
```

## Full Documentation

See `DATE_HELPERS_USAGE.md` for complete documentation with detailed examples.
