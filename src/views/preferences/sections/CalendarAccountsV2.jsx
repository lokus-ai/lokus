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

      <div className="pt-3 flex items-center gap-2 flex-wrap">
        <P.Button tone="primary" onClick={() => addOauth(calendarV2.addGoogleAccount)} disabled={busy}>
          {busy ? 'Opening browser…' : 'Add Google'}
        </P.Button>
        <P.Button onClick={() => addOauth(calendarV2.addMicrosoftAccount)} disabled={busy}>
          Add Microsoft
        </P.Button>
        <span className="text-[11px] text-app-muted">
          iCloud uses an app-specific password (below, legacy section for now). Notion arrives next.
        </span>
      </div>
      {error && <P.Note tone="danger">{error}</P.Note>}
    </>
  );
}
