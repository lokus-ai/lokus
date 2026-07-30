import { Input, Label } from 'lokus';
import { Search } from 'lucide-react';

export const Default = () => (
  <div style={{ maxWidth: 380 }}>
    <Input defaultValue="Weekly Review.md" />
  </div>
);

export const WithPlaceholder = () => (
  <div style={{ maxWidth: 380 }}>
    <Input placeholder="Untitled note…" />
  </div>
);

export const WithLabel = () => (
  <div style={{ maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 6 }}>
    <Label htmlFor="workspace-name">Workspace name</Label>
    <Input id="workspace-name" defaultValue="Engineering Vault" />
  </div>
);

export const SearchField = () => (
  <div style={{ maxWidth: 380, position: 'relative' }}>
    <Search
      className="h-4 w-4 text-app-muted"
      style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
    />
    <Input className="pl-9" placeholder="Search notes and tags…" />
  </div>
);

export const Disabled = () => (
  <div style={{ maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 6 }}>
    <Label htmlFor="vault-path">Vault path (managed by sync)</Label>
    <Input id="vault-path" disabled defaultValue="~/Documents/Lokus/Engineering" />
  </div>
);
