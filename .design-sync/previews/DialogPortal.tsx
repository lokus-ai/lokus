import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from 'lokus';
import { FolderTree, FileText, Hash } from 'lucide-react';

// DialogPortal is the structural part DialogContent mounts through: it lifts the
// panel out of the sidebar's stacking/overflow context and renders it at the
// document root. The story is the result — a dialog triggered from the file tree
// that floats over the whole workspace instead of being clipped inside it.

const WorkspaceChrome = () => (
  <div className="flex overflow-hidden rounded-lg border border-app-border" style={{ height: 512 }}>
    <aside className="w-56 shrink-0 overflow-hidden border-r border-app-border bg-app-panel p-3">
      <div className="obsidian-text-sm mb-3 font-semibold text-app-text">Second Brain</div>
      <div className="space-y-1 text-sm text-app-muted">
        <div className="flex items-center gap-2 rounded px-2 py-1">
          <FolderTree className="h-3.5 w-3.5" /> Engineering
        </div>
        <div className="flex items-center gap-2 rounded bg-app-accent/15 px-2 py-1 text-app-text">
          <FileText className="h-3.5 w-3.5" /> Weekly Review.md
        </div>
        <div className="flex items-center gap-2 rounded px-2 py-1">
          <FileText className="h-3.5 w-3.5" /> Sync Design Notes.md
        </div>
        <div className="flex items-center gap-2 rounded px-2 py-1">
          <Hash className="h-3.5 w-3.5" /> retro
        </div>
      </div>
    </aside>
    <div className="flex-1 space-y-3 p-6">
      <div className="obsidian-text-lg font-semibold text-app-text">Weekly Review</div>
      <div className="h-2 w-3/4 rounded bg-app-border" />
      <div className="h-2 w-1/2 rounded bg-app-border" />
      <div className="h-2 w-2/3 rounded bg-app-border" />
    </div>
  </div>
);

export const PortalEscapesTheSidebar = () => (
  <>
    <WorkspaceChrome />
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move “Weekly Review.md”</DialogTitle>
          <DialogDescription>
            Opened from the file tree, mounted at the document root — the panel overlaps the
            sidebar instead of being clipped by its overflow.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-app-border bg-app-bg px-3 py-2 text-sm text-app-muted">
          Journal / 2026 / July
        </div>
        <DialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button>Move note</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
);
