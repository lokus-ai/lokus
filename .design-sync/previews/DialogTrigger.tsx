import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Badge,
} from 'lokus';
import { Plus, Trash2, FilePlus2, FolderPlus, MoreHorizontal } from 'lucide-react';

// DialogTrigger is the affordance that opens the dialog, so it is shown rendered in
// place with its dialog still closed — that is the state a user actually sees it in.
// Stories vary how the trigger is presented: as row actions in workspace settings,
// and as the primary/secondary calls to action in an empty folder.

export const TriggersInWorkspaceSettings = () => (
  <div className="mx-auto max-w-xl space-y-3">
    <div className="obsidian-text-lg font-semibold text-app-text">Workspaces</div>

    <div className="flex items-center justify-between rounded-lg border border-app-border bg-app-panel p-4">
      <div>
        <div className="text-sm font-medium text-app-text">Second Brain</div>
        <div className="text-xs text-app-muted">~/Documents/Lokus · 412 notes · synced 2m ago</div>
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4" />
            New workspace
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>Pick a folder to hold your markdown notes.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>

    <div className="flex items-center justify-between rounded-lg border border-app-border bg-app-panel p-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-app-text">Archive 2024</span>
          <Badge variant="outline">not synced</Badge>
        </div>
        <div className="text-xs text-app-muted">~/Documents/Archive · 1,908 notes</div>
      </div>
      <div className="flex items-center gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Workspace details</DialogTitle>
              <DialogDescription>Path, note count and sync history.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove workspace?</DialogTitle>
              <DialogDescription>Files stay on disk.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  </div>
);

export const TriggersInAnEmptyFolder = () => (
  <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-lg border border-dashed border-app-border bg-app-panel px-6 py-12 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-app-accent/15">
      <FilePlus2 className="h-6 w-6 text-app-accent" />
    </div>
    <div className="space-y-1">
      <div className="obsidian-text-lg font-semibold text-app-text">Journal is empty</div>
      <p className="text-sm text-app-muted">
        Start from a template, or add a subfolder to organise entries by month.
      </p>
    </div>
    <div className="flex items-center gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" />
            New note from template
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a template</DialogTitle>
            <DialogDescription>6 templates available in Templates/.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost">
            <FolderPlus className="h-4 w-4" />
            New folder
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder in Journal</DialogTitle>
            <DialogDescription>Created on disk under ~/Documents/Lokus/Journal.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  </div>
);
