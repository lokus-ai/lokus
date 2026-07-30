import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Badge,
  Label,
  Input,
} from 'lokus';
import { ShieldCheck, FileClock } from 'lucide-react';

// The card viewport is taller than a bare dialog, and DialogOverlay's backdrop-blur
// samples whatever is behind it — so a short story root leaks the host page's white
// background as a band across the scrim. Stage holds the root open to full height.
const Stage = ({ children }) => (
  <div style={{ minHeight: 'calc(100vh - 48px)' }}>{children}</div>
);

// DialogContent is the panel itself: centred, max-w-lg by default, grid gap-4, and it
// always ships the corner close button. Stories vary what the panel has to hold —
// a dense body at default width, and a widened panel via className.

export const ContentWithFormBody = () => (
  <Stage>
  <Dialog open>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Rename note</DialogTitle>
        <DialogDescription>
          Links pointing at this note are rewritten across the workspace.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="note-name">File name</Label>
        <Input id="note-name" defaultValue="Weekly Review.md" />
        <p className="text-xs text-app-muted">4 backlinks will be updated in Journal/ and Engineering/.</p>
      </div>
      <DialogFooter>
        <Button variant="ghost">Cancel</Button>
        <Button>Rename</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </Stage>
);

export const WideContentForPluginPermissions = () => (
  <Stage>
  <Dialog open>
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-app-accent/15">
            <ShieldCheck className="h-5 w-5 text-app-accent" />
          </div>
          <div>
            <DialogTitle>Kanban Sync wants access</DialogTitle>
            <DialogDescription>Plugin v2.1.0 · published by lokus-community</DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <div className="divide-y divide-app-border rounded-lg border border-app-border">
        <div className="flex items-start justify-between gap-4 p-3">
          <div>
            <div className="text-sm font-medium text-app-text">Read and write notes</div>
            <div className="text-xs text-app-muted">Limited to the Tasks/ folder</div>
          </div>
          <Badge variant="outline">scoped</Badge>
        </div>
        <div className="flex items-start justify-between gap-4 p-3">
          <div>
            <div className="text-sm font-medium text-app-text">Network access</div>
            <div className="text-xs text-app-muted">api.github.com — issue and project sync</div>
          </div>
          <Badge variant="destructive">sensitive</Badge>
        </div>
        <div className="flex items-start justify-between gap-4 p-3">
          <div>
            <div className="text-sm font-medium text-app-text">Register commands</div>
            <div className="text-xs text-app-muted">Adds 3 entries to the command palette</div>
          </div>
          <Badge variant="outline">safe</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-app-muted">
        <FileClock className="h-3.5 w-3.5" />
        Permissions can be revoked any time in Settings → Plugins.
      </div>
      <DialogFooter>
        <Button variant="ghost">Deny</Button>
        <Button>Allow plugin</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </Stage>
);
