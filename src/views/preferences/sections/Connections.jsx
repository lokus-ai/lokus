/**
 * Connections — calendars Lokus reads from and writes to.
 *
 * Props (all map 1:1 onto existing Preferences.jsx state; the async work stays
 * in this file because it only ever touches calendarService plus these setters):
 *
 *   icalSubscriptions     {array}     → `icalSubscriptions`
 *   setIcalSubscriptions  (v)         → `setIcalSubscriptions`
 *   icalUrl               {string}    → `icalUrl`
 *   setIcalUrl            (v)         → `setIcalUrl`
 *   icalLoading           {boolean}   → `icalLoading`
 *   setIcalLoading        (v)         → `setIcalLoading`
 *   caldavAccount         {object|null} → `caldavAccount`
 *   setCaldavAccount      (v)         → `setCaldavAccount`
 *   caldavCalendars       {array}     → `caldavCalendars`
 *   setCaldavCalendars    (v)         → `setCaldavCalendars`
 *   caldavForm            {object}    { serverUrl, username, password } → `caldavForm`
 *   setCaldavForm         (v)         → `setCaldavForm`
 *   caldavLoading         {boolean}   → `caldavLoading`
 *   setCaldavLoading      (v)         → `setCaldavLoading`
 *
 * `expandedConnections` / `setExpandedConnections` are no longer used: the three
 * providers are laid out as groups instead of accordions.
 */
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { CalendarSettings } from "../../../components/Calendar/index.js";
import CalendarAccountsV2 from './CalendarAccountsV2.jsx';
import calendarService from "../../../services/calendar.js";
import * as P from "../primitives.jsx";

/** Feed colours come from the calendar itself, so they arrive as data. */
function Swatch({ color }) {
  return (
    <span
      aria-hidden
      className={`w-2 h-2 rounded-full flex-none ${color ? "" : "bg-app-muted"}`}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

export default function Connections({
  icalSubscriptions,
  setIcalSubscriptions,
  icalUrl,
  setIcalUrl,
  icalLoading,
  setIcalLoading,
  caldavAccount,
  setCaldavAccount,
  caldavCalendars,
  setCaldavCalendars,
  caldavForm,
  setCaldavForm,
  caldavLoading,
  setCaldavLoading,
}) {
  const [icalError, setIcalError] = useState("");
  const [caldavError, setCaldavError] = useState("");
  const icalId = P.useFieldId("ical-url");
  const appleIdId = P.useFieldId("caldav-user");
  const passwordId = P.useFieldId("caldav-password");

  const addSubscription = async (e) => {
    e.preventDefault();
    if (!icalUrl.trim()) return;
    setIcalError("");
    setIcalLoading(true);
    try {
      const sub = await calendarService.ical.addSubscription(icalUrl.trim());
      setIcalSubscriptions((prev) => [...prev, sub]);
      setIcalUrl("");
    } catch (err) {
      console.error("Failed to add subscription:", err);
      setIcalError(err.message || "That URL didn't return a calendar. Check it and try again.");
    } finally {
      setIcalLoading(false);
    }
  };

  const syncSubscription = async (id) => {
    try {
      const updated = await calendarService.ical.syncSubscription(id);
      setIcalSubscriptions((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      console.error("Failed to sync:", err);
    }
  };

  const removeSubscription = async (sub) => {
    if (!window.confirm(`Remove "${sub.name}"?`)) return;
    try {
      await calendarService.ical.removeSubscription(sub.id);
      setIcalSubscriptions((prev) => prev.filter((s) => s.id !== sub.id));
    } catch (err) {
      console.error("Failed to remove:", err);
    }
  };

  const connectCaldav = async (e) => {
    e.preventDefault();
    if (!caldavForm.username || !caldavForm.password) return;
    setCaldavError("");
    setCaldavLoading(true);
    try {
      const account = await calendarService.caldav.connect(
        caldavForm.serverUrl,
        caldavForm.username,
        caldavForm.password
      );
      setCaldavAccount(account);
      setCaldavForm({ serverUrl: "https://caldav.icloud.com", username: "", password: "" });
      const cals = await calendarService.caldav.refreshCalendars();
      setCaldavCalendars(cals);
    } catch (err) {
      console.error("Failed to connect:", err);
      setCaldavError(err.message || "iCloud rejected those details. An app-specific password is required.");
    } finally {
      setCaldavLoading(false);
    }
  };

  const disconnectCaldav = async () => {
    if (!window.confirm("Disconnect iCloud Calendar?")) return;
    setCaldavLoading(true);
    try {
      await calendarService.caldav.disconnect();
      setCaldavAccount(null);
      setCaldavCalendars([]);
    } catch (err) {
      console.error("Failed to disconnect:", err);
    } finally {
      setCaldavLoading(false);
    }
  };

  const refreshCaldav = async () => {
    setCaldavLoading(true);
    try {
      const cals = await calendarService.caldav.refreshCalendars();
      setCaldavCalendars(cals);
    } catch (err) {
      console.error("Failed to refresh:", err);
    } finally {
      setCaldavLoading(false);
    }
  };

  return (
    <P.Page title="Connections" lede="Link a calendar and its events sit alongside your notes.">
      <P.Group
        label="Calendar accounts"
        hint="Multiple accounts sync in the background into a local store — the calendar reads instantly, even offline."
      >
        <CalendarAccountsV2 />
      </P.Group>

      <P.Group label="Google Calendar (legacy)">
        <CalendarSettings />
      </P.Group>

      <P.Group label="iCal subscriptions" hint="Read-only feeds from any webcal:// or https:// address.">
        <form onSubmit={addSubscription} className="flex items-center gap-2 pb-3 border-b border-app-border/60">
          <label htmlFor={icalId} className="sr-only">
            Calendar URL
          </label>
          <P.TextField
            id={icalId}
            mono
            value={icalUrl}
            onChange={setIcalUrl}
            placeholder="https://example.com/calendar.ics"
            className="flex-1 min-w-0"
          />
          <P.Button type="submit" tone="primary" disabled={icalLoading || !icalUrl.trim()}>
            {icalLoading ? "Adding…" : "Follow"}
          </P.Button>
        </form>
        {icalError && <P.Note tone="danger">{icalError}</P.Note>}

        {icalSubscriptions.length > 0 ? (
          icalSubscriptions.map((sub) => (
            <div
              key={sub.id}
              className="group py-3 border-b border-app-border/60 last:border-b-0 flex items-center justify-between gap-6"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Swatch color={sub.color} />
                <span className="text-[13.5px] leading-[1.4] text-app-text truncate">{sub.name}</span>
                {sub.last_synced && (
                  <span className="font-mono text-[11px] text-app-muted flex-none">
                    {new Date(sub.last_synced).toLocaleDateString()}
                  </span>
                )}
              </span>
              <span
                className="flex items-center gap-1 flex-none opacity-0 transition-opacity motion-reduce:transition-none
                           group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <P.Button tone="ghost" onClick={() => syncSubscription(sub.id)}>
                  Sync
                </P.Button>
                <P.Button tone="ghost" className="hover:text-app-danger" onClick={() => removeSubscription(sub)}>
                  Remove
                </P.Button>
              </span>
            </div>
          ))
        ) : (
          <P.Empty>Paste a calendar address above to follow it here.</P.Empty>
        )}
      </P.Group>

      <P.Group label="iCloud / CalDAV">
        {caldavAccount ? (
          <>
            <P.Row
              label={caldavAccount.display_name || caldavAccount.username}
              hint={<span className="font-mono">{caldavAccount.username}</span>}
            >
              <P.Button tone="danger" onClick={disconnectCaldav} disabled={caldavLoading}>
                Disconnect
              </P.Button>
            </P.Row>

            {caldavCalendars.map((cal) => (
              <div
                key={cal.id}
                className="py-3 border-b border-app-border/60 last:border-b-0 flex items-center gap-2"
              >
                <Swatch color={cal.color} />
                <span className="text-[13.5px] leading-[1.4] text-app-text truncate">{cal.name}</span>
                {cal.is_primary && <span className="text-[12px] text-app-muted flex-none">Primary</span>}
              </div>
            ))}

            <P.ActionRow
              label="Refresh calendars"
              onClick={refreshCaldav}
              disabled={caldavLoading}
              trailing={
                <RefreshCw
                  aria-hidden
                  className={`w-3.5 h-3.5 ${caldavLoading ? "animate-spin motion-reduce:animate-none" : ""}`}
                />
              }
            />
          </>
        ) : (
          <>
            <P.Empty>
              Sync events both ways with <span className="font-mono">caldav.icloud.com</span>. Sign in with an{" "}
              <a
                href="https://support.apple.com/en-us/HT204397"
                target="_blank"
                rel="noopener noreferrer"
                className="text-app-accent hover:underline focus-visible:outline-none focus-visible:underline"
              >
                app-specific password
              </a>
              , not your Apple ID password.
            </P.Empty>

            <form onSubmit={connectCaldav}>
              <P.Row label="Apple ID" htmlFor={appleIdId}>
                <P.TextField
                  id={appleIdId}
                  type="email"
                  mono
                  value={caldavForm.username}
                  onChange={(v) => setCaldavForm((prev) => ({ ...prev, username: v }))}
                  placeholder="you@icloud.com"
                  className="w-[220px]"
                />
              </P.Row>
              <P.Row label="App-specific password" htmlFor={passwordId}>
                <P.TextField
                  id={passwordId}
                  type="password"
                  mono
                  value={caldavForm.password}
                  onChange={(v) => setCaldavForm((prev) => ({ ...prev, password: v }))}
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  className="w-[220px]"
                />
              </P.Row>
              <div className="pt-3">
                <P.Button
                  type="submit"
                  tone="primary"
                  disabled={caldavLoading || !caldavForm.username || !caldavForm.password}
                >
                  {caldavLoading ? "Connecting…" : "Connect iCloud"}
                </P.Button>
              </div>
              {caldavError && <P.Note tone="danger">{caldavError}</P.Note>}
            </form>
          </>
        )}
      </P.Group>

      <P.Group label="Coming soon">
        <P.Empty>Outlook, Jira, Slack and Reddit are on the way.</P.Empty>
      </P.Group>
    </P.Page>
  );
}
