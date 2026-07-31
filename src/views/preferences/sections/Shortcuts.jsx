/**
 * Keyboard shortcuts.
 *
 * Props:
 *   actions       {array}       [{ id, name }] from listActions()
 *                               → Preferences.jsx `actions`
 *   keymap        {object}      action id → accelerator string
 *                               → Preferences.jsx `keymap`
 *   query         {string}      search text → `query`
 *   onQueryChange (string)      → setQuery
 *   editing       {string|null} id of the row being rebound → `editing`
 *   onBeginEdit   (id)          → `beginEdit`
 *   onCancelEdit  ()            → `cancelEdit`
 *   onKeyCapture  (event, id)   captures the new binding → `onKeyCapture`
 *   onResetAll    ()            restore every default → `onResetAll`
 *
 * The rebinding logic itself is untouched — this only changes how a row looks
 * and that the whole row, not a per-row button, is what you click.
 */
import { Search, RotateCcw, Pencil } from "lucide-react";
import { formatAccelerator } from "../../../core/shortcuts/registry.js";
import * as P from "../primitives.jsx";

/** Split an accelerator into keycap parts. Verbatim from the old section. */
function accelParts(accel) {
  if (!accel) return [];
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || navigator.userAgent || "");
  return accel.split("+").map((p) => {
    if (p === "CommandOrControl") return isMac ? "⌘" : "Ctrl";
    if (p === "Control") return isMac ? "⌃" : "Ctrl";
    if (p === "Shift") return isMac ? "⇧" : "Shift";
    if (p === "Alt" || p === "Option") return isMac ? "⌥" : "Alt";
    if (p === "Comma") return ",";
    return p.toUpperCase();
  });
}

export default function Shortcuts({
  actions,
  keymap,
  query,
  onQueryChange,
  editing,
  onBeginEdit,
  onCancelEdit,
  onKeyCapture,
  onResetAll,
}) {
  const searchId = P.useFieldId("shortcut-search");
  const needle = query.trim().toLowerCase();
  const matches = actions.filter((a) => a.name.toLowerCase().includes(needle));

  return (
    <P.Page
      title="Shortcuts"
      lede="Click any shortcut to rebind it, then press the keys you want."
      actions={
        <P.Button onClick={onResetAll}>
          <span className="flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset all
          </span>
        </P.Button>
      }
    >
      <div className="relative">
        <Search aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-muted" />
        <label htmlFor={searchId} className="sr-only">
          Search actions
        </label>
        <P.TextField
          id={searchId}
          value={query}
          onChange={onQueryChange}
          placeholder="Search actions"
          className="w-full pl-8"
        />
      </div>

      <P.Group label={`${matches.length} action${matches.length === 1 ? "" : "s"}`}>
        {matches.length === 0 && <P.Empty>Nothing matches that. Try a shorter word.</P.Empty>}

        {matches.map((a) => {
          const accel = keymap[a.id];
          const parts = accelParts(accel);

          if (editing === a.id) {
            return (
              <div
                key={a.id}
                className="py-3 border-b border-app-border/60 last:border-b-0 flex items-center justify-between gap-6"
              >
                <span className="text-[13.5px] leading-[1.4] text-app-text min-w-0">{a.name}</span>
                <input
                  autoFocus
                  aria-label={`New shortcut for ${a.name}`}
                  onKeyDown={(e) => onKeyCapture(e, a.id)}
                  onBlur={onCancelEdit}
                  placeholder={formatAccelerator(accel) || "Press keys"}
                  className="w-[140px] flex-none bg-transparent border border-dashed border-app-accent rounded-md
                             px-2.5 py-1.5 font-mono text-[12px] text-app-text text-center
                             placeholder:text-app-muted focus:outline-none"
                />
              </div>
            );
          }

          return (
            <P.ActionRow
              key={a.id}
              label={a.name}
              onClick={() => onBeginEdit(a.id)}
              trailing={
                <span className="flex items-center gap-1.5">
                  <Pencil
                    aria-hidden
                    className="w-3 h-3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100
                               transition-opacity motion-reduce:transition-none"
                  />
                  {parts.length > 0 ? (
                    <span className="flex flex-wrap items-center gap-1 justify-end">
                      {parts.map((p, i) => (
                        <P.KeyCap key={i}>{p}</P.KeyCap>
                      ))}
                    </span>
                  ) : (
                    <span className="text-[12.5px] text-app-muted">Not set</span>
                  )}
                </span>
              }
            />
          );
        })}
      </P.Group>
    </P.Page>
  );
}
