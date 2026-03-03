import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InFileSearch from "./InFileSearch.jsx";

// Mock Lucide React icons
vi.mock("lucide-react", () => ({
  Search: () => <div data-testid="search-icon" />,
  X: () => <div data-testid="x-icon" />,
  ChevronUp: () => <div data-testid="chevron-up-icon" />,
  ChevronDown: () => <div data-testid="chevron-down-icon" />,
  ToggleLeft: () => <div data-testid="toggle-left-icon" />,
  ToggleRight: () => <div data-testid="toggle-right-icon" />,
  Replace: () => <div data-testid="replace-icon" />,
}));

// Mock ProseMirror state — TextSelection.create is called in jumpToMatch
vi.mock("prosemirror-state", () => ({
  TextSelection: {
    create: vi.fn((doc, from, to) => ({ from, to, type: "selection" })),
  },
  Plugin: vi.fn(),
  PluginKey: vi.fn(() => ({
    getState: vi.fn(),
    toString: () => 'search'
  })),
}));

describe("InFileSearch", () => {
  let mockEditor;
  let mockOnClose;
  let user;

  beforeEach(() => {
    user = userEvent.setup();

    mockOnClose = vi.fn();

    // The component calls:
    //   editor.state.doc.textContent          — for the search content
    //   editor.state.tr.setSelection(sel)     — returns the transaction (chainable)
    //   editor.state.tr.scrollIntoView()      — returns the transaction (chainable)
    //   editor.state.tr.replaceWith(...)      — returns the transaction (chainable)
    //   editor.state.schema.text(str)         — creates a text node
    //   editor.dispatch(tr)                   — dispatches the transaction (NOT editor.view.dispatch)
    const mockTr = {
      setMeta: vi.fn().mockReturnThis(),
      setSelection: vi.fn().mockReturnThis(),
      scrollIntoView: vi.fn().mockReturnThis(),
      replaceWith: vi.fn().mockReturnThis(),
    };

    mockEditor = {
      state: {
        doc: {
          textContent: "Hello world this is a test hello again",
        },
        tr: mockTr,
        schema: {
          text: vi.fn((text) => ({ type: "text", text })),
        },
      },
      dispatch: vi.fn(),
    };
  });

  it("should not render when closed", () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={false}
        onClose={mockOnClose}
      />,
    );

    expect(
      screen.queryByPlaceholderText("Find in file..."),
    ).not.toBeInTheDocument();
  });

  it("should render when open", () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    expect(screen.getByPlaceholderText("Find in file...")).toBeInTheDocument();
  });

  it("should auto-focus search input when opened", () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    expect(screen.getByPlaceholderText("Find in file...")).toHaveFocus();
  });

  it("should perform search and dispatch via editor.dispatch when typing", async () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Find in file...");
    await act(async () => {
      await user.type(searchInput, "hello");
    });

    await waitFor(() => {
      // The component uses editor.dispatch(tr), not editor.view.dispatch
      expect(mockEditor.dispatch).toHaveBeenCalled();
    });
  });

  it("should show match count after typing a query", async () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Find in file...");
    await act(async () => {
      await user.type(searchInput, "hello");
    });

    await waitFor(() => {
      expect(screen.getByText(/\d+ of \d+/)).toBeInTheDocument();
    });
  });

  it("should navigate to next match via the Next button", async () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Find in file...");
    await act(async () => {
      await user.type(searchInput, "hello");
    });

    // Wait for the initial search dispatch
    await waitFor(() => {
      expect(mockEditor.dispatch).toHaveBeenCalled();
    });

    mockEditor.dispatch.mockClear();

    const nextButton = screen.getByTitle("Next match (Enter)");
    await act(async () => {
      await user.click(nextButton);
    });

    expect(mockEditor.dispatch).toHaveBeenCalled();
  });

  it("should navigate to previous match via the Prev button", async () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Find in file...");
    await act(async () => {
      await user.type(searchInput, "hello");
    });

    // Wait for the initial search dispatch
    await waitFor(() => {
      expect(mockEditor.dispatch).toHaveBeenCalled();
    });

    mockEditor.dispatch.mockClear();

    const prevButton = screen.getByTitle("Previous match (Shift+Enter)");
    await act(async () => {
      await user.click(prevButton);
    });

    expect(mockEditor.dispatch).toHaveBeenCalled();
  });

  it("should close when close button clicked", async () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    const closeButton = screen.getByTitle("Close (Escape)");
    await act(async () => {
      await user.click(closeButton);
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should close when Escape key pressed", async () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    await act(async () => {
      await user.keyboard("{Escape}");
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should navigate with Enter and Shift+Enter keyboard shortcuts", async () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Find in file...");
    await act(async () => {
      await user.type(searchInput, "hello");
    });

    // Wait for search to complete
    await waitFor(() => {
      expect(mockEditor.dispatch).toHaveBeenCalled();
    });

    mockEditor.dispatch.mockClear();

    // Enter moves to next match
    await act(async () => {
      await user.keyboard("{Enter}");
    });

    expect(mockEditor.dispatch).toHaveBeenCalled();

    mockEditor.dispatch.mockClear();

    // Shift+Enter moves to previous match
    await act(async () => {
      await user.keyboard("{Shift>}{Enter}{/Shift}");
    });
    expect(mockEditor.dispatch).toHaveBeenCalled();
  });

  it("should toggle search options (case sensitive checkbox)", async () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    const caseSensitiveBox = checkboxes[0]; // First checkbox is case sensitive

    await act(async () => {
      await user.click(caseSensitiveBox);
    });

    expect(caseSensitiveBox).toBeChecked();
  });

  it("should show replace interface when toggle replace button is clicked", async () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    const replaceButton = screen.getByTitle("Toggle replace (Ctrl+H)");
    await act(async () => {
      await user.click(replaceButton);
    });

    expect(screen.getByPlaceholderText("Replace with...")).toBeInTheDocument();
    expect(screen.getByText("Replace")).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument();
  });

  it("should perform single replace via editor.dispatch and tr.replaceWith", async () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Find in file...");
    await act(async () => {
      await user.type(searchInput, "hello");
    });

    // Wait for search to complete
    await waitFor(() => {
      expect(mockEditor.dispatch).toHaveBeenCalled();
    });

    mockEditor.dispatch.mockClear();
    mockEditor.state.tr.replaceWith.mockClear();

    // Open replace panel
    const toggleReplaceButton = screen.getByTitle("Toggle replace (Ctrl+H)");
    await act(async () => {
      await user.click(toggleReplaceButton);
    });

    // Type replacement text
    const replaceInput = screen.getByPlaceholderText("Replace with...");
    await act(async () => {
      await user.type(replaceInput, "hi");
    });

    // Click Replace
    const replaceOneButton = screen.getByText("Replace");
    await act(async () => {
      await user.click(replaceOneButton);
    });

    expect(mockEditor.state.tr.replaceWith).toHaveBeenCalled();
    expect(mockEditor.dispatch).toHaveBeenCalled();
  });

  it("should perform replace all via editor.dispatch and tr.replaceWith", async () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Find in file...");
    await act(async () => {
      await user.type(searchInput, "hello");
    });

    // Wait for search to complete
    await waitFor(() => {
      expect(mockEditor.dispatch).toHaveBeenCalled();
    });

    mockEditor.dispatch.mockClear();
    mockEditor.state.tr.replaceWith.mockClear();

    // Open replace panel
    const toggleReplaceButton = screen.getByTitle("Toggle replace (Ctrl+H)");
    await act(async () => {
      await user.click(toggleReplaceButton);
    });

    // Type replacement text
    const replaceInput = screen.getByPlaceholderText("Replace with...");
    await act(async () => {
      await user.type(replaceInput, "hi");
    });

    // Click Replace All
    const replaceAllButton = screen.getByText("All");
    await act(async () => {
      await user.click(replaceAllButton);
    });

    expect(mockEditor.state.tr.replaceWith).toHaveBeenCalled();
    expect(mockEditor.dispatch).toHaveBeenCalled();
  });

  it("should handle regex search option", async () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    // Enable regex mode
    const regexLabel = screen.getByTitle("Regular expression");
    await act(async () => {
      await user.click(regexLabel);
    });

    const searchInput = screen.getByPlaceholderText("Find in file...");
    await act(async () => {
      await user.type(searchInput, "h.llo");
    });

    await waitFor(() => {
      expect(mockEditor.dispatch).toHaveBeenCalled();
    });
  });

  it("should handle whole word search option", async () => {
    render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    // Enable whole word mode
    const wholeWordLabel = screen.getByTitle("Whole word");
    await act(async () => {
      await user.click(wholeWordLabel);
    });

    const searchInput = screen.getByPlaceholderText("Find in file...");
    await act(async () => {
      await user.type(searchInput, "hello");
    });

    await waitFor(() => {
      expect(mockEditor.dispatch).toHaveBeenCalled();
    });
  });

  it("should not render search panel when isVisible toggles to false", async () => {
    const { rerender } = render(
      <InFileSearch
        editor={mockEditor}
        isVisible={true}
        onClose={mockOnClose}
      />,
    );

    expect(screen.getByPlaceholderText("Find in file...")).toBeInTheDocument();

    rerender(
      <InFileSearch
        editor={mockEditor}
        isVisible={false}
        onClose={mockOnClose}
      />,
    );

    expect(
      screen.queryByPlaceholderText("Find in file..."),
    ).not.toBeInTheDocument();
  });
});
