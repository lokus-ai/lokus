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

export const SectionHeadings = () => (
  <Story>
    <Caption
      title="Headings inside the menu"
      body="SelectLabel is semibold and shares the item indent, so a heading lines up with the rows it introduces instead of hanging left."
    />
    <div style={{ width: 300 }}>
      <div className="mb-1.5 text-xs font-medium text-app-muted">Appearance</div>
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
        </SelectContent>
      </Select>
    </div>
  </Story>
);

export const SingleLabelledGroup = () => (
  <Story>
    <Caption
      title="One label, one group"
      body="A single heading is enough to say what the menu is listing — here the export formats Lokus can write a note out as."
    />
    <div style={{ width: 300 }}>
      <div className="mb-1.5 text-xs font-medium text-app-muted">Export note as</div>
      <Select open defaultValue="markdown">
        <SelectTrigger>
          <SelectValue placeholder="Choose a format" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>File format</SelectLabel>
            <SelectItem value="markdown">Markdown (.md)</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="html">HTML</SelectItem>
            <SelectItem value="docx">Word (.docx)</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  </Story>
);
