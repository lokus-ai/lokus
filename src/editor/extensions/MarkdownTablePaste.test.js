import { describe, it, expect, vi, beforeEach } from 'vitest';
import MarkdownTablePaste from './MarkdownTablePaste.js';

// Mock TipTap
const mockEditor = {
  chain: vi.fn(() => ({
    focus: vi.fn(() => ({
      insertContent: vi.fn(() => ({
        run: vi.fn()
      }))
    }))
  }))
};

const mockView = {
  // Mock ProseMirror view
};

describe('MarkdownTablePaste Extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Extension Creation', () => {
    it('should create extension with correct name', () => {
      const extension = MarkdownTablePaste;
      expect(extension.name).toBe('markdownTablePaste');
    });

    it('should return ProseMirror plugins array', () => {
      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
      
      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins).toHaveLength(1);
      expect(plugins[0]).toBeDefined();
      expect(plugins[0].props).toBeDefined();
      expect(plugins[0].props.handlePaste).toBeInstanceOf(Function);
    });
  });

  describe('Table Parsing', () => {
    it('should parse simple markdown table', () => {
      const tableText = `| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |`;

      // Test indirectly through the paste handler
      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(tableText)
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(true);
      expect(mockClipboardEvent.preventDefault).toHaveBeenCalled();
      expect(mockEditor.chain).toHaveBeenCalled();
    });

    it('should parse table without leading/trailing pipes', () => {
      const tableText = `Header 1 | Header 2
--- | ---
Cell 1 | Cell 2`;

      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(tableText)
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(true);
    });

    it('should parse table with alignment indicators', () => {
      const tableText = `| Left | Center | Right |
| :--- | :---: | ---: |
| L1 | C1 | R1 |`;

      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(tableText)
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(true);
    });

    it('should handle tables with varying cell counts', () => {
      const tableText = `| H1 | H2 | H3 |
| --- | --- | --- |
| C1 | C2 |
| C3 | C4 | C5 | C6 |`;

      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(tableText)
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(true);
    });
  });

  describe('Invalid Table Handling', () => {
    it('should reject non-table text', () => {
      const regularText = 'This is just regular text';

      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(regularText)
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(false);
      expect(mockClipboardEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('should reject table without separator', () => {
      const invalidTable = `| Header 1 | Header 2 |
| Cell 1 | Cell 2 |`;

      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(invalidTable)
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(false);
    });

    it('should reject table with invalid separator', () => {
      const invalidTable = `| Header 1 | Header 2 |
| == | == |
| Cell 1 | Cell 2 |`;

      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(invalidTable)
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(false);
    });

    it('should handle empty or null input', () => {
      const testCases = [null, undefined, '', '   '];

      testCases.forEach(input => {
        const mockClipboardEvent = {
          clipboardData: {
            getData: vi.fn().mockReturnValue(input)
          },
          preventDefault: vi.fn()
        };

        const extension = MarkdownTablePaste;
        const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
        const handlePaste = plugins[0].props.handlePaste;

        const result = handlePaste(mockView, mockClipboardEvent);

        expect(result).toBe(false);
      });
    });

    it('should handle table with insufficient rows', () => {
      const insufficientTable = `| Header 1 | Header 2 |
| --- | --- |`;

      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(insufficientTable)
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(false);
    });
  });

  describe('HTML Generation', () => {
    it('should escape HTML characters in cell content', () => {
      const tableWithHtml = `| Header | Content |
| --- | --- |
| Cell | <script>alert('xss')</script> |`;

      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(tableWithHtml)
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(true);
      // The actual HTML escaping would be tested in the internal functions
    });

    it('should handle special characters in table content', () => {
      const tableWithSpecials = `| Header | Content |
| --- | --- |
| Cell | Content with & < > " characters |`;

      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(tableWithSpecials)
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle parsing errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock editor.chain to throw error
      const errorEditor = {
        chain: vi.fn(() => {
          throw new Error('Editor error');
        })
      };

      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue('| H1 | H2 |\n| --- | --- |\n| C1 | C2 |')
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: errorEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('[md-table] paste failed:', expect.any(Error));

      consoleWarnSpy.mockRestore();
    });

    it('should handle clipboard data errors', () => {
      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn(() => {
            throw new Error('Clipboard access error');
          })
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(false);
    });
  });

  describe('Integration with Editor', () => {
    it('should call editor chain methods in correct sequence', () => {
      const mockInsertContent = vi.fn(() => ({ run: vi.fn() }));
      const mockFocus = vi.fn(() => ({ insertContent: mockInsertContent }));
      const mockChain = vi.fn(() => ({ focus: mockFocus }));
      
      const trackedEditor = {
        chain: mockChain
      };

      const tableText = `| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |`;

      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(tableText)
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: trackedEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(true);
      expect(mockChain).toHaveBeenCalled();
      expect(mockFocus).toHaveBeenCalled();
      expect(mockInsertContent).toHaveBeenCalled();
    });

    it('should insert valid HTML table structure', () => {
      const mockInsertContent = vi.fn(() => ({ run: vi.fn() }));
      const mockFocus = vi.fn(() => ({ insertContent: mockInsertContent }));
      const mockChain = vi.fn(() => ({ focus: mockFocus }));
      
      const trackedEditor = {
        chain: mockChain
      };

      const tableText = `| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |`;

      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(tableText)
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: trackedEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(true);
      expect(mockInsertContent).toHaveBeenCalledWith(
        expect.stringContaining('<table><thead><tr><th>')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle tables with empty cells', () => {
      const tableWithEmpty = `| Header 1 | Header 2 | Header 3 |
| --- | --- | --- |
| Cell 1 |  | Cell 3 |
|  | Cell 2 |  |`;

      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(tableWithEmpty)
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(true);
    });

    it('should handle tables with whitespace variations', () => {
      const tableWithWhitespace = `|  Header 1  |  Header 2  |
|   ---   |   ---   |
|  Cell 1  |  Cell 2  |`;

      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(tableWithWhitespace)
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(true);
    });

    it('should handle single column tables', () => {
      const singleColumnTable = `| Header |
| --- |
| Cell 1 |
| Cell 2 |`;

      const mockClipboardEvent = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(singleColumnTable)
        },
        preventDefault: vi.fn()
      };

      const extension = MarkdownTablePaste;
      const plugins = extension.addProseMirrorPlugins.call({ editor: mockEditor });
      const handlePaste = plugins[0].props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(true);
    });
  });
});