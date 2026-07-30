import { Tabs, TabsList, TabsTrigger, TabsContent } from 'lokus';

export const WorkspaceViews = () => (
  <Tabs defaultValue="notes" className="w-full max-w-[620px]">
    <TabsList>
      <TabsTrigger value="notes">Notes</TabsTrigger>
      <TabsTrigger value="graph">Graph</TabsTrigger>
      <TabsTrigger value="kanban">Kanban</TabsTrigger>
      <TabsTrigger value="canvas">Canvas</TabsTrigger>
    </TabsList>
    <TabsContent value="notes" className="rounded-md border border-app-border bg-app-panel p-4 text-sm text-app-muted">
      106 notes across Journal, Engineering and Design.
    </TabsContent>
    <TabsContent value="graph" className="rounded-md border border-app-border bg-app-panel p-4 text-sm text-app-muted">
      412 links · 106 nodes.
    </TabsContent>
    <TabsContent value="kanban" className="rounded-md border border-app-border bg-app-panel p-4 text-sm text-app-muted">
      3 boards.
    </TabsContent>
    <TabsContent value="canvas" className="rounded-md border border-app-border bg-app-panel p-4 text-sm text-app-muted">
      2 canvases.
    </TabsContent>
  </Tabs>
);

export const FullWidthList = () => (
  <Tabs defaultValue="outline" className="w-full max-w-[620px]">
    <TabsList className="grid w-full grid-cols-3">
      <TabsTrigger value="outline">Outline</TabsTrigger>
      <TabsTrigger value="backlinks">Backlinks</TabsTrigger>
      <TabsTrigger value="tags">Tags</TabsTrigger>
    </TabsList>
    <TabsContent value="outline" className="rounded-md border border-app-border bg-app-panel p-4 text-sm text-app-muted">
      <div className="space-y-1 text-app-text">
        <div>Sync Engine V2</div>
        <div className="pl-4 text-app-muted">Manifest diff</div>
        <div className="pl-4 text-app-muted">Offline queue</div>
      </div>
    </TabsContent>
    <TabsContent value="backlinks" className="rounded-md border border-app-border bg-app-panel p-4 text-sm text-app-muted">
      14 notes link here.
    </TabsContent>
    <TabsContent value="tags" className="rounded-md border border-app-border bg-app-panel p-4 text-sm text-app-muted">
      #specs · #sync · #engineering
    </TabsContent>
  </Tabs>
);
