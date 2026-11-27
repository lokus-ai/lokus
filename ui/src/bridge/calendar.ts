/** @part-of ui.bridge */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toCoreError } from "./core";

export interface CalAccount {
  id: string;
  provider: "google" | "microsoft";
  email: string;
  name: string;
  signed_in: boolean;
}

export interface CalCalendar {
  account: string;
  id: string;
  name: string;
  color: string;
  hidden: boolean;
  primary: boolean;
  default: boolean;
}

export interface CalGuest {
  email: string;
  name: string;
  optional: boolean;
  /** accepted, declined, tentative or needsAction */
  reply: string;
}

export interface CalEvent {
  key: string;
  account: string;
  calendar: string;
  id: string;
  title: string;
  /** Both ends as UTC, like 2026-12-01T15:00:00Z. */
  start: string;
  end: string;
  all_day: boolean;
  zone: string;
  location: string;
  description: string;
  guests: CalGuest[];
  organizer: string;
  /** This person organises it, so may change it. */
  mine: boolean;
  reply: string;
  meeting: { kind: "meet" | "teams"; url: string } | null;
  want_meeting: boolean;
  repeat: string | null;
  series: string | null;
  link: string;
  /** Changed here and not sent to the guests yet. */
  pending: boolean;
  /** An invitation that has never been sent. */
  unsent: boolean;
  changes: string[];
  /** On its way to the provider (offline, or not sent this minute yet). */
  queued: boolean;
  error: string | null;
  note: string | null;
}

export interface CalStatus {
  accounts: CalAccount[];
  calendars: CalCalendar[];
  waiting: { n: number; key: string; op: string; error: string | null }[];
  synced: string | null;
  available: { google: boolean; microsoft: boolean; stand_in: boolean };
}

export interface CalMember {
  member: string;
  name: string;
  emails: string[];
  updated: string;
  age_minutes: number | null;
  busy: [string, string][];
}

export interface CalBusy {
  email: string;
  known: boolean;
  times: [string, string][];
}

export interface CalSlot {
  start: string;
  end: string;
  local: string;
}

/** Run a calendar command (`calendar.events`, `calendar.event.update`, …): JSON in, JSON out. */
export async function runCalendar<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>("calendar_run", { name, args: args ?? null });
  } catch (raw) {
    throw toCoreError(raw);
  }
}

/** Send what is waiting and read what changed, now instead of at the next minute. */
export function syncCalendar(): void {
  void invoke("calendar_sync").catch(() => undefined);
}

/** Told after every round with the providers; `changed` when the local copy moved. */
export function onCalendarSynced(handler: (changed: boolean, offline: boolean) => void): () => void {
  const stop = listen<{ changed: boolean; sync: { offline: boolean } }>("calendar:synced", ({ payload }) =>
    handler(payload.changed, payload.sync.offline),
  );
  return () => void stop.then((off) => off());
}
