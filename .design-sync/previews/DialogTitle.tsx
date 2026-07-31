import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
} from 'lokus';

// The card viewport is taller than a bare dialog, and DialogOverlay's backdrop-blur
// samples whatever is behind it — so a short story root leaks the host page's white
// background as a band across the scrim. Stage holds the root open to full height.
const Stage = ({ children }) => (
  <div style={{ minHeight: 'calc(100vh - 48px)' }}>{children}</div>
);

// DialogTitle is the dialog's accessible name and its strongest line of type.
// Stories vary the length: a short imperative title, and a long title that has to
// wrap in the panel without colliding with the corner close button.

export const ShortTitle = () => (
  <Stage>
  <Dialog open>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Rename folder</DialogTitle>
        <DialogDescription>Renaming updates every wikilink that points inside it.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="folder-name">Folder name</Label>
        <Input id="folder-name" defaultValue="Engineering" />
      </div>
      <DialogFooter>
        <Button variant="ghost">Cancel</Button>
        <Button>Rename</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </Stage>
);

export const LongWrappingTitle = () => (
  <Stage>
  <Dialog open>
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="pr-8">
          “Engineering/2026-07-24 Sync Engine Postmortem.md” already exists in Journal
        </DialogTitle>
        <DialogDescription>
          A note with that name is already in the destination folder. Choose how to continue.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <div className="rounded-md border border-app-accent/60 bg-app-bg p-3">
          <div className="text-sm font-medium text-app-text">Keep both</div>
          <div className="text-xs text-app-muted">Saves as “… Postmortem 2.md”</div>
        </div>
        <div className="rounded-md border border-app-border bg-app-bg p-3">
          <div className="text-sm font-medium text-app-text">Replace the existing note</div>
          <div className="text-xs text-app-muted">The current file is moved to trash first</div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost">Cancel</Button>
        <Button>Keep both</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </Stage>
);
