import {
  Slash,
  Link2,
  CheckSquare,
  AlertTriangle,
  Code2,
  Sigma,
  GitBranch,
  Network,
  Hash,
  Keyboard,
} from "lucide-react";

export const FEATURES = [
  {
    id: "slash-commands",
    icon: Slash,
    title: "Slash Commands",
    description: "Type / to insert headings, lists, code blocks, and more",
  },
  {
    id: "wiki-links",
    icon: Link2,
    title: "Wiki Links",
    description: "Type [[ to link notes together and build your knowledge graph",
  },
  {
    id: "tasks",
    icon: CheckSquare,
    title: "Smart Tasks",
    description: "23 task states from todo to delegated — way beyond checkboxes",
  },
  {
    id: "callouts",
    icon: AlertTriangle,
    title: "Callouts",
    description: "Highlight important info with note, tip, warning, and danger blocks",
  },
  {
    id: "code-blocks",
    icon: Code2,
    title: "Code Blocks",
    description: "Syntax highlighting for 100+ languages with copy support",
  },
  {
    id: "math",
    icon: Sigma,
    title: "Math & LaTeX",
    description: "Render equations inline or as blocks with KaTeX",
  },
  {
    id: "mermaid",
    icon: GitBranch,
    title: "Mermaid Diagrams",
    description: "Create flowcharts, sequence diagrams, and more from text",
  },
  {
    id: "graph",
    icon: Network,
    title: "Graph View",
    description: "Visualize connections between all your notes interactively",
  },
  {
    id: "tags",
    icon: Hash,
    title: "Tags & Backlinks",
    description: "Organize with #tags and see what links to each note",
  },
  {
    id: "shortcuts",
    icon: Keyboard,
    title: "Keyboard Shortcuts",
    description: "Cmd/Ctrl+K for command palette, and dozens more shortcuts",
  },
];
