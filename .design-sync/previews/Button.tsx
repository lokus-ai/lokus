import { Button } from 'lokus';
import { Plus, Search, Trash2, Save } from 'lucide-react';

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>
);

export const Variants = () => (
  <Row>
    <Button>New Note</Button>
    <Button variant="secondary">Open Workspace</Button>
    <Button variant="outline">Import</Button>
    <Button variant="ghost">Cancel</Button>
    <Button variant="link">Learn more</Button>
    <Button variant="destructive">Delete Note</Button>
  </Row>
);

export const Sizes = () => (
  <Row>
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
    <Button size="icon" aria-label="Search">
      <Search className="h-4 w-4" />
    </Button>
  </Row>
);

export const WithIcons = () => (
  <Row>
    <Button>
      <Plus className="h-4 w-4" />
      New Note
    </Button>
    <Button variant="secondary">
      <Save className="h-4 w-4" />
      Save
    </Button>
    <Button variant="destructive">
      <Trash2 className="h-4 w-4" />
      Move to Trash
    </Button>
  </Row>
);

export const Disabled = () => (
  <Row>
    <Button disabled>Syncing…</Button>
    <Button variant="secondary" disabled>
      Unavailable
    </Button>
    <Button variant="outline" disabled>
      Offline
    </Button>
  </Row>
);
