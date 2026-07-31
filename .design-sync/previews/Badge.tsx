import { Badge } from 'lokus';
import { Check, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>
);

export const Variants = () => (
  <Row>
    <Badge>Synced</Badge>
    <Badge variant="secondary">Draft</Badge>
    <Badge variant="outline">Archived</Badge>
    <Badge variant="destructive">Conflict</Badge>
  </Row>
);

export const SyncStatus = () => (
  <Row>
    <Badge>
      <Check className="h-3 w-3 mr-1" />
      Synced 2m ago
    </Badge>
    <Badge variant="secondary">
      <RefreshCw className="h-3 w-3 mr-1" />
      Syncing 14 files
    </Badge>
    <Badge variant="outline">
      <CloudOff className="h-3 w-3 mr-1" />
      Offline — 3 queued
    </Badge>
    <Badge variant="destructive">
      <AlertTriangle className="h-3 w-3 mr-1" />
      Merge conflict
    </Badge>
  </Row>
);

export const TagList = () => (
  <Row>
    <span className="text-xs text-app-muted">Weekly Review.md</span>
    <Badge variant="secondary">#journal</Badge>
    <Badge variant="secondary">#retro</Badge>
    <Badge variant="outline">#engineering</Badge>
    <Badge variant="outline">#q3-planning</Badge>
  </Row>
);

export const TaskPriority = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <span className="text-sm text-app-text">Ship manifest diff v2</span>
      <Badge variant="destructive">High</Badge>
      <Badge variant="outline">Due today</Badge>
    </div>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <span className="text-sm text-app-text">Rewrite graph view shaders</span>
      <Badge variant="secondary">Backlog</Badge>
      <Badge>In Progress</Badge>
    </div>
  </div>
);
