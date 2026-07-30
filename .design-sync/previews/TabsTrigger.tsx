import { Tabs, TabsList, TabsTrigger, TabsContent } from 'lokus';
import { FileText, Network, Trash2 } from 'lucide-react';

export const TriggersWithIcons = () => (
  <Tabs defaultValue="graph" className="w-full max-w-[620px]">
    <TabsList>
      <TabsTrigger value="notes" className="gap-1.5">
        <FileText className="h-4 w-4" /> Notes
      </TabsTrigger>
      <TabsTrigger value="graph" className="gap-1.5">
        <Network className="h-4 w-4" /> Graph
      </TabsTrigger>
      <TabsTrigger value="trash" className="gap-1.5">
        <Trash2 className="h-4 w-4" /> Trash
      </TabsTrigger>
    </TabsList>
    <TabsContent value="notes" className="rounded-md border border-app-border bg-app-panel p-4 text-sm text-app-muted">
      106 notes in this workspace.
    </TabsContent>
    <TabsContent value="graph" className="rounded-md border border-app-border bg-app-panel p-4 text-sm text-app-muted">
      106 nodes · 412 wiki-links · 3 orphan notes.
    </TabsContent>
    <TabsContent value="trash" className="rounded-md border border-app-border bg-app-panel p-4 text-sm text-app-muted">
      2 notes, deleted 30 days ago.
    </TabsContent>
  </Tabs>
);

export const ActiveAndDisabled = () => (
  <Tabs defaultValue="local" className="w-full max-w-[620px]">
    <TabsList>
      <TabsTrigger value="local">Local vault</TabsTrigger>
      <TabsTrigger value="history">Version history</TabsTrigger>
      <TabsTrigger value="cloud" disabled>
        Cloud vault
      </TabsTrigger>
    </TabsList>
    <TabsContent value="local" className="rounded-md border border-app-border bg-app-panel p-4 text-sm text-app-muted">
      ~/Notes · 106 files on disk. Cloud vault is disabled until sync is enabled.
    </TabsContent>
    <TabsContent value="history" className="rounded-md border border-app-border bg-app-panel p-4 text-sm text-app-muted">
      42 snapshots kept locally.
    </TabsContent>
    <TabsContent value="cloud" className="rounded-md border border-app-border bg-app-panel p-4 text-sm text-app-muted">
      Sync is off.
    </TabsContent>
  </Tabs>
);
