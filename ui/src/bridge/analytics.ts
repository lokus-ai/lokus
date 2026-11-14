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

/** Usage and errors only. Note names, paths and contents are never sent. */
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
    // Nothing beyond the named events: no click, performance or heatmap capture.
    capture_dead_clicks: false,
    capture_performance: false,
    capture_heatmaps: false,
    persistence: "localStorage",
  });
  posthog = client;
  client.register(about);
  for (const [event, props] of queue.splice(0)) client.capture(event, props);
}

/** Events fired before the library has loaded. */
const queue: [string, Record<string, unknown> | undefined][] = [];

/**
 * What is counted. One name per thing a person can do, so each feature's use can be read off:
 * opening a kind of page, running a command, each step of setup, updating, connecting a
 * service, asking the assistant. Names of notes, customers and people are never part of it.
 */
export type AnalyticsEvent =
  | "app_opened"
  | "vault_opened"
  | "note_opened"
  | "note_created"
  | "command_run"
  | "page_opened"
  | "settings_opened"
  | "preference_changed"
  | "onboarding_step"
  | "onboarding_done"
  | "onboarding_skipped"
  | "connection_added"
  | "connection_failed"
  | "sync_connected"
  | "update_offered"
  | "update_started"
  | "update_installed"
  | "update_failed"
  | "update_restarted"
  | "news_opened"
  | "assistant_asked"
  | "action";

export function track(event: AnalyticsEvent | `$ai_${string}`, props?: Record<string, unknown>): void {
  if (!analyticsEnabled()) return;
  recent.push({ event, props, sent: Boolean(posthog) });
  if (recent.length > 60) recent.shift();
  if (posthog) posthog.capture(event, props);
  else if (queue.length < 50) queue.push([event, props]);
}

/** The last things counted, newest last: for checking, in development, that a feature is counted. */
export const recent: { event: string; props?: Record<string, unknown>; sent: boolean }[] = [];

/** Things true of this copy of the app, sent with every event: its version, the look chosen. */
export function describe(props: Record<string, string | number | boolean>): void {
  about = { ...about, ...props };
  posthog?.register(about);
}
let about: Record<string, string | number | boolean> = {};

/** Anything that looks like a place on someone's disk or a note's name is taken out. */
function scrub(text: string): string {
  return text
    .replace(/(?:[A-Za-z]:\\|\/)(?:[^\s"'`:]+[\\/])+[^\s"'`:]*/g, "<path>")
    .replace(/[^\s"'`/]+\.(?:md|png|jpe?g|pdf|json|canvas|kanban)\b/gi, "<file>")
    .replace(/“[^”]{1,200}”/g, "“…”")
    .slice(0, 500);
}

/**
 * Something went wrong. What is sent: the kind of error, its message with paths and names
 * taken out, where in the app it happened, and where in our own code it was thrown.
 */
export function reportError(error: unknown, where: string, extra?: Record<string, string | number | boolean>): void {
  if (!analyticsEnabled()) return;
  const e = error as { name?: string; message?: string; code?: string; stack?: string };
  const props = {
    where,
    code: e?.code ?? "",
    $exception_type: e?.name ?? "Error",
    $exception_message: scrub(e?.message ?? String(error)),
    $exception_stack: scrub(e?.stack ?? "").slice(0, 2000),
    ...extra,
  };
  recent.push({ event: "$exception", props, sent: Boolean(posthog) });
  if (posthog) posthog.capture("$exception", props);
  else if (queue.length < 50) queue.push(["$exception", props]);
}

/** Catch what nothing else caught: errors thrown anywhere in the window, promises nobody handled. */
export function watchErrors(): void {
  window.addEventListener("error", (e) => reportError(e.error ?? e.message, "window"));
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason, "promise"));
}

const CHATS = "lokus.analytics.chats";

/** Whether what is said to the assistant, and what it says back, may be sent too. Off unless chosen. */
export const chatSharingEnabled = () => analyticsEnabled() && localStorage.getItem(CHATS) === "1";

export function setChatSharing(on: boolean): void {
  if (on) localStorage.setItem(CHATS, "1");
  else localStorage.removeItem(CHATS);
}

/** One request to the assistant, start to finish, as PostHog's LLM analytics reads it. */
export interface ChatTrace {
  trace: string;
  provider: string;
  model: string;
  seconds: number;
  rounds: number;
  inputTokens: number;
  outputTokens: number;
  tools: string[];
  stop: string;
  /** Empty when it worked. */
  error: string;
  /** Sent only when conversation sharing is on. */
  question: string;
  answer: string;
}

export function traceChat(t: ChatTrace): void {
  if (!analyticsEnabled()) return;
  const shared = chatSharingEnabled();
  const common = { $ai_trace_id: t.trace, $ai_provider: t.provider, $ai_model: t.model, $ai_latency: t.seconds, $ai_is_error: Boolean(t.error), ...(t.error ? { $ai_error: scrub(t.error) } : {}) };
  // Each tool the assistant reached for, so which connections earn their keep can be seen.
  t.tools.forEach((tool, i) => track("$ai_span", { ...common, $ai_span_id: `${t.trace}-${i}`, $ai_span_name: tool, $ai_parent_id: t.trace }));
  track("$ai_generation", {
    ...common,
    $ai_input_tokens: t.inputTokens,
    $ai_output_tokens: t.outputTokens,
    $ai_stop_reason: t.stop,
    rounds: t.rounds,
    tool_count: t.tools.length,
    tools_used: [...new Set(t.tools)].join(","),
    ...(shared ? { $ai_input: [{ role: "user", content: t.question }], $ai_output_choices: [{ role: "assistant", content: t.answer }] } : {}),
  });
}

export function identify(userId: string | null): void {
  if (!posthog) return;
  if (userId) posthog.identify(userId);
  else posthog.reset();
}
