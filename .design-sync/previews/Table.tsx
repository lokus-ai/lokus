import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
} from 'lokus';

const notes = [
  { title: 'Weekly Review.md', folder: 'Journal', words: 842, status: 'Synced', edited: '2 min ago' },
  { title: 'Sync Engine V2.md', folder: 'Engineering', words: 3120, status: 'Synced', edited: '1 hour ago' },
  { title: 'Graph View Ideas.md', folder: 'Design', words: 411, status: 'Pending', edited: 'Yesterday' },
  { title: 'Plugin SDK Notes.md', folder: 'Engineering', words: 1276, status: 'Synced', edited: '3 days ago' },
];

export const NoteList = () => (
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

export const WithStatusAndCaption = () => (
  <Table>
    <TableCaption>All notes in this workspace are encrypted before upload.</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Note</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Last edited</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {notes.map((n) => (
        <TableRow key={n.title}>
          <TableCell className="font-medium">{n.title}</TableCell>
          <TableCell>
            <Badge variant={n.status === 'Synced' ? 'default' : 'secondary'}>{n.status}</Badge>
          </TableCell>
          <TableCell>{n.edited}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const WithFooter = () => (
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
        <TableCell className="font-medium">Total</TableCell>
        <TableCell className="text-right">106</TableCell>
        <TableCell className="text-right">74,024</TableCell>
      </TableRow>
    </TableFooter>
  </Table>
);
