/**
 * Calendar accounts (V2 multi-account) — list, add, remove.
 * Backed by the local store; statuses update live via calendar://changed.
 */
import React, { useEffect, useState } from 'react';
import * as P from '../primitives.jsx';
import calendarV2 from '../../../services/calendarV2.js';
import { useCalendarV2Store } from '../../../stores/calendarV2.js';

const PROVIDER_LABELS = {
  google: 'Google',
  microsoft: 'Microsoft',
  caldav: 'CalDAV',
  icloud: 'iCloud',
  notion: 'Notion',
  ical: 'iCal feed',
};

export default function CalendarAccountsV2() {
  const accounts = useCalendarV2Store((s) => s.accounts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showCaldav, setShowCaldav] = useState(false);
  const [caldavUrl, setCaldavUrl] = useState('https://caldav.icloud.com');
  const [caldavUser, setCaldavUser] = useState('');
  const [caldavPass, setCaldavPass] = useState('');
  const calendars = useCalendarV2Store((s) => s.calendars);
  const conflicts = useCalendarV2Store((s) => s.conflicts);

  useEffect(() => {
    useCalendarV2Store.getState().init();
  }, []);

  const addOauth = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      // Completion lands via calendar://changed once the browser flow finishes.
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (account) => {
    if (!window.confirm(`Disconnect ${account.label}? Local copies of its events are removed.`)) return;
    try {
      await calendarV2.removeAccount(account.id);
    } catch (e) {
      setError(String(e?.message || e));
    }
  };

  return (
    <>
      {accounts.map((a) => (
        <div
          key={a.id}
          className="group py-3 border-b border-app-border/60 last:border-b-0 flex items-center justify-between gap-6"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-none ${
                a.status === 'connected' ? 'bg-green-500' : a.status === 'auth_error' ? 'bg-red-500' : 'bg-app-muted/50'
              }`}
              title={a.status}
            />
            <span className="text-[13.5px] leading-[1.4] text-app-text truncate">{a.label}</span>
            <span className="text-[11px] text-app-muted flex-none">{PROVIDER_LABELS[a.provider] || a.provider}</span>
            {a.status === 'auth_error' && (
              <span className="text-[11px] text-red-400 flex-none">login expired</span>
            )}
          </span>
          <span
            className="flex items-center gap-1 flex-none opacity-0 transition-opacity motion-reduce:transition-none
                       group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <P.Button tone="ghost" className="hover:text-app-danger" onClick={() => remove(a)}>
              Disconnect
            </P.Button>
          </span>
        </div>
      ))}

      {/* Per-calendar visibility */}
      {calendars.length > 0 && (
        <div className="pt-2 pb-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-app-muted mb-1">Calendars</div>
          {calendars.map((cal) => {
            const acct = accounts.find((a) => a.id === cal.account_id);
            return (
              <label key={cal.id} className="flex items-center gap-2 py-1 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={cal.visible}
                  onChange={(e) => calendarV2.setCalendarVisible(cal.id, e.target.checked)}
                  className="accent-[rgb(var(--accent))]"
                />
                <span className="w-2 h-2 rounded-full flex-none" style={{ backgroundColor: cal.color || 'rgb(var(--muted))' }} />
                <span className="text-[13px] text-app-text truncate">{cal.name}</span>
                <span className="text-[11px] text-app-muted truncate">{acct?.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {/* Sync conflicts */}
      {conflicts.length > 0 && (
        <div className="pt-2 pb-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-red-400 mb-1">
            Sync conflicts ({conflicts.length})
          </div>
          {conflicts.map((cf) => (
            <div key={cf.id} className="flex items-center gap-2 py-1.5 border-b border-app-border/40 last:border-b-0">
              <span className="text-[13px] text-app-text truncate flex-1">
                {cf.title || 'Untitled event'}
                <span className="text-[11px] text-app-muted ml-2">edited in two places</span>
              </span>
              <P.Button tone="ghost" onClick={() => calendarV2.resolveConflict(cf.id, false)}>
                Keep remote
              </P.Button>
              <P.Button tone="ghost" onClick={() => calendarV2.resolveConflict(cf.id, true)}>
                Keep mine
              </P.Button>
            </div>
          ))}
        </div>
      )}

      {/* iCloud / CalDAV connect form */}
      {showCaldav && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await calendarV2.addCaldavAccount(caldavUrl.trim(), caldavUser.trim(), caldavPass, null);
              setShowCaldav(false);
              setCaldavUser('');
              setCaldavPass('');
            } catch (err) {
              setError(String(err?.message || err));
            } finally {
              setBusy(false);
            }
          }}
          className="mt-3 p-3 rounded-lg bg-[rgb(var(--text)/0.04)] space-y-2"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-app-muted">iCloud / CalDAV</div>
          <P.TextField mono value={caldavUrl} onChange={setCaldavUrl} placeholder="https://caldav.icloud.com" />
          <P.TextField value={caldavUser} onChange={setCaldavUser} placeholder="Apple ID / username" />
          <P.TextField type="password" value={caldavPass} onChange={setCaldavPass} placeholder="App-specific password" />
          <div className="flex items-center gap-2">
            <P.Button type="submit" tone="primary" disabled={busy || !caldavUrl.trim() || !caldavUser.trim() || !caldavPass}>
              {busy ? 'Verifying…' : 'Connect'}
            </P.Button>
            <P.Button tone="ghost" onClick={() => setShowCaldav(false)}>Cancel</P.Button>
            <span className="text-[11px] text-app-muted">iCloud needs an app-specific password (appleid.apple.com)</span>
          </div>
        </form>
      )}

      <div className="pt-3 flex items-center gap-2 flex-wrap">
        <P.Button tone="primary" onClick={() => addOauth(calendarV2.addGoogleAccount)} disabled={busy}>
          {busy ? 'Opening browser…' : 'Add Google'}
        </P.Button>
        <P.Button onClick={() => addOauth(calendarV2.addMicrosoftAccount)} disabled={busy}>
          Add Microsoft
        </P.Button>
        <P.Button onClick={() => setShowCaldav((v) => !v)} disabled={busy}>
          Add iCloud / CalDAV
        </P.Button>
        <P.Button
          onClick={() => {
            const token = window.prompt(
              'Paste a Notion internal-integration token.\n\nCreate one at notion.so/my-integrations, then share your databases with it. Every shared database with a date property becomes a calendar.'
            );
            if (token?.trim()) addOauth(() => calendarV2.addNotionAccount(token.trim()));
          }}
          disabled={busy}
        >
          Add Notion
        </P.Button>

      </div>
      {error && <P.Note tone="danger">{error}</P.Note>}
    </>
  );
}
