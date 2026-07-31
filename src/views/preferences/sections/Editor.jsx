/**
 * Editor preferences.
 *
 * Props:
 *   settings              {object}          flat snapshot of every live editor setting
 *                                           (Preferences.jsx: `liveSettings`)
 *   onChange              (key, value)      write one setting
 *                                           (Preferences.jsx: liveEditorSettings.updateSetting)
 *   onApplyPreset         (presetName)      apply a named preset
 *                                           (Preferences.jsx: `applyPreset`)
 *                                           (Preferences.jsx: `saveEditorSettings`)
 *   onReset               ()                restore defaults (now persists too)
 *                                           (Preferences.jsx: `resetEditorSettings`)
 *   onFontFamilyChange    (value)           optional. Font family alone also writes
 *                                           `editor.font.family` to config on change, so the
 *                                           parent owns it. Falls back to onChange.
 *
 * Settings apply the moment you drag a slider. liveEditorSettings writes the CSS variables,
 * broadcasts them to every other window, and persists on a debounce — so there is no Save
 * action here and nothing to lose by closing the window.
 */
import { createContext, useContext } from "react";
import * as P from "../primitives.jsx";

const SettingsCtx = createContext({ settings: {}, onChange: () => { } });

const useSetting = (key) => {
  const { settings, onChange } = useContext(SettingsCtx);
  return [settings[key], (value) => onChange(key, value)];
};

/* --------------------------------------------------------------- format ---- */

const unit = (suffix, decimals) => (v) => {
  const n = Number(v);
  const shown = Number.isFinite(n) && decimals != null ? n.toFixed(decimals) : v;
  return `${shown}${suffix}`;
};

const px = unit("px");
const em = (d) => unit("em", d);
const rem = (d) => unit("rem", d);

/* ------------------------------------------------------------- controls ---- */

function SliderRow({ label, hint, setting, min, max, step = 1, format }) {
  const id = P.useFieldId("editor");
  const [value, set] = useSetting(setting);
  return (
    <P.Row label={label} hint={hint} htmlFor={id} stacked>
      <P.Slider id={id} value={value} onChange={set} min={min} max={max} step={step} format={format} />
    </P.Row>
  );
}

function SelectRow({ label, hint, setting, options }) {
  const id = P.useFieldId("editor");
  const [value, set] = useSetting(setting);
  return (
    <P.Row label={label} hint={hint} htmlFor={id}>
      <P.Select id={id} value={value} onChange={set}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>{text}</option>
        ))}
      </P.Select>
    </P.Row>
  );
}

/**
 * A colour. The swatch is the picker; the stored value is printed beside it in mono because it
 * can be a token like `inherit` rather than a hex, and that is worth being honest about.
 *
 * `fallback` is what the picker shows when the stored value isn't a hex colour, and `read`/`write`
 * exist for the one setting (selection) that stores rgba rather than hex.
 */
function ColorRow({ label, hint, setting, fallback = "#000000", read, write }) {
  const id = P.useFieldId("editor");
  const [value, set] = useSetting(setting);
  const swatch = read ? read(value) : (value === "#inherit" ? fallback : value) || fallback;
  return (
    <P.Row label={label} hint={hint} htmlFor={id}>
      <span className="flex items-center gap-2.5">
        <span className="font-mono text-[11px] text-app-muted tabular-nums">{value ?? "default"}</span>
        <input
          id={id}
          type="color"
          value={swatch}
          onChange={(e) => set(write ? write(e.target.value) : e.target.value)}
          className="h-[22px] w-[30px] rounded-[3px] border border-app-border bg-transparent cursor-pointer
                     p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/50"
        />
      </span>
    </P.Row>
  );
}

/** Pick one glyph out of a handful. A radio group, not a row of toggles. */
function SymbolRow({ label, hint, setting, symbols }) {
  const [value, set] = useSetting(setting);
  return (
    <P.Row label={label} hint={hint} stacked>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {symbols.map((symbol) => {
          const active = value === symbol;
          return (
            <button
              key={symbol}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => set(symbol)}
              className={`h-8 w-8 rounded-md border text-[14px] leading-none transition-colors
                          motion-reduce:transition-none focus-visible:outline-none
                          focus-visible:ring-2 focus-visible:ring-app-accent/50
                          ${active
                  ? "border-app-accent text-app-accent"
                  : "border-app-border text-app-text hover:border-app-border-hover"}`}
            >
              {symbol}
            </button>
          );
        })}
      </div>
    </P.Row>
  );
}

/* ----------------------------------------------------------------- page ---- */

const FONT_FAMILIES = [
  ["ui-sans-serif", "System sans"],
  ["ui-serif", "System serif"],
  ["ui-monospace", "System monospace"],
  ["Inter", "Inter"],
  ["Roboto", "Roboto"],
  ["'Helvetica Neue', Helvetica", "Helvetica"],
  ["Georgia, serif", "Georgia"],
  ["'Times New Roman', serif", "Times New Roman"],
  ["'JetBrains Mono', monospace", "JetBrains Mono"],
];

const CODE_FAMILIES = [
  ["ui-monospace", "System monospace"],
  ["'JetBrains Mono', monospace", "JetBrains Mono"],
  ["'Fira Code', monospace", "Fira Code"],
  ["'Source Code Pro', monospace", "Source Code Pro"],
  ["Consolas, monospace", "Consolas"],
  ["Monaco, monospace", "Monaco"],
];

const PRESETS = [
  ["minimal", "Minimal", "Roomy line height, restrained headings."],
  ["comfortable", "Comfortable", "The middle ground. A good place to start."],
  ["compact", "Compact", "Smaller and tighter — more words on screen."],
  ["spacious", "Spacious", "Large type with plenty of air around it."],
];

export default function Editor({
  settings = {},
  onChange,
  onApplyPreset,
  onReset,
  onFontFamilyChange,
}) {
  const fontFamilyId = P.useFieldId("editor");

  return (
    <SettingsCtx.Provider value={{ settings, onChange }}>
      <P.Page
        title="Editor"
        lede="How your notes look while you write them. Changes apply everywhere as you make them and are kept automatically."
      >
        <P.Group label="Preview">
          <div
            className="ProseMirror border-y border-app-border/60 py-3 max-h-[300px] overflow-y-auto"
            style={{
              fontFamily: "var(--editor-font-family, ui-sans-serif)",
              fontSize: "var(--editor-font-size, 16px)",
              lineHeight: "var(--editor-line-height, 1.7)",
              letterSpacing: "var(--editor-letter-spacing, 0.003em)",
              color: "var(--editor-text-color, rgb(var(--text)))",
            }}
          >
            <h1>Heading 1</h1>
            <h2>Heading 2</h2>
            <h3>Heading 3</h3>
            <p>A paragraph with <strong>bold text</strong> and <em>italic text</em>, so you can see the weights against each other.</p>
            <ul>
              <li>Bullet point one</li>
              <li>Bullet point two</li>
              <li>Nested list:
                <ul>
                  <li>Nested item 1</li>
                  <li>Nested item 2</li>
                </ul>
              </li>
            </ul>
            <p>Here's a <a href="#">link</a> and some <code>inline code</code>.</p>
            <blockquote>
              <p>And a blockquote, for the bar and the padding.</p>
            </blockquote>
          </div>
        </P.Group>

        <P.Group label="Presets" hint="A starting point for size, spacing and heading scale. Everything below stays adjustable.">
          {PRESETS.map(([key, label, hint]) => (
            <P.ActionRow key={key} label={label} hint={hint} onClick={() => onApplyPreset?.(key)} />
          ))}
        </P.Group>

        <P.Group label="Typeface">
          <P.Row label="Font" htmlFor={fontFamilyId}>
            <P.Select
              id={fontFamilyId}
              value={settings.fontFamily}
              onChange={(v) => (onFontFamilyChange ? onFontFamilyChange(v) : onChange("fontFamily", v))}
            >
              {FONT_FAMILIES.map(([v, text]) => (
                <option key={v} value={v}>{text}</option>
              ))}
            </P.Select>
          </P.Row>
          <SliderRow label="Size" setting="fontSize" min={12} max={24} step={1} format={px} />
          <SliderRow label="Line height" setting="lineHeight" min={1.2} max={2.5} step={0.1} format={unit("", 1)} />
          <SliderRow label="Letter spacing" setting="letterSpacing" min={-0.05} max={0.1} step={0.005} format={em(3)} />
          <SliderRow label="Body weight" setting="fontWeight" min={100} max={900} step={100} />
          <SliderRow label="Bold weight" setting="boldWeight" min={100} max={900} step={100} />
          <ColorRow label="Text colour" setting="textColor" />
          <ColorRow label="Bold colour" setting="boldColor" />
          <ColorRow label="Italic colour" setting="italicColor" />
        </P.Group>

        <P.Group label="Headings">
          <SliderRow label="H1 size" setting="h1Size" min={1.5} max={3.0} step={0.1} format={em(1)} />
          <SliderRow label="H2 size" setting="h2Size" min={1.2} max={2.5} step={0.1} format={em(1)} />
          <SliderRow label="H3 size" setting="h3Size" min={1.0} max={2.0} step={0.1} format={em(1)} />
          <SliderRow label="H1 weight" setting="h1Weight" min={100} max={900} step={100} />
          <SliderRow label="H2 weight" setting="h2Weight" min={100} max={900} step={100} />
          <SliderRow label="H3 weight" setting="h3Weight" min={100} max={900} step={100} />
          <ColorRow label="Heading colour" setting="headingColor" />
        </P.Group>

        <P.Group label="Spacing">
          <SliderRow label="Between paragraphs" setting="paragraphSpacing" min={0} max={3} step={0.25} format={rem(2)} />
          <SliderRow label="Between list items" setting="listSpacing" min={0} max={1} step={0.05} format={rem(2)} />
          <SliderRow label="Indent step" setting="indentSize" min={1} max={4} step={0.5} format={rem(1)} />
        </P.Group>

        <P.Group label="Lists">
          <SymbolRow label="Bullet" setting="bulletStyle" symbols={["•", "◦", "▪", "▸", "►", "○", "●"]} />
          <SymbolRow label="Checked task" setting="checkboxStyle" symbols={["☑", "✓", "✔", "☐", "✅"]} />
        </P.Group>

        <P.Group label="Links">
          <ColorRow label="Colour" setting="linkColor" fallback="#0000ff" />
          <ColorRow label="Colour on hover" setting="linkHoverColor" fallback="#0000cc" />
          <SelectRow
            label="Underline"
            setting="linkUnderline"
            options={[["none", "Never"], ["hover", "On hover"], ["always", "Always"]]}
          />
          <SliderRow label="Underline thickness" setting="linkUnderlineThickness" min={1} max={4} step={1} format={px} />
          <SliderRow label="Underline offset" setting="linkUnderlineOffset" min={0} max={8} step={1} format={px} />
        </P.Group>

        <P.Group label="Inline code" hint="Backticks inside a sentence.">
          <ColorRow label="Text colour" setting="codeColor" fallback="#e83e8c" />
          <ColorRow label="Background" setting="codeBackground" />
        </P.Group>

        <P.Group label="Code blocks">
          <ColorRow label="Background" setting="codeBlockBg" />
          <ColorRow label="Border colour" setting="codeBlockBorder" />
          <SliderRow label="Border width" setting="codeBlockBorderWidth" min={0} max={5} step={1} format={px} />
          <SliderRow label="Corner radius" setting="codeBlockBorderRadius" min={0} max={20} step={1} format={px} />
          <SliderRow label="Padding" setting="codeBlockPadding" min={0} max={32} step={2} format={px} />
          <SelectRow label="Font" setting="codeBlockFont" options={CODE_FAMILIES} />
          <SliderRow label="Font size" setting="codeBlockFontSize" min={10} max={20} step={1} format={px} />
          <SliderRow label="Line height" setting="codeBlockLineHeight" min={1.0} max={2.0} step={0.1} format={unit("", 1)} />
        </P.Group>

        <P.Group label="Quotes">
          <ColorRow label="Text colour" setting="blockquoteColor" fallback="#6c757d" />
          <ColorRow label="Bar colour" setting="blockquoteBorder" />
          <SliderRow label="Bar width" setting="blockquoteBorderWidth" min={1} max={8} step={1} format={px} />
          <SelectRow
            label="Bar style"
            setting="blockquoteStyle"
            options={[["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"], ["double", "Double"]]}
          />
          <SliderRow label="Padding" setting="blockquotePadding" min={8} max={32} step={2} format={px} />
        </P.Group>

        <P.Group label="Tables">
          <ColorRow label="Border colour" setting="tableBorder" />
          <SliderRow label="Border width" setting="tableBorderWidth" min={1} max={4} step={1} format={px} />
          <ColorRow label="Header background" setting="tableHeaderBg" />
          <SliderRow label="Cell padding" setting="tableCellPadding" min={4} max={20} step={2} format={px} />
        </P.Group>

        <P.Group label="Marks">
          <ColorRow label="Highlight background" setting="highlightColor" />
          <ColorRow label="Highlight text" setting="highlightTextColor" />
          <ColorRow label="Strikethrough" setting="strikethroughColor" />
          <SliderRow label="Strikethrough thickness" setting="strikethroughThickness" min={1} max={4} step={1} format={px} />
          <ColorRow label="Underline" setting="underlineColor" />
          <SliderRow label="Underline thickness" setting="underlineThickness" min={1} max={4} step={1} format={px} />
          <ColorRow
            label="Selection"
            setting="selectionColor"
            fallback="#6366f1"
            read={(v) => String(v ?? "").match(/#[0-9a-fA-F]{6}/)?.[0] || "#6366f1"}
            write={(hex) =>
              `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, 0.2)`
            }
          />
        </P.Group>

        {/* No Save button: liveEditorSettings now broadcasts to every window
            and persists on a debounce, so there is nothing left to commit. */}
        <P.Group label="Defaults">
          <div className="pt-1">
            <P.Button tone="ghost" onClick={onReset}>Restore defaults</P.Button>
          </div>
        </P.Group>
      </P.Page>
    </SettingsCtx.Provider>
  );
}
