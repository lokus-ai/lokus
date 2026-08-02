import { create } from 'zustand';
import calendarV2 from '../services/calendarV2.js';

/**
 * THE calendar store — replaces CalendarContext's upcoming-events cache,
 * CalendarView's private range cache, and the service-level caches. State is
 * a thin mirror of local SQLite; every `calendar://changed` re-pulls the
 * slices currently on screen (reads are local + instant, so refetching whole
 * ranges costs ~1ms and removes all invalidation logic).
 */
export const useCalendarV2Store = create((set, get) => ({
  accounts: [],
  calendars: [],
  upcoming: [],           // next 7 days, powers widget/agenda
  ready: false,
  _unlisten: null,

  async init() {
    if (get()._unlisten) return; // once
    const refresh = () => get().refresh();
    const un = await calendarV2.onChanged(refresh);
    set({ _unlisten: un });
    await get().refresh();
  },

  async refresh() {
    try {
      const [accounts, calendars, upcoming] = await Promise.all([
        calendarV2.accounts(),
        calendarV2.calendars(),
        calendarV2.eventsInRange(Date.now(), Date.now() + 7 * 86400000),
      ]);
      set({ accounts, calendars, upcoming, ready: true });
    } catch (e) {
      console.error('[calendarV2] refresh failed:', e);
    }
  },
}));

/** Convenience selectors matching what the old context exposed. */
export function selectTodayEvents(state) {
  const today = new Date().toDateString();
  return state.upcoming.filter((e) => new Date(e.start).toDateString() === today);
}

export function selectEventsByDate(state) {
  const grouped = {};
  for (const e of state.upcoming) {
    const key = new Date(e.start).toDateString();
    (grouped[key] ||= []).push(e);
  }
  return grouped;
}
