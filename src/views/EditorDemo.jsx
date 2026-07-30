import { useCallback, useRef, useState } from "react";
import Editor from "../editor/components/Editor.jsx";
import { createLokusParser, createLokusSerializer } from "../core/markdown/lokus-md-pipeline.js";
import { EditorState } from "prosemirror-state";

// Browser-only demo page used by QA. Bypasses Auth + Launcher + Tauri
// invoke paths. Mounts the REAL <Editor> with seeded markdown so the QA
// bot can exercise every markdown feature.
const SEED_MARKDOWN = `# Lokus Markdown QA

This document seeds the editor with every feature for QA.

## Headings

### H3 heading
#### H4 heading

## Inline marks

**bold**, *italic*, ~~strike~~, \`inline code\`, [link](https://example.com).

## Lists

- bullet one
- bullet two
  - nested bullet
- bullet three

1. ordered one
2. ordered two
3. ordered three

## Task list

- [ ] open task
- [x] completed task

## Blockquote

> This is a blockquote.
> Second line.

## Code block

\`\`\`js
function hello(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Table

| Feature | Status |
| ------- | ------ |
| Bold    | ok     |
| Tables  | ok     |

## Math

Inline math: $E = mc^2$

Block math:

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Wiki link & tag

A wikilink: [[Some Note]] and a tag: #demo-tag

## Horizontal rule

---

End of seed.
`;

export default function EditorDemo() {
  const editorRef = useRef(null);
  const [markdown, setMarkdown] = useState(SEED_MARKDOWN);
  const serializerRef = useRef(null);

  // Seed the real <Editor> doc by parsing markdown the same way EditorGroup does.
  const handleEditorReady = useCallback((view) => {
    if (!view) return;
    try {
      const parser = createLokusParser(view.state.schema);
      const doc = parser.parse(SEED_MARKDOWN);
      const newState = EditorState.create({
        doc,
        schema: view.state.schema,
        plugins: view.state.plugins,
      });
      const tr = newState.tr;
      tr.setMeta("programmatic", true);
      view.updateState(newState);
      window.__LOKUS_DEMO_VIEW__ = view;
      window.__LOKUS_DEMO_READY__ = true;
    } catch (err) {
      console.error("[EditorDemo] seed failed", err);
    }
  }, []);

  const handleContentChange = useCallback((view) => {
    try {
      if (!serializerRef.current) {
        serializerRef.current = createLokusSerializer();
      }
      const md = serializerRef.current.serialize(view.state.doc);
      setMarkdown(md);
    } catch (err) {
      console.error("[EditorDemo] serialize failed", err);
    }
  }, []);

  return (
    <div
      data-testid="editor-demo-root"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        height: "100vh",
        background: "var(--app-bg, #0b0b0c)",
        color: "var(--app-text, #fff)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ overflow: "auto", padding: 16, borderRight: "1px solid #2a2a2a" }}>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
          Lokus Editor Demo — real ProseMirror editor with full markdown plugins
        </div>
        <Editor
          ref={editorRef}
          content={""}
          onContentChange={handleContentChange}
          onEditorReady={handleEditorReady}
          isLoading={false}
        />
      </div>
      <div style={{ overflow: "auto", padding: 16, background: "#111", fontFamily: "monospace" }}>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Live serialized markdown</div>
        <pre data-testid="serialized-md" style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
          {markdown}
        </pre>
      </div>
    </div>
  );
}
