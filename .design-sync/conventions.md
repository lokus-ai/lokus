# Building with the Lokus design system

Lokus is a local-first markdown notes app (Tauri + React 19). This library is its
real `src/components/ui` surface — Radix primitives and plain elements styled with
Tailwind against a CSS-variable theme.

## Always wrap in `LokusRoot`

Lokus paints its surface on the **app root element**, not on `<body>`. The
stylesheet sets a background on `html, body` but never a foreground colour, so
anything that inherits its text colour — `Button variant="ghost"`,
`variant="link"`, bare `<p>`/`<span>` — renders **black on the dark surface**
without the wrapper.

```jsx
const { LokusRoot, Button } = window.LokusDS;

<LokusRoot>
  <Button>New Note</Button>
</LokusRoot>
```

`LokusRoot` applies `bg-app-bg text-app-text`, the Lokus font stack and base font
size. One wrapper at the root of the screen is enough — do not nest it.

Theme: tokens are defined on `:root` (Lokus Dark) with overrides on
`:root[data-theme="light"]` and `:root[data-theme="dark"]`. Set
`document.documentElement.dataset.theme = "light"` to preview the light theme;
the default is dark.

## Style with the `app-*` Tailwind families

This is a Tailwind 3 system whose palette is bound to CSS variables. Use these
class families for your own layout and chrome — never raw hex, and never invent
colour names outside this list:

| Family | Classes | Use for |
| --- | --- | --- |
| Surface | `bg-app-bg`, `bg-app-panel`, `bg-app-titlebar` | page background, cards/panels, title bar |
| Border | `border-app-border` | every hairline and outline |
| Text | `text-app-text`, `text-app-muted` | primary copy, secondary/meta copy |
| Accent | `bg-app-accent`, `text-app-accent`, `text-app-accent-fg` | primary action, active state, focus ring |

All four accept Tailwind opacity modifiers (`bg-app-accent/90`,
`ring-app-accent/40`) — that is how the components themselves do hover and focus.
Radii: `rounded-md` (8px) and `rounded-lg` (10px). Long-form markdown uses the
Tailwind `prose` classes from `@tailwindcss/typography`.

When you need a token Tailwind does not expose as a class, read it directly —
the variables are RGB triplets, so they must go through `rgb()`:

```jsx
<div style={{ background: "rgb(var(--panel-secondary))", borderRadius: "var(--radius)" }} />
```

Available beyond the `app-*` families: `--panel-secondary`, `--text-secondary`,
`--border-hover`, `--accent-hover`, `--danger`, `--success`, `--warning`,
`--info`, the `--task-*` status colours, `--font-family`, `--font-mono`, and the
`--text-xs` … `--text-2xl` sizes.

## Icons and toasts come from the same global

Every [Lucide](https://lucide.dev) icon is bundled and exported alongside the
components — Lokus uses Lucide throughout, so this is the icon set. Pull them off
the same global, and size them with Tailwind:

```jsx
const { Plus, Search, Trash2, FileText, Button } = window.LokusDS;

<Button><Plus className="h-4 w-4" />New Note</Button>
```

Two icon names are shadowed by components of the same name — `Table` and
`Command` resolve to the **components**, not the icons. Use a different icon
(`Grid3x3`, `Terminal`) if you need those glyphs.

`toast` is exported too, so a mounted `<Toaster />` can actually be driven:

```jsx
const { toast } = window.LokusDS;
toast.success("Workspace synced — 14 files uploaded");
```

## Composition rules that matter here

- **Radix families are compound.** `Dialog`, `Select`, `DropdownMenu`,
  `ContextMenu`, `Tabs` and `Toast` are roots that own state; always compose them
  from their own parts (`DialogContent` inside `Dialog`, `SelectItem` inside
  `SelectContent`, one `TabsContent` per `TabsTrigger` value). A part rendered
  outside its root throws.
- **`Toaster` is a mount point.** Render it once near the root, then call
  `toast()` from `sonner` to show notifications. The Radix `Toast` family is the
  lower-level alternative when you need a toast rendered inline.
- **`Label` needs `htmlFor`** matching the control's `id`.
- **`Badge` has one axis** — `variant` (`default` | `secondary` | `outline` |
  `destructive`). There is no size prop.
- `Badge` and `Toast variant="destructive"` use raw `bg-red-500` / an undefined
  `destructive` colour rather than a theme token; prefer `default` plus explicit
  red utilities if you need a destructive surface that respects the theme.

## Where the truth is

- `_ds/<folder>/styles.css` and everything it `@import`s — the compiled Tailwind
  build plus every token definition. Read it before inventing a class.
- `components/<group>/<Name>/<Name>.prompt.md` — per-component description and
  usage.
- `components/<group>/<Name>/<Name>.d.ts` — the `<Name>Props` contract.

## A representative screen

```jsx
const { LokusRoot, Button, Badge, Input, Table, TableHeader, TableBody,
        TableRow, TableHead, TableCell } = window.LokusDS;

<LokusRoot>
  <div className="flex items-center justify-between gap-4 pb-4">
    <h1 className="text-lg font-semibold text-app-text">Journal</h1>
    <div className="flex items-center gap-2">
      <Input placeholder="Search notes…" className="w-64" />
      <Button>New Note</Button>
    </div>
  </div>

  <div className="rounded-lg border border-app-border bg-app-panel p-1">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Note</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Words</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">Weekly Review.md</TableCell>
          <TableCell><Badge>Synced</Badge></TableCell>
          <TableCell className="text-right">842</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</LokusRoot>
```
