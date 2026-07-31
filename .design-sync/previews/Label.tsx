import { Label, Input } from 'lokus';

export const WithInput = () => (
  <div style={{ maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 6 }}>
    <Label htmlFor="note-title">Note title</Label>
    <Input id="note-title" defaultValue="Weekly Review — Sprint 34" />
  </div>
);

export const WithHint = () => (
  <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 6 }}>
    <Label htmlFor="template-name">Template name</Label>
    <Input id="template-name" placeholder="Daily Journal" />
    <span className="text-xs text-app-muted">Saved to Templates/ in the current workspace.</span>
  </div>
);

export const InlineCheckbox = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <input
      id="auto-sync"
      type="checkbox"
      defaultChecked
      className="peer h-4 w-4 accent-app-accent"
    />
    <Label htmlFor="auto-sync">Sync this workspace automatically on save</Label>
  </div>
);

export const DisabledControl = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input id="encrypt-vault" type="checkbox" defaultChecked className="peer h-4 w-4 accent-app-accent" />
      <Label htmlFor="encrypt-vault">Encrypt vault before upload</Label>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input id="share-vault" type="checkbox" disabled className="peer h-4 w-4 accent-app-accent" />
      <Label htmlFor="share-vault">Share workspace (requires sync enabled)</Label>
    </div>
  </div>
);
