import React from 'react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuShortcut,
} from './ui/context-menu';
import {
  Scissors,
  Copy,
  Clipboard,
  MousePointer2,
  RotateCcw,
  RotateCw,
  Search,
  SearchX,
  Zap,
  FileText,
  Download,
  Upload,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Link,
  Image,
  Table,
  Quote,
  Heading,
  Type,
  Sparkles,
  BookOpen,
  FileCode,
  Braces,
  SeparatorHorizontal
} from 'lucide-react';
import platformService from '../services/platform/PlatformService';

export default function EditorContextMenu({
  children,
  onAction,
  hasSelection = false,
  canUndo = false,
  canRedo = false,
  editor = null
}) {
  const isWindows = platformService.isWindows();

  const handleAction = (action, data = {}) => {
    if (onAction) {
      onAction(action, data);
    }
  };

  // Get current editor state
  const selectedText = editor?.state?.selection ? editor.state.doc.textBetween(
    editor.state.selection.from,
    editor.state.selection.to,
    ' '
  ) : '';

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-72">
        {/* Basic Editing */}
        <ContextMenuItem
          onClick={() => handleAction('cut')}
          disabled={!hasSelection}
        >
          <Scissors className="mr-2 h-4 w-4" />
          Cut
          <ContextMenuShortcut>{isWindows ? 'Ctrl+X' : '⌘X'}</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => handleAction('copy')}
          disabled={!hasSelection}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy
          <ContextMenuShortcut>{isWindows ? 'Ctrl+C' : '⌘C'}</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={() => handleAction('paste')}>
          <Clipboard className="mr-2 h-4 w-4" />
          Paste
          <ContextMenuShortcut>{isWindows ? 'Ctrl+V' : '⌘V'}</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Formatting */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Type className="mr-2 h-4 w-4" />
            Format
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuItem
              onClick={() => handleAction('toggleBold')}
              disabled={!hasSelection}
            >
              <Bold className="mr-2 h-4 w-4" />
              Bold
              <ContextMenuShortcut>{isWindows ? 'Ctrl+B' : '⌘B'}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => handleAction('toggleItalic')}
              disabled={!hasSelection}
            >
              <Italic className="mr-2 h-4 w-4" />
              Italic
              <ContextMenuShortcut>{isWindows ? 'Ctrl+I' : '⌘I'}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => handleAction('toggleStrikethrough')}
              disabled={!hasSelection}
            >
              <Strikethrough className="mr-2 h-4 w-4" />
              Strikethrough
              <ContextMenuShortcut>{isWindows ? 'Ctrl+Shift+X' : '⌘⇧X'}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => handleAction('toggleCode')}
              disabled={!hasSelection}
            >
              <Code className="mr-2 h-4 w-4" />
              Inline Code
              <ContextMenuShortcut>{isWindows ? 'Ctrl+E' : '⌘E'}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => handleAction('clearFormatting')}>
              <Type className="mr-2 h-4 w-4" />
              Clear Formatting
              <ContextMenuShortcut>{isWindows ? 'Ctrl+\\' : '⌘\\'}</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Insert */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Sparkles className="mr-2 h-4 w-4" />
            Insert
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuItem onClick={() => handleAction('insertLink')}>
              <Link className="mr-2 h-4 w-4" />
              Link
              <ContextMenuShortcut>{isWindows ? 'Ctrl+K' : '⌘K'}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('insertImage')}>
              <Image className="mr-2 h-4 w-4" />
              Image
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('insertTable')}>
              <Table className="mr-2 h-4 w-4" />
              Table
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('insertCodeBlock')}>
              <FileCode className="mr-2 h-4 w-4" />
              Code Block
              <ContextMenuShortcut>{isWindows ? 'Ctrl+Shift+C' : '⌘⇧C'}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('insertQuote')}>
              <Quote className="mr-2 h-4 w-4" />
              Blockquote
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('insertHorizontalRule')}>
              <SeparatorHorizontal className="mr-2 h-4 w-4" />
              Horizontal Rule
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {/* Copy Block Reference */}
        <ContextMenuItem
          onClick={() => handleAction('copyBlockReference')}
          disabled={!editor}
        >
          <Link className="mr-2 h-4 w-4" />
          Copy block reference
        </ContextMenuItem>

        {/* Headings */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Heading className="mr-2 h-4 w-4" />
            Change to Heading
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuItem onClick={() => handleAction('setHeading', { level: 1 })}>
              <Heading className="mr-2 h-4 w-4" />
              Heading 1
              <ContextMenuShortcut>{isWindows ? 'Ctrl+Alt+1' : '⌘⌥1'}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('setHeading', { level: 2 })}>
              <Heading className="mr-2 h-4 w-4" />
              Heading 2
              <ContextMenuShortcut>{isWindows ? 'Ctrl+Alt+2' : '⌘⌥2'}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('setHeading', { level: 3 })}>
              <Heading className="mr-2 h-4 w-4" />
              Heading 3
              <ContextMenuShortcut>{isWindows ? 'Ctrl+Alt+3' : '⌘⌥3'}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('setHeading', { level: 4 })}>
              <Heading className="mr-2 h-4 w-4" />
              Heading 4
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('setHeading', { level: 5 })}>
              <Heading className="mr-2 h-4 w-4" />
              Heading 5
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('setHeading', { level: 6 })}>
              <Heading className="mr-2 h-4 w-4" />
              Heading 6
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => handleAction('setParagraph')}>
              <Type className="mr-2 h-4 w-4" />
              Normal Text
              <ContextMenuShortcut>{isWindows ? 'Ctrl+Alt+0' : '⌘⌥0'}</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Lists */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <List className="mr-2 h-4 w-4" />
            Lists
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuItem onClick={() => handleAction('toggleBulletList')}>
              <List className="mr-2 h-4 w-4" />
              Bullet List
              <ContextMenuShortcut>{isWindows ? 'Ctrl+Shift+8' : '⌘⇧8'}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('toggleOrderedList')}>
              <ListOrdered className="mr-2 h-4 w-4" />
              Numbered List
              <ContextMenuShortcut>{isWindows ? 'Ctrl+Shift+7' : '⌘⇧7'}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('toggleTaskList')}>
              <CheckSquare className="mr-2 h-4 w-4" />
              Task List
              <ContextMenuShortcut>{isWindows ? 'Ctrl+Shift+9' : '⌘⇧9'}</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {/* Select All */}
        <ContextMenuItem onClick={() => handleAction('selectAll')}>
          <MousePointer2 className="mr-2 h-4 w-4" />
          Select All
          <ContextMenuShortcut>{isWindows ? 'Ctrl+A' : '⌘A'}</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Undo/Redo */}
        <ContextMenuItem
          onClick={() => handleAction('undo')}
          disabled={!canUndo}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Undo
          <ContextMenuShortcut>{isWindows ? 'Ctrl+Z' : '⌘Z'}</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => handleAction('redo')}
          disabled={!canRedo}
        >
          <RotateCw className="mr-2 h-4 w-4" />
          Redo
          <ContextMenuShortcut>{isWindows ? 'Ctrl+Y' : '⌘⇧Z'}</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Find and Replace */}
        <ContextMenuItem onClick={() => handleAction('find')}>
          <Search className="mr-2 h-4 w-4" />
          Find
          <ContextMenuShortcut>{isWindows ? 'Ctrl+F' : '⌘F'}</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={() => handleAction('findAndReplace')}>
          <SearchX className="mr-2 h-4 w-4" />
          Replace
          <ContextMenuShortcut>{isWindows ? 'Ctrl+H' : '⌘⌥F'}</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Command Palette */}
        <ContextMenuItem onClick={() => handleAction('commandPalette')}>
          <Zap className="mr-2 h-4 w-4" />
          Command Palette
          <ContextMenuShortcut>{isWindows ? 'Ctrl+Shift+P' : '⌘⇧P'}</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Export */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Download className="mr-2 h-4 w-4" />
            Export
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuItem onClick={() => handleAction('exportMarkdown')}>
              <FileText className="mr-2 h-4 w-4" />
              Export as Markdown
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('exportHTML')}>
              <FileCode className="mr-2 h-4 w-4" />
              Export as HTML
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('exportPDF')}>
              <FileText className="mr-2 h-4 w-4" />
              Export as PDF
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuItem onClick={() => handleAction('importFile')}>
          <Upload className="mr-2 h-4 w-4" />
          Import File...
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
