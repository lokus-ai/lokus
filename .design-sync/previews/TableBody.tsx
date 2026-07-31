import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
} from 'lokus';

const notes = [
  { title: 'Weekly Review.md', folder: 'Journal', words: 842, edited: '2 min ago' },
  { title: 'Sync Engine V2.md', folder: 'Engineering', words: 3120, edited: '1 hour ago' },
  { title: 'Graph View Ideas.md', folder: 'Design', words: 411, edited: 'Yesterday' },
  { title: 'Plugin SDK Notes.md', folder: 'Engineering', words: 1276, edited: '3 days ago' },
];

export const NoteRows = () => (
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

export const EmptyBody = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Note</TableHead>
        <TableHead>Tag</TableHead>
        <TableHead>Last edited</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell colSpan={3} className="py-14 text-center">
          <div className="text-app-text">
            No notes tagged <Badge variant="secondary">#retro</Badge> yet.
          </div>
          <div className="mt-1.5 text-app-muted">
            Add the tag in a note&apos;s frontmatter and it will show up here.
          </div>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
);
