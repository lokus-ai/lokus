import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Label,
  Input,
} from 'lokus';

export const EditorPanel = () => (
  <Tabs defaultValue="editor" className="w-full max-w-[640px]">
    <TabsList>
      <TabsTrigger value="editor">Editor</TabsTrigger>
      <TabsTrigger value="preview">Preview</TabsTrigger>
      <TabsTrigger value="frontmatter">Frontmatter</TabsTrigger>
    </TabsList>
    <TabsContent value="editor" className="rounded-md border border-app-border bg-app-panel p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="tc-title">Title</Label>
          <Input id="tc-title" defaultValue="Weekly Review" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tc-folder">Folder</Label>
          <Input id="tc-folder" defaultValue="Journal" />
        </div>
      </div>
    </TabsContent>
    <TabsContent value="preview" className="rounded-md border border-app-border bg-app-panel p-4">
      Rendered markdown
    </TabsContent>
    <TabsContent value="frontmatter" className="rounded-md border border-app-border bg-app-panel p-4">
      YAML frontmatter
    </TabsContent>
  </Tabs>
);

export const FrontmatterPanel = () => (
  <Tabs defaultValue="frontmatter" className="w-full max-w-[640px]">
    <TabsList>
      <TabsTrigger value="editor">Editor</TabsTrigger>
      <TabsTrigger value="preview">Preview</TabsTrigger>
      <TabsTrigger value="frontmatter">Frontmatter</TabsTrigger>
    </TabsList>
    <TabsContent value="editor" className="rounded-md border border-app-border bg-app-panel p-4">
      Markdown source
    </TabsContent>
    <TabsContent value="preview" className="rounded-md border border-app-border bg-app-panel p-4">
      Rendered markdown
    </TabsContent>
    <TabsContent value="frontmatter" className="rounded-md border border-app-border bg-app-panel p-4">
      <pre className="font-mono text-xs leading-relaxed text-app-muted">
{`title: Weekly Review
created: 2026-03-14
tags: [journal, retro]`}
      </pre>
      <div className="mt-3 flex gap-1.5">
        <Badge variant="secondary">#journal</Badge>
        <Badge variant="secondary">#retro</Badge>
      </div>
    </TabsContent>
  </Tabs>
);
