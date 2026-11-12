---
paths:
  - 'ui/src/editor/**'
---

# Editor

- The CodeMirror document is the markdown text, byte for byte. Live preview is decoration only:
  it hides or styles syntax and never rewrites the text.
- Syntax is revealed on the line or range the cursor touches.
- Every editing action (`editor.toggleBold`, ...) is a command built on a pure function over
  editor state, so it can run headless with a document and a selection.
- Typing and the caret are never animated.
- Do not normalise line endings, trailing spaces or the final newline on load or save.
