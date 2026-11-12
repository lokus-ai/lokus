/** @part-of ui.bridge */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;
function supabase(): SupabaseClient {
  if (!URL || !ANON) throw new Error("Accounts are not configured in this build.");
  client ??= createClient(URL, ANON, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

export interface Account {
  id: string;
  email: string;
}

export const accountsAvailable = Boolean(URL && ANON);

export async function currentAccount(): Promise<Account | null> {
  if (!accountsAvailable) return null;
  const { data } = await supabase().auth.getSession();
  const user = data.session?.user;
  return user ? { id: user.id, email: user.email ?? "" } : null;
}

export async function signIn(email: string, password: string): Promise<Account> {
  const { data, error } = await supabase().auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(error?.message ?? "Sign in failed");
  return { id: data.user.id, email: data.user.email ?? email };
}

/** Returns null when the account exists but the email still needs confirming. */
export async function signUp(email: string, password: string): Promise<Account | null> {
  const { data, error } = await supabase().auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return data.session && data.user ? { id: data.user.id, email: data.user.email ?? email } : null;
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut();
}
