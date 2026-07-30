import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'lokus';

const notes = [
  { title: 'Weekly Review.md', folder: 'Journal', words: 842, edited: '2 min ago' },
  { title: 'Sync Engine V2.md', folder: 'Engineering', words: 3120, edited: '1 hour ago' },
  { title: 'Graph View Ideas.md', folder: 'Design', words: 411, edited: 'Yesterday' },
];

export const ColumnHeader = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Note</TableHead>
        <TableHead>Folder</TableHead>
        <TableHead className="text-right">Words</TableHead>
        <TableHead>Last edited</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {notes.map((n) => (
        <TableRow key={n.title}>
          <TableCell className="font-medium">{n.title}</TableCell>
          <TableCell>{n.folder}</TableCell>
          <TableCell className="text-right">{n.words.toLocaleString()}</TableCell>
          <TableCell>{n.edited}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const UppercaseHeader = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead className="text-xs uppercase tracking-wider text-app-muted">File</TableHead>
        <TableHead className="text-xs uppercase tracking-wider text-app-muted">Sync state</TableHead>
        <TableHead className="text-xs uppercase tracking-wider text-app-muted text-right">Size</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell className="font-medium">Journal/Weekly Review.md</TableCell>
        <TableCell>Uploaded</TableCell>
        <TableCell className="text-right">12.4 KB</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Engineering/Sync Engine V2.md</TableCell>
        <TableCell>Uploaded</TableCell>
        <TableCell className="text-right">48.1 KB</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Design/Graph View Ideas.md</TableCell>
        <TableCell>Queued</TableCell>
        <TableCell className="text-right">6.0 KB</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);
