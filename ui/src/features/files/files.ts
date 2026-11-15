/** @part-of ui.files */

export type FileKind = "image" | "pdf" | "table" | "text" | "other";

/** What a file is to a person, by its ending. The same split the core makes. */
export function kindOf(path: string): FileKind {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (ext === "csv" || ext === "tsv") return "table";
  if (["txt", "log", "json", "html", "htm", "xml", "yaml", "yml", "toml"].includes(ext)) return "text";
  return "other";
}

export const fileName = (path: string) => path.split("/").pop() ?? path;

/** "PDF", "CSV", "PNG": the short word shown beside a file's name. */
export const fileTag = (path: string) => (path.split(".").pop() ?? "").toUpperCase().slice(0, 5) || "File";

export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

/** Rows and cells of a CSV (or a TSV), with quoted cells and line breaks inside quotes kept whole. */
export function parseTable(text: string, tab = false): string[][] {
  const sep = tab ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}
