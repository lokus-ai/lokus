import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from 'lokus';

// Fills the card so the harness page background never shows at the edges.
const Story = ({ children }) => (
  <div style={{ minHeight: 'calc(100vh - 48px)' }}>{children}</div>
);

const Split = ({ children }) => (
  <div
    style={{ minHeight: 'calc(100vh - 48px)', display: 'flex', gap: 24, alignItems: 'flex-start' }}
  >
    {children}
  </div>
);

const Caption = ({ title, body }) => (
  <div style={{ width: 240 }}>
    <div className="text-sm font-medium text-app-text">{title}</div>
    <p className="mt-1 text-xs leading-relaxed text-app-muted">{body}</p>
  </div>
);

const Field = ({ label, width = 260, children }) => (
  <div style={{ width }}>
    <div className="mb-1.5 text-xs font-medium text-app-muted">{label}</div>
    {children}
  </div>
);

export const ClosedTriggers = () => (
  <Story>
    <div className="flex items-start gap-5">
      <Field label="Workspace" width={220}>
        <Select defaultValue="second-brain">
          <SelectTrigger>
            <SelectValue placeholder="Choose a workspace">Second Brain</SelectValue>
          </SelectTrigger>
        </Select>
      </Field>
      <Field label="Move note to folder" width={220}>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select a folder…" />
          </SelectTrigger>
        </Select>
      </Field>
      <Field label="Sync schedule" width={220}>
        <Select disabled defaultValue="manual">
          <SelectTrigger disabled>
            <SelectValue placeholder="Sync is off">Manual only</SelectValue>
          </SelectTrigger>
        </Select>
      </Field>
    </div>
    <p className="mt-3 text-xs text-app-muted">
      Resting state: selected value · placeholder · disabled (sync is off for this workspace)
    </p>
  </Story>
);

export const OpenWorkspacePicker = () => (
  <Split>
    <Caption
      title="Workspace switcher"
      body="The flat case: five vaults, the open one checked. The panel drops under the trigger and matches its width."
    />
    <Field label="Workspace" width={280}>
      <Select open defaultValue="second-brain">
        <SelectTrigger>
          <SelectValue placeholder="Choose a workspace" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="second-brain">Second Brain</SelectItem>
          <SelectItem value="engineering">Engineering Notes</SelectItem>
          <SelectItem value="journal">Journal</SelectItem>
          <SelectItem value="client-work">Client Work</SelectItem>
          <SelectItem value="archive-2025">Archive 2025</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  </Split>
);

export const GroupedThemePicker = () => (
  <Split>
    <Caption
      title="Grouped options"
      body="Themes split into labelled groups with separators, so plugin-provided themes never look built in."
    />
    <Field label="Appearance" width={280}>
      <Select open defaultValue="lokus-dark">
        <SelectTrigger>
          <SelectValue placeholder="Choose a theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Built in</SelectLabel>
            <SelectItem value="lokus-dark">Lokus Dark</SelectItem>
            <SelectItem value="lokus-light">Lokus Light</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>From plugins</SelectLabel>
            <SelectItem value="gruvbox">Gruvbox Warm</SelectItem>
            <SelectItem value="nord">Nord Deep</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value="system">Match system</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  </Split>
);

export const DisabledOption = () => (
  <Split>
    <Caption
      title="Unavailable option"
      body="Sorting by backlinks needs the graph index. The row stays in the menu, dimmed and unclickable, instead of disappearing."
    />
    <Field label="Sort notes by" width={280}>
      <Select open defaultValue="modified">
        <SelectTrigger>
          <SelectValue placeholder="Sort order" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="modified">Last modified</SelectItem>
          <SelectItem value="created">Date created</SelectItem>
          <SelectItem value="title">Title (A–Z)</SelectItem>
          <SelectItem value="backlinks" disabled>
            Backlink count — indexing…
          </SelectItem>
        </SelectContent>
      </Select>
    </Field>
  </Split>
);
