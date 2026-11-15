//! @part-of core
//! Files in a vault that are not notes: pictures, PDFs, spreadsheets saved as CSV.
//!
//! Three things are done with them. They are handed over whole, for a viewer or for a model
//! that can look at a picture. They are read as text, for a model that cannot open a PDF or a
//! person searching one. And a PDF can be written from plain text, so the assistant can hand
//! back a document and not only a note.

use std::path::Path;

use base64::Engine as _;
use printpdf::{BuiltinFont, IndirectFontRef, Mm, PdfDocument, PdfDocumentReference};
use serde_json::{json, Value};

use crate::error::{CoreError, Result};
use crate::vault::Vault;

/// The largest file handed over whole or read as text.
pub const MAX_FILE: usize = 25 * 1024 * 1024;

fn extension(path: &str) -> String {
    Path::new(path)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

/// What a file is, said the way the web says it.
pub fn mime(path: &str) -> &'static str {
    match extension(path).as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "pdf" => "application/pdf",
        "csv" => "text/csv",
        "tsv" => "text/tab-separated-values",
        "json" => "application/json",
        "html" | "htm" => "text/html",
        "txt" | "log" | "md" => "text/plain",
        _ => "application/octet-stream",
    }
}

/// The kind of thing a file is to a person: what the app shows it as.
pub fn kind(path: &str) -> &'static str {
    match extension(path).as_str() {
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "avif" | "bmp" => "image",
        "pdf" => "pdf",
        "csv" | "tsv" => "table",
        "txt" | "log" | "json" | "html" | "htm" | "xml" | "yaml" | "yml" | "toml" => "text",
        _ => "other",
    }
}

fn bytes(vault: &Vault, path: &str) -> Result<Vec<u8>> {
    let abs = vault.resolve(path)?;
    if !abs.is_file() {
        return Err(CoreError::NotFound(path.to_string()));
    }
    let size = std::fs::metadata(&abs)?.len() as usize;
    if size > MAX_FILE {
        return Err(CoreError::BadArgs {
            command: "file".into(),
            message: format!("{path} is larger than 25 MB"),
        });
    }
    Ok(std::fs::read(abs)?)
}

/// A file whole, as base64, with what it is.
pub fn read(vault: &Vault, path: &str) -> Result<Value> {
    let data = bytes(vault, path)?;
    Ok(json!({
        "path": path,
        "size": data.len(),
        "mime": mime(path),
        "kind": kind(path),
        "base64": base64::engine::general_purpose::STANDARD.encode(&data),
    }))
}

/// The words in a file. A PDF gives up its text; a picture or anything else has none, and
/// says so. `from_line` and `max_chars` let a long file be read in parts.
pub fn text(vault: &Vault, path: &str, from_line: usize, max_chars: usize) -> Result<Value> {
    let data = bytes(vault, path)?;
    let whole = match kind(path) {
        "pdf" => pdf_extract::extract_text_from_mem(&data)
            .map_err(|_| CoreError::NotText(path.to_string()))?,
        "image" if extension(path) != "svg" => return Err(CoreError::NotText(path.to_string())),
        _ => String::from_utf8(data).map_err(|_| CoreError::NotText(path.to_string()))?,
    };
    let lines: Vec<&str> = whole.lines().collect();
    let start = from_line.saturating_sub(1).min(lines.len());
    let mut out = String::new();
    let mut end = start;
    for line in &lines[start..] {
        if !out.is_empty() && out.len() + line.len() + 1 > max_chars {
            break;
        }
        out.push_str(line);
        out.push('\n');
        end += 1;
        if out.len() > max_chars {
            // One line longer than the whole allowance is cut, never skipped.
            let mut cut = max_chars;
            while !out.is_char_boundary(cut) {
                cut -= 1;
            }
            out.truncate(cut);
            break;
        }
    }
    Ok(json!({
        "path": path,
        "kind": kind(path),
        "text": out,
        "from_line": start + 1,
        "to_line": end,
        "lines": lines.len(),
        "more": end < lines.len(),
        // A scanned PDF is pictures of pages: it opens, and has no words in it.
        "empty": whole.trim().is_empty(),
    }))
}

const PAGE: (f32, f32) = (210.0, 297.0);
const MARGIN: f32 = 22.0;
const POINT: f32 = 0.352_778;

/// How wide a piece of Helvetica is, near enough to wrap lines by.
fn width(text: &str, size: f32, bold: bool) -> f32 {
    let ems: f32 = text
        .chars()
        .map(|c| match c {
            'i' | 'l' | 'I' | '.' | ',' | ':' | ';' | '|' | '!' | '\'' | 'j' => 0.26,
            'f' | 't' | 'r' | ' ' | '(' | ')' | '-' | '/' => 0.32,
            'm' | 'w' | 'M' | 'W' | '@' | '%' => 0.86,
            c if c.is_ascii_uppercase() => 0.69,
            _ => 0.555,
        })
        .sum();
    ems * size * POINT * if bold { 1.06 } else { 1.0 }
}

/// What the built-in fonts can draw; anything else becomes its plainest stand-in.
fn latin(text: &str) -> String {
    text.chars()
        .map(|c| match c {
            '‘' | '’' => '\'',
            '“' | '”' => '"',
            '–' | '—' => '-',
            '…' => '.',
            '\t' => ' ',
            c if (c as u32) < 256 && !c.is_control() => c,
            _ => '?',
        })
        .collect()
}

/// Markdown's marks taken off a line, leaving what it says.
fn plain(line: &str) -> String {
    let mut out = String::new();
    let mut rest = line;
    while let Some(open) = rest.find('[') {
        let Some(close) = rest[open..].find("](") else {
            break;
        };
        let Some(end) = rest[open + close..].find(')') else {
            break;
        };
        out.push_str(&rest[..open]);
        out.push_str(&rest[open + 1..open + close]);
        rest = &rest[open + close + end + 1..];
    }
    out.push_str(rest);
    latin(&out.replace("**", "").replace("__", "").replace('`', ""))
}

fn wrap(text: &str, size: f32, bold: bool, room: f32) -> Vec<String> {
    let mut lines = Vec::new();
    let mut line = String::new();
    for word in text.split_whitespace() {
        let tried = if line.is_empty() {
            word.to_string()
        } else {
            format!("{line} {word}")
        };
        if width(&tried, size, bold) > room && !line.is_empty() {
            lines.push(std::mem::take(&mut line));
            line = word.to_string();
        } else {
            line = tried;
        }
    }
    if !line.is_empty() {
        lines.push(line);
    }
    lines
}

struct Sheet {
    doc: PdfDocumentReference,
    layer: printpdf::PdfLayerReference,
    regular: IndirectFontRef,
    bold: IndirectFontRef,
    /// How far down the page the next line goes, from the top, in millimetres.
    y: f32,
}

impl Sheet {
    fn room(&mut self, needed: f32) {
        if self.y + needed > PAGE.1 - MARGIN {
            let (page, layer) = self.doc.add_page(Mm(PAGE.0), Mm(PAGE.1), "Page");
            self.layer = self.doc.get_page(page).get_layer(layer);
            self.y = MARGIN;
        }
    }

    fn line(&mut self, text: &str, size: f32, bold: bool, x: f32) {
        let height = size * POINT * 1.42;
        self.room(height);
        self.y += height;
        let font = if bold { &self.bold } else { &self.regular };
        self.layer
            .use_text(text, size, Mm(x), Mm(PAGE.1 - self.y), font);
    }

    fn paragraph(&mut self, text: &str, size: f32, bold: bool, indent: f32) {
        let room = PAGE.0 - 2.0 * MARGIN - indent;
        for line in wrap(text, size, bold, room) {
            self.line(&line, size, bold, MARGIN + indent);
        }
    }

    fn table(&mut self, rows: &[Vec<String>]) {
        let columns = rows.iter().map(Vec::len).max().unwrap_or(1).max(1);
        let each = (PAGE.0 - 2.0 * MARGIN) / columns as f32;
        for (r, row) in rows.iter().enumerate() {
            let size = 9.5;
            let height = size * POINT * 1.7;
            self.room(height);
            self.y += height;
            for (c, cell) in row.iter().enumerate() {
                // A cell keeps to its column: what does not fit is cut, with a mark.
                let mut shown = cell.clone();
                while width(&shown, size, r == 0) > each - 2.0 && shown.chars().count() > 1 {
                    shown.pop();
                }
                if shown != *cell {
                    shown.pop();
                    shown.push('.');
                }
                let font = if r == 0 { &self.bold } else { &self.regular };
                self.layer.use_text(
                    shown,
                    size,
                    Mm(MARGIN + c as f32 * each),
                    Mm(PAGE.1 - self.y),
                    font,
                );
            }
        }
        self.y += 2.0;
    }
}

/// Write a PDF from text laid out the way a note is: `#` headings, paragraphs, `-` lists and
/// `|` tables. Latin letters only, since the fonts every PDF reader has cover no more.
pub fn write_pdf(vault: &Vault, path: &str, title: &str, body: &str) -> Result<Value> {
    let bad = |message: String| CoreError::BadArgs {
        command: "file.pdf".into(),
        message,
    };
    if extension(path) != "pdf" {
        return Err(bad("the path must end in .pdf".into()));
    }
    if vault.resolve(path)?.exists() {
        return Err(CoreError::AlreadyExists(path.to_string()));
    }
    let (doc, page, layer) = PdfDocument::new(latin(title), Mm(PAGE.0), Mm(PAGE.1), "Page");
    let font = |f| doc.add_builtin_font(f).map_err(|e| bad(e.to_string()));
    let (regular, bold) = (
        font(BuiltinFont::Helvetica)?,
        font(BuiltinFont::HelveticaBold)?,
    );
    let layer = doc.get_page(page).get_layer(layer);
    let mut sheet = Sheet {
        doc,
        layer,
        regular,
        bold,
        y: MARGIN,
    };
    let mut table: Vec<Vec<String>> = Vec::new();
    for raw in body.lines().chain(std::iter::once("")) {
        let line = raw.trim();
        if line.starts_with('|') && line.ends_with('|') && line.len() > 1 {
            let cells: Vec<String> = line[1..line.len() - 1]
                .split('|')
                .map(|c| plain(c.trim()))
                .collect();
            // The row of dashes under a table's heading is markup, not a row.
            if !cells.iter().all(|c| c.chars().all(|ch| "-: ".contains(ch))) {
                table.push(cells);
            }
            continue;
        }
        if !table.is_empty() {
            sheet.table(&std::mem::take(&mut table));
        }
        if line.is_empty() {
            sheet.y += 3.0;
        } else if let Some(text) = line.strip_prefix("### ") {
            sheet.y += 2.0;
            sheet.paragraph(&plain(text), 12.0, true, 0.0);
        } else if let Some(text) = line.strip_prefix("## ") {
            sheet.y += 3.0;
            sheet.paragraph(&plain(text), 14.5, true, 0.0);
        } else if let Some(text) = line.strip_prefix("# ") {
            sheet.y += 2.0;
            sheet.paragraph(&plain(text), 20.0, true, 0.0);
            sheet.y += 2.0;
        } else if let Some(text) = line.strip_prefix("- ").or_else(|| line.strip_prefix("* ")) {
            // Room is made first, so the dash and the first line of its item share a page.
            let height = 11.0 * POINT * 1.42;
            sheet.room(height);
            sheet.layer.use_text(
                "-",
                11.0,
                Mm(MARGIN + 1.5),
                Mm(PAGE.1 - sheet.y - height),
                &sheet.regular,
            );
            sheet.paragraph(&plain(text), 11.0, false, 6.0);
        } else {
            sheet.paragraph(&plain(line), 11.0, false, 0.0);
        }
    }
    let made = sheet.doc.save_to_bytes().map_err(|e| bad(e.to_string()))?;
    vault.write_file(path, &made)?;
    Ok(json!({ "path": path, "size": made.len(), "kind": "pdf" }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_pdf_written_can_be_read_back() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        let body = "# Quarterly report\n\nRevenue grew **12%** over the quarter, mostly from [Acme](https://acme.io).\n\n## By customer\n\n| Customer | Plan | Seats |\n| --- | --- | --- |\n| Acme | Team | 42 |\n| Globex | Solo | 3 |\n\n- First point “quoted”\n- Second point\n";
        let made = write_pdf(&vault, "reports/Q3.pdf", "Quarterly report", body).unwrap();
        assert!(made["size"].as_u64().unwrap() > 500);
        let read = text(&vault, "reports/Q3.pdf", 1, 10_000).unwrap();
        let words = read["text"].as_str().unwrap();
        for part in [
            "Quarterly report",
            "Revenue grew 12%",
            "Acme",
            "Globex",
            "Second point",
        ] {
            assert!(words.contains(part), "{part} missing from: {words}");
        }
        assert!(!words.contains("**") && !words.contains("https://"));
        assert!(write_pdf(&vault, "reports/Q3.pdf", "x", "again").is_err());
        assert!(write_pdf(&vault, "reports/Q3.txt", "x", "wrong").is_err());
    }

    #[test]
    fn a_long_file_is_read_in_parts_and_a_picture_has_no_words() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        let csv: String = (1..=500).map(|n| format!("row{n},{}\n", n * 2)).collect();
        vault.write_file("data/sales.csv", csv.as_bytes()).unwrap();
        let first = text(&vault, "data/sales.csv", 1, 600).unwrap();
        assert_eq!(first["kind"], "table");
        assert_eq!(first["lines"], 500);
        assert_eq!(first["more"], true);
        let next = first["to_line"].as_u64().unwrap() as usize + 1;
        let second = text(&vault, "data/sales.csv", next, 600).unwrap();
        assert!(second["text"]
            .as_str()
            .unwrap()
            .starts_with(&format!("row{next},")));

        vault
            .write_file("pic.png", &[0x89, b'P', b'N', b'G', 0, 1, 2])
            .unwrap();
        assert!(matches!(
            text(&vault, "pic.png", 1, 100),
            Err(CoreError::NotText(_))
        ));
        let whole = read(&vault, "pic.png").unwrap();
        assert_eq!(
            (whole["mime"].as_str(), whole["kind"].as_str()),
            (Some("image/png"), Some("image"))
        );
        assert!(read(&vault, "missing.pdf").is_err());
    }
}
