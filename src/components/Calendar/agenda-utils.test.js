import { describe, expect, it } from 'vitest';
import {
  buildAgendaSections,
  getAgendaSectionKey,
  isAgendaTaskOverdue,
  sortAgendaItems,
} from './agenda-utils.js';

describe('agenda-utils', () => {
  it('sorts agenda items chronologically across events and tasks', () => {
    const items = [
      { id: 'task-1', kind: 'task', title: 'Submit report', dueAt: new Date(2026, 2, 24, 17, 0) },
      { id: 'event-1', kind: 'event', title: 'Standup', start: new Date(2026, 2, 24, 9, 0) },
      { id: 'event-2', kind: 'event', title: 'Planning', start: new Date(2026, 2, 25, 10, 0) },
    ];

    expect(sortAgendaItems(items).map((item) => item.id)).toEqual([
      'event-1',
      'task-1',
      'event-2',
    ]);
  });

  it('keeps date-only tasks in Today until the day ends', () => {
    const now = new Date(2026, 2, 24, 10, 0);
    const allDayTodayTask = {
      id: 'task-1',
      kind: 'task',
      title: 'Review roadmap',
      dueAt: new Date(2026, 2, 24, 0, 0),
      isAllDay: true,
    };
    const yesterdayTask = {
      id: 'task-2',
      kind: 'task',
      title: 'Send invoice',
      dueAt: new Date(2026, 2, 23, 0, 0),
      isAllDay: true,
    };

    expect(isAgendaTaskOverdue(allDayTodayTask, now)).toBe(false);
    expect(isAgendaTaskOverdue(yesterdayTask, now)).toBe(true);
    expect(getAgendaSectionKey(allDayTodayTask, now)).toBe('today');
    expect(getAgendaSectionKey(yesterdayTask, now)).toBe('overdue');
  });

  it('builds ordered sections for today, tomorrow, this week, and overdue', () => {
    const now = new Date(2026, 2, 24, 10, 0);
    const items = [
      { id: 'event-1', kind: 'event', title: 'Standup', start: new Date(2026, 2, 24, 9, 0) },
      { id: 'task-1', kind: 'task', title: 'Submit report', dueAt: new Date(2026, 2, 24, 17, 0) },
      { id: 'event-2', kind: 'event', title: 'Sprint planning', start: new Date(2026, 2, 25, 10, 0) },
      { id: 'task-2', kind: 'task', title: 'Review PR', dueAt: new Date(2026, 2, 26, 11, 0) },
      { id: 'task-3', kind: 'task', title: 'Fix regression', dueAt: new Date(2026, 2, 23, 14, 0) },
    ];

    const sections = buildAgendaSections(items, now);

    expect(sections.map((section) => section.key)).toEqual([
      'today',
      'tomorrow',
      'thisWeek',
      'overdue',
    ]);
    expect(sections.find((section) => section.key === 'today')?.count).toBe(2);
    expect(sections.find((section) => section.key === 'tomorrow')?.count).toBe(1);
    expect(sections.find((section) => section.key === 'thisWeek')?.dayGroups).toHaveLength(1);
    expect(sections.find((section) => section.key === 'overdue')?.count).toBe(1);
  });
});
