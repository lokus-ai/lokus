import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
} from 'lokus';
import { FileText, Folder } from 'lucide-react';

export const RichCells = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Note</TableHead>
        <TableHead>Tags</TableHead>
        <TableHead>Last edited</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell className="font-medium">
          <span className="inline-flex items-center gap-2">
            <FileText className="h-4 w-4 text-app-muted" /> Weekly Review.md
          </span>
        </TableCell>
        <TableCell>
          <span className="inline-flex gap-1.5">
            <Badge variant="secondary">#journal</Badge>
            <Badge variant="secondary">#retro</Badge>
          </span>
        </TableCell>
        <TableCell className="text-app-muted">2 min ago</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">
          <span className="inline-flex items-center gap-2">
            <Folder className="h-4 w-4 text-app-accent" /> Engineering
          </span>
        </TableCell>
        <TableCell>
          <span className="inline-flex gap-1.5">
            <Badge variant="secondary">#specs</Badge>
          </span>
        </TableCell>
        <TableCell className="text-app-muted">1 hour ago</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">
          <span className="inline-flex items-center gap-2">
            <FileText className="h-4 w-4 text-app-muted" /> Graph View Ideas.md
          </span>
        </TableCell>
        <TableCell>
          <span className="inline-flex gap-1.5">
            <Badge variant="secondary">#design</Badge>
            <Badge variant="secondary">#graph</Badge>
          </span>
        </TableCell>
        <TableCell className="text-app-muted">Yesterday</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);

export const AlignedCells = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Workspace path</TableHead>
        <TableHead className="text-right">Words</TableHead>
        <TableHead className="text-right">Hash</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell className="font-medium">~/Notes/Journal/Weekly Review.md</TableCell>
        <TableCell className="text-right tabular-nums">842</TableCell>
        <TableCell className="text-right font-mono text-xs text-app-muted">a3f19c2e</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">~/Notes/Engineering/Sync Engine V2.md</TableCell>
        <TableCell className="text-right tabular-nums">3,120</TableCell>
        <TableCell className="text-right font-mono text-xs text-app-muted">7b04de51</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">~/Notes/Design/Graph View Ideas.md</TableCell>
        <TableCell className="text-right tabular-nums">411</TableCell>
        <TableCell className="text-right font-mono text-xs text-app-muted">c82a6f00</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);
