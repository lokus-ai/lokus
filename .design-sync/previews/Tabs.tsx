import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Button,
  Input,
  Label,
} from 'lokus';

export const Preferences = () => (
  <Tabs defaultValue="editor" className="w-full max-w-[680px]">
    <TabsList>
      <TabsTrigger value="editor">Editor</TabsTrigger>
      <TabsTrigger value="appearance">Appearance</TabsTrigger>
      <TabsTrigger value="sync">Sync</TabsTrigger>
      <TabsTrigger value="plugins">Plugins</TabsTrigger>
    </TabsList>
    <TabsContent value="editor" className="rounded-md border border-app-border bg-app-panel p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="prefs-font">Editor font</Label>
          <Input id="prefs-font" defaultValue="Inter" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prefs-width">Line width</Label>
          <Input id="prefs-width" defaultValue="720 px" />
        </div>
      </div>
      <p className="mt-3 text-sm text-app-muted">
        Markdown shortcuts, wiki-links and math render live as you type.
      </p>
    </TabsContent>
    <TabsContent value="appearance" className="rounded-md border border-app-border bg-app-panel p-4">
      Appearance settings
    </TabsContent>
    <TabsContent value="sync" className="rounded-md border border-app-border bg-app-panel p-4">
      Sync settings
    </TabsContent>
    <TabsContent value="plugins" className="rounded-md border border-app-border bg-app-panel p-4">
      Plugin settings
    </TabsContent>
  </Tabs>
);

export const SyncPanel = () => (
  <Tabs defaultValue="sync" className="w-full max-w-[680px]">
    <TabsList>
      <TabsTrigger value="editor">Editor</TabsTrigger>
      <TabsTrigger value="appearance">Appearance</TabsTrigger>
      <TabsTrigger value="sync">Sync</TabsTrigger>
      <TabsTrigger value="plugins">Plugins</TabsTrigger>
    </TabsList>
    <TabsContent value="editor" className="rounded-md border border-app-border bg-app-panel p-4">
      Editor settings
    </TabsContent>
    <TabsContent value="appearance" className="rounded-md border border-app-border bg-app-panel p-4">
      Appearance settings
    </TabsContent>
    <TabsContent value="sync" className="rounded-md border border-app-border bg-app-panel p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-app-text">Notes</span>
            <Badge>Syncing here</Badge>
          </div>
          <p className="mt-1 text-sm text-app-muted">
            106 files · 3.5 MB encrypted · last sync 5 minutes ago
          </p>
        </div>
        <Button size="sm">Sync now</Button>
      </div>
    </TabsContent>
    <TabsContent value="plugins" className="rounded-md border border-app-border bg-app-panel p-4">
      Plugin settings
    </TabsContent>
  </Tabs>
);

export const PluginsPanel = () => (
  <Tabs defaultValue="plugins" className="w-full max-w-[680px]">
    <TabsList>
      <TabsTrigger value="editor">Editor</TabsTrigger>
      <TabsTrigger value="appearance">Appearance</TabsTrigger>
      <TabsTrigger value="sync">Sync</TabsTrigger>
      <TabsTrigger value="plugins">Plugins</TabsTrigger>
    </TabsList>
    <TabsContent value="editor" className="rounded-md border border-app-border bg-app-panel p-4">
      Editor settings
    </TabsContent>
    <TabsContent value="appearance" className="rounded-md border border-app-border bg-app-panel p-4">
      Appearance settings
    </TabsContent>
    <TabsContent value="sync" className="rounded-md border border-app-border bg-app-panel p-4">
      Sync settings
    </TabsContent>
    <TabsContent value="plugins" className="rounded-md border border-app-border bg-app-panel p-1.5">
      <div className="divide-y divide-app-border">
        <div className="flex items-center justify-between px-2.5 py-2">
          <span className="text-sm text-app-text">Kanban Board</span>
          <Badge>Enabled</Badge>
        </div>
        <div className="flex items-center justify-between px-2.5 py-2">
          <span className="text-sm text-app-text">Graph View 3D</span>
          <Badge>Enabled</Badge>
        </div>
        <div className="flex items-center justify-between px-2.5 py-2">
          <span className="text-sm text-app-text">Daily Templates</span>
          <Badge variant="secondary">Disabled</Badge>
        </div>
      </div>
    </TabsContent>
  </Tabs>
);
