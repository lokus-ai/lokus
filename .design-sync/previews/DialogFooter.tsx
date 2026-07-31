import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
} from 'lokus';

// The card viewport is taller than a bare dialog, and DialogOverlay's backdrop-blur
// samples whatever is behind it — so a short story root leaks the host page's white
// background as a band across the scrim. Stage holds the root open to full height.
const Stage = ({ children }) => (
  <div style={{ minHeight: 'calc(100vh - 48px)' }}>{children}</div>
);

// DialogFooter right-aligns its actions with space-x-2 on sm+. Stories vary the
// action set: the two-button ghost + destructive pair, and a three-action footer
// where the least-destructive escape hatch sits furthest from the primary.

export const GhostAndDestructive = () => (
  <Stage>
  <Dialog open>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Move “Q3 Planning.md” to trash?</DialogTitle>
        <DialogDescription>
          It stays in .lokus/trash for 30 days, then is permanently removed.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button variant="destructive">Move to trash</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </Stage>
);

export const ThreeActionFooter = () => (
  <Stage>
  <Dialog open>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Unsaved changes in 2 notes</DialogTitle>
        <DialogDescription>
          Closing this window now would drop edits in “Weekly Review.md” and “Canvas Ideas.md”.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-md border border-app-border bg-app-bg px-3 py-2 text-sm">
          <span className="text-app-text">Weekly Review.md</span>
          <span className="text-xs text-app-muted">edited 1m ago</span>
        </div>
        <div className="flex items-center justify-between rounded-md border border-app-border bg-app-bg px-3 py-2 text-sm">
          <span className="text-app-text">Canvas Ideas.md</span>
          <span className="text-xs text-app-muted">edited 6m ago</span>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost">Cancel</Button>
        <Button variant="destructive">Discard changes</Button>
        <Button>Save and close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </Stage>
);
