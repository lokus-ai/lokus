/**
 * Template System Examples
 *
 * Comprehensive examples demonstrating all template features:
 * - Variables and filters
 * - Conditionals and loops
 * - Template inclusion
 * - Date manipulation
 * - User prompts
 * - JavaScript execution
 */

/**
 * Example 1: Daily Note Template
 * Features: Date formatting, prompts, conditionals
 */
export const dailyNoteTemplate = {
  id: 'daily-note',
  name: 'Daily Note',
  category: 'notes',
  tags: ['daily', 'journal', 'productivity'],
  content: `# Daily Note - {{date.format(date.now(), 'MMMM DD, YYYY')}}

## Morning Reflection
{{prompt:mood:How are you feeling today?:Good}}

{{#if mood == "Great"}}
Excellent! Keep up the positive energy!
{{else if mood == "Good"}}
That's wonderful! Have a productive day!
{{else}}
Remember, every day is a fresh start.
{{/if}}

## Today's Goals
{{prompt:goal1:Main goal for today:}}
{{#if goal1}}
- [ ] {{goal1}}
{{/if}}

{{prompt:goal2:Secondary goal (optional):}}
{{#if goal2}}
- [ ] {{goal2}}
{{/if}}

{{prompt:goal3:Stretch goal (optional):}}
{{#if goal3}}
- [ ] {{goal3}}
{{/if}}

## Schedule
- Morning: {{prompt:morning:Morning activities:Work}}
- Afternoon: {{prompt:afternoon:Afternoon activities:Meetings}}
- Evening: {{prompt:evening:Evening activities:Personal time}}

## Notes
{{cursor}}

## Daily Stats
- Created: {{date.format(date.now(), 'HH:mm')}}
- Day of week: {{date.format(date.now(), 'DDDD')}}
- Week number: {{date.getWeek(date.now())}}

---
*Generated with Lokus Template System*
`,
  metadata: {
    description: 'Daily note with mood tracking, goals, and schedule',
    author: 'Lokus',
    version: '1.0.0'
  }
};

/**
 * Example 2: Project Template
 * Features: Loops, conditionals, multiple variables
 */
export const projectTemplate = {
  id: 'project',
  name: 'Project Documentation',
  category: 'documentation',
  tags: ['project', 'planning', 'team'],
  content: `# {{projectName || 'New Project'}}

## Overview
**Status:** {{status || 'Planning'}}
**Start Date:** {{startDate | dateFormat('MMMM DD, YYYY')}}
**End Date:** {{endDate | dateFormat('MMMM DD, YYYY')}}
**Priority:** {{priority || 'Medium'}}

## Team Members
{{#each team}}
- **{{this.name}}** - {{this.role}}{{#if this.email}} ({{this.email}}){{/if}}
{{/each}}

## Objectives
{{#each objectives}}
{{@index + 1}}. {{this}}
{{/each}}

## Milestones
{{#each milestones}}
### {{this.name}}
- **Target:** {{this.date | dateFormat('MMM DD, YYYY')}}
- **Status:** {{this.status}}
{{#if this.description}}
- **Description:** {{this.description}}
{{/if}}
{{/each}}

## Tasks
{{#each tasks}}
- [{{#if this.completed}}x{{else}} {{/if}}] {{this.title}} {{#if this.assignee}}(@{{this.assignee}}){{/if}}
{{/each}}

## Budget
**Total Budget:** {{budget | format('$0,0.00')}}
**Spent:** {{spent | format('$0,0.00')}}
**Remaining:** {{budget - spent | format('$0,0.00')}}

## Notes
{{notes || 'No additional notes'}}

---
*Last updated: {{date.format(date.now(), 'YYYY-MM-DD HH:mm')}}*
`,
  metadata: {
    description: 'Comprehensive project documentation template',
    author: 'Lokus',
    version: '1.0.0'
  }
};

/**
 * Example 3: Meeting Notes Template
 * Features: Date helpers, loops, conditionals
 */
export const meetingNotesTemplate = {
  id: 'meeting-notes',
  name: 'Meeting Notes',
  category: 'notes',
  tags: ['meeting', 'collaboration', 'work'],
  content: `# Meeting Notes: {{title}}

**Date:** {{date.format(date.now(), 'MMMM DD, YYYY')}}
**Time:** {{date.format(date.now(), 'HH:mm')}}
**Duration:** {{duration || '1 hour'}}
**Location:** {{location || 'Remote'}}

## Attendees
{{#each attendees}}
- {{this}}{{#if @first}} (Organizer){{/if}}
{{/each}}

{{#if absent}}
## Absent
{{#each absent}}
- {{this}}
{{/each}}
{{/if}}

## Agenda
{{#each agenda}}
{{@index + 1}}. {{this}}
{{/each}}

## Discussion Points

{{#each discussions}}
### {{this.topic}}
{{this.summary}}

{{#if this.decisions}}
**Decisions:**
{{#each this.decisions}}
- {{this}}
{{/each}}
{{/if}}
{{/each}}

## Action Items
{{#each actionItems}}
- [ ] {{this.task}} - @{{this.owner}} - Due: {{this.dueDate | dateFormat('MMM DD')}}
{{/each}}

## Next Steps
{{nextSteps || 'TBD'}}

## Next Meeting
{{#if nextMeeting}}
**Date:** {{nextMeeting | dateFormat('MMMM DD, YYYY')}}
**Time:** {{nextMeetingTime || 'TBD'}}
{{else}}
To be scheduled
{{/if}}

---
*Notes compiled by {{compiler || user}}*
`,
  metadata: {
    description: 'Professional meeting notes template',
    author: 'Lokus',
    version: '1.0.0'
  }
};

/**
 * Example 4: Task List Template
 * Features: Loops, filters, conditionals, statistics
 */
export const taskListTemplate = {
  id: 'task-list',
  name: 'Task List',
  category: 'productivity',
  tags: ['tasks', 'todo', 'productivity'],
  content: `# Task List - {{listName || 'My Tasks'}}

**Generated:** {{date.format(date.now(), 'MMM DD, YYYY HH:mm')}}

## Summary
<%
const completed = tasks.filter(t => t.completed).length;
const total = tasks.length;
const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
return \`- Total: \${total} tasks\\n- Completed: \${completed} (\${percentage}%)\\n- Remaining: \${total - completed}\`;
%>

## High Priority
{{#each tasks}}
{{#if this.priority == "High" && !this.completed}}
- [ ] **{{this.title}}**
  {{#if this.dueDate}}- Due: {{this.dueDate | dateFormat('MMM DD')}}{{#if this.isOverdue}} ⚠️ OVERDUE{{/if}}{{/if}}
  {{#if this.tags}}- Tags: {{this.tags | join(', ')}}{{/if}}
  {{#if this.notes}}- Notes: {{this.notes}}{{/if}}
{{/if}}
{{/each}}

## Medium Priority
{{#each tasks}}
{{#if this.priority == "Medium" && !this.completed}}
- [ ] {{this.title}}
  {{#if this.dueDate}}- Due: {{this.dueDate | dateFormat('MMM DD')}}{{/if}}
  {{#if this.tags}}- Tags: {{this.tags | join(', ')}}{{/if}}
{{/if}}
{{/each}}

## Low Priority
{{#each tasks}}
{{#if this.priority == "Low" && !this.completed}}
- [ ] {{this.title}}
  {{#if this.dueDate}}- Due: {{this.dueDate | dateFormat('MMM DD')}}{{/if}}
{{/if}}
{{/each}}

## Completed
{{#each tasks}}
{{#if this.completed}}
- [x] {{this.title}} ✓
{{/if}}
{{/each}}

{{#if tasks.length == 0}}
No tasks yet. Start adding some!
{{/if}}

---
*Keep going! You're doing great!*
`,
  metadata: {
    description: 'Task list with priority sorting and progress tracking',
    author: 'Lokus',
    version: '1.0.0'
  }
};

/**
 * Example 5: Report Template
 * Features: All features combined - filters, dates, loops, conditionals, JS
 */
export const reportTemplate = {
  id: 'report',
  name: 'Monthly Report',
  category: 'reports',
  tags: ['report', 'business', 'analytics'],
  content: `# {{reportTitle || 'Monthly Report'}}

## Report Period
**From:** {{startDate | dateFormat('MMMM DD, YYYY')}}
**To:** {{endDate | dateFormat('MMMM DD, YYYY')}}
**Generated:** {{date.format(date.now(), 'YYYY-MM-DD HH:mm')}}

## Executive Summary
{{summary | truncate(500)}}

## Key Metrics

### Performance
<%
const metrics = [
  { name: 'Revenue', value: revenue, format: '$0,0.00' },
  { name: 'Growth', value: growth, format: '0.00%' },
  { name: 'Customers', value: customers, format: '0,0' },
  { name: 'Satisfaction', value: satisfaction, format: '0.0%' }
];

return metrics.map(m => {
  const formatted = typeof m.value === 'number'
    ? m.value.toLocaleString()
    : m.value;
  return \`- **\${m.name}:** \${formatted}\`;
}).join('\\n');
%>

### Year over Year Comparison
| Metric | This Period | Last Period | Change |
|--------|------------|-------------|---------|
{{#each comparisons}}
| {{this.metric}} | {{this.current}} | {{this.previous}} | {{this.change}}% |
{{/each}}

## Highlights
{{#each highlights}}
{{@index + 1}}. **{{this.title}}**
   {{this.description}}
{{/each}}

## Challenges
{{#if challenges}}
{{#each challenges}}
- **{{this.title}}**: {{this.description}}
  {{#if this.mitigation}}- *Mitigation:* {{this.mitigation}}{{/if}}
{{/each}}
{{else}}
No significant challenges reported.
{{/if}}

## Departmental Updates

{{#each departments}}
### {{this.name}}
{{#if this.achievements}}
**Achievements:**
{{#each this.achievements}}
- {{this}}
{{/each}}
{{/if}}

{{#if this.metrics}}
**Metrics:**
{{#each this.metrics}}
- {{this.name}}: {{this.value}}
{{/each}}
{{/if}}

{{#if this.goals}}
**Next Period Goals:**
{{#each this.goals}}
- {{this}}
{{/each}}
{{/if}}
{{/each}}

## Financial Summary
**Revenue:** {{revenue | format('$0,0.00')}}
**Expenses:** {{expenses | format('$0,0.00')}}
**Net Profit:** {{revenue - expenses | format('$0,0.00')}}
**Profit Margin:** <% return ((revenue - expenses) / revenue * 100).toFixed(2) %>%

## Outlook
{{#if outlook}}
{{outlook}}
{{else}}
Outlook to be determined in next review.
{{/if}}

## Action Items for Next Period
{{#each actionItems}}
{{@index + 1}}. {{this.action}}
   - Owner: {{this.owner}}
   - Target: {{this.targetDate | dateFormat('MMM DD, YYYY')}}
   - Priority: {{this.priority}}
{{/each}}

## Appendix
{{#if appendix}}
{{appendix}}
{{/if}}

---
**Report prepared by:** {{preparedBy || user}}
**Review date:** {{reviewDate | dateFormat('MMMM DD, YYYY')}}
**Next report:** {{date.format(date.addMonths(date.now(), 1), 'MMMM DD, YYYY')}}

*This report is confidential and intended for internal use only.*
`,
  metadata: {
    description: 'Comprehensive monthly business report template',
    author: 'Lokus',
    version: '1.0.0'
  }
};

/**
 * Example 6: Blog Post Template
 * Features: Prompts, filters, date helpers
 */
export const blogPostTemplate = {
  id: 'blog-post',
  name: 'Blog Post',
  category: 'content',
  tags: ['blog', 'writing', 'content'],
  content: `# {{prompt:title:Blog post title:}}

**Author:** {{prompt:author:Author name:}}
**Date:** {{date.format(date.now(), 'MMMM DD, YYYY')}}
**Reading time:** {{prompt:readingTime:Estimated reading time:5}} minutes
**Tags:** {{prompt:tags:Tags (comma-separated):technology, tutorial}}

---

## Introduction

{{prompt:introduction:Write your introduction:}}

## Main Content

{{cursor}}

## Conclusion

{{prompt:conclusion:Write your conclusion:}}

---

## About the Author

{{prompt:authorBio:Short author bio:}}

## Related Posts

{{prompt:relatedPost1:Related post 1 (optional):}}
{{#if relatedPost1}}
- {{relatedPost1}}
{{/if}}

{{prompt:relatedPost2:Related post 2 (optional):}}
{{#if relatedPost2}}
- {{relatedPost2}}
{{/if}}

{{prompt:relatedPost3:Related post 3 (optional):}}
{{#if relatedPost3}}
- {{relatedPost3}}
{{/if}}

---

*Published on {{date.format(date.now(), 'MMMM DD, YYYY')}} • {{tags | split(',') | length}} topics*
`,
  metadata: {
    description: 'Interactive blog post template with prompts',
    author: 'Lokus',
    version: '1.0.0'
  }
};

/**
 * Example 7: Weekly Review Template
 * Features: Date arithmetic, loops, conditionals, calculations
 */
export const weeklyReviewTemplate = {
  id: 'weekly-review',
  name: 'Weekly Review',
  category: 'notes',
  tags: ['review', 'weekly', 'reflection'],
  content: `# Weekly Review
## Week of {{date.format(date.startOfWeek(date.now()), 'MMMM DD')}} - {{date.format(date.endOfWeek(date.now()), 'MMMM DD, YYYY')}}

### Overview
**Week Number:** {{date.getWeek(date.now())}}
**Quarter:** Q{{date.getQuarter(date.now())}}

### This Week's Wins
{{#each wins}}
{{@index + 1}}. {{this}}
{{/each}}

### Challenges Faced
{{#each challenges}}
- {{this.challenge}}
  {{#if this.resolution}}- *Resolution:* {{this.resolution}}{{/if}}
{{/each}}

### Lessons Learned
{{#each lessons}}
- {{this}}
{{/each}}

### Time Breakdown
<%
const totalHours = timeTracking.reduce((sum, item) => sum + item.hours, 0);
return timeTracking.map(item => {
  const percentage = ((item.hours / totalHours) * 100).toFixed(1);
  return \`- **\${item.category}:** \${item.hours}h (\${percentage}%)\`;
}).join('\\n');
%>

**Total hours tracked:** <% return timeTracking.reduce((sum, item) => sum + item.hours, 0) %>

### Goals Review
{{#each goals}}
- [{{#if this.achieved}}x{{else}} {{/if}}] {{this.goal}}
  {{#if this.progress}}- Progress: {{this.progress}}%{{/if}}
  {{#if this.notes}}- Notes: {{this.notes}}{{/if}}
{{/each}}

### Next Week's Focus
{{#each nextWeekFocus}}
{{@index + 1}}. {{this}}
{{/each}}

### Gratitude
{{#each gratitude}}
- {{this}}
{{/each}}

### Health & Wellness
- Exercise: {{exercise || 'Not tracked'}}
- Sleep average: {{sleepAverage || 'Not tracked'}}
- Stress level (1-10): {{stressLevel || 'Not tracked'}}

---
*Review completed on {{date.format(date.now(), 'MMMM DD, YYYY')}}*
*Next review: {{date.format(date.addWeeks(date.now(), 1), 'MMMM DD, YYYY')}}*
`,
  metadata: {
    description: 'Weekly review and reflection template',
    author: 'Lokus',
    version: '1.0.0'
  }
};

/**
 * All example templates
 */
export const exampleTemplates = [
  dailyNoteTemplate,
  projectTemplate,
  meetingNotesTemplate,
  taskListTemplate,
  reportTemplate,
  blogPostTemplate,
  weeklyReviewTemplate
];

/**
 * Example data for testing templates
 */
export const exampleData = {
  // Daily note data
  dailyNote: {
    mood: 'Great',
    goal1: 'Complete template system integration',
    goal2: 'Write documentation',
    goal3: 'Test all features',
    morning: 'Coding',
    afternoon: 'Testing',
    evening: 'Relaxation'
  },

  // Project data
  project: {
    projectName: 'Template System',
    status: 'In Progress',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-03-31'),
    priority: 'High',
    team: [
      { name: 'Alice', role: 'Lead Developer', email: 'alice@example.com' },
      { name: 'Bob', role: 'Designer', email: 'bob@example.com' },
      { name: 'Charlie', role: 'Tester' }
    ],
    objectives: [
      'Create comprehensive template system',
      'Integrate all components',
      'Write documentation and examples',
      'Ensure high performance'
    ],
    milestones: [
      { name: 'Phase 1: Core Features', date: new Date('2025-01-31'), status: 'Completed', description: 'Basic template processing' },
      { name: 'Phase 2: Advanced Features', date: new Date('2025-02-28'), status: 'In Progress' },
      { name: 'Phase 3: Polish & Testing', date: new Date('2025-03-31'), status: 'Planned' }
    ],
    tasks: [
      { title: 'Implement filters', completed: true, assignee: 'Alice' },
      { title: 'Add conditionals', completed: true, assignee: 'Alice' },
      { title: 'Create examples', completed: false, assignee: 'Bob' },
      { title: 'Write tests', completed: false, assignee: 'Charlie' }
    ],
    budget: 50000,
    spent: 32500,
    notes: 'Project is on track and within budget.'
  },

  // Meeting notes data
  meetingNotes: {
    title: 'Template System Sprint Planning',
    duration: '1.5 hours',
    location: 'Conference Room A',
    attendees: ['Alice', 'Bob', 'Charlie', 'Diana'],
    absent: ['Eve'],
    agenda: [
      'Review completed work',
      'Discuss integration challenges',
      'Plan next sprint',
      'Assign action items'
    ],
    discussions: [
      {
        topic: 'Filter System',
        summary: 'Completed 20+ filters covering strings, arrays, numbers, dates, and objects.',
        decisions: ['Use filters.js as single source of truth', 'Add more filters as needed']
      },
      {
        topic: 'Performance',
        summary: 'Need to ensure templates process in under 100ms for good UX.'
      }
    ],
    actionItems: [
      { task: 'Complete integration testing', owner: 'Charlie', dueDate: new Date('2025-02-15') },
      { task: 'Write user documentation', owner: 'Bob', dueDate: new Date('2025-02-20') },
      { task: 'Optimize performance', owner: 'Alice', dueDate: new Date('2025-02-25') }
    ],
    nextSteps: 'Continue implementation and schedule code review.',
    nextMeeting: new Date('2025-02-08'),
    nextMeetingTime: '10:00 AM'
  },

  // Task list data
  taskList: {
    listName: 'Development Tasks',
    tasks: [
      { title: 'Implement filters', priority: 'High', completed: true, tags: ['development', 'core'] },
      { title: 'Create examples', priority: 'High', completed: false, dueDate: new Date('2025-02-10'), tags: ['documentation'] },
      { title: 'Write integration tests', priority: 'High', completed: false, dueDate: new Date('2025-02-12'), tags: ['testing'] },
      { title: 'Performance optimization', priority: 'Medium', completed: false, dueDate: new Date('2025-02-15'), tags: ['optimization'] },
      { title: 'Update README', priority: 'Low', completed: false, tags: ['documentation'] },
      { title: 'Initial setup', priority: 'High', completed: true, tags: ['setup'] }
    ]
  },

  // Report data (simplified)
  report: {
    reportTitle: 'Q1 2025 Performance Report',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-03-31'),
    summary: 'Excellent quarter with strong growth across all metrics. Revenue exceeded targets by 15% while maintaining high customer satisfaction scores.',
    revenue: 1250000,
    growth: 0.23,
    customers: 5420,
    satisfaction: 0.94,
    expenses: 850000,
    comparisons: [
      { metric: 'Revenue', current: '$1.25M', previous: '$1.02M', change: '+23' },
      { metric: 'Customers', current: '5,420', previous: '4,680', change: '+16' },
      { metric: 'Satisfaction', current: '94%', previous: '91%', change: '+3' }
    ],
    highlights: [
      { title: 'New Product Launch', description: 'Successfully launched Template System with positive market response' },
      { title: 'Team Expansion', description: 'Hired 5 new team members across engineering and support' }
    ],
    challenges: [
      { title: 'Scaling Infrastructure', description: 'Increased load required infrastructure upgrades', mitigation: 'Implemented auto-scaling and load balancing' }
    ],
    departments: [
      {
        name: 'Engineering',
        achievements: ['Released 3 major features', 'Reduced bugs by 40%'],
        metrics: [{ name: 'Deployment frequency', value: '2x per week' }],
        goals: ['Achieve 99.9% uptime', 'Launch mobile app']
      }
    ],
    actionItems: [
      { action: 'Expand to new markets', owner: 'Marketing Team', targetDate: new Date('2025-06-01'), priority: 'High' },
      { action: 'Improve onboarding flow', owner: 'Product Team', targetDate: new Date('2025-05-15'), priority: 'Medium' }
    ],
    preparedBy: 'Executive Team',
    reviewDate: new Date('2025-04-05')
  }
};

/**
 * Helper function to load example templates
 */
export function getExampleTemplate(id) {
  return exampleTemplates.find(t => t.id === id);
}

/**
 * Helper function to get example data
 */
export function getExampleData(key) {
  return exampleData[key];
}

/**
 * Get all available example IDs
 */
export function getExampleIds() {
  return exampleTemplates.map(t => t.id);
}

/**
 * Get examples by category
 */
export function getExamplesByCategory(category) {
  return exampleTemplates.filter(t => t.category === category);
}

/**
 * Get examples by tag
 */
export function getExamplesByTag(tag) {
  return exampleTemplates.filter(t => t.tags.includes(tag));
}

export default {
  templates: exampleTemplates,
  data: exampleData,
  getTemplate: getExampleTemplate,
  getData: getExampleData,
  getIds: getExampleIds,
  getByCategory: getExamplesByCategory,
  getByTag: getExamplesByTag
};
