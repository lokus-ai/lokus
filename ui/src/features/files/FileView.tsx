/** @part-of ui.files */
import { useEffect, useState } from "react";

import { runCore, vaultFileUrl } from "../../bridge/core";
import { Icon } from "../../shell/Icon";
import { useStore } from "../../shell/store";
import { app } from "../../shell/workspace";
import { attachToChat } from "../ai/chat";
import { fileName, fileTag, kindOf, parseTable } from "./files";

/** The most rows of a table drawn at once; a bigger file says how many more it has. */
const ROWS = 1000;

interface Read {
  text: string;
  lines: number;
  more: boolean;
}

function Table({ path }: { path: string }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [more, setMore] = useState(false);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    runCore<Read>("file.text", { path, max_chars: 2_000_000 }).then(
      (read) => {
        const all = parseTable(read.text, /\.tsv$/i.test(path));
        setMore(read.more || all.length > ROWS + 1);
        setRows(all.slice(0, ROWS + 1));
      },
      (e) => setProblem(e instanceof Error ? e.message : String(e)),
    );
  }, [path]);
  if (problem) return <p className="file-note">This file could not be read as a table: {problem}</p>;
  if (!rows) return null;
  if (!rows.length) return <p className="file-note">This file is empty.</p>;
  const [head, ...body] = rows;
  const numeric = head.map((_, c) => body.length > 0 && body.every((r) => !r[c] || /^-?[\d,.]+%?$|^[$€£]-?[\d,.]+$/.test(r[c].trim())));
  return (
    <div className="file-table">
      <table>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} className={numeric[i] ? "num" : ""}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i}>
              {head.map((_, c) => (
                <td key={c} className={numeric[c] ? "num" : ""}>
                  {r[c] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {more && <p className="file-note">Showing the first {ROWS.toLocaleString()} rows.</p>}
    </div>
  );
}

function Text({ path }: { path: string }) {
  const [read, setRead] = useState<Read | null>(null);
  useEffect(() => {
    runCore<Read>("file.text", { path, max_chars: 400_000 }).then(setRead, () => setRead({ text: "", lines: 0, more: false }));
  }, [path]);
  if (!read) return null;
  return (
    <pre className="file-text">
      {read.text}
      {read.more ? "\n…" : ""}
    </pre>
  );
}

/** A file that is not a note, shown in the main area: a picture, a PDF, a table, or its text. */
export function FileView({ path }: { path: string }) {
  const vault = useStore(app, (s) => s.vault);
  if (!vault) return null;
  const kind = kindOf(path);
  const url = vaultFileUrl(vault.root, path);
  return (
    <div className="file-view">
      <header className="file-head">
        <strong>{fileName(path)}</strong>
        <span className="file-tag">{fileTag(path)}</span>
        <span className="file-space" />
        <button className="settings-button" onClick={() => attachToChat(path)}>
          <Icon name="assistant" size={13} /> Ask about this
        </button>
      </header>
      <div className={`file-body ${kind}`}>
        {kind === "image" && <img src={url} alt={fileName(path)} />}
        {kind === "pdf" && <iframe src={url} title={fileName(path)} />}
        {kind === "table" && <Table path={path} />}
        {kind === "text" && <Text path={path} />}
        {kind === "other" && <p className="file-note">Lokus cannot show this kind of file. It is in your workspace folder and opens in its own app.</p>}
      </div>
    </div>
  );
}
