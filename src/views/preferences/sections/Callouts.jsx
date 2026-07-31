/**
 * Callout preferences — one row per callout type.
 *
 * Props:
 *   callouts   {object}          the whole callout config, keyed by type
 *                                → Preferences.jsx `callouts`
 *   onChange   (next:object)     receives the complete updated config; the parent
 *                                is responsible for `setCallouts(next)` **and**
 *                                `saveCalloutConfig(next)`, exactly as before
 *                                → Preferences.jsx `setCallouts` + `saveCalloutConfig`
 */
import * as P from "../primitives.jsx";

/**
 * The three types the old type-picker offered, in the same order. The swatch is
 * presentational: `bg` in the stored config is a raw `var(--…)` string that
 * nothing reads, so the colour comes from the theme token instead.
 */
const TYPES = [
  { id: "note", label: "Note", swatch: "bg-app-info", fallbackIcon: "ℹ️" },
  { id: "warning", label: "Warning", swatch: "bg-app-warning", fallbackIcon: "⚠️" },
  { id: "tip", label: "Tip", swatch: "bg-app-success", fallbackIcon: "💡" },
];

function CalloutRow({ type, config, onField }) {
  const iconId = P.useFieldId(`callout-${type.id}-icon`);

  return (
    <P.Row
      htmlFor={iconId}
      label={
        <span className="flex items-center gap-2">
          <span aria-hidden className={`w-2.5 h-2.5 rounded-full flex-none ${type.swatch}`} />
          {type.label}
        </span>
      }
    >
      <div className="flex items-center gap-3">
        <P.TextField
          id={iconId}
          value={config?.icon || ""}
          placeholder={type.fallbackIcon}
          onChange={(v) => onField(type.id, "icon", v)}
          className="w-[56px] text-center"
        />
        <P.Toggle
          checked={config?.collapsed ?? false}
          onChange={(v) => onField(type.id, "collapsed", v)}
          label={`${type.label} starts collapsed`}
        />
      </div>
    </P.Row>
  );
}

export default function Callouts({ callouts, onChange }) {
  const setField = (typeId, key, value) => {
    onChange({
      ...callouts,
      [typeId]: { ...callouts[typeId], [key]: value },
    });
  };

  return (
    <P.Page
      title="Callouts"
      lede="Callouts are the boxed asides you drop into a note. Give each kind its own icon and decide whether it opens folded."
    >
      <P.Group label="Types" hint="The icon, then whether the callout starts collapsed.">
        {TYPES.map((type) => (
          <CalloutRow
            key={type.id}
            type={type}
            config={callouts?.[type.id]}
            onField={setField}
          />
        ))}
      </P.Group>
    </P.Page>
  );
}
