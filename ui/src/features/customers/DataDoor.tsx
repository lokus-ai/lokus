/** @part-of ui.customers */
import { track } from "../../bridge/analytics";
import { useCallback, useEffect, useState } from "react";

import { relay } from "../../bridge/sync";
import { notify } from "../../shell/workspace";
import { Row } from "../settings/parts";

interface Key {
  id: string;
  label: string;
  created_at: number;
  last_used: number | null;
}

interface Props {
  server: string;
  token: string;
  workspace: string;
}

const when = (seconds: number | null) => (seconds ? new Date(seconds * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "never");

/** One request a team can paste into a terminal to see a customer appear. */
function example(server: string, key: string): string {
  return `curl -X POST ${server}/v1/ingest \\
  -H "authorization: Bearer ${key}" \\
  -H "content-type: application/json" \\
  -d '{"customer": "acme.com", "name": "Acme", "set": {"plan": "Growth", "mrr": 900}}'`;
}

/** What to hand a coding assistant so it wires a team's own backend to this workspace. */
function brief(server: string): string {
  return `Send our customer data to Lokus, our team's shared notes.

Endpoint: POST ${server}/v1/ingest
Headers: "authorization: Bearer $LOKUS_KEY" (read the key from an environment variable; never commit it) and "content-type: application/json".
Body: one fact, or {"items": [fact, ...]} for up to 100 at once. A fact is:

{
  "customer": "acme.com",        // required: the customer's domain, or our own id or name for them
  "name": "Acme",                // optional: what to call them the first time they are seen
  "source": "admin",             // optional: where this comes from (admin, billing, linear, slack...)
  "set": { "plan": "Growth", "mrr": 900, "seats": 12, "renewal": "2027-02-01" },
                                 // optional: any details; each key becomes a field on the customer's page.
                                 // text, numbers and true/false only. Dates as YYYY-MM-DD.
  "event": {                     // optional: one thing that happened
    "id": "inv_123",             // our own id for it; sending the same id again updates it instead of duplicating
    "kind": "event",             // event, issue, message or meeting
    "title": "Invoice paid: $900",
    "status": "todo",            // for issues: anything; done, closed, resolved, fixed or cancelled means closed
    "from": "Dana Whitlock",     // who said or raised it
    "at": "2026-11-13T21:40:05Z",
    "text": "longer text",
    "thread": "export-bug", "channel": "#acme", "direction": "in"   // for messages: in = from the customer, out = from us
  },
  "person": { "name": "Dana Whitlock", "email": "dana@acme.com", "role": "Head of Ops" }   // optional: someone at the customer
}

Rules: it is safe to retry (the same fact twice changes nothing). A changed detail is recorded as history automatically. A 401 means the key is wrong or removed; a 400 says what is wrong with the body.

Please: find where our backend already knows these things (signup, plan change, payment, usage job, support tool) and send a fact from each place. Start with one call on plan change so we can see it arrive, then add the rest. Do not block a user request on this call: send it in the background and ignore a failure after logging it.`;
}

/**
 * Settings, Team: the door a team's own systems push customer facts through. An owner makes a
 * key here, sees it once, and gets something to paste: a request to try, and a brief for a
 * coding assistant to wire their backend up.
 */
export function DataDoor({ server, token, workspace }: Props) {
  const [keys, setKeys] = useState<Key[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [supported, setSupported] = useState(true);
  const base = `/v1/workspaces/${workspace}/keys`;

  const load = useCallback(async () => {
    try {
      setKeys(await relay<Key[]>(server, token, "GET", base));
    } catch {
      // A relay from before this existed has no keys to list.
      setSupported(false);
    }
  }, [base, server, token]);
  useEffect(() => {
    void load();
  }, [load]);

  const make = async () => {
    track("action", { feature: "data_door", action: "key_made" });
    try {
      const made = await relay<{ key: string }>(server, token, "POST", base, { label: label.trim() || "Our backend" });
      setFresh(made.key);
      setLabel("");
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "The key could not be made");
    }
  };
  const remove = async (id: string) => {
    track("action", { feature: "data_door", action: "key_removed" });
    await relay(server, token, "DELETE", `${base}/${id}`).catch(() => {});
    await load();
  };
  const copy = (text: string, said: string) => void navigator.clipboard.writeText(text).then(() => notify(said));

  if (!supported) return null;
  return (
    <>
      <h3>Customer data from your own systems</h3>
      <Row
        label="Keys"
        hint="Your backend sends facts about customers (a plan change, a payment, a support message) with a key. Each fact lands on that customer's page for the whole team."
      >
        <input value={label} placeholder="What will use it, like Billing" aria-label="Name for the new key" onChange={(e) => setLabel(e.target.value)} />
        <button className="settings-button" onClick={() => void make()}>
          Make a key
        </button>
      </Row>
      {fresh && (
        <div className="door-fresh">
          <p>Copy this key now. It is shown once and cannot be shown again.</p>
          <div className="team-code-row">
            <code className="team-code">{fresh}</code>
            <button className="settings-button" onClick={() => copy(fresh, "Key copied")}>
              Copy
            </button>
          </div>
          <p>Try it: paste this into a terminal and a customer called Acme appears.</p>
          <pre className="door-code">{example(server, fresh)}</pre>
          <div className="door-actions">
            <button className="settings-button" onClick={() => copy(example(server, fresh), "Request copied")}>
              Copy the request
            </button>
            <button className="settings-button" onClick={() => copy(brief(server), "Instructions copied")}>
              Copy instructions for a coding assistant
            </button>
            <button className="link" onClick={() => setFresh(null)}>
              Done
            </button>
          </div>
        </div>
      )}
      {keys.length > 0 && (
        <div className="settings-list">
          {keys.map((k) => (
            <div key={k.id} className="settings-item">
              <div className="settings-item-main">
                <strong>{k.label || "Unnamed key"}</strong>
                <small>
                  Made {when(k.created_at)}. Last used {when(k.last_used)}.
                </small>
              </div>
              <button className="link danger" onClick={() => void remove(k.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {!fresh && (
        <button className="link" onClick={() => copy(brief(server), "Instructions copied")}>
          Copy instructions for a coding assistant
        </button>
      )}
    </>
  );
}
