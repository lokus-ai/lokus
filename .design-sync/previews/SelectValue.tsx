import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'lokus';

const Story = ({ children }) => (
  <div style={{ minHeight: 'calc(100vh - 48px)' }}>{children}</div>
);

export const PlaceholderVsSelected = () => (
  <Story>
    <div className="flex items-start gap-6">
      <div style={{ width: 250 }}>
        <div className="mb-1.5 text-xs font-medium text-app-muted">Move note to folder</div>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select a folder…" />
          </SelectTrigger>
        </Select>
        <p className="mt-2 text-xs text-app-muted">
          Nothing chosen yet, so the trigger shows the placeholder string.
        </p>
      </div>
      <div style={{ width: 250 }}>
        <div className="mb-1.5 text-xs font-medium text-app-muted">Move note to folder</div>
        <Select defaultValue="engineering-rfcs">
          <SelectTrigger>
            <SelectValue placeholder="Select a folder…">Engineering/RFCs</SelectValue>
          </SelectTrigger>
        </Select>
        <p className="mt-2 text-xs text-app-muted">
          Once a folder is chosen, its label replaces the placeholder in the same slot.
        </p>
      </div>
    </div>
  </Story>
);

export const ValueMirrorsCheckedItem = () => (
  <Story>
    <div className="flex items-start gap-6">
      <div style={{ width: 240 }}>
        <div className="text-sm font-medium text-app-text">Sync schedule</div>
        <p className="mt-1 text-xs leading-relaxed text-app-muted">
          SelectValue reads its label straight off the checked item, so the closed trigger and the
          open menu can never drift apart.
        </p>
      </div>
      <div style={{ width: 280 }}>
        <div className="mb-1.5 text-xs font-medium text-app-muted">Run sync</div>
        <Select open defaultValue="on-save">
          <SelectTrigger>
            <SelectValue placeholder="Choose a schedule" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="on-save">On save (3s debounce)</SelectItem>
            <SelectItem value="five-min">Every 5 minutes</SelectItem>
            <SelectItem value="manual">Manual only</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  </Story>
);
