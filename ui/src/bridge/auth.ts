/** @part-of ui.bridge */
import type { SupabaseClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: Promise<SupabaseClient> | null = null;
/** Loaded on demand: most sessions never touch the account. */
function supabase(): Promise<SupabaseClient> {
  if (!URL || !ANON) throw new Error("Accounts are not configured in this build.");
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(URL, ANON, { auth: { persistSession: true, autoRefreshToken: true } }),
  );
  return client;
}

const SESSION_KEY = URL ? `sb-${new globalThis.URL(URL).hostname.split(".")[0]}-auth-token` : "";

export interface Account {
  id: string;
  email: string;
}

export const accountsAvailable = Boolean(URL && ANON);

export async function currentAccount(): Promise<Account | null> {
  // No stored session means nobody is signed in; skip loading the library.
  if (!accountsAvailable || !localStorage.getItem(SESSION_KEY)) return null;
  const { data } = await (await supabase()).auth.getSession();
  const user = data.session?.user;
  return user ? { id: user.id, email: user.email ?? "" } : null;
}

export async function signIn(email: string, password: string): Promise<Account> {
  const { data, error } = await (await supabase()).auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(error?.message ?? "Sign in failed");
  return { id: data.user.id, email: data.user.email ?? email };
}

/** Returns null when the account exists but the email still needs confirming. */
export async function signUp(email: string, password: string): Promise<Account | null> {
  const { data, error } = await (await supabase()).auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return data.session && data.user ? { id: data.user.id, email: data.user.email ?? email } : null;
}

export async function signOut(): Promise<void> {
  await (await supabase()).auth.signOut();
}
