/** @part-of ui.bridge */
import type { PostHog } from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";
const OPT_OUT = "lokus.analytics.off";

let posthog: PostHog | null = null;

export function analyticsEnabled(): boolean {
  return Boolean(KEY) && localStorage.getItem(OPT_OUT) !== "1";
}

export function setAnalyticsEnabled(on: boolean): void {
  if (on) localStorage.removeItem(OPT_OUT);
  else localStorage.setItem(OPT_OUT, "1");
  if (posthog) on ? posthog.opt_in_capturing() : posthog.opt_out_capturing();
  else if (on) void startAnalytics();
}

/** Usage events only. Note names, paths and contents are never sent. */
export async function startAnalytics(): Promise<void> {
  if (posthog || !KEY || !analyticsEnabled()) return;
  // Loaded on demand so it never slows the first paint.
  const client = (await import("posthog-js")).default;
  client.init(KEY, {
    api_host: HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    persistence: "localStorage",
  });
  posthog = client;
  for (const [event, props] of queue.splice(0)) client.capture(event, props);
}

/** Events fired before the library has loaded. */
const queue: [string, Record<string, string | number | boolean> | undefined][] = [];

export type AnalyticsEvent = "app_opened" | "vault_opened" | "note_opened" | "note_created" | "command_run";

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>): void {
  if (!analyticsEnabled()) return;
  if (posthog) posthog.capture(event, props);
  else if (queue.length < 50) queue.push([event, props]);
}

export function identify(userId: string | null): void {
  if (!posthog) return;
  if (userId) posthog.identify(userId);
  else posthog.reset();
}
