import {
  addDays,
  endOfDay,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  isTomorrow,
  startOfDay,
} from 'date-fns';

export const AGENDA_SECTION_ORDER = ['today', 'tomorrow', 'thisWeek', 'overdue'];

const SECTION_TITLES = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  thisWeek: 'This Week',
  overdue: 'Overdue',
};

function toDate(value) {
  if (value instanceof Date) return value;
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getAgendaItemDate(item) {
  return toDate(item.kind === 'event' ? item.start : item.dueAt);
}

export function isAgendaTaskOverdue(item, now = new Date()) {
  if (item.kind !== 'task') return false;

  const dueDate = getAgendaItemDate(item);
  if (!dueDate) return false;

  const comparisonDate = item.isAllDay ? endOfDay(dueDate) : dueDate;
  return comparisonDate < now;
}

export function getAgendaSectionKey(item, now = new Date()) {
  const itemDate = getAgendaItemDate(item);
  if (!itemDate) return null;

  if (isAgendaTaskOverdue(item, now)) {
    return 'overdue';
  }

  if (isSameDay(itemDate, now)) {
    return 'today';
  }

  if (isSameDay(itemDate, addDays(now, 1))) {
    return 'tomorrow';
  }

  const start = startOfDay(now);
  const end = endOfWeek(now);

  if (itemDate > start && itemDate <= end) {
    return 'thisWeek';
  }

  return null;
}

export function sortAgendaItems(items) {
  return [...items].sort((left, right) => {
    const leftDate = getAgendaItemDate(left)?.getTime() ?? 0;
    const rightDate = getAgendaItemDate(right)?.getTime() ?? 0;

    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    if (left.kind !== right.kind) {
      return left.kind === 'event' ? -1 : 1;
    }

    if (!!left.isAllDay !== !!right.isAllDay) {
      return left.isAllDay ? -1 : 1;
    }

    return (left.title || '').localeCompare(right.title || '');
  });
}

export function formatAgendaDayLabel(date, now = new Date()) {
  if (isToday(date)) {
    return `Today (${format(date, 'MMM d')})`;
  }

  if (isTomorrow(date)) {
    return `Tomorrow (${format(date, 'MMM d')})`;
  }

  return format(date, 'EEE, MMM d');
}

export function buildAgendaSections(items, now = new Date()) {
  const seededSections = new Map(
    AGENDA_SECTION_ORDER.map((key) => [
      key,
      {
        key,
        title: SECTION_TITLES[key],
        count: 0,
        dayGroups: [],
      },
    ]),
  );

  const dayGroupsBySection = new Map(
    AGENDA_SECTION_ORDER.map((key) => [key, new Map()]),
  );

  for (const item of sortAgendaItems(items)) {
    const sectionKey = getAgendaSectionKey(item, now);
    const itemDate = getAgendaItemDate(item);

    if (!sectionKey || !itemDate) {
      continue;
    }

    const section = seededSections.get(sectionKey);
    const groups = dayGroupsBySection.get(sectionKey);
    const dayKey = format(itemDate, 'yyyy-MM-dd');

    if (!groups.has(dayKey)) {
      groups.set(dayKey, {
        key: dayKey,
        date: itemDate,
        label: formatAgendaDayLabel(itemDate, now),
        items: [],
      });
    }

    groups.get(dayKey).items.push(item);
    section.count += 1;
  }

  return AGENDA_SECTION_ORDER
    .map((key) => {
      const section = seededSections.get(key);
      section.dayGroups = [...dayGroupsBySection.get(key).values()];
      return section;
    })
    .filter((section) => section.count > 0);
}
