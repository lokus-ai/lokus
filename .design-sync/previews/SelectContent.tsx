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

export const PopperBelowTrigger = () => (
  <Story>
    <Caption
      title="position=&quot;popper&quot; (default)"
      body="The content panel drops below the trigger and matches its width — panel surface, hairline border and shadow all come from the Lokus tokens."
    />
    <div style={{ width: 300 }}>
      <div className="mb-1.5 text-xs font-medium text-app-muted">Move note to folder</div>
      <Select open defaultValue="engineering-rfcs">
        <SelectTrigger>
          <SelectValue placeholder="Choose a folder" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Recent</SelectLabel>
            <SelectItem value="engineering-rfcs">Engineering/RFCs</SelectItem>
            <SelectItem value="daily-notes">Daily Notes</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value="journal">Journal</SelectItem>
          <SelectItem value="design">Design</SelectItem>
          <SelectItem value="templates">Templates</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </Story>
);

export const ItemAlignedOverTrigger = () => (
  <Story>
    <Caption
      title="position=&quot;item-aligned&quot;"
      body="The native-select behaviour: the panel lifts over the trigger so the checked row lands exactly where the closed value was."
    />
    <div style={{ width: 300 }}>
      <div className="mb-1.5 text-xs font-medium text-app-muted">Graph view layout</div>
      <Select open defaultValue="force">
        <SelectTrigger>
          <SelectValue placeholder="Choose a layout" />
        </SelectTrigger>
        <SelectContent position="item-aligned">
          <SelectItem value="force">Force directed</SelectItem>
          <SelectItem value="radial">Radial</SelectItem>
          <SelectItem value="hierarchy">Hierarchy</SelectItem>
          <SelectItem value="grid">Grid</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </Story>
);
