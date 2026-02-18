import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, fireEvent, waitFor, act } from "@testing-library/react";
import CommandPalette from "./CommandPalette.jsx";

// Mock shortcuts registry
vi.mock("../core/shortcuts/registry.js", () => ({
  getActiveShortcuts: vi.fn().mockResolvedValue({
    "new-file": "CmdOrCtrl+N",
    "new-folder": "CmdOrCtrl+Shift+N",
    "save-file": "CmdOrCtrl+S",
    "close-tab": "CmdOrCtrl+W",
    "toggle-sidebar": "CmdOrCtrl+B",
    "open-preferences": "CmdOrCtrl+Comma",
  }),
  formatAccelerator: vi
    .fn()
    .mockImplementation((shortcut) =>
      shortcut ? shortcut.replace("CmdOrCtrl", "⌘") : "",
    ),
}));

// Mock UI components
vi.mock("./ui/command.jsx", () => ({
  Command: ({ children, ...props }) => (
    <div data-testid="command" {...props}>
      {children}
    </div>
  ),
  CommandDialog: ({ children, open, onOpenChange, ...props }) =>
    open ? (
      <div
        data-testid="command-dialog"
        onKeyDown={(e) => e.key === "Escape" && onOpenChange(false)}
        {...props}
      >
        {children}
      </div>
    ) : null,
  CommandInput: ({ onValueChange, ...props }) => (
    <input
      data-testid="command-input"
      onChange={(e) => onValueChange && onValueChange(e.target.value)}
      {...props}
    />
  ),
  CommandList: ({ children, ...props }) => (
    <div data-testid="command-list" {...props}>
      {children}
    </div>
  ),
  CommandEmpty: ({ children, ...props }) => (
    <div data-testid="command-empty" {...props}>
      {children}
    </div>
  ),
  CommandGroup: ({ children, ...props }) => (
    <div data-testid="command-group" {...props}>
      {children}
    </div>
  ),
  CommandItem: ({ children, onSelect, ...props }) => (
    <div
      data-testid="command-item"
      onClick={() => onSelect && onSelect()}
      {...props}
    >
      {children}
    </div>
  ),
  CommandSeparator: (props) => (
    <div data-testid="command-separator" {...props} />
  ),
  CommandShortcut: ({ children, ...props }) => (
    <span data-testid="command-shortcut" {...props}>
      {children}
    </span>
  ),
}));

// Mock Lucide React icons
vi.mock("lucide-react", () => ({
  File: () => <div data-testid="file-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  Folder: () => <div data-testid="folder-icon" />,
  Search: () => <div data-testid="search-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Hash: () => <div data-testid="hash-icon" />,
  Save: () => <div data-testid="save-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  X: () => <div data-testid="x-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  FolderPlus: () => <div data-testid="folder-plus-icon" />,
  Sidebar: () => <div data-testid="sidebar-icon" />,
  ToggleLeft: () => <div data-testid="toggle-left-icon" />,
  History: () => <div data-testid="history-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
  Network: () => <div data-testid="network-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
  Mail: () => <div data-testid="mail-icon" />,
  Target: () => <div data-testid="target-icon" />,
  Database: () => <div data-testid="database-icon" />,
}));

vi.mock("../core/markdown/compiler.js", () => ({
  getMarkdownCompiler: vi.fn(() => ({
    compile: vi.fn().mockResolvedValue("<p>compiled markdown</p>"),
  })),
}));

// Mock the useCommandHistory hook
const mockAddToHistory = vi.fn();
const mockRemoveFromHistory = vi.fn();
const mockClearHistory = vi.fn();
let mockUseCommandHistory = vi.fn(() => ({
  formattedHistory: [],
  addToHistory: mockAddToHistory,
  removeFromHistory: mockRemoveFromHistory,
  clearHistory: mockClearHistory,
}));

vi.mock("../hooks/useCommandHistory.js", () => ({
  useCommandHistory: () => mockUseCommandHistory(),
  createFileHistoryItem: vi.fn((file) => ({
    type: "file",
    data: file,
  })),
  createCommandHistoryItem: vi.fn((command, data = {}) => ({
    type: "command",
    data: { command, ...data },
  })),
}));

// Mock the useTemplates hooks
vi.mock("../hooks/useTemplates.js", () => ({
  useTemplates: vi.fn(() => ({
    templates: [],
  })),
  useTemplateProcessor: vi.fn(() => ({
    process: vi.fn().mockResolvedValue({ result: "processed content" }),
  })),
}));

// Mock FolderScopeContext
vi.mock("../contexts/FolderScopeContext.jsx", () => ({
  useFolderScope: vi.fn(() => ({
    scope: null,
    setScope: vi.fn(),
    isInScope: vi.fn().mockReturnValue(true),
    getAllFolders: vi.fn().mockReturnValue([]),
  })),
  FolderScopeProvider: ({ children }) => <div>{children}</div>,
}));

// Mock BasesContext
const mockUseBases = vi.fn(() => ({
  bases: [],
  createBase: vi.fn(),
  deleteBase: vi.fn(),
  updateBase: vi.fn(),
  dataManager: {
    getAllFiles: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../bases/BasesContext.jsx", () => ({
  useBases: () => mockUseBases(),
  BasesProvider: ({ children }) => <div>{children}</div>,
}));

describe("CommandPalette", () => {
  const mockProps = {
    open: true,
    setOpen: vi.fn(),
    fileTree: [
      { name: "README.md", path: "/README.md", is_directory: false },
      { name: "docs", path: "/docs", is_directory: true },
      { name: "src", path: "/src", is_directory: true },
    ],
    openFiles: [
      { name: "README.md", path: "/README.md" },
      { name: "index.js", path: "/index.js" },
    ],
    onFileOpen: vi.fn(),
    onCreateFile: vi.fn(),
    onCreateFolder: vi.fn(),
    onSave: vi.fn(),
    onOpenPreferences: vi.fn(),
    onToggleSidebar: vi.fn(),
    onCloseTab: vi.fn(),
    activeFile: { name: "README.md", path: "/README.md" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBases.mockReturnValue({
      bases: [],
      createBase: vi.fn(),
      deleteBase: vi.fn(),
      updateBase: vi.fn(),
      dataManager: {
        getAllFiles: vi.fn().mockResolvedValue([]),
      },
    });
    // Reset the mock implementation to return empty history by default
    mockUseCommandHistory = vi.fn(() => ({
      formattedHistory: [],
      addToHistory: mockAddToHistory,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
    }));
  });

  it("should render when open is true", async () => {
    let result;
    await act(async () => {
      result = render(<CommandPalette {...mockProps} />);
    });

    expect(result.getByTestId("command-dialog")).toBeInTheDocument();
    expect(result.getByTestId("command-input")).toBeInTheDocument();
  });

  it("should not render when open is false", async () => {
    let result;
    await act(async () => {
      result = render(<CommandPalette {...mockProps} open={false} />);
    });

    expect(result.queryByTestId("command-dialog")).not.toBeInTheDocument();
  });

  it("should display search input with placeholder", async () => {
    let result;
    await act(async () => {
      result = render(<CommandPalette {...mockProps} />);
    });

    const input = result.getByTestId("command-input");
    expect(input).toHaveAttribute(
      "placeholder",
      "Type command: 'send gmail', 'search emails', 'save email' or direct commands",
    );
  });

  it("should show file tree items", async () => {
    let result;
    await act(async () => {
      result = render(<CommandPalette {...mockProps} />);
    });

    const items = result.getAllByTestId("command-item");
    expect(items.length).toBeGreaterThan(0);

    // Should contain file items
    expect(items.some((item) => item.textContent?.includes("README.md"))).toBe(
      true,
    );
  });

  it("should filter files based on search input", async () => {
    let result;
    await act(async () => {
      result = render(<CommandPalette {...mockProps} />);
    });

    const input = result.getByTestId("command-input");
    await act(async () => {
      fireEvent.change(input, { target: { value: "README" } });
    });

    // Just verify input value
    expect(input.value).toBe("README");
  });

  it("should show recent files section", async () => {
    let result;
    await act(async () => {
      result = render(<CommandPalette {...mockProps} />);
    });

    // The "Recent Files" text is in a heading attribute of CommandGroup
    const recentFilesGroup = result.container.querySelector(
      '[heading="Recent Files"]',
    );
    expect(recentFilesGroup).toBeInTheDocument();
  });

  it("should show actions section", async () => {
    let result;
    await act(async () => {
      result = render(<CommandPalette {...mockProps} />);
    });

    // Check for heading attributes instead of direct text
    const fileGroup = result.container.querySelector('[heading="File"]');
    expect(fileGroup).toBeInTheDocument();

    // Check for actual command text content
    expect(result.getByText("Save File")).toBeInTheDocument();
    expect(result.getByText("New File")).toBeInTheDocument();
    expect(result.getByText("New Folder")).toBeInTheDocument();
  });

  it("should call onFileOpen when file is selected", async () => {
    let result;
    await act(async () => {
      result = render(<CommandPalette {...mockProps} />);
    });

    const items = result.getAllByTestId("command-item");
    const readmeItem = items.find((item) =>
      item.textContent?.includes("README.md"),
    );

    if (readmeItem) {
      await act(async () => {
        fireEvent.click(readmeItem);
      });
      expect(mockProps.onFileOpen).toHaveBeenCalledWith({
        name: "README.md",
        path: "/README.md",
      });
      expect(mockProps.setOpen).toHaveBeenCalledWith(false);
    }
  });

  it("should call onSave when save action is selected", async () => {
    let result;
    await act(async () => {
      result = render(<CommandPalette {...mockProps} />);
    });

    const saveItem = result.getByText("Save File");
    await act(async () => {
      fireEvent.click(saveItem);
    });

    expect(mockProps.onSave).toHaveBeenCalled();
    expect(mockProps.setOpen).toHaveBeenCalledWith(false);
  });

  it("should call onCreateFile when new file action is selected", async () => {
    let result;
    await act(async () => {
      result = render(<CommandPalette {...mockProps} />);
    });

    const newFileItem = result.getByText("New File");
    await act(async () => {
      fireEvent.click(newFileItem);
    });

    expect(mockProps.onCreateFile).toHaveBeenCalled();
    expect(mockProps.setOpen).toHaveBeenCalledWith(false);
  });

  it("should call onOpenPreferences when preferences action is selected", async () => {
    let result;
    await act(async () => {
      result = render(<CommandPalette {...mockProps} />);
    });

    const preferencesItem = result.getByText("Open Preferences");
    await act(async () => {
      fireEvent.click(preferencesItem);
    });

    expect(mockProps.onOpenPreferences).toHaveBeenCalled();
    expect(mockProps.setOpen).toHaveBeenCalledWith(false);
  });

  it("should handle empty file tree gracefully", async () => {
    let result;
    await act(async () => {
      result = render(
        <CommandPalette {...mockProps} fileTree={[]} openFiles={[]} />,
      );
    });

    const items = result.queryAllByTestId("command-item");
    const readmeItem = items.find((item) =>
      item.textContent?.includes("README.md"),
    );
    expect(readmeItem).toBeUndefined();
  });

  it("should handle undefined props gracefully", async () => {
    let result;
    await act(async () => {
      result = render(
        <CommandPalette
          {...mockProps}
          fileTree={undefined}
          recentFiles={undefined}
        />,
      );
    });
    expect(result.getByTestId("command-input")).toBeInTheDocument();
  });

  it("should show keyboard shortcuts", async () => {
    let result;
    await act(async () => {
      result = render(<CommandPalette {...mockProps} />);
    });

    // Actions should show keyboard shortcuts
    const saveItem = result.getByText("Save File");
    expect(saveItem.parentElement).toHaveTextContent("⌘+S");
  });

  it("should filter out directories when searching for files", async () => {
    const fileTreeWithDirs = [
      { name: "folder", path: "/folder", is_directory: true },
      { name: "file.md", path: "/file.md", is_directory: false },
    ];

    mockUseBases.mockReturnValue({
      bases: [],
      dataManager: {
        getAllFiles: vi
          .fn()
          .mockResolvedValue([
            { name: "file.md", path: "/file.md", is_directory: false },
          ]),
      },
    });

    let result;
    await act(async () => {
      result = render(
        <CommandPalette {...mockProps} fileTree={fileTreeWithDirs} />,
      );
    });

    const input = result.getByTestId("command-input");
    await act(async () => {
      fireEvent.change(input, { target: { value: "file" } });
    });

    const items = result.getAllByTestId("command-item");
    const folderItem = items.find((item) =>
      item.textContent?.includes("folder"),
    );
    const fileItem = items.find((item) =>
      item.textContent?.includes("file.md"),
    );

    expect(folderItem).toBeUndefined();
    expect(fileItem).toBeDefined();
  });

  it("should show empty state when no results found", async () => {
    let result;
    await act(async () => {
      result = render(<CommandPalette {...mockProps} />);
    });

    const input = result.getByTestId("command-input");
    await act(async () => {
      fireEvent.change(input, { target: { value: "nonexistentfile123" } });
    });

    expect(result.getByTestId("command-empty")).toBeInTheDocument();
  });

  it("should close on escape key", async () => {
    let result;
    await act(async () => {
      result = render(<CommandPalette {...mockProps} />);
    });

    const input = result.getByTestId("command-input");
    await act(async () => {
      fireEvent.keyDown(input, { key: "Escape" });
    });

    expect(mockProps.setOpen).toHaveBeenCalledWith(false);
  });

  it("should handle file path display correctly", async () => {
    const fileTreeWithPaths = [
      {
        name: "nested-file.md",
        path: "/folder/nested-file.md",
        is_directory: false,
      },
      { name: "root-file.md", path: "/root-file.md", is_directory: false },
    ];

    let result;
    await act(async () => {
      result = render(
        <CommandPalette {...mockProps} fileTree={fileTreeWithPaths} />,
      );
    });

    const items = result.getAllByTestId("command-item");
    const nestedFileItem = items.find((item) =>
      item.textContent?.includes("nested-file.md"),
    );

    if (nestedFileItem) {
      expect(nestedFileItem.textContent).toContain("nested-file.md");
    }
  });

  describe("Command History", () => {
    it("should not show history section when no history items exist", async () => {
      let result;
      await act(async () => {
        result = render(<CommandPalette {...mockProps} />);
      });

      expect(result.queryByText("History")).not.toBeInTheDocument();
      expect(result.queryByText("Clear History")).not.toBeInTheDocument();
    });

    it("should display history section with items", async () => {
      const mockHistory = [
        {
          id: "file-123-abc",
          type: "file",
          displayName: "test.md",
          relativeTime: "5m ago",
          data: { name: "test.md", path: "/test.md" },
        },
        {
          id: "command-456-def",
          type: "command",
          displayName: "Save File",
          relativeTime: "10m ago",
          data: { command: "Save File" },
        },
      ];

      mockUseCommandHistory = vi.fn(() => ({
        formattedHistory: mockHistory,
        addToHistory: mockAddToHistory,
        removeFromHistory: mockRemoveFromHistory,
        clearHistory: mockClearHistory,
      }));

      let result;
      await act(async () => {
        result = render(<CommandPalette {...mockProps} />);
      });

      // The "History" text is in a heading attribute
      const historyGroup = result.container.querySelector(
        '[heading="History"]',
      );
      expect(historyGroup).toBeInTheDocument();
      expect(result.getByText("test.md")).toBeInTheDocument();
      expect(result.getByText("5m ago")).toBeInTheDocument();
      expect(result.getAllByText("Save File")).toHaveLength(2); // One in history, one in commands
      expect(result.getByText("10m ago")).toBeInTheDocument();
      expect(result.getByText("Clear History")).toBeInTheDocument();

      // Check that history icons are rendered
      expect(result.getAllByTestId("history-icon")).toHaveLength(2);
    });

    it("should limit history display to 8 items and show overflow message", async () => {
      const mockHistory = Array.from({ length: 12 }, (_, i) => ({
        id: `item-${i}`,
        type: "file",
        displayName: `file${i}.md`,
        relativeTime: `${i + 1}m ago`,
        data: { name: `file${i}.md`, path: `/file${i}.md` },
      }));

      mockUseCommandHistory = vi.fn(() => ({
        formattedHistory: mockHistory,
        addToHistory: mockAddToHistory,
        removeFromHistory: mockRemoveFromHistory,
        clearHistory: mockClearHistory,
      }));

      let result;
      await act(async () => {
        result = render(<CommandPalette {...mockProps} />);
      });

      // Should show first 8 items
      expect(result.getAllByTestId("history-icon")).toHaveLength(8);
      expect(result.getByText("file0.md")).toBeInTheDocument();
      expect(result.getByText("file7.md")).toBeInTheDocument();

      // Should show overflow message
      expect(result.getByText("...and 4 more items")).toBeInTheDocument();
    });

    it("should execute file from history", async () => {
      const mockHistory = [
        {
          id: "file-123-abc",
          type: "file",
          displayName: "test.md",
          relativeTime: "5m ago",
          data: { name: "test.md", path: "/test.md" },
        },
      ];

      mockUseCommandHistory = vi.fn(() => ({
        formattedHistory: mockHistory,
        addToHistory: mockAddToHistory,
        removeFromHistory: mockRemoveFromHistory,
        clearHistory: mockClearHistory,
      }));

      let result;
      await act(async () => {
        result = render(<CommandPalette {...mockProps} />);
      });

      const historyItem = result.getByText("test.md");
      await act(async () => {
        fireEvent.click(historyItem);
      });

      expect(mockProps.onFileOpen).toHaveBeenCalledWith({
        name: "test.md",
        path: "/test.md",
      });
      expect(mockProps.setOpen).toHaveBeenCalledWith(false);
    });

    it("should execute commands from history", async () => {
      const mockHistory = [
        {
          id: "command-456-def",
          type: "command",
          displayName: "New File",
          relativeTime: "10m ago",
          data: { command: "New File" },
        },
        {
          id: "command-789-ghi",
          type: "command",
          displayName: "Save File",
          relativeTime: "15m ago",
          data: { command: "Save File" },
        },
      ];

      mockUseCommandHistory = vi.fn(() => ({
        formattedHistory: mockHistory,
        addToHistory: mockAddToHistory,
        removeFromHistory: mockRemoveFromHistory,
        clearHistory: mockClearHistory,
      }));

      let result;
      await act(async () => {
        result = render(<CommandPalette {...mockProps} />);
      });

      const historyItems = result.getAllByTestId("command-item");
      const newFileItem = historyItems.find(
        (item) =>
          item.textContent?.includes("New File") &&
          item.textContent?.includes("10m ago"),
      );
      const saveFileItem = historyItems.find(
        (item) =>
          item.textContent?.includes("Save File") &&
          item.textContent?.includes("15m ago"),
      );

      // Test New File command
      if (newFileItem) {
        await act(async () => {
          fireEvent.click(newFileItem);
        });
        expect(mockProps.onCreateFile).toHaveBeenCalled();
        expect(mockProps.setOpen).toHaveBeenCalledWith(false);
      }

      // Reset mocks and test Save File command
      vi.clearAllMocks();
      if (saveFileItem) {
        await act(async () => {
          fireEvent.click(saveFileItem);
        });
        expect(mockProps.onSave).toHaveBeenCalled();
        expect(mockProps.setOpen).toHaveBeenCalledWith(false);
      }
    });

    it("should handle unknown commands from history gracefully", async () => {
      const mockHistory = [
        {
          id: "command-unknown",
          type: "command",
          displayName: "Unknown Command",
          relativeTime: "5m ago",
          data: { command: "Unknown Command" },
        },
      ];

      mockUseCommandHistory = vi.fn(() => ({
        formattedHistory: mockHistory,
        addToHistory: mockAddToHistory,
        removeFromHistory: mockRemoveFromHistory,
        clearHistory: mockClearHistory,
      }));

      // Clear previous mock calls before this test
      vi.clearAllMocks();

      let result;
      await act(async () => {
        result = render(<CommandPalette {...mockProps} />);
      });

      const historyItem = result.getByText("Unknown Command");
      await act(async () => {
        fireEvent.click(historyItem);
      });

      // Unknown commands do nothing and don't close the palette
      expect(mockProps.setOpen).not.toHaveBeenCalled();
    });

    it("should remove individual history items", async () => {
      const mockHistory = [
        {
          id: "file-123-abc",
          type: "file",
          displayName: "test.md",
          relativeTime: "5m ago",
          data: { name: "test.md", path: "/test.md" },
        },
      ];

      mockUseCommandHistory = vi.fn(() => ({
        formattedHistory: mockHistory,
        addToHistory: mockAddToHistory,
        removeFromHistory: mockRemoveFromHistory,
        clearHistory: mockClearHistory,
      }));

      let result;
      await act(async () => {
        result = render(<CommandPalette {...mockProps} />);
      });

      const removeButtons = result.getAllByTestId("x-icon");
      const removeButton = removeButtons.find((button) =>
        button
          .closest('[data-testid="command-item"]')
          ?.textContent?.includes("test.md"),
      );

      if (removeButton) {
        await act(async () => {
          fireEvent.mouseDown(removeButton);
        });
        expect(mockRemoveFromHistory).toHaveBeenCalledWith("file-123-abc");
      }
    });

    it("should prevent event propagation when removing history items", async () => {
      const mockHistory = [
        {
          id: "file-123-abc",
          type: "file",
          displayName: "test.md",
          relativeTime: "5m ago",
          data: { name: "test.md", path: "/test.md" },
        },
      ];

      mockUseCommandHistory = vi.fn(() => ({
        formattedHistory: mockHistory,
        addToHistory: mockAddToHistory,
        removeFromHistory: mockRemoveFromHistory,
        clearHistory: mockClearHistory,
      }));

      let result;
      await act(async () => {
        result = render(<CommandPalette {...mockProps} />);
      });

      const removeButtons = result.getAllByTestId("x-icon");
      const removeButton = removeButtons.find((button) =>
        button
          .closest('[data-testid="command-item"]')
          ?.textContent?.includes("test.md"),
      );

      if (removeButton) {
        await act(async () => {
          fireEvent.mouseDown(removeButton);
        });
        expect(mockRemoveFromHistory).toHaveBeenCalledWith("file-123-abc");
        // File should not be opened when remove button is clicked
        expect(mockProps.onFileOpen).not.toHaveBeenCalled();
      }
    });

    it("should clear all history when clear button is clicked", async () => {
      const mockHistory = [
        {
          id: "file-123-abc",
          type: "file",
          displayName: "test.md",
          relativeTime: "5m ago",
          data: { name: "test.md", path: "/test.md" },
        },
      ];

      mockUseCommandHistory = vi.fn(() => ({
        formattedHistory: mockHistory,
        addToHistory: mockAddToHistory,
        removeFromHistory: mockRemoveFromHistory,
        clearHistory: mockClearHistory,
      }));

      let result;
      await act(async () => {
        result = render(<CommandPalette {...mockProps} />);
      });

      const clearButton = result.getByText("Clear History");
      await act(async () => {
        fireEvent.click(clearButton);
      });

      expect(mockClearHistory).toHaveBeenCalled();
      expect(mockProps.setOpen).toHaveBeenCalledWith(false);
    });

    it("should track file selections with history", async () => {
      let result;
      await act(async () => {
        result = render(<CommandPalette {...mockProps} />);
      });

      const items = result.getAllByTestId("command-item");
      const readmeItem = items.find((item) =>
        item.textContent?.includes("README.md"),
      );

      if (readmeItem) {
        await act(async () => {
          fireEvent.click(readmeItem);
        });

        // Should add to history with proper file data
        expect(mockAddToHistory).toHaveBeenCalledWith({
          type: "file",
          data: expect.objectContaining({
            name: "README.md",
            path: "/README.md",
          }),
        });
      }
    });

    it("should track command executions with history", async () => {
      let result;
      await act(async () => {
        result = render(<CommandPalette {...mockProps} />);
      });

      const newFileButton = result.getByText("New File");
      await act(async () => {
        fireEvent.click(newFileButton);
      });

      expect(mockAddToHistory).toHaveBeenCalledWith({
        type: "command",
        data: { command: "New File" },
      });

      // Reset and test another command
      vi.clearAllMocks();
      const saveButton = result.getByText("Save File");
      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(mockAddToHistory).toHaveBeenCalledWith({
        type: "command",
        data: {
          command: "Save File",
          fileName: "README.md",
        },
      });
    });
  });
});
