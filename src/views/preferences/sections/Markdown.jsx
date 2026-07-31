/**
 * Markdown syntax preferences.
 *
 * Props:
 *   syntax                    {object}     the live config snapshot; the parent
 *                                          subscribes to markdownSyntaxConfig
 *                                          and re-renders on change
 *                                          → Preferences.jsx `markdownSyntax`
 *   customSymbols             {object}     name → character map
 *                                          → Preferences.jsx `customSymbols`
 *   newSymbolName             {string}     draft name in the add row
 *                                          → Preferences.jsx `newSymbolName`
 *   onNewSymbolNameChange     (v:string)   → Preferences.jsx `setNewSymbolName`
 *   newSymbolChar             {string}     draft character in the add row
 *                                          → Preferences.jsx `newSymbolChar`
 *   onNewSymbolCharChange     (v:string)   → Preferences.jsx `setNewSymbolChar`
 *   onAddSymbol               ()           commit the draft (it does its own
 *                                          validation and clears the fields)
 *                                          → Preferences.jsx `addCustomSymbol`
 *   onRemoveSymbol            (name)       → Preferences.jsx `removeCustomSymbol`
 *
 * `markdownSyntaxConfig` is a module singleton, so it is imported directly
 * rather than threaded through props — the same object the parent subscribes to.
 * Save feedback is local state; the parent's shared `saveStatus` is no longer
 * needed here.
 */
import { useState } from "react";
import markdownSyntaxConfig from "../../../core/markdown/syntax-config.js";
import * as P from "../primitives.jsx";

/** In the order the section has always listed them. */
const SYNTAX = [
  { key: "heading", label: "Headings", fallback: "#", max: 2 },
  { key: "bold", label: "Bold", fallback: "**", max: 3 },
  { key: "italic", label: "Italic", fallback: "*", max: 2 },
  { key: "inlineCode", label: "Inline code", fallback: "`", max: 2 },
  { key: "strikethrough", label: "Strikethrough", fallback: "~~", max: 3 },
  { key: "highlight", label: "Highlight", fallback: "==", max: 3 },
  { key: "bulletList", label: "Bullet lists", kind: "bulletList" },
  { key: "blockquote", label: "Blockquote", fallback: ">", max: 2 },
  { key: "wikiLink", label: "Wiki links", kind: "wikiLink", hint: "Opening and closing brackets." },
  { key: "image", label: "Images", fallback: "!", max: 2 },
];

/** A marker/enabled pair: the character on the left of the switch. */
function MarkerRow({ item, syntax }) {
  const id = P.useFieldId(`md-${item.key}`);
  const entry = syntax?.[item.key];
  const enabled = entry?.enabled !== false;

  return (
    <P.Row label={item.label} hint={item.hint} htmlFor={id}>
      <div className="flex items-center gap-3">
        <P.TextField
          id={id}
          mono
          value={entry?.marker || item.fallback}
          disabled={!enabled}
          onChange={(v) => markdownSyntaxConfig.set(item.key, "marker", v.slice(0, item.max))}
          className="w-[60px] text-center"
        />
        <P.Toggle
          checked={enabled}
          onChange={() => markdownSyntaxConfig.set(item.key, "enabled", !enabled)}
          label={`${item.label} syntax`}
        />
      </div>
    </P.Row>
  );
}

function BulletListRow({ item, syntax }) {
  const id = P.useFieldId("md-bullet");
  const entry = syntax?.bulletList;
  const enabled = entry?.enabled !== false;

  return (
    <P.Row label={item.label} htmlFor={id}>
      <div className="flex items-center gap-3">
        <P.Select
          id={id}
          value={entry?.defaultMarker || "-"}
          disabled={!enabled}
          onChange={(v) => markdownSyntaxConfig.set("bulletList", "defaultMarker", v)}
          className="w-[60px] font-mono text-center"
        >
          {(entry?.markers || ["*", "-", "+"]).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </P.Select>
        <P.Toggle
          checked={enabled}
          onChange={() => markdownSyntaxConfig.set("bulletList", "enabled", !enabled)}
          label="Bullet list syntax"
        />
      </div>
    </P.Row>
  );
}

function WikiLinkRow({ item, syntax }) {
  const openId = P.useFieldId("md-wiki-open");
  const closeId = P.useFieldId("md-wiki-close");
  const link = syntax?.link;
  const wiki = link?.wikiLink;
  const enabled = wiki?.enabled !== false;

  const setWiki = (patch) =>
    markdownSyntaxConfig.set("link", { ...link, wikiLink: { ...wiki, ...patch } });

  return (
    <P.Row label={item.label} hint={item.hint} htmlFor={openId}>
      <div className="flex items-center gap-3">
        <P.TextField
          id={openId}
          mono
          value={wiki?.open || "[["}
          disabled={!enabled}
          onChange={(v) => setWiki({ open: v.slice(0, 3) })}
          className="w-[44px] text-center"
        />
        <P.TextField
          id={closeId}
          mono
          value={wiki?.close || "]]"}
          disabled={!enabled}
          onChange={(v) => setWiki({ close: v.slice(0, 3) })}
          className="w-[44px] text-center"
        />
        <P.Toggle
          checked={enabled}
          onChange={() => setWiki({ enabled: !enabled })}
          label="Wiki link syntax"
        />
      </div>
    </P.Row>
  );
}

/** One saved shortcut. The name and the character are both data, so both are mono. */
function SymbolRow({ name, symbol, onRemove }) {
  return (
    <div className="py-2.5 border-b border-app-border/60 flex items-center gap-3">
      <span className="font-mono text-[12px] text-app-text flex-1 min-w-0 truncate">
        :{name}:
      </span>
      <span aria-hidden className="text-[12px] text-app-muted flex-none">→</span>
      <span className="font-mono text-[13px] text-app-text w-[56px] text-center flex-none">
        {symbol}
      </span>
      <P.Button tone="ghost" onClick={() => onRemove(name)} className="flex-none">
        Remove<span className="sr-only"> {`:${name}:`}</span>
      </P.Button>
    </div>
  );
}

export default function Markdown({
  syntax,
  customSymbols,
  newSymbolName,
  onNewSymbolNameChange,
  newSymbolChar,
  onNewSymbolCharChange,
  onAddSymbol,
  onRemoveSymbol,
}) {
  const [status, setStatus] = useState(null);
  const nameId = P.useFieldId("symbol-name");
  const charId = P.useFieldId("symbol-char");

  const symbols = Object.entries(customSymbols || {});
  const canAdd =
    !!newSymbolName.trim() && !!newSymbolChar.trim() && newSymbolName.trim().length >= 2;

  const flash = (tone, text) => {
    setStatus({ tone, text });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleExport = () => {
    navigator.clipboard.writeText(markdownSyntaxConfig.export());
    flash("muted", "Configuration copied to the clipboard.");
  };

  return (
    <P.Page
      title="Markdown"
      lede="Pick the characters Lokus writes for each piece of syntax, and add shortcuts for the symbols you type often."
      actions={
        <>
          <P.Button onClick={handleExport}>Export</P.Button>
          <P.Button onClick={() => markdownSyntaxConfig.reset()}>Reset all</P.Button>
        </>
      }
    >
      <P.Group label="Syntax" hint="Turn one off to leave that syntax as plain text.">
        {SYNTAX.map((item) => {
          if (item.kind === "bulletList") {
            return <BulletListRow key={item.key} item={item} syntax={syntax} />;
          }
          if (item.kind === "wikiLink") {
            return <WikiLinkRow key={item.key} item={item} syntax={syntax} />;
          }
          return <MarkerRow key={item.key} item={item} syntax={syntax} />;
        })}

        {status && <P.Note tone={status.tone}>{status.text}</P.Note>}
      </P.Group>

      <P.Group
        label="Symbol shortcuts"
        hint={
          <>
            Type <span className="font-mono">:name:</span> to insert a character.{" "}
            <span className="font-mono">:theta:</span> → θ,{" "}
            <span className="font-mono">:arrow:</span> → → and{" "}
            <span className="font-mono">:inf:</span> → ∞ come built in; yours win on a
            name clash.
          </>
        }
      >
        {symbols.length === 0 ? (
          <P.Empty>No shortcuts of your own yet. Add one below and it works as you type.</P.Empty>
        ) : (
          symbols.map(([name, symbol]) => (
            <SymbolRow key={name} name={name} symbol={symbol} onRemove={onRemoveSymbol} />
          ))
        )}

        <form
          className="pt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onAddSymbol();
          }}
        >
          <label htmlFor={nameId} className="sr-only">Shortcut name</label>
          <P.TextField
            id={nameId}
            mono
            value={newSymbolName}
            placeholder="myarrow"
            onChange={(v) => onNewSymbolNameChange(v.replace(/[^a-zA-Z0-9]/g, ""))}
            className="flex-1 min-w-0"
          />
          <span aria-hidden className="text-[12px] text-app-muted flex-none">→</span>
          <label htmlFor={charId} className="sr-only">Character to insert</label>
          <P.TextField
            id={charId}
            mono
            value={newSymbolChar}
            placeholder="➜"
            onChange={onNewSymbolCharChange}
            className="w-[56px] text-center flex-none"
          />
          <P.Button type="submit" disabled={!canAdd} className="flex-none">Add</P.Button>
        </form>
      </P.Group>
    </P.Page>
  );
}
