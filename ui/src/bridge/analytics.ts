/** @part-of ui.bridge */
import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";
const OPT_OUT = "lokus.analytics.off";

let started = false;

export function analyticsEnabled(): boolean {
  return Boolean(KEY) && localStorage.getItem(OPT_OUT) !== "1";
}

export function setAnalyticsEnabled(on: boolean): void {
  if (on) localStorage.removeItem(OPT_OUT);
  else localStorage.setItem(OPT_OUT, "1");
  if (started) on ? posthog.opt_in_capturing() : posthog.opt_out_capturing();
  else if (on) startAnalytics();
}

/** Usage events only. Note names, paths and contents are never sent. */
export function startAnalytics(): void {
  if (started || !KEY || !analyticsEnabled()) return;
  posthog.init(KEY, {
    api_host: HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    persistence: "localStorage",
  });
  started = true;
}

export type AnalyticsEvent = "app_opened" | "vault_opened" | "note_opened" | "note_created" | "command_run";

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>): void {
  if (started && analyticsEnabled()) posthog.capture(event, props);
}

export function identify(userId: string | null): void {
  if (!started) return;
  if (userId) posthog.identify(userId);
  else posthog.reset();
}
