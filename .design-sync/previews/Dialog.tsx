import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from 'lokus';

export const CreateWorkspace = () => (
  <Dialog open>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create workspace</DialogTitle>
        <DialogDescription>
          Pick a folder on this machine. Lokus keeps every note as plain markdown inside it.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor="ws-name">Name</Label>
          <Input id="ws-name" defaultValue="Second Brain" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ws-path">Location</Label>
          <Input id="ws-path" defaultValue="~/Documents/Lokus" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost">Cancel</Button>
        <Button>Create workspace</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const DestructiveConfirm = () => (
  <Dialog open>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Move 3 notes to trash?</DialogTitle>
        <DialogDescription>
          They stay in <code>.lokus/trash</code> for 30 days, then are permanently removed.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost">Keep them</Button>
        <Button variant="destructive">Move to trash</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
