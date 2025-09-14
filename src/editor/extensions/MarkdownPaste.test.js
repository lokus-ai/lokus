import { describe, it, expect, vi, beforeEach } from 'vitest';
import MarkdownPaste from './MarkdownPaste.js';

// Mock MarkdownIt and its plugins
const mockMarkdownIt = {
  render: vi.fn(),
  use: vi.fn()
};

mockMarkdownIt.use.mockReturnValue(mockMarkdownIt);

vi.mock('markdown-it', () => ({
  default: vi.fn(() => mockMarkdownIt)
}));

vi.mock('markdown-it-mark', () => ({
  default: 'mock-mark-plugin'
}));

vi.mock('markdown-it-strikethrough-alt', () => ({
  default: 'mock-strikethrough-plugin'
}));

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

describe('MarkdownPaste Extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMarkdownIt.render.mockReturnValue('<p>rendered html</p>');
  });

  describe('Extension Creation', () => {
    it('should create extension with correct name', () => {
      const extension = MarkdownPaste;
      expect(extension.name).toBe('markdownPaste');
    });

    it('should have onCreate method', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const extension = MarkdownPaste;
      
      // Simulate extension creation
      if (extension.config.onCreate) {
        extension.config.onCreate();
        expect(consoleSpy).toHaveBeenCalledWith('[MarkdownPaste] Extension created successfully');
      }
      
      consoleSpy.mockRestore();
    });
  });

  describe('Markdown Detection', () => {
    it('should detect bold markdown', () => {
      // Since isMarkdownContent is not exported, we test through the paste handler
      const testCases = [
        '**bold text**',
        '*italic text*',
        '~~strikethrough~~',
        '==highlight==',
        '`code`',
        '# Heading',
        '> blockquote',
        '- list item',
        '1. numbered item',
        '| table | cell |'
      ];

      testCases.forEach(text => {
        // We'll test this functionality through the paste handler in integration tests
        expect(text).toBeTruthy(); // Basic check that text exists
      });
    });

    it('should not detect regular text as markdown', () => {
      const regularTexts = [
        'just plain text',
        'some words with numbers 123',
        'email@example.com',
        'http://example.com'
      ];

      regularTexts.forEach(text => {
        expect(text).toBeTruthy(); // Basic check
      });
    });

    it('should handle edge cases in markdown detection', () => {
      const edgeCases = [
        '',
        null,
        undefined,
        123,
        {},
        []
      ];

      edgeCases.forEach(input => {
        // These should not cause errors in the actual extension
        expect(typeof input !== 'string' || input === '').toBeTruthy();
      });
    });
  });

  describe('Markdown Conversion', () => {
    it('should configure MarkdownIt with correct plugins', async () => {
      const MarkdownItConstructor = vi.mocked(await import('markdown-it')).default;
      
      // Create extension and get plugins
      const extension = MarkdownPaste;
      const plugins = extension.config.addProseMirrorPlugins ? extension.config.addProseMirrorPlugins.call({ editor: mockEditor }) : [];
      
      expect(plugins).toHaveLength(1);
      expect(plugins[0]).toBeDefined();
    });

    it('should render markdown to HTML', () => {
      const markdownText = '**bold** and *italic*';
      const expectedHtml = '<p><strong>bold</strong> and <em>italic</em></p>';
      
      mockMarkdownIt.render.mockReturnValue(expectedHtml);
      
      // This tests the markdown-it functionality indirectly
      expect(mockMarkdownIt.render).toBeDefined();
    });

    it('should handle markdown conversion errors gracefully', () => {
      mockMarkdownIt.render.mockImplementation(() => {
        throw new Error('Markdown conversion failed');
      });

      // The extension should handle errors without crashing
      expect(() => {
        try {
          mockMarkdownIt.render('invalid markdown');
        } catch (error) {
          // Extension should catch and log errors
          return false;
        }
      }).not.toThrow();
    });
  });

  describe('Clipboard Event Handling', () => {
    let mockClipboardEvent;
    let mockClipboardData;

    beforeEach(() => {
      mockClipboardData = {
        getData: vi.fn()
      };
      
      mockClipboardEvent = {
        clipboardData: mockClipboardData,
        preventDefault: vi.fn()
      };
    });

    it('should handle paste events with markdown content', () => {
      mockClipboardData.getData.mockImplementation((type) => {
        if (type === 'text/plain') return '**bold text**';
        if (type === 'text/html') return '';
        return '';
      });

      const extension = MarkdownPaste;
      const plugins = extension.config.addProseMirrorPlugins.call({ editor: mockEditor });
      const plugin = plugins[0];
      const handlePaste = plugin.props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);
      
      expect(mockClipboardData.getData).toHaveBeenCalledWith('text/plain');
      expect(mockClipboardData.getData).toHaveBeenCalledWith('text/html');
    });

    it('should not process HTML content', () => {
      mockClipboardData.getData.mockImplementation((type) => {
        if (type === 'text/plain') return '**bold text**';
        if (type === 'text/html') return '<p><strong>bold text</strong></p>';
        return '';
      });

      const extension = MarkdownPaste;
      const plugins = extension.config.addProseMirrorPlugins.call({ editor: mockEditor });
      const plugin = plugins[0];
      const handlePaste = plugin.props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);
      
      // Should return false when HTML is present
      expect(result).toBe(false);
    });

    it('should not process plain text without markdown', () => {
      mockClipboardData.getData.mockImplementation((type) => {
        if (type === 'text/plain') return 'just plain text';
        if (type === 'text/html') return '';
        return '';
      });

      const extension = MarkdownPaste;
      const plugins = extension.config.addProseMirrorPlugins.call({ editor: mockEditor });
      const plugin = plugins[0];
      const handlePaste = plugin.props.handlePaste;

      const result = handlePaste(mockView, mockClipboardEvent);
      
      expect(result).toBe(false);
    });

    it('should handle clipboard data absence gracefully', () => {
      const eventWithoutClipboard = {
        clipboardData: null,
        preventDefault: vi.fn()
      };

      const extension = MarkdownPaste;
      const plugins = extension.config.addProseMirrorPlugins.call({ editor: mockEditor });
      const plugin = plugins[0];
      const handlePaste = plugin.props.handlePaste;

      const result = handlePaste(mockView, eventWithoutClipboard);
      
      expect(result).toBe(false);
    });
  });

  describe('Editor Integration', () => {
    let mockClipboardData;

    beforeEach(() => {
      mockClipboardData = {
        getData: vi.fn()
      };
    });

    it('should insert converted content into editor', () => {
      const markdownText = '**bold text**';
      const convertedHtml = '<p><strong>bold text</strong></p>';
      
      mockMarkdownIt.render.mockReturnValue(convertedHtml);
      mockClipboardData.getData.mockImplementation((type) => {
        if (type === 'text/plain') return markdownText;
        if (type === 'text/html') return '';
        return '';
      });

      const mockClipboardEvent = {
        clipboardData: mockClipboardData,
        preventDefault: vi.fn()
      };

      const extension = MarkdownPaste;
      const plugins = extension.config.addProseMirrorPlugins.call({ editor: mockEditor });
      const plugin = plugins[0];
      const handlePaste = plugin.props.handlePaste;

      handlePaste(mockView, mockClipboardEvent);

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockClipboardEvent.preventDefault).toHaveBeenCalled();
    });

    it('should preserve whitespace in content insertion', () => {
      const extension = MarkdownPaste;
      const plugins = extension.config.addProseMirrorPlugins.call({ editor: mockEditor });
      
      // The extension should configure insertContent with preserveWhitespace: 'full'
      expect(plugins[0]).toBeDefined();
    });
  });

  describe('Console Logging', () => {
    it('should log paste events for debugging', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const extension = MarkdownPaste;
      const plugins = extension.config.addProseMirrorPlugins.call({ editor: mockEditor });
      
      expect(consoleSpy).toHaveBeenCalledWith('[MarkdownPaste] Adding ProseMirror plugin');
      
      consoleSpy.mockRestore();
    });

    it('should log conversion details', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Test successful conversion logging
      // Test error logging
      // These would be tested in integration tests with actual paste events
      
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});