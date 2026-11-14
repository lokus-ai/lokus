/** @part-of ui.bridge */
import { DEV_CHANNEL } from "./dev";
import type { SupabaseClient } from "@supabase/supabase-js";
import { invoke } from "@tauri-apps/api/core";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: Promise<SupabaseClient> | null = null;
/** Loaded on demand: most sessions never touch the account. */
function supabase(): Promise<SupabaseClient> {
  if (!URL || !ANON) throw new Error("Accounts are not configured in this build.");
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    // PKCE: a browser sign-in comes back with a one-time code, never with the session itself.
    createClient(URL, ANON, { auth: { persistSession: true, autoRefreshToken: true, flowType: "pkce", detectSessionInUrl: false } }),
  );
  return client;
}

const SESSION_KEY = URL ? `sb-${new globalThis.URL(URL).hostname.split(".")[0]}-auth-token` : "";

export interface Account {
  id: string;
  email: string;
  /** The person's name and photo as their sign-in provider gives them (Google does); empty otherwise. */
  name: string;
  picture: string;
  /** How they signed in: "google", or "email" for an address and password. */
  provider: string;
}

/** A signed-in user as the app knows them. */
function account(user: { id: string; email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }, email = ""): Account {
  const meta = user.user_metadata ?? {};
  const word = (key: string) => (typeof meta[key] === "string" ? (meta[key] as string) : "");
  const provider = typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "email";
  // `lokus_name` is the name chosen in Lokus; it wins over the one the provider supplies.
  return { id: user.id, email: user.email ?? email, name: word("lokus_name") || word("full_name") || word("name"), picture: word("avatar_url") || word("picture"), provider };
}

/**
 * Keep the name someone chose with their account, so a new device or a new workspace knows it
 * before any notes have synced. Kept under its own key: the provider rewrites its own on sign-in.
 */
export async function rememberName(name: string): Promise<void> {
  if (!accountsAvailable) return;
  await (await supabase()).auth.updateUser({ data: { lokus_name: name } });
}

export const accountsAvailable = Boolean(URL && ANON);

/**
 * Dev builds only: stand in for a sign-in with one of a local relay's fixed tokens
 * (`LOKUS_DEV_TOKENS`), so team features can be driven from a terminal with no real account.
 */
let standIn: { token: string; account: Account } | null = null;
export function pretendAccount(email: string, token: string): Account | null {
  if (!DEV_CHANNEL) return null;
  standIn = email ? { token, account: { id: email.split("@")[0], email, name: "", picture: "", provider: "email" } } : null;
  return standIn?.account ?? null;
}

export async function currentAccount(): Promise<Account | null> {
  if (standIn) return standIn.account;
  // No stored session means nobody is signed in; skip loading the library.
  if (!accountsAvailable || !localStorage.getItem(SESSION_KEY)) return null;
  const { data } = await (await supabase()).auth.getSession();
  const user = data.session?.user;
  return user ? account(user) : null;
}

export async function signIn(email: string, password: string): Promise<Account> {
  const { data, error } = await (await supabase()).auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(error?.message ?? "Sign in failed");
  return account(data.user, email);
}

/** Where the browser is sent after a Google sign-in; the app listens there. Registered with Supabase. */
const BROWSER_RETURN = "http://127.0.0.1:53682/auth/callback";

/** Sign in with Google in the person's own browser, then pick the session up here. */
export async function signInWithGoogle(): Promise<Account> {
  const auth = (await supabase()).auth;
  const { data, error } = await auth.signInWithOAuth({ provider: "google", options: { redirectTo: BROWSER_RETURN, skipBrowserRedirect: true } });
  if (error || !data.url) throw new Error(error?.message ?? "Google sign-in is not available");
  let answer: URLSearchParams;
  try {
    answer = new URLSearchParams(await invoke<string>("account_browser_login", { url: data.url }));
  } catch (raw) {
    throw new Error((raw as { message?: string })?.message ?? String(raw));
  }
  const code = answer.get("code");
  if (!code) throw new Error(answer.get("error_description") ?? "Sign-in was not finished");
  const done = await auth.exchangeCodeForSession(code);
  if (done.error || !done.data.user) throw new Error(done.error?.message ?? "Sign in failed");
  return account(done.data.user);
}

/** Returns null when the account exists but the email still needs confirming. */
export async function signUp(email: string, password: string): Promise<Account | null> {
  const { data, error } = await (await supabase()).auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return data.session && data.user ? account(data.user) : null;
}

export async function signOut(): Promise<void> {
  await (await supabase()).auth.signOut();
}

/**
 * Call `handler` with each fresh account token as the old one nears its end (about hourly), so
 * a long-running connection can be handed the new one. Returns how to stop listening.
 */
export async function onAccessToken(handler: (token: string) => void): Promise<() => void> {
  if (!accountsAvailable) return () => {};
  const { data } = (await supabase()).auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) handler(session.access_token);
  });
  return () => data.subscription.unsubscribe();
}

/** The signed-in account's token, for the relay. */
export async function accessToken(): Promise<string | null> {
  if (standIn) return standIn.token;
  if (!accountsAvailable || !localStorage.getItem(SESSION_KEY)) return null;
  const { data } = await (await supabase()).auth.getSession();
  return data.session?.access_token ?? null;
}
