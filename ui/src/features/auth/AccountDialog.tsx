/** @part-of ui.auth */
import { type FormEvent, useState } from "react";

import { type Account, signIn, signUp } from "../../bridge/auth";

interface Props {
  onDone(account: Account): void;
  onClose(): void;
}

/** Optional: Lokus works fully without an account. Signing in is for sync and teams. */
export function AccountDialog({ onDone, onClose }: Props) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "in") {
        onDone(await signIn(email, password));
      } else {
        const account = await signUp(email, password);
        if (account) onDone(account);
        else setMessage("Check your email to confirm your account, then sign in.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <form className="dialog" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{mode === "in" ? "Sign in to Lokus" : "Create your account"}</h2>
        <p className="dialog-sub">Your notes stay on this device. An account is only for sync and teams.</p>
        <label>
          Email
          <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {message && <p className="dialog-message">{message}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
        <button type="button" className="link" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
