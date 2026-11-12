---
paths:
  - 'ui/**/*.ts'
  - 'ui/**/*.tsx'
  - 'ui/**/*.css'
---

# UI

- First line of every file: `/** @part-of <part> */` from `parts.json`.
- The UI renders and sends commands. No file access, `fetch`, websocket, Tauri, Supabase or
  PostHog import outside `ui/src/bridge/`.
- One folder per feature under `ui/src/features/`. Shared pieces live in `ui/src/shell/`.
- Style with the design tokens (type, spacing, radii, colour, motion). No one-off pixel values or
  colours in components.
- Anything a user can do is a registered command, so the palette, shortcuts and the dev channel
  can run it.
- Analytics events never contain note content, titles or paths.
