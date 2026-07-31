/**
 * Updates — which build you're on, and how you get the next one.
 *
 * Props:
 *   appVersion            {string}    e.g. "1.4.2"; '' while it's still loading
 *   betaUpdates           {boolean}   beta channel opted in
 *   onBetaUpdatesChange   (next)      set the flag AND persist it:
 *                                       async (next) => {
 *                                         setBetaUpdates(next);
 *                                         try { await updateConfig({ updates: { betaChannel: next } }); }
 *                                         catch (e) { console.error('Failed to save beta updates preference:', e); }
 *                                       }
 *
 * Checking is fire-and-forget: the section dispatches `check-for-update` and
 * UpdateChecker reports the outcome as a notification. Nothing here polls.
 */
import { useState } from "react";
import * as P from "../primitives.jsx";

const ANALYTICS_KEY = "lokus-analytics-preferences";

function readAnalyticsEnabled() {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    return raw ? JSON.parse(raw).enabled !== false : true;
  } catch {
    return true;
  }
}

export default function Updates({ appVersion, betaUpdates, onBetaUpdatesChange }) {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(readAnalyticsEnabled);

  const handleAnalyticsChange = (enabled) => {
    setAnalyticsEnabled(enabled);
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify({ enabled, lastUpdated: new Date().toISOString() }));
    // Dynamically import to avoid circular deps
    import("../../../services/posthog.js").then(({ default: posthog }) => {
      if (enabled) posthog.enable();
      else posthog.disable();
    });
  };

  const openPrivacyPolicy = () => {
    import("@tauri-apps/plugin-opener").then(({ open }) => {
      open("https://lokusmd.com/privacy");
    });
  };

  return (
    <P.Page title="Updates" lede="Lokus looks for new versions in the background and tells you when one lands.">
      <P.Group label="Version">
        <P.Row label="You're running">
          <span className="font-mono text-[12px] text-app-text tabular-nums">
            {appVersion ? `v${appVersion}` : "—"}
          </span>
        </P.Row>
        <P.ActionRow
          label="Check for updates now"
          hint="Takes a second. If there's a newer build, you'll get a notification with what's in it."
          onClick={() => window.dispatchEvent(new Event("check-for-update"))}
        />
      </P.Group>

      <P.Group label="Channel">
        <P.Row label="Beta builds" hint="Get features while they're still being finished.">
          <P.Toggle
            checked={betaUpdates}
            onChange={onBetaUpdatesChange}
            label="Beta builds"
          />
        </P.Row>
        {betaUpdates && (
          <P.Note>Beta builds change fast and can break. Turn this off to go back to stable releases.</P.Note>
        )}
      </P.Group>

      <P.Group label="Privacy">
        <P.Row
          label="Share anonymous usage data"
          hint="Counts of which features get used. Never your notes, file names or paths."
        >
          <P.Toggle
            checked={analyticsEnabled}
            onChange={handleAnalyticsChange}
            label="Share anonymous usage data"
          />
        </P.Row>
        <P.ActionRow label="Read the privacy policy" onClick={openPrivacyPolicy} />
      </P.Group>
    </P.Page>
  );
}
