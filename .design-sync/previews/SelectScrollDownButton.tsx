import {
  Select,
  SelectContent,
  SelectItem,
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
  <div style={{ width: 250 }}>
    <div className="text-sm font-medium text-app-text">{title}</div>
    <p className="mt-1 text-xs leading-relaxed text-app-muted">{body}</p>
  </div>
);

// A real vault has more folders/tags than fit in one menu — that overflow is
// the only thing that makes the scroll affordance render.
const FOLDERS = [
  'Inbox',
  'Daily Notes',
  'Journal',
  'Journal/2026',
  'Engineering',
  'Engineering/RFCs',
  'Engineering/Postmortems',
  'Design',
  'Design/Design System',
  'Meetings',
  'Meetings/Standups',
  'Product',
  'Product/Roadmap',
  'Research',
  'Templates',
  'Clients',
  'Clients/Northwind',
  'Archive 2025',
];

const TAGS = [
  'area/engineering',
  'area/design',
  'area/product',
  'status/draft',
  'status/in-review',
  'status/published',
  'type/meeting',
  'type/spec',
  'type/retro',
  'type/journal',
  'project/sync-v2',
  'project/graph-view',
  'project/plugin-api',
  'person/ada',
  'person/grace',
  'source/podcast',
  'source/paper',
  'reading/queue',
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const OverflowingFolderList = () => (
  <Story>
    <Caption
      title="Move note to folder"
      body="18 folders overflow the menu, so the down chevron pins to the bottom edge of the content while there is more list below."
    />
    <div style={{ width: 300 }}>
      <div className="mb-1.5 text-xs font-medium text-app-muted">Destination</div>
      <Select open defaultValue={slug(FOLDERS[1])}>
        <SelectTrigger>
          <SelectValue placeholder="Choose a folder" />
        </SelectTrigger>
        <SelectContent position="item-aligned">
          {FOLDERS.map((f) => (
            <SelectItem key={f} value={slug(f)}>
              {f}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </Story>
);

export const TagPickerOverflow = () => (
  <Story>
    <Caption
      title="Tag filter"
      body="Same affordance in the tag picker: the list starts at the top, so only the down chevron is showing."
    />
    <div style={{ width: 300 }}>
      <div className="mb-1.5 text-xs font-medium text-app-muted">Filter by tag</div>
      <Select open defaultValue={slug(TAGS[0])}>
        <SelectTrigger>
          <SelectValue placeholder="All tags" />
        </SelectTrigger>
        <SelectContent position="item-aligned">
          {TAGS.map((t) => (
            <SelectItem key={t} value={slug(t)}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </Story>
);
