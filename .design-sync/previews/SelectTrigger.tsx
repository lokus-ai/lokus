import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'lokus';

const Story = ({ children }) => (
  <div style={{ minHeight: 'calc(100vh - 48px)' }}>{children}</div>
);

const Field = ({ label, hint, width = 230, children }) => (
  <div style={{ width }}>
    <div className="mb-1.5 text-xs font-medium text-app-muted">{label}</div>
    {children}
    {hint ? <div className="mt-1.5 text-xs text-app-muted">{hint}</div> : null}
  </div>
);

export const TriggerStates = () => (
  <Story>
    <div className="flex items-start gap-5">
      <Field label="Workspace" hint="Value resolved from the current selection">
        <Select defaultValue="second-brain">
          <SelectTrigger>
            <SelectValue placeholder="Choose a workspace">Second Brain</SelectValue>
          </SelectTrigger>
        </Select>
      </Field>
      <Field label="Move note to folder" hint="Nothing chosen yet — placeholder">
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select a folder…" />
          </SelectTrigger>
        </Select>
      </Field>
      <Field label="Sync schedule" hint="Disabled while sync is off">
        <Select disabled defaultValue="manual">
          <SelectTrigger disabled>
            <SelectValue placeholder="Sync is off">Manual only</SelectValue>
          </SelectTrigger>
        </Select>
      </Field>
    </div>
  </Story>
);

export const TriggerInSettingsRow = () => (
  <Story>
    <div className="rounded-md border border-app-border bg-app-panel p-4">
      <div className="mb-3 text-sm font-semibold text-app-text">Editor</div>
      <div className="flex items-center justify-between gap-6 border-b border-app-border py-3">
        <div>
          <div className="text-sm text-app-text">Default new-note template</div>
          <div className="text-xs text-app-muted">Applied when you press ⌘N</div>
        </div>
        <div style={{ width: 220 }}>
          <Select defaultValue="daily">
            <SelectTrigger>
              <SelectValue placeholder="No template">Daily Note</SelectValue>
            </SelectTrigger>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between gap-6 py-3">
        <div>
          <div className="text-sm text-app-text">Line width</div>
          <div className="text-xs text-app-muted">Applies to every markdown pane</div>
        </div>
        <div style={{ width: 220 }}>
          <Select open defaultValue="readable">
            <SelectTrigger>
              <SelectValue placeholder="Line width" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="readable">Readable (72ch)</SelectItem>
              <SelectItem value="wide">Wide (96ch)</SelectItem>
              <SelectItem value="full">Full width</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  </Story>
);
