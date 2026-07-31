import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from 'lokus';

export const FolderTotals = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Folder</TableHead>
        <TableHead className="text-right">Notes</TableHead>
        <TableHead className="text-right">Words</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell className="font-medium">Journal</TableCell>
        <TableCell className="text-right">28</TableCell>
        <TableCell className="text-right">14,204</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Engineering</TableCell>
        <TableCell className="text-right">61</TableCell>
        <TableCell className="text-right">52,880</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Design</TableCell>
        <TableCell className="text-right">17</TableCell>
        <TableCell className="text-right">6,940</TableCell>
      </TableRow>
    </TableBody>
    <TableFooter>
      <TableRow>
        <TableCell>Total</TableCell>
        <TableCell className="text-right">106</TableCell>
        <TableCell className="text-right">74,024</TableCell>
      </TableRow>
    </TableFooter>
  </Table>
);

export const SyncSizeFooter = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Sync batch</TableHead>
        <TableHead className="text-right">Files</TableHead>
        <TableHead className="text-right">Encrypted size</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell className="font-medium">Uploaded</TableCell>
        <TableCell className="text-right">42</TableCell>
        <TableCell className="text-right">3.1 MB</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Downloaded</TableCell>
        <TableCell className="text-right">7</TableCell>
        <TableCell className="text-right">412 KB</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Moved to trash</TableCell>
        <TableCell className="text-right">2</TableCell>
        <TableCell className="text-right">38 KB</TableCell>
      </TableRow>
    </TableBody>
    <TableFooter>
      <TableRow>
        <TableCell>Last sync · 5 min ago</TableCell>
        <TableCell className="text-right">51</TableCell>
        <TableCell className="text-right text-app-accent">3.5 MB</TableCell>
      </TableRow>
    </TableFooter>
  </Table>
);
