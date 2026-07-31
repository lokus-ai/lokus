# design-sync notes — Lokus

Repo-specific gotchas for syncing this design system to claude.ai/design.
Read this before any re-sync.

## Shape: this repo is an app, not a published DS package

- Root `package.json` is `private`, has no `main`/`module`/`exports`, and `dist/`
  is the built **app**, not a component library. There is no `.d.ts` tree.
- So the sync uses an explicit barrel entry: **`.design-sync/ds-entry.jsx`**
  (committed) re-exports the `src/components/ui/*` surface, and
  `cfg.entry` points at it. **To add or drop a component from the design system,
  edit that file and `cfg.componentSrcMap` together.**
- `cfg.componentSrcMap` enumerates all 80 exports explicitly. It has to: with
  `cfg.entry` set, the converter looks for the component list in a `.d.ts` tree
  that does not exist here, finds nothing, and would fall through to
  "tokens-only DS". The map IS the component list for this repo.
- Do NOT drop `cfg.entry` hoping synth-entry mode kicks in — without it the
  converter resolves `PKG_DIR` to `node_modules/lokus`, which does not exist,
  and dies in `dts.mjs` with ENOENT.

## Styling

- Tailwind 3 + CSS custom properties. Tokens live in **`src/styles/globals.css`**
  (`:root`, plus `:root[data-theme="light"]` / `[data-theme="dark"]`), exposed to
  Tailwind as the `app-*` color families in `tailwind.config.cjs`.
- There is no prebuilt DS stylesheet, so `cfg.buildCmd` compiles one:
  `npx tailwindcss -c tailwind.config.cjs -i src/styles/globals.css -o .design-sync/.cache/ds.css`
  → `cfg.cssEntry` points at that file. **Re-run it before every converter build**
  (the driver/`buildCmd` does this) or new utility classes used by previews will
  be missing from the shipped CSS.

## The provider is mandatory

- Lokus paints its surface on the **app root div** (`src/App.jsx`:
  `bg-app-bg text-app-text`), not on `<body>`. `globals.css` only sets
  `background-color` on html/body — never a foreground colour.
- Without a wrapper, `Button variant="ghost"` and `variant="link"` render
  **browser-default black text on the dark surface**. That was the first real
  bug found while calibrating previews.
- Fix: `.design-sync/lokus-root.jsx` exports `LokusRoot` (committed, exported from
  the barrel) and `cfg.provider = {component: "LokusRoot"}` wraps every preview.
  Anything built with this DS must be wrapped the same way.

## Types

- The repo is plain `.jsx`, so the converter can only emit
  `ButtonProps { [key: string]: unknown }`. Every component therefore has a
  hand-written props body in `cfg.dtsPropsFor`, generated from
  `.design-sync/.cache/dts-props.mjs` (a source-of-truth module kept in the
  cache, applied to the config by `apply-dts-props.mjs`).
- **If a component's real props change, update `dts-props.mjs` and re-apply** —
  nothing else will notice the drift.

## Grouping and docs

- `cfg.docsDir = .design-sync/docs` — one `<Name>.md` per component whose
  `category:` frontmatter sets the DS pane group (Actions / Display / Forms /
  Overlays / Data / Navigation / Feedback). Without these every component lands
  in `general` (the src path `src/components/ui` is all generic dir names).
- `cfg.guidelinesGlob` is pinned to the design-sync guidelines only. The default
  glob picked up `docs/PRE-PRODUCTION-CHECKLIST.md`, which is release process,
  not design guidance.

## The CSS is a safelisted build, and that is load-bearing

- `cfg.buildCmd` compiles with **`.design-sync/tailwind.ds.cjs`**, not the app's
  own config. That file adds two things to the repo config:
  1. `.design-sync/previews/**` in `content`, so classes used by preview cards exist;
  2. a **safelist** of the utility vocabulary a design agent is likely to write.
- Why the safelist matters more than it looks: Tailwind JIT only emits classes it
  can *see*. The design agent writes markup we can never scan, so without the
  safelist `p-6`, `gap-3`, `md:grid-cols-2` or `hover:bg-app-accent/90` in a
  generated design resolve to **nothing** and the screen ships unstyled.
- Cost: `_ds_bundle.css` ≈ 840 KB. Do not "optimise" it back to a content-only
  scan without understanding you are removing the agent's vocabulary.
- Every preview batch independently hit the symptom before the safelist existed:
  **arbitrary values (`w-[280px]`, `h-[420px]`, `min-w-[240px]`) silently no-op**.
  They are still not safelisted (they are infinite) — use inline `style={{ }}` for
  one-off geometry. Confirmed missing before the fix and now covered: `mr-auto`,
  fractional widths beyond a few, `sm:`/`lg:` variants.

## lucide-react is in the bundle on purpose

- `cfg.extraEntries = ["lucide-react"]`. Two reasons:
  1. **Speed.** As a bare import in previews, esbuild walked lucide's ~1,500-module
     barrel through the story-imports resolve plugin for *every* preview file —
     ~2 min per file, ~2.5 h for 80. Shimmed to the global it is seconds.
     (Bundling lucide once takes 155 ms; the cost was per-file plugin resolution.)
  2. **Capability.** The design agent can only use what is on `window.LokusDS`.
     Without this it had no icons at all, while Lokus's own UI uses Lucide everywhere.
- Cost: `_ds_bundle.js` 568 KB → 1690 KB, and `window.LokusDS` has ~5,600 exports.
- **Name collisions**: `bundle.mjs` `Object.assign`s the main namespace LAST, so DS
  components win over icons. `Table` and `Command` therefore resolve to the
  components; the icons of those names are unreachable. Two previews
  (`ContextMenuSubContent`, `DropdownMenuShortcut`) import them aliased.
- `toast` is re-exported from `sonner` in `ds-entry.jsx` for the same reason: the
  bundle inlines its own sonner instance, so a `toast()` imported from anywhere
  else hits a different singleton and `<Toaster />` never paints.

## The white-band leak, and the two-part fix

Symptom every batch hit: a card renders as a short dark box, then a **bright
horizontal band**, then a second dark block — the host's white `body` bleeding
through wherever the story's content ended.

Cause: the card page keeps `body{background:#fff;padding:24px}`, and `LokusRoot`
was `minHeight: 100%`, which resolves to **0** inside an auto-height mount root.
An absolutely-positioned open overlay adds no height at all, so the dark surface
stopped under the trigger.

Fixed in two places, both of which matter:

1. **Provider (permanent)** — `.design-sync/lokus-root.jsx` now uses
   `minHeight: "100vh"` + `boxSizing: "border-box"`. This is the real fix and it
   is in the bundle; don't regress it back to `100%`.
2. **Per story (still useful for short/overlay stories)**:
   ```jsx
   <div style={{ minHeight: "calc(100vh - 48px)", display: "flex", alignItems: "center" }}>
   ```
   `48px` is exactly `LokusRoot`'s own padding, so the root fills the viewport
   without overflowing it. Note `calc(100vh - 48px)` is right *inside* the root;
   if you compute a flat pixel value instead, the card body's own 24px padding
   counts too (a 470px card leaves 374px, not 422px).
   The `alignItems: "center"` half is a separate win: without it, short stories
   (empty states especially) strand ~250px of dead space at the bottom instead of
   sitting centred.

## Process hazard: a full build wipes the bundle under a running subagent

`package-build.mjs` `rm -rf`s `ds-bundle/`. Started while a subagent is mid-loop,
its `preview-rebuild` dies with `[NO_MANIFEST]` and its `package-capture` dies with
`ENOENT` on `_screenshots/review/raw/` — and because the documented invocation ends
in `| tail -N`, **the pipeline still reports exit code 0**, so the failure is
invisible unless you read the text. This happened twice in the first sync. Either
stagger full builds against subagent waves, or check `_preview/<Name>.js` mtimes
against the bundle before trusting a capture.

## Static-render recipes per family (found the hard way)

- **DropdownMenu**: `<DropdownMenu open modal={false}>` is enough — the wrapper has
  no Radix Portal, so no `forceMount`. `modal={false}` avoids body scroll-lock
  perturbing the capture.
- **ContextMenu**: `open` is a **no-op** — Radix `ContextMenu.Root` is uncontrolled.
  You need `forceMount` on `ContextMenuContent`, and a submenu needs
  `<ContextMenuSub open>` **plus** `forceMount` on its `SubContent`. A forceMounted
  context menu also anchors to a virtual pointer at `{0,0}`; the batch pinned it with
  `.ctx-stage > [data-radix-popper-content-wrapper]{position:absolute!important;transform:none!important;}`.
- **Select**: `<Select open defaultValue="…">`, no `forceMount`. Scroll buttons only
  render with `position="item-aligned"` (the popper path uses an arbitrary-value
  height class that does not exist in the CSS). `<SelectValue>` renders nothing when
  the menu has never opened — pass children for a closed trigger.
- **Toast**: needs `duration={Infinity}` on BOTH provider and toast (Radix's 5 s timer
  starts on mount even for a controlled toast), `ToastViewport` forced out of
  `position: fixed` via inline style, `ToastClose` given `opacity-100`, and
  `ToastAction` a non-empty `altText` or Radix throws.
- **cmdk**: `CommandEmpty` is driven by `value` on **`CommandInput`**, not on `Command`
  (`value` on `Command` sets the selected item). `CommandList`'s `max-h-[300px]` clips
  silently and tends to land the cut on a group heading, so the card reads as broken
  rather than as a scroll — inline `style={{ maxHeight: 375 }}` (340 inside
  `CommandDialog`, whose rows are `py-3`) fits a 470px card. Sizing budget:
  ~31px per item, ~30px per group heading, ~8px per group gap.
  Filtering is **real** in a static capture: cmdk's Input pushes its `value` into
  the store's `search` on mount, so `<CommandInput value="review">` makes cmdk itself
  drop non-matching rows (pass a no-op `onValueChange` to keep it controlled; use
  `shouldFilter={false}` only to show a query beside results it wouldn't match).
  cmdk auto-selects the first item, so `data-[selected=true]:bg-app-accent` fires for
  free — set `value` on `<Command>` to move the highlight off row one.
  `CommandDialog` renders its own `Command` internally — compose only the parts as
  children, never nest another `<Command>`.
- **Tabs**: non-overlay — `defaultValue` alone; vary it per story.
- `⌫` (U+232B) has no glyph in the card font and captures as tofu. `⌘ ⇧ ✓ ● ○ ›` are fine.

## Known render warns (triaged — not new)

- `[FONT_MISSING] "Inter", "SF Pro Text"` — Lokus's `--font-family` is a system
  stack (`-apple-system, BlinkMacSystemFont, 'Inter', 'SF Pro Text', 'Segoe UI'`).
  No webfont ships with the app by design; previews render in the system UI font,
  which is what the app itself shows. Expected, not a defect.
- `[TOKENS_MISSING]` — `--app-text`, `--app-muted`, `--border-primary`,
  `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--text-primary`,
  `--text-tertiary`. See "Bugs found in the repo" below: these are real repo bugs,
  not sync misconfiguration.
- `[PROVIDER_UNVERIFIED] LokusRoot` — the export scan finds 0 PascalCase symbols
  because there is no `.d.ts` tree to scan. The provider does work; the warn is
  the converter admitting it cannot prove it.

## Bugs found in the repo while syncing (not sync problems)

- `tailwind.config.cjs` typography block uses `rgb(var(--app-text))` and
  `rgb(var(--app-muted))`, but `globals.css` defines `--text` / `--muted`.
  The `app-` prefix belongs to the Tailwind color *name*, not the CSS variable.
  Result: `prose` typography colours resolve to nothing.
- `src/components/ui/toast.jsx` `variant="destructive"` uses
  `border-destructive bg-destructive text-destructive-foreground`; no
  `destructive` color exists in `tailwind.config.cjs`, so the destructive toast
  renders unstyled.
- `--border-primary`, `--bg-primary`, `--bg-secondary`, `--bg-tertiary`,
  `--text-primary`, `--text-tertiary` are referenced by app CSS but defined
  nowhere in `globals.css`.
- **`ContextMenuRadioItem` / `DropdownMenuRadioItem` read `props.checked`** for
  their `●` glyph, but Radix's `RadioGroup` never passes `checked` — it passes
  `value`. So in the real app the selected radio bullet **never fills**. Two
  batches found this independently. Same shape on the `CheckboxItem`s, which do
  get `checked` from Radix and are fine.
- **`disabled` has no visual treatment** on `ContextMenuItem` /
  `ContextMenuSubTrigger` — a disabled row is indistinguishable from an enabled
  one, despite `FileContextMenu.jsx` and `EditorContextMenu.jsx` relying on it.
- **No `data-[state=open]` styling on `SubTrigger`** — an expanded submenu row
  looks identical to collapsed siblings.
- `SelectTrigger`'s `placeholder:text-app-muted` is dead CSS: the placeholder is a
  `<span>` in a button, not an `<input>`, so `::placeholder` never matches — a
  placeholder and a real value render at identical contrast. Radix sets
  `data-placeholder` on the trigger; `data-placeholder:text-app-muted` would work.
- `select.jsx`'s popper viewport uses `h-[var(--radix-select-trigger-height)]` —
  an arbitrary value that currently does not compile. If it ever does, every
  popper select menu collapses to trigger height. It should be
  `max-h-[var(--radix-select-content-available-height)]`.
- `Badge variant="secondary"` is `bg-app-panel`, i.e. **invisible on a panel or
  dialog surface**. Use `variant="outline"` there.
- `DialogFooter`'s `sm:justify-end` cannot be overridden from `className` (same
  specificity, source order wins). Design dialog footers as right-aligned.

## Re-sync risks

- **`ds-entry.jsx` + `componentSrcMap` drift**: adding a component to
  `src/components/ui/` does nothing until both are updated by hand. There is no
  auto-discovery in this configuration.
- **`ds.css` is generated into a gitignored cache**: a fresh clone has no
  stylesheet until `cfg.buildCmd` runs. Always run it first.
- **Toaster is not statically renderable** (sonner renders nothing until
  `toast()` is called), so its card documents the mount point rather than showing
  a live toast.
- Card geometry (`cfg.overrides.<Name>.viewport`) was tuned against the current
  preview content. If a preview grows, its card clips silently — the render check
  will not flag it. Eyeball `.review.html` after content edits.
