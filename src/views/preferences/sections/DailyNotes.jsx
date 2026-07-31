/**
 * Daily Notes preferences.
 *
 * Props:
 *   settings   {object}   { format, folder, template, openOnStartup }
 *                         → Preferences.jsx `dailyNotesSettings`
 *   onChange   (patch)    merge a partial settings object into state
 *                         → (patch) => setDailyNotesSettings(s => ({ ...s, ...patch }))
 *   onSave     ()         persist the current settings
 *                         → Preferences.jsx `saveDailyNotesSettings`
 *
 * Persistence is unchanged: text fields save on blur, the startup toggle saves
 * immediately after its change, exactly as before.
 */
import { format as formatDate } from "date-fns";
import { isDesktop } from "../../../platform/index.js";
import * as P from "../primitives.jsx";

const VARIABLES = [
  ["{{date}}", "Today"],
  ["{{yesterday}}", "Yesterday"],
  ["{{tomorrow}}", "Tomorrow"],
  ["{{day}}", "Day name — Monday"],
  ["{{day_short}}", "Day name — Mon"],
  ["{{month}}", "Month name"],
  ["{{week}}", "Week number"],
  ["{{year}}", "Year"],
  ["{{time}}", "Time now"],
  ["{{date:FORMAT}}", "Any other format"],
];

const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || navigator.userAgent || "");
const MOD = isMac ? "⌘" : "Ctrl";
const SHIFT = isMac ? "⇧" : "Shift";

/** What today's file will actually be called. Mirrors the manager's fallback. */
function previewFileName(pattern) {
  const now = new Date();
  try {
    return `${formatDate(now, pattern || "yyyy-MM-dd")}.md`;
  } catch {
    return `${formatDate(now, "yyyy-MM-dd")}.md`;
  }
}

export default function DailyNotes({ settings, onChange, onSave }) {
  const formatId = P.useFieldId("daily-format");
  const folderId = P.useFieldId("daily-folder");
  const templateId = P.useFieldId("daily-template");

  return (
    <P.Page
      title="Daily Notes"
      lede="One note per day, created from your template the first time you open it."
    >
      <P.Group label="The file">
        {/* P.TextField takes no onBlur, so catch the bubbled focusout to save. */}
        <span onBlur={onSave} className="contents">
          <P.Row
            label="Date format"
            htmlFor={formatId}
            hint={
              <>
                Today&rsquo;s note is{" "}
                <span className="font-mono text-app-text-secondary">{previewFileName(settings.format)}</span>
              </>
            }
          >
            <P.TextField
              id={formatId}
              mono
              value={settings.format}
              onChange={(v) => onChange({ format: v })}
              placeholder="yyyy-MM-dd"
              className="w-[150px]"
            />
          </P.Row>

          <P.Row label="Folder" htmlFor={folderId} hint="Relative to the workspace root.">
            <P.TextField
              id={folderId}
              mono
              value={settings.folder}
              onChange={(v) => onChange({ folder: v })}
              placeholder="Daily Notes"
              className="w-[150px]"
            />
          </P.Row>
        </span>

        <P.Row label="Open today's note at startup">
          <P.Toggle
            label="Open today's note at startup"
            checked={settings.openOnStartup}
            onChange={(v) => {
              onChange({ openOnStartup: v });
              onSave();
            }}
          />
        </P.Row>
      </P.Group>

      <P.Group label="Template" hint="Every new daily note starts from this.">
        <textarea
          id={templateId}
          value={settings.template}
          onChange={(e) => onChange({ template: e.target.value })}
          onBlur={onSave}
          placeholder={"# {{date}}\n\n## Tasks\n- \n\n## Notes\n"}
          className="w-full h-32 bg-transparent border border-app-border rounded-md px-2.5 py-2
                     font-mono text-[12px] leading-[1.6] text-app-text placeholder:text-app-muted
                     resize-y focus:border-app-accent focus:outline-none
                     transition-colors motion-reduce:transition-none"
        />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3">
          {VARIABLES.map(([token, meaning]) => (
            <div key={token} className="flex items-baseline gap-2 min-w-0">
              <dt className="font-mono text-[11px] text-app-text-secondary flex-none">{token}</dt>
              <dd className="text-[12px] text-app-muted truncate">{meaning}</dd>
            </div>
          ))}
        </dl>
      </P.Group>

      {isDesktop() && (
        <P.Group label="Quick access">
          <P.Row label="Open today's note">
            <span className="flex items-center gap-1">
              <P.KeyCap>{MOD}</P.KeyCap>
              <P.KeyCap>{SHIFT}</P.KeyCap>
              <P.KeyCap>D</P.KeyCap>
            </span>
          </P.Row>
          <P.Row label="From the command palette" hint="Search for “Open Daily Note”.">
            <span className="flex items-center gap-1">
              <P.KeyCap>{MOD}</P.KeyCap>
              <P.KeyCap>K</P.KeyCap>
            </span>
          </P.Row>
        </P.Group>
      )}
    </P.Page>
  );
}
