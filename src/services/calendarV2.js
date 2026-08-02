import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/**
 * Calendar V2 service — thin wrappers over the cal2_* commands plus shape
 * adapters to the V1 event shape (snake_case, ISO strings) so existing view
 * code keeps working. Reads are always local SQLite: instant, offline-safe.
 */

/** OccurrenceView (camelCase, ms) → V1-ish event shape used by the views. */
function occurrenceToV1(o) {
  return {
    id: o.eventId,
    calendar_id: o.calendarId,
    account_id: o.accountId,
    title: o.title,
    location: o.location || null,
    start: new Date(o.startTs).toISOString(),
    end: new Date(o.endTs).toISOString(),
    all_day: o.allDay,
    status: o.status,
    color: o.color || null,
    html_link: o.htmlLink || null,
    pending: o.pending,
    also_in: o.alsoIn || [],
  };
}

function calendarToV1(c) {
  return {
    id: c.id,
    account_id: c.accountId,
    name: c.name,
    description: c.description || null,
    color: c.color || null,
    is_primary: c.isPrimary,
    is_writable: c.isWritable,
    visible: c.visible,
  };
}

/** UI fields → EventRow payload (camelCase, ms / civil dates). */
function toEventRow(base, { title, description, location, start, end, allDay }) {
  const row = {
    id: base?.id || '',
    calendarId: base?.calendarId || base?.calendar_id,
    providerEventId: base?.providerEventId ?? null,
    icalUid: base?.icalUid ?? null,
    recurrenceId: null,
    masterEventId: null,
    title: title ?? '',
    description: description ?? null,
    location: location ?? null,
    startTs: null,
    endTs: null,
    startDate: null,
    endDate: null,
    startTz: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    allDay: !!allDay,
    status: 'confirmed',
    transparency: 'opaque',
    rrule: null,
    rdate: null,
    exdate: null,
    organizerEmail: null,
    organizerIsSelf: false,
    attendees: null,
    htmlLink: base?.htmlLink ?? null,
    color: null,
    etag: base?.etag ?? null,
    providerUpdatedAt: null,
    fingerprint: null,
    pending: true,
    deleted: false,
    createdAt: 0,
    updatedAt: 0,
    raw: null,
  };
  if (allDay) {
    const day = (d) => new Date(d).toISOString().slice(0, 10);
    row.startDate = day(start);
    // end exclusive: UI passes inclusive-ish end; normalize to at least +1d
    const endDay = day(end);
    row.endDate = endDay > row.startDate ? endDay : day(new Date(new Date(start).getTime() + 86400000));
  } else {
    row.startTs = new Date(start).getTime();
    row.endTs = new Date(end).getTime();
  }
  return row;
}

export const calendarV2 = {
  async accounts() {
    return invoke('cal2_accounts_list');
  },
  async calendars() {
    const raw = await invoke('cal2_calendars_list');
    return raw.map(calendarToV1);
  },
  async eventsInRange(start, end) {
    const s = start instanceof Date ? start.getTime() : start;
    const e = end instanceof Date ? end.getTime() : end;
    const raw = await invoke('cal2_events_in_range', { start: s, end: e });
    return raw.map(occurrenceToV1);
  },
  async createEvent(calendarId, fields) {
    return invoke('cal2_event_create', { event: toEventRow({ calendarId }, fields) });
  },
  async updateEvent(eventId, fields) {
    const row = await invoke('cal2_event_get', { id: eventId });
    if (!row) throw new Error('event not found');
    // Partial update: only provided fields override the stored row.
    const allDay = fields.allDay ?? row.allDay;
    const merged = {
      ...row,
      title: fields.title ?? row.title,
      description: fields.description !== undefined ? fields.description : row.description,
      location: fields.location !== undefined ? fields.location : row.location,
      allDay,
    };
    if (fields.start !== undefined || fields.end !== undefined || fields.allDay !== undefined) {
      const start = fields.start ?? (row.startTs ? new Date(row.startTs) : row.startDate);
      const end = fields.end ?? (row.endTs ? new Date(row.endTs) : row.endDate);
      const t = toEventRow(row, { ...fields, title: merged.title, allDay, start, end });
      merged.startTs = t.startTs;
      merged.endTs = t.endTs;
      merged.startDate = t.startDate;
      merged.endDate = t.endDate;
    }
    return invoke('cal2_event_update', { event: merged });
  },
  async deleteEvent(eventId) {
    return invoke('cal2_event_delete', { id: eventId });
  },
  async setCalendarVisible(calendarId, visible) {
    return invoke('cal2_set_calendar_visible', { calendarId, visible });
  },
  async addGoogleAccount() {
    const url = await invoke('cal2_account_add_google');
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
    return url;
  },
  async addMicrosoftAccount() {
    const url = await invoke('cal2_account_add_microsoft');
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
    return url;
  },
  async addCaldavAccount(serverUrl, username, password, label = null) {
    return invoke('cal2_account_add_caldav', { serverUrl, username, password, label });
  },
  async addIcalAccount(url, name = null) {
    return invoke('cal2_account_add_ical', { url, name });
  },
  async addNotionAccount(token, label = null) {
    return invoke('cal2_account_add_notion', { token, label });
  },
  async removeAccount(accountId) {
    return invoke('cal2_account_remove', { accountId });
  },
  async syncNow() {
    return invoke('cal2_sync_now');
  },
  /** Subscribe to store changes; returns unlisten. Client-side debounced. */
  async onChanged(cb) {
    let t = null;
    const un = await listen('calendar://changed', () => {
      clearTimeout(t);
      t = setTimeout(cb, 150);
    });
    return () => {
      clearTimeout(t);
      un();
    };
  },
};

export default calendarV2;
