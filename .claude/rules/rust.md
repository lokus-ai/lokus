---
paths:
  - 'crates/**/*.rs'
  - 'apps/desktop/**/*.rs'
---

# Rust

- First line of every file: `//! @part-of <part>` from `parts.json`.
- `lokus-core` never depends on Tauri or a networking crate. Networking belongs in `lokus-sync`,
  `lokus-server` and `lokus-ai`.
- A feature is a command in `core.commands`: a name, JSON arguments, a JSON result. The Tauri
  shell and the CLI only forward to it; they hold no logic.
- File writes are atomic (temp file, then rename) and never change bytes the user did not edit.
- Paths from outside are resolved inside the vault root and rejected if they escape it.
- Return errors; do not `unwrap` or `panic` on anything a user or a file can cause.
