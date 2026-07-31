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
import { CloudUpload } from 'lucide-react';

// The card viewport is taller than a bare dialog, and DialogOverlay's backdrop-blur
// samples whatever is behind it — so a short story root leaks the host page's white
// background as a band across the scrim. Stage holds the root open to full height.
const Stage = ({ children }) => (
  <div style={{ minHeight: 'calc(100vh - 48px)' }}>{children}</div>
);

// DialogHeader stacks title + description with space-y-1.5. First story is the pure
// case — header and actions, no body at all. Second shows the header carrying an
// icon and a status badge alongside the title.

export const HeaderOnly = () => (
  <Stage>
  <Dialog open>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Discard unsaved changes?</DialogTitle>
        <DialogDescription>
          “Sprint Retro.md” has edits from the last 3 minutes that were never written to disk.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost">Keep editing</Button>
        <Button variant="destructive">Discard</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </Stage>
);

export const HeaderWithIconAndStatus = () => (
  <Stage>
  <Dialog open>
    <DialogContent>
      <DialogHeader>
        <div className="flex items-start gap-3 pr-8">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-app-accent/15">
            <CloudUpload className="h-5 w-5 text-app-accent" />
          </div>
          <div className="flex flex-col space-y-1.5 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>Enable sync for Second Brain</DialogTitle>
              <Badge variant="outline">end-to-end encrypted</Badge>
            </div>
            <DialogDescription>
              412 notes and 38 attachments will be encrypted with your local key before upload.
              You can sync one workspace at a time.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost">Not now</Button>
        <Button>Enable sync</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </Stage>
);
