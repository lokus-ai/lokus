import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'lokus';

export const CaptionedNotes = () => (
  <Table>
    <TableCaption>Showing 3 of 106 notes in this workspace.</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Note</TableHead>
        <TableHead>Folder</TableHead>
        <TableHead>Last edited</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell className="font-medium">Weekly Review.md</TableCell>
        <TableCell>Journal</TableCell>
        <TableCell>2 min ago</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Sync Engine V2.md</TableCell>
        <TableCell>Engineering</TableCell>
        <TableCell>1 hour ago</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Graph View Ideas.md</TableCell>
        <TableCell>Design</TableCell>
        <TableCell>Yesterday</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);

export const SyncCaption = () => (
  <Table>
    <TableCaption>
      Files are encrypted with your workspace key before upload. Last sync 5 minutes ago.
    </TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>File</TableHead>
        <TableHead>Action</TableHead>
        <TableHead className="text-right">Size</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell className="font-medium">Journal/Weekly Review.md</TableCell>
        <TableCell>Uploaded</TableCell>
        <TableCell className="text-right">12.4 KB</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Engineering/Plugin SDK Notes.md</TableCell>
        <TableCell>Downloaded</TableCell>
        <TableCell className="text-right">19.8 KB</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Design/Old Moodboard.md</TableCell>
        <TableCell>Moved to trash</TableCell>
        <TableCell className="text-right">4.2 KB</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);
