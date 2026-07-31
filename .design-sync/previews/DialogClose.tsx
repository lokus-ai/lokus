import {
  Dialog,
  DialogContent,
  DialogClose,
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

// DialogClose is any element that dismisses the dialog. Shown in place: as the
// footer's secondary action (asChild over a Button), as a link-style opt-out, and
// alongside the X affordance DialogContent renders in the corner.

export const CloseAsFooterAction = () => (
  <Stage>
  <Dialog open>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Export “Weekly Review.md”</DialogTitle>
        <DialogDescription>
          Choose a format. Attachments in the note are copied next to the exported file.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md border border-app-accent/60 bg-app-bg px-3 py-2 text-center text-sm text-app-text">
          Markdown
        </div>
        <div className="rounded-md border border-app-border bg-app-bg px-3 py-2 text-center text-sm text-app-muted">
          PDF
        </div>
        <div className="rounded-md border border-app-border bg-app-bg px-3 py-2 text-center text-sm text-app-muted">
          HTML
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button>Export</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </Stage>
);

export const CloseAsInlineOptOut = () => (
  <Stage>
  <Dialog open>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Lokus 1.4 is installed</DialogTitle>
        <DialogDescription>
          Canvas embeds, faster graph view, and a rewritten sync engine. Restart to finish
          applying the update.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="items-center">
        <DialogClose asChild>
          <Button variant="link" className="px-0">
            Remind me later
          </Button>
        </DialogClose>
        <Button>Restart Lokus</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </Stage>
);
