import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'lokus';
import { ArrowDown, ArrowUpDown } from 'lucide-react';

export const NumericHeads = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead className="w-[45%]">Note</TableHead>
        <TableHead className="text-right">Words</TableHead>
        <TableHead className="text-right">Backlinks</TableHead>
        <TableHead className="text-right">Size</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell className="font-medium">Sync Engine V2.md</TableCell>
        <TableCell className="text-right">3,120</TableCell>
        <TableCell className="text-right">14</TableCell>
        <TableCell className="text-right">48.1 KB</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Plugin SDK Notes.md</TableCell>
        <TableCell className="text-right">1,276</TableCell>
        <TableCell className="text-right">6</TableCell>
        <TableCell className="text-right">19.8 KB</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Weekly Review.md</TableCell>
        <TableCell className="text-right">842</TableCell>
        <TableCell className="text-right">3</TableCell>
        <TableCell className="text-right">12.4 KB</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);

export const SortableHeads = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>
          <span className="inline-flex items-center gap-1.5">
            Note <ArrowUpDown className="h-3.5 w-3.5 text-app-muted" />
          </span>
        </TableHead>
        <TableHead>
          <span className="inline-flex items-center gap-1.5">
            Folder <ArrowUpDown className="h-3.5 w-3.5 text-app-muted" />
          </span>
        </TableHead>
        <TableHead className="text-right text-app-accent">
          <span className="inline-flex items-center gap-1.5">
            Last edited <ArrowDown className="h-3.5 w-3.5" />
          </span>
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell className="font-medium">Weekly Review.md</TableCell>
        <TableCell>Journal</TableCell>
        <TableCell className="text-right">2 min ago</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Sync Engine V2.md</TableCell>
        <TableCell>Engineering</TableCell>
        <TableCell className="text-right">1 hour ago</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Graph View Ideas.md</TableCell>
        <TableCell>Design</TableCell>
        <TableCell className="text-right">Yesterday</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);
