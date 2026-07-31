import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'lokus';

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

export const CheckedAmongDefaults = () => (
  <Story>
    <Caption
      title="Checked row"
      body="Only the selected item shows its indicator; every row reserves the same left gutter so labels stay on one optical line."
    />
    <div style={{ width: 300 }}>
      <div className="mb-1.5 text-xs font-medium text-app-muted">Sort notes by</div>
      <Select open defaultValue="created">
        <SelectTrigger>
          <SelectValue placeholder="Sort order" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="modified">Last modified</SelectItem>
          <SelectItem value="created">Date created</SelectItem>
          <SelectItem value="title-asc">Title (A–Z)</SelectItem>
          <SelectItem value="title-desc">Title (Z–A)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </Story>
);

export const UnavailableOptions = () => (
  <Story>
    <Caption
      title="Disabled rows"
      body="Options that need a plugin or a finished index stay visible but dimmed and unclickable, so the menu still explains what Lokus can do."
    />
    <div style={{ width: 300 }}>
      <div className="mb-1.5 text-xs font-medium text-app-muted">Group notes by</div>
      <Select open defaultValue="folder">
        <SelectTrigger>
          <SelectValue placeholder="Grouping" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="folder">Folder</SelectItem>
          <SelectItem value="tag">Tag</SelectItem>
          <SelectItem value="backlinks" disabled>
            Backlink count — indexing…
          </SelectItem>
          <SelectItem value="kanban" disabled>
            Kanban status — plugin disabled
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  </Story>
);
