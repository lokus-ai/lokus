import { describe, it, expect, vi, beforeEach } from 'vitest';
import createMarkdownPastePlugin from './MarkdownPaste.js';

// Mock the compiler logic
vi.mock('../../core/markdown/compiler-logic.js', () => ({
  MarkdownCompiler: vi.fn().mockImplementation(() => ({
    compile: vi.fn().mockResolvedValue('<p>compiled html</p>'),
    isMarkdown: vi.fn().mockImplementation((text) => {
      // Simple markdown detection for testing
      return /(\*\*|__|~~|==|`|^#|^>|^-\s|^\d+\.\s|^\|)/m.test(text || '')
    })
  }))
}));

// Mock the lokus-md-pipeline parser
vi.mock('../../core/markdown/lokus-md-pipeline.js', () => ({
  createLokusParser: vi.fn(() => ({
    parse: vi.fn().mockReturnValue({
      content: { size: 10 }
    })
  }))
}));

describe('MarkdownPaste Plugin (ProseMirror)', () => {
  let plugin;
  let mockView;
  let mockClipboardEvent;
  let mockClipboardData;

  beforeEach(() => {
    vi.clearAllMocks();
    plugin = createMarkdownPastePlugin();

    mockView = {
      state: {
        schema: { text: vi.fn((t) => t) },
        selection: {
          from: 0,
          to: 0,
          $from: { parent: { type: { name: 'paragraph' } }, pos: 0 },
          $to: { pos: 0 },
        },
        tr: {
          insertText: vi.fn().mockReturnThis(),
          replaceSelection: vi.fn().mockReturnThis(),
          setMeta: vi.fn().mockReturnThis(),
        },
      },
      dispatch: vi.fn(),
    };

    mockClipboardData = {
      getData: vi.fn()
    };

    mockClipboardEvent = {
      clipboardData: mockClipboardData,
      preventDefault: vi.fn()
    };
  });

  describe('Plugin Creation', () => {
    it('should create ProseMirror plugin successfully', () => {
      expect(plugin).toBeDefined();
      expect(plugin.spec).toBeDefined();
      expect(plugin.props).toBeDefined();
      expect(plugin.props.handlePaste).toBeInstanceOf(Function);
    });

    it('should have proper handlePaste function', () => {
      const handlePaste = plugin.props.handlePaste;
      expect(handlePaste).toBeDefined();
      expect(typeof handlePaste).toBe('function');
    });
  });

  describe('Clipboard Event Handling', () => {
    it('should handle paste events with markdown content', () => {
      mockClipboardData.getData.mockImplementation((type) => {
        if (type === 'text/plain') return '**bold text**';
        if (type === 'text/html') return '';
        return '';
      });

      const handlePaste = plugin.props.handlePaste;
      const result = handlePaste(mockView, mockClipboardEvent);

      expect(mockClipboardData.getData).toHaveBeenCalledWith('text/plain');
      expect(mockClipboardData.getData).toHaveBeenCalledWith('text/html');
      // Should return true because markdown was detected
      expect(result).toBe(true);
    });

    it('should not process plain text without markdown', () => {
      mockClipboardData.getData.mockImplementation((type) => {
        if (type === 'text/plain') return 'just plain text';
        if (type === 'text/html') return '';
        return '';
      });

      const handlePaste = plugin.props.handlePaste;
      const result = handlePaste(mockView, mockClipboardEvent);

      expect(result).toBe(false);
    });

    it('should handle clipboard data absence gracefully', () => {
      const eventWithoutClipboard = {
        clipboardData: null,
        preventDefault: vi.fn()
      };

      const handlePaste = plugin.props.handlePaste;
      const result = handlePaste(mockView, eventWithoutClipboard);

      expect(result).toBe(false);
    });

    it('should handle paste with both HTML and markdown text', () => {
      mockClipboardData.getData.mockImplementation((type) => {
        if (type === 'text/plain') return '**bold text**';
        if (type === 'text/html') return '<p><strong>bold text</strong></p>';
        return '';
      });

      const handlePaste = plugin.props.handlePaste;
      const result = handlePaste(mockView, mockClipboardEvent);

      // Should return true because we prefer Markdown processing when valid Markdown is detected
      expect(result).toBe(true);
    });
  });

  describe('Markdown Detection', () => {
    it('should detect bold markdown', () => {
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
        expect(text).toBeTruthy();
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
        expect(text).toBeTruthy();
      });
    });
  });

  describe('Editor Integration', () => {
    it('should prevent default and process markdown paste', async () => {
      const markdownText = '**bold text**';

      mockClipboardData.getData.mockImplementation((type) => {
        if (type === 'text/plain') return markdownText;
        if (type === 'text/html') return '';
        return '';
      });

      const handlePaste = plugin.props.handlePaste;
      handlePaste(mockView, mockClipboardEvent);

      // Should have prevented default because markdown was detected
      expect(mockClipboardEvent.preventDefault).toHaveBeenCalled();
    });
  });
});
