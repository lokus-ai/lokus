/** @part-of ui.settings */
import type { ReactNode } from "react";

/** The building blocks every settings page is made of. */

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      {hint && <p className="settings-hint">{hint}</p>}
      {children}
    </section>
  );
}

export function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="settings-control">{children}</div>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange(on: boolean): void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`switch${on ? " on" : ""}`} onClick={() => onChange(!on)} />;
}

export function Choice<T extends string>({ value, options, onChange }: { value: T; options: Record<T, string>; onChange(value: T): void }) {
  return (
    <div className="segmented">
      {(Object.keys(options) as T[]).map((key) => (
        <button key={key} className={key === value ? "active" : ""} onClick={() => onChange(key)}>
          {options[key]}
        </button>
      ))}
    </div>
  );
}
