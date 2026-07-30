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

export const RecentAndAllWorkspaces = () => (
  <Story>
    <Caption
      title="Two groups, one menu"
      body="Each SelectGroup ties its rows to one SelectLabel, so recently opened vaults read as a section rather than four loose rows."
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
            <SelectItem value="client-work">Client Work</SelectItem>
            <SelectItem value="archive-2025">Archive 2025</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  </Story>
);

export const TemplatesByFolder = () => (
  <Story>
    <Caption
      title="Grouped by source folder"
      body="The same grouping carries the template picker: one group per folder in Templates/, so duplicate names stay readable."
    />
    <div style={{ width: 300 }}>
      <div className="mb-1.5 text-xs font-medium text-app-muted">Insert template</div>
      <Select open defaultValue="weekly-review">
        <SelectTrigger>
          <SelectValue placeholder="Choose a template" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Templates/Journal</SelectLabel>
            <SelectItem value="daily-note">Daily Note</SelectItem>
            <SelectItem value="weekly-review">Weekly Review</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Templates/Meetings</SelectLabel>
            <SelectItem value="standup">Standup</SelectItem>
            <SelectItem value="one-on-one">1:1</SelectItem>
            <SelectItem value="retro">Retro</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  </Story>
);
