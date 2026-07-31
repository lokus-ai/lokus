import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
} from 'lokus';

export const SelectedRow = () => (
  <Table>
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
      <TableRow data-state="selected">
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

export const StatusRows = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>File</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Size</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell className="font-medium">Journal/Weekly Review.md</TableCell>
        <TableCell><Badge>Synced</Badge></TableCell>
        <TableCell className="text-right">12.4 KB</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Design/Graph View Ideas.md</TableCell>
        <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
        <TableCell className="text-right">6.0 KB</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Engineering/Draft Spec.md</TableCell>
        <TableCell><Badge variant="destructive">Conflict</Badge></TableCell>
        <TableCell className="text-right">27.3 KB</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);
