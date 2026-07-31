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

const TEMPLATES = [
  'Daily Note',
  'Weekly Review',
  'Meeting Notes',
  'Standup',
  '1:1',
  'Incident Postmortem',
  'RFC',
  'Design Review',
  'Reading Note',
  'Book Summary',
  'Project Brief',
  'Retro',
  'Interview Debrief',
  'Release Checklist',
  'Bug Report',
  'Idea Capture',
  'Travel Log',
  'Recipe',
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Selecting an item deep in the list makes Radix open the menu already scrolled
// past the top — which is the only state where the up chevron renders.
export const ScrolledPastTheTop = () => (
  <Story>
    <Caption
      title="Move note to folder"
      body="The saved destination sits near the end of an 18-folder list, so the menu opens already scrolled and the up chevron appears above the first visible row."
    />
    <div style={{ width: 300, marginTop: 150 }}>
      <div className="mb-1.5 text-xs font-medium text-app-muted">Destination</div>
      <Select open defaultValue={slug(FOLDERS[FOLDERS.length - 2])}>
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

export const TemplatePickerScrolled = () => (
  <Story>
    <Caption
      title="Insert template"
      body="Same affordance in the template picker, reopened on the last-used template far down the list."
    />
    <div style={{ width: 300, marginTop: 150 }}>
      <div className="mb-1.5 text-xs font-medium text-app-muted">Template</div>
      <Select open defaultValue={slug(TEMPLATES[TEMPLATES.length - 3])}>
        <SelectTrigger>
          <SelectValue placeholder="Choose a template" />
        </SelectTrigger>
        <SelectContent position="item-aligned">
          {TEMPLATES.map((t) => (
            <SelectItem key={t} value={slug(t)}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </Story>
);
