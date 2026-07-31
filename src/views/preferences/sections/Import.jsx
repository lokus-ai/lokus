/**
 * Import — bring a folder of notes over from another app.
 *
 * Every row opens the same picker: QuickImport detects the format itself, so
 * choosing a source here is a statement of intent, not a different code path.
 * The QuickImport modal stays mounted by Preferences.jsx and is untouched.
 *
 * Props:
 *   onImport   ()   open the QuickImport picker — `() => setShowQuickImport(true)`
 */
import * as P from "../primitives.jsx";

const SOURCES = [
  {
    name: "Logseq",
    hint: "Page properties become YAML frontmatter, TODO/DONE become checkboxes, and block references are resolved in place.",
  },
  {
    name: "Roam Research",
    hint: "Blocks come across as nested lists, and bidirectional links become wiki links.",
  },
  {
    name: "Obsidian",
    hint: "Canvas files, callouts and plugin syntax are converted. Everything else already works as-is.",
  },
];

export default function Import({ onImport }) {
  return (
    <P.Page
      title="Import"
      lede="Point Lokus at a folder from another app. It reads the format, converts a copy, and leaves your originals exactly where they are."
    >
      <P.Group label="Bring notes in" hint="Each one opens the same folder picker — Lokus detects the format itself.">
        {SOURCES.map((source) => (
          <P.ActionRow key={source.name} label={source.name} hint={source.hint} onClick={onImport} />
        ))}
      </P.Group>

      <P.Group label="Before you start">
        <P.Empty>
          A backup folder is written before anything is converted, so an import you don't like is one folder away from
          being undone.
        </P.Empty>
        <P.Note>
          Need the details? Read the{" "}
          <a
            href="https://github.com/lokus-ai/lokus/blob/main/docs/migration-guide.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-app-accent underline underline-offset-2 hover:text-app-accent-hover
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/50 rounded-sm"
          >
            migration guide
          </a>
          .
        </P.Note>
      </P.Group>
    </P.Page>
  );
}
