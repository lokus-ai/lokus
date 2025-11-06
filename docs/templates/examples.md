# Template Examples

Real-world template examples for common use cases.

## Daily Notes

```markdown
# {{date.format('dddd, MMMM do, yyyy')}}

**Week:** {{date.week}} | **Quarter:** Q{{date.quarter}}

## Today's Focus
{{cursor}}

## Schedule
- 9:00 AM -
- 10:00 AM -
- 2:00 PM -

## Notes


## Tomorrow
{{date.tomorrow.format('dddd, MMMM do')}}
```

## Meeting Notes

```markdown
# {{prompt:meetingType:Meeting type:Team Sync}} - {{date.format('MMM do')}}

**Date:** {{date.format('MMMM do, yyyy')}}
**Time:** {{time}}
**Attendees:** {{prompt:attendees:Who attended?:}}

## Agenda
1.
2.
3.

## Discussion
{{cursor}}

## Decisions Made
-

## Action Items
- [ ] Task | Owner:  | Due: {{date.add(7, 'days').format('MMM do')}}

## Next Steps


---
*Next meeting: {{date.add(7, 'days').format('dddd, MMM do')}}*
```

## Project Brief

```markdown
# {{prompt:projectName:Project name:}} Brief

**Date:** {{date}}
**Owner:** {{prompt:owner:Project owner:{{user}}}}
**Type:** {{suggest:type:Project type:Feature,Bug Fix,Improvement,Research:Feature}}

## Overview
{{cursor}}

## Objectives
1.
2.
3.

## Success Metrics
-

## Timeline
- **Start:** {{date}}
- **Milestone 1:** {{date.add(14, 'days')}}
- **Launch:** {{date.add(30, 'days')}}

## Resources
### Team
-

### Tools
-

## Risks
{{#if type == 'Feature'}}
- New feature complexity
- User adoption
{{/if}}
-

## Status Updates
Will update weekly on {{date.format('dddd')}}s

---
**Project ID:** {{uuid}}
**Created:** {{datetime}}
```

## Weekly Review

```markdown
# Week {{date.week}} Review ({{date.format('yyyy')}})

**Week of:** {{date.startOfWeek.format('MMM do')}} - {{date.endOfWeek.format('MMM do')}}

## Wins
-

## Challenges
-

## Key Metrics
| Metric | Value | Change |
|--------|-------|--------|
|        |       |        |

## This Week's Focus
{{#each [1, 2, 3]}}
- [ ] Priority {{@index + 1}}:
{{/each}}

## Next Week Planning
**Week {{date.add(7, 'days').week}}** ({{date.nextWeek.format('MMM do')}})

### Goals
1.
2.
3.

---
*Review completed: {{datetime}}*
```

## Bug Report

```markdown
# [BUG] {{prompt:title:Bug title:}}

**Reported:** {{date.format('yyyy-MM-dd')}}
**Reporter:** {{user}}
**Severity:** {{suggest:severity:Severity:Critical,High,Medium,Low:Medium}}
**Status:** {{suggest:status:Status:New,In Progress,Fixed,Closed:New}}

{{#if severity == 'Critical'}}
🚨 **CRITICAL BUG** - Immediate attention required
{{/if}}

## Description
{{cursor}}

## Steps to Reproduce
1.
2.
3.

## Expected Behavior


## Actual Behavior


## Environment
- **OS:**
- **Browser:**
- **Version:**

## Screenshots


## Additional Context


---
**Bug ID:** {{uuid}}
**Reported:** {{datetime}}
```

## Sprint Planning

```markdown
# Sprint {{prompt:sprintNumber:Sprint number:}} Planning

**Sprint Duration:** {{date}} to {{date.add(14, 'days')}}
**Sprint Goal:** {{prompt:goal:Sprint goal:}}

## Team Capacity
| Member | Capacity (points) |
|--------|-------------------|
|        |                   |

## Backlog Items
### High Priority
- [ ]

### Medium Priority
- [ ]

### Low Priority
- [ ]

## Sprint Commitments
Total Points: {{prompt:totalPoints:Total points:}}

## Definition of Done
- [ ] Code reviewed
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Deployed to staging

## Daily Standup Schedule
Every day at {{prompt:standupTime:Standup time:9:00 AM}}

## Sprint Retrospective
Scheduled for {{date.add(14, 'days').format('MMMM do')}}

---
*Planning completed: {{datetime}}*
```

## Research Notes

```markdown
# Research: {{prompt:topic:Research topic:}}

**Date:** {{date.format('MMMM do, yyyy')}}
**Researcher:** {{user}}
**Category:** {{suggest:category:Category:Technical,Market,User,Competitive:Technical}}

## Research Question
{{cursor}}

## Hypothesis


## Methodology


## Findings
### Key Insights
1.
2.
3.

### Supporting Data
-

## Conclusions


## Recommendations
1.
2.
3.

## Next Steps
- [ ]

## References
-

---
**Research ID:** {{uuid}}
**Completed:** {{date}}
```

## One-on-One Meeting

```markdown
# 1:1 with {{prompt:person:Person's name:}}

**Date:** {{date.format('MMMM do, yyyy')}}
**Time:** {{time}}

## Check-in
How are you doing?

## Recent Wins
-

## Challenges & Blockers
-

## Career Development
### Current Goals
-

### Skills to Develop
-

## Feedback
### For {{prompt:person:Person's name:}}
-

### For Me
-

## Action Items
- [ ] Me:
- [ ] {{prompt:person:Person's name:}}:

## Next Meeting
{{date.add(14, 'days').format('MMMM do, yyyy')}} at {{time}}

---
*Notes by: {{user}}*
```

## Product Roadmap Item

```markdown
# [ROADMAP] {{prompt:featureName:Feature name:}}

**Quarter:** Q{{date.quarter}} {{date.format('yyyy')}}
**Owner:** {{prompt:owner:Feature owner:}}
**Priority:** {{suggest:priority:Priority:P0,P1,P2,P3:P1}}

## Problem Statement
{{cursor}}

## Proposed Solution


## User Impact
### Target Users
-

### Expected Benefits
-

## Technical Approach


## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
|        |        |             |

## Timeline
- **Design:** {{date}}
- **Development:** {{date.add(14, 'days')}}
- **Testing:** {{date.add(28, 'days')}}
- **Launch:** {{date.add(35, 'days')}}

## Dependencies
-

## Risks & Mitigation
| Risk | Impact | Mitigation |
|------|--------|------------|
|      |        |            |

## Resources Required
-

---
**Feature ID:** {{uuid}}
**Created:** {{datetime}}
```

## Content Calendar

```markdown
# Content Calendar - {{date.format('MMMM yyyy')}}

**Month:** {{date.format('MMMM')}}
**Quarter:** Q{{date.quarter}}

## This Month's Theme
{{prompt:theme:Monthly theme:}}

## Publishing Schedule

### Week {{date.week}}
- {{date.nextMonday.format('MMM do')}}:
- {{date.nextMonday.add(3, 'days').format('MMM do')}}:

### Week {{date.add(7, 'days').week}}
- {{date.add(7, 'days').nextMonday.format('MMM do')}}:
- {{date.add(7, 'days').nextMonday.add(3, 'days').format('MMM do')}}:

## Content Ideas
- [ ]
- [ ]
- [ ]

## Performance Goals
| Metric | Target | Actual |
|--------|--------|--------|
| Views  |        |        |
| Shares |        |        |

## Next Month Preview
{{date.nextMonth.format('MMMM yyyy')}} theme:

---
*Calendar updated: {{date}}*
```

## Code Review Checklist

```markdown
# Code Review: {{prompt:prTitle:PR title:}}

**PR:** {{prompt:prNumber:PR number:#}}
**Author:** {{prompt:author:Author:}}
**Reviewer:** {{user}}
**Date:** {{date}}

## Summary


## Code Quality
- [ ] Code follows style guide
- [ ] No code smells
- [ ] Proper error handling
- [ ] Efficient algorithms

## Testing
- [ ] Unit tests included
- [ ] Tests pass
- [ ] Edge cases covered
- [ ] Integration tests if needed

## Documentation
- [ ] Code comments
- [ ] README updated
- [ ] API docs updated

## Security
- [ ] No security vulnerabilities
- [ ] Input validation
- [ ] Proper authentication/authorization

## Performance
- [ ] No performance regressions
- [ ] Optimized queries
- [ ] Proper caching

## Feedback
### Required Changes
-

### Suggestions
-

### Praise
-

## Decision
{{suggest:decision:Decision:Approve,Request Changes,Comment:Approve}}

---
*Review completed: {{datetime}}*
```

These templates demonstrate:
- User input with prompts and suggestions
- Date manipulation and formatting
- Conditional content
- Structured layouts
- Real-world workflows
