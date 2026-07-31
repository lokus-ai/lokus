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

const Story = ({ children }) => (
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

export const BetweenGroups = () => (
  <Story>
    <Caption
      title="Between labelled groups"
      body="A full-bleed hairline on the border token — it runs edge to edge of the panel, so two labelled groups read as separate lists."
    />
    <div style={{ width: 300 }}>
      <div className="mb-1.5 text-xs font-medium text-app-muted">Workspace</div>
      <Select open defaultValue="second-brain">
        <SelectTrigger>
          <SelectValue placeholder="Choose a workspace" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Recent</SelectLabel>
            <SelectItem value="second-brain">Second Brain</SelectItem>
            <SelectItem value="engineering">Engineering Notes</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>All workspaces</SelectLabel>
            <SelectItem value="journal">Journal</SelectItem>
            <SelectItem value="archive-2025">Archive 2025</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  </Story>
);

export const FencingOffTheLastRow = () => (
  <Story>
    <Caption
      title="Fencing off a trailing action"
      body="The second use: one rule above the last row so an odd-one-out option cannot be mistaken for another sort field."
    />
    <div style={{ width: 300 }}>
      <div className="mb-1.5 text-xs font-medium text-app-muted">Sort notes by</div>
      <Select open defaultValue="modified">
        <SelectTrigger>
          <SelectValue placeholder="Sort order" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="modified">Last modified</SelectItem>
          <SelectItem value="created">Date created</SelectItem>
          <SelectItem value="title-asc">Title (A–Z)</SelectItem>
          <SelectSeparator />
          <SelectItem value="custom">Custom order (drag to reorder)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </Story>
);
