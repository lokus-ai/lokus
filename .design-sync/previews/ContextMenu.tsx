import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuShortcut,
} from 'lokus';
import {
  FilePlus,
  FolderPlus,
  FolderOpen,
  ExternalLink,
  FileText,
  Eye,
  Pencil,
  Trash2,
  Link,
  Copy,
  Scissors,
  Clipboard,
  Type,
  Sparkles,
  Code,
  ChevronDown,
  ChevronRight,
  Hash,
  Palette,
  Group,
  Layers,
} from 'lucide-react';

/* The popper wrapper is fixed to the viewport because a static capture has no
   real right-click point. Pin it into the stage so the menu lands over the
   surface it belongs to. Only the top-level wrapper — submenus stay free. */
const CTX_CSS =
  '.ctx-stage > [data-radix-popper-content-wrapper]{position:absolute!important;transform:none!important;}';

const stage = {
  position: 'relative',
  height: 420,
  overflow: 'hidden',
  borderRadius: 'var(--radius)',
  border: '1px solid rgb(var(--border))',
  background: 'rgb(var(--bg))',
};

const Row = ({ label, depth = 0, icon, active, muted }) => (
  <div
    className="flex items-center gap-2 rounded-sm text-sm"
    style={{
      padding: '4px 8px',
      marginLeft: depth * 14,
      color: muted ? 'rgb(var(--muted))' : 'rgb(var(--text))',
      background: active ? 'rgb(var(--panel-secondary))' : 'transparent',
    }}
  >
    {icon}
    <span>{label}</span>
  </div>
);

const Sidebar = () => (
  <div
    className="bg-app-panel"
    style={{ width: 248, height: '100%', borderRight: '1px solid rgb(var(--border))', padding: '10px 6px' }}
  >
    <div className="text-xs font-medium text-app-muted" style={{ padding: '0 8px 8px' }}>
      SECOND BRAIN
    </div>
    <Row label="Journal" icon={<ChevronDown className="h-3 w-3 text-app-muted" />} />
    <Row label="2026-07-27.md" depth={1} icon={<FileText className="h-4 w-4 text-app-muted" />} />
    <Row label="Engineering" icon={<ChevronDown className="h-3 w-3 text-app-muted" />} />
    <Row label="Weekly Review.md" depth={1} icon={<FileText className="h-4 w-4 text-app-muted" />} active />
    <Row label="Sync V2 Notes.md" depth={1} icon={<FileText className="h-4 w-4 text-app-muted" />} />
    <Row label="Design" icon={<ChevronRight className="h-3 w-3 text-app-muted" />} />
    <Row label="Templates" icon={<ChevronRight className="h-3 w-3 text-app-muted" />} />
  </div>
);

const EditorPane = ({ title = 'Weekly Review', children }) => (
  <div style={{ flex: 1, padding: '18px 24px', minWidth: 0 }}>
    <div className="text-app-text" style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>
      {title}
    </div>
    {children}
  </div>
);

const Line = ({ children, muted }) => (
  <div
    className="text-sm"
    style={{ marginBottom: 8, lineHeight: 1.6, color: muted ? 'rgb(var(--muted))' : 'rgb(var(--text))' }}
  >
    {children}
  </div>
);

export const FileTreeMenu = () => (
  <div style={stage}>
    <style>{CTX_CSS}</style>
    <div style={{ display: 'flex', height: '100%' }}>
      <Sidebar />
      <EditorPane>
        <Line>Shipped the manifest diff rewrite. Sync now reconciles in one pass.</Line>
        <Line muted>Open threads: trash retention, offline queue drain order.</Line>
      </EditorPane>
    </div>
    <div className="ctx-stage" style={{ position: 'absolute', left: 40, top: 74 }}>
      <ContextMenu>
        <ContextMenuTrigger />
        <ContextMenuContent forceMount className="w-72">
          <ContextMenuItem>
            <FilePlus className="mr-2 h-4 w-4" />
            New File
            <ContextMenuShortcut>⌘N</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
            <ContextMenuShortcut>⌘⇧N</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem>
            <FileText className="mr-2 h-4 w-4" />
            Open
            <ContextMenuShortcut>Enter</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSub open>
            <ContextMenuSubTrigger>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open With…
            </ContextMenuSubTrigger>
            <ContextMenuSubContent forceMount className="w-56">
              <ContextMenuItem>
                <FileText className="mr-2 h-4 w-4" />
                Default Editor
              </ContextMenuItem>
              <ContextMenuItem>
                <ExternalLink className="mr-2 h-4 w-4" />
                External Application
              </ContextMenuItem>
              <ContextMenuItem>
                <Eye className="mr-2 h-4 w-4" />
                System Default
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem>
            <FolderOpen className="mr-2 h-4 w-4" />
            Reveal in Finder
            <ContextMenuShortcut>⌥R</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <Link className="mr-2 h-4 w-4" />
            Copy Path
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
            <ContextMenuShortcut>F2</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <Trash2 className="mr-2 h-4 w-4 text-red-500" />
            <span className="text-red-500">Delete</span>
            <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  </div>
);

export const EditorSelectionMenu = () => (
  <div style={stage}>
    <style>{CTX_CSS}</style>
    <div style={{ display: 'flex', height: '100%' }}>
      <EditorPane title="Sync V2 Notes">
        <Line>
          The manifest is a single JSONB column per workspace, so a full{' '}
          <span style={{ background: 'rgb(var(--accent) / 0.25)' }}>reconciliation is one round trip</span>{' '}
          instead of N file rows.
        </Line>
        <Line muted>Optimistic concurrency lives in the update_manifest() RPC.</Line>
      </EditorPane>
    </div>
    <div className="ctx-stage" style={{ position: 'absolute', left: 150, top: 66 }}>
      <ContextMenu>
        <ContextMenuTrigger />
        <ContextMenuContent forceMount className="w-72">
          <ContextMenuItem>
            <Sparkles className="mr-2 h-4 w-4" />
            Ask AI
          </ContextMenuItem>
          <ContextMenuSub open>
            <ContextMenuSubTrigger>
              <Sparkles className="mr-2 h-4 w-4" />
              AI Transform
            </ContextMenuSubTrigger>
            <ContextMenuSubContent forceMount className="w-56">
              <ContextMenuItem>Rewrite</ContextMenuItem>
              <ContextMenuItem>Simplify</ContextMenuItem>
              <ContextMenuItem>Expand</ContextMenuItem>
              <ContextMenuItem>Fix grammar</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem>
            <Scissors className="mr-2 h-4 w-4" />
            Cut
            <ContextMenuShortcut>⌘X</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <Copy className="mr-2 h-4 w-4" />
            Copy
            <ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <Clipboard className="mr-2 h-4 w-4" />
            Paste
            <ContextMenuShortcut>⌘V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem>
            <Type className="mr-2 h-4 w-4" />
            Format
          </ContextMenuItem>
          <ContextMenuItem>
            <Link className="mr-2 h-4 w-4" />
            Insert wiki link
            <ContextMenuShortcut>[[</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <Code className="mr-2 h-4 w-4" />
            Copy block reference
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  </div>
);

export const CanvasNodeMenu = () => (
  <div style={stage}>
    <style>{CTX_CSS}</style>
    <div
      style={{
        height: '100%',
        background: 'rgb(var(--canvas-bg))',
        backgroundImage:
          'linear-gradient(var(--canvas-grid) 1px, transparent 1px), linear-gradient(90deg, var(--canvas-grid) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        position: 'relative',
      }}
    >
      <div
        className="bg-app-panel"
        style={{
          position: 'absolute',
          left: 380,
          top: 48,
          width: 200,
          padding: 12,
          borderRadius: 'var(--radius)',
          border: '1px solid rgb(var(--accent))',
        }}
      >
        <div className="text-sm text-app-text" style={{ fontWeight: 600, marginBottom: 4 }}>
          Retention model
        </div>
        <div className="text-xs text-app-muted">Linked to 3 notes</div>
      </div>
      <div
        className="bg-app-panel"
        style={{
          position: 'absolute',
          left: 400,
          top: 260,
          width: 176,
          padding: 12,
          borderRadius: 'var(--radius)',
          border: '1px solid rgb(var(--border))',
        }}
      >
        <div className="text-sm text-app-text">Weekly Review.md</div>
      </div>
    </div>
    <div className="ctx-stage" style={{ position: 'absolute', left: 60, top: 60 }}>
      <ContextMenu>
        <ContextMenuTrigger />
        <ContextMenuContent forceMount className="w-72">
          <ContextMenuItem>
            <Pencil className="mr-2 h-4 w-4" />
            Edit label
            <ContextMenuShortcut>F2</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <Palette className="mr-2 h-4 w-4" />
            Node colour…
          </ContextMenuItem>
          <ContextMenuItem>
            <FileText className="mr-2 h-4 w-4" />
            Convert to note
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem>
            <Layers className="mr-2 h-4 w-4" />
            Bring to front
            <ContextMenuShortcut>⌘⇧]</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <Group className="mr-2 h-4 w-4" />
            Group selection
            <ContextMenuShortcut>⌘G</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <Hash className="mr-2 h-4 w-4" />
            Add tag…
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem>
            <Trash2 className="mr-2 h-4 w-4 text-red-500" />
            <span className="text-red-500">Delete node</span>
            <ContextMenuShortcut>⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  </div>
);
