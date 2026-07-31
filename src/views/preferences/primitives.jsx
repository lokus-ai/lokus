/**
 * Settings primitives — one language for every preferences page.
 *
 * Before this, each section invented its own: Appearance used a bare eyebrow
 * and a select, Editor used collapsible icon cards with value chips and fat
 * sliders, Shortcuts used a bordered table. 79 hand-rolled containers, no two
 * alike. These components are the whole vocabulary; a page should not need a
 * `rounded-*` or a bespoke flex row of its own.
 *
 * The language is Vellum, same as WelcomeScreen and the launcher: a reading
 * column, hairline rules instead of cards, typography carrying hierarchy, and
 * the accent spent only on focus and the active control.
 */
import { useId } from "react";

/* ---------------------------------------------------------------- page ---- */

/** The frame every section renders into: title, optional lede, then groups. */
export function Page({ title, lede, actions, children }) {
  return (
    <div className="max-w-[560px]">
      <header className="mb-7">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-[22px] leading-[1.2] font-bold tracking-[-0.01em] text-app-text">
            {title}
          </h1>
          {actions && <div className="flex items-center gap-2 flex-none">{actions}</div>}
        </div>
        {lede && (
          <p className="text-[13.5px] leading-[1.6] text-app-text-secondary mt-1.5">{lede}</p>
        )}
      </header>
      <div className="flex flex-col gap-8">{children}</div>
    </div>
  );
}

/** A titled cluster of rows. The label is a quiet mono eyebrow, not a heading. */
export function Group({ label, hint, children }) {
  return (
    <section>
      {label && (
        <h2 className="font-mono text-[10px] tracking-[0.14em] uppercase text-app-muted mb-1">
          {label}
        </h2>
      )}
      {hint && <p className="text-[12.5px] leading-[1.55] text-app-muted mb-2">{hint}</p>}
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

/**
 * One setting. Label and hint on the left, control on the right, hairline
 * beneath. `stacked` puts the control on its own line for wide controls
 * (sliders, long selects, textareas).
 */
export function Row({ label, hint, htmlFor, children, stacked = false }) {
  return (
    <div className="py-3 border-b border-app-border/60 last:border-b-0">
      <div className={stacked ? "" : "flex items-center justify-between gap-6"}>
        <div className="min-w-0">
          {label && (
            <label htmlFor={htmlFor} className="block text-[13.5px] leading-[1.4] text-app-text">
              {label}
            </label>
          )}
          {hint && (
            <p className="text-[12px] leading-[1.5] text-app-muted mt-0.5">{hint}</p>
          )}
        </div>
        <div className={stacked ? "mt-2.5" : "flex-none"}>{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ controls ---- */

export function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      /* "On" is a neutral fill, not the accent. A settings page can show a
         dozen enabled toggles at once, and a dozen accent-coloured pills turns
         the page into noise. The accent is worth more when it only ever means
         focus. */
      className={`relative h-[18px] w-[30px] rounded-full border transition-colors motion-reduce:transition-none
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/50
                  disabled:opacity-40
                  ${checked ? "bg-app-text border-app-text" : "bg-transparent border-app-border"}`}
    >
      <span
        className={`absolute top-[2px] h-[12px] w-[12px] rounded-full transition-all motion-reduce:transition-none
                    ${checked ? "left-[15px] bg-app-bg" : "left-[2px] bg-app-muted"}`}
      />
    </button>
  );
}

export function Select({ value, onChange, children, disabled, id, className = "" }) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      className={`bg-transparent border border-app-border rounded-md px-2.5 py-1.5 text-[13px] text-app-text
                  focus:border-app-accent focus:outline-none disabled:opacity-40
                  transition-colors motion-reduce:transition-none ${className}`}
    >
      {children}
    </select>
  );
}

export function TextField({
  value, onChange, placeholder, id, type = "text", mono, disabled, className = "",
  // Forwarded so credential fields can opt out of autofill and spellcheck.
  autoComplete, spellCheck, onBlur, onKeyDown, maxLength, name,
}) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      autoComplete={autoComplete}
      spellCheck={spellCheck}
      maxLength={maxLength}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onChange={(e) => onChange?.(e.target.value)}
      className={`bg-transparent border border-app-border rounded-md px-2.5 py-1.5 text-[13px] text-app-text
                  placeholder:text-app-muted focus:border-app-accent focus:outline-none disabled:opacity-40
                  transition-colors motion-reduce:transition-none ${mono ? "font-mono text-[12px]" : ""} ${className}`}
    />
  );
}

/** Slider with its value in mono to the right — the number is data, so it's set as data. */
export function Slider({ value, onChange, min, max, step = 1, format, id, disabled }) {
  return (
    <div className="flex items-center gap-3 w-full">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(parseFloat(e.target.value))}
        /* Neutral, like the toggles. The Editor page shows around twenty of
           these at once; accent-filled they turn the page purple and the
           accent stops meaning anything. */
        className="flex-1 accent-app-text disabled:opacity-40"
      />
      <span className="font-mono text-[11px] text-app-muted tabular-nums w-[52px] text-right flex-none">
        {format ? format(value) : value}
      </span>
    </div>
  );
}

/** Secondary action. `tone="danger"` for destructive, `tone="primary"` for the one commit action. */
export function Button({ children, onClick, tone = "default", disabled, type = "button", className = "" }) {
  const tones = {
    default: "border-app-border text-app-text hover:border-app-accent",
    primary: "border-app-accent bg-app-accent text-app-accent-fg hover:bg-app-accent/90",
    danger: "border-app-border text-app-danger hover:border-app-danger",
    ghost: "border-transparent text-app-muted hover:text-app-text",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`border rounded-md px-2.5 py-1.5 text-[13px] disabled:opacity-40
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/50
                  transition-colors motion-reduce:transition-none ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

/** A single key in a shortcut, e.g. ⌘ or S. */
export function KeyCap({ children }) {
  return (
    <kbd className="font-mono text-[11px] leading-none text-app-text bg-app-panel-secondary
                    border border-app-border rounded px-1.5 py-1 min-w-[20px] inline-flex
                    items-center justify-center">
      {children}
    </kbd>
  );
}

/** A clickable row that performs something, rather than holding a value. */
export function ActionRow({ label, hint, onClick, disabled, tone = "default", trailing }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group w-full text-left py-3 border-b border-app-border/60 last:border-b-0
                 flex items-center justify-between gap-6 disabled:opacity-40
                 focus-visible:outline-none"
    >
      <span className="min-w-0">
        <span className={`block text-[13.5px] leading-[1.4] group-focus-visible:underline
                          ${tone === "danger" ? "text-app-danger" : "text-app-text"}`}>
          {label}
        </span>
        {hint && <span className="block text-[12px] leading-[1.5] text-app-muted mt-0.5">{hint}</span>}
      </span>
      {trailing && <span className="flex-none text-app-muted">{trailing}</span>}
    </button>
  );
}

/** Empty / not-configured state. An empty screen is an invitation to act. */
export function Empty({ children }) {
  return <p className="text-[13.5px] leading-[1.7] text-app-text-secondary py-1">{children}</p>;
}

/** Inline status after an action — never a floating toast bar. */
export function Note({ tone = "muted", children }) {
  const tones = {
    muted: "text-app-muted",
    success: "text-app-success",
    danger: "text-app-danger",
  };
  return <p className={`text-[12.5px] leading-[1.55] mt-2 ${tones[tone]}`}>{children}</p>;
}

/** Stable id for label/control pairing inside a Row. */
export function useFieldId(prefix = "field") {
  const id = useId();
  return `${prefix}-${id}`;
}
