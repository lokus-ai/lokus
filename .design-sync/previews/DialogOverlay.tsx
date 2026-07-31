import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Badge,
} from 'lokus';
import { AlertTriangle } from 'lucide-react';

// DialogOverlay is the scrim DialogContent renders behind the panel: black/60 plus a
// backdrop blur across the whole viewport. To show what it contributes, both stories
// put real editor content underneath so the dimming and blur are visible.

const EditorBehind = () => (
  <div className="space-y-4 overflow-hidden rounded-lg border border-app-border bg-app-panel p-6" style={{ height: 512 }}>
    <div className="flex items-center gap-2">
      <div className="obsidian-text-lg font-semibold text-app-text">Sync Design Notes</div>
      <Badge variant="outline">engineering</Badge>
      <Badge variant="outline">sync</Badge>
    </div>
    <p className="text-sm leading-relaxed text-app-muted">
      The manifest diff runs before any upload: same hash skips, different hash falls back to
      last-write-wins on modified_at, and anything present remotely but missing locally is a
      delete only if it is still in the sync cache.
    </p>
    <p className="text-sm leading-relaxed text-app-muted">
      Deleted files land in .lokus/trash/&lt;date&gt; for 30 days before the cleanup pass removes
      them for good.
    </p>
    <p className="text-sm leading-relaxed text-app-muted">
      Auto-sync fires 3 seconds after a save and again on a 5 minute timer, whichever comes
      first. A cross-window mutex in localStorage keeps two open Lokus windows from racing each
      other into the same manifest version.
    </p>
    <div className="h-2 w-3/4 rounded bg-app-border" />
    <div className="h-2 w-1/2 rounded bg-app-border" />
    <div className="h-2 w-2/3 rounded bg-app-border" />
    <div className="h-2 w-2/5 rounded bg-app-border" />
  </div>
);

export const ScrimOverTheEditor = () => (
  <>
    <EditorBehind />
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve sync conflict</DialogTitle>
          <DialogDescription>
            “Sync Design Notes.md” changed on this Mac and on lokus-mini since the last sync.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-app-accent/60 bg-app-bg p-3">
            <div className="mb-1 text-sm font-medium text-app-text">This device</div>
            <div className="text-xs text-app-muted">Edited 4 minutes ago · 6.2 KB</div>
          </div>
          <div className="rounded-md border border-app-border bg-app-bg p-3">
            <div className="mb-1 text-sm font-medium text-app-text">lokus-mini</div>
            <div className="text-xs text-app-muted">Edited 51 minutes ago · 5.8 KB</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost">Keep both</Button>
          <Button>Use this device</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
);

export const ScrimUnderADestructiveWarning = () => (
  <>
    <EditorBehind />
    <Dialog open>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "rgba(239, 68, 68, 0.15)" }}>
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <DialogTitle>Stop syncing this workspace?</DialogTitle>
          <DialogDescription>
            Encrypted blobs and the workspace manifest are deleted from the cloud. Your local
            markdown files are untouched.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Stop syncing</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
);
