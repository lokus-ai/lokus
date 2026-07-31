import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from 'lokus';

// The card viewport is taller than a bare dialog, and DialogOverlay's backdrop-blur
// samples whatever is behind it — so a short story root leaks the host page's white
// background as a band across the scrim. Stage holds the root open to full height.
const Stage = ({ children }) => (
  <div style={{ minHeight: 'calc(100vh - 48px)' }}>{children}</div>
);

// DialogDescription is the muted supporting copy under the title. Stories vary how
// much explaining the dialog has to do: one long multi-sentence description that
// carries the whole decision, and a short one-line clarifier.

export const LongExplanatoryDescription = () => (
  <Stage>
  <Dialog open>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Switch the synced workspace to “Archive 2024”?</DialogTitle>
        <DialogDescription>
          Lokus syncs one workspace at a time. Switching uploads a fresh manifest for “Archive
          2024” and removes the encrypted blobs for “Second Brain” from cloud storage — the local
          markdown files for both workspaces stay exactly where they are on disk. Because a switch
          re-uploads everything, you can only do this once every 6 hours.
        </DialogDescription>
      </DialogHeader>
      <div className="rounded-md border border-app-border bg-app-bg px-3 py-2 text-xs text-app-muted">
        Last switch: 24 Jul 2026, 09:12 · next switch available now
      </div>
      <DialogFooter>
        <Button variant="ghost">Cancel</Button>
        <Button>Switch workspace</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </Stage>
);

export const ShortClarifier = () => (
  <Stage>
  <Dialog open>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Export note</DialogTitle>
        <DialogDescription>Saved to ~/Downloads as Markdown.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost">Cancel</Button>
        <Button>Export</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </Stage>
);
