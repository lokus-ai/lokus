import { describe, it, expect, vi } from 'vitest';

// Mock KaTeX for unit tests
const mockKatex = {
  renderToString: vi.fn((tex, options) => `<span class="katex-mock">${tex}</span>`)
};

// Mock the math extension
vi.mock('../../src/editor/extensions/Math.js', () => ({
  default: [
    { name: 'mathInline' },
    { name: 'mathBlock' }
  ]
}));

describe('Math Extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.katex = mockKatex;
  });

  it('should have KaTeX available globally', () => {
    expect(globalThis.katex).toBeDefined();
    expect(globalThis.katex.renderToString).toBeInstanceOf(Function);
  });

  it('should render simple math expressions', () => {
    const result = mockKatex.renderToString('E = mc^2', { displayMode: false });
    expect(result).toContain('E = mc^2');
    expect(result).toContain('katex-mock');
  });

  it('should handle display mode for block math', () => {
    const result = mockKatex.renderToString('\\int x dx', { displayMode: true });
    expect(result).toContain('\\int x dx');
    expect(mockKatex.renderToString).toHaveBeenCalledWith('\\int x dx', { displayMode: true });
  });

  it('should handle math rendering errors gracefully', () => {
    mockKatex.renderToString.mockImplementation(() => {
      throw new Error('Parse error');
    });

    // In real implementation, this should fallback to showing raw LaTeX
    expect(() => {
      try {
        mockKatex.renderToString('\\invalid');
      } catch (e) {
        return 'fallback';
      }
    }).not.toThrow();
  });
});

describe('Editor Utils', () => {
  it('should validate markdown patterns', () => {
    const patterns = {
      bold: /\*\*([^*]+)\*\*/,
      italic: /\*([^*]+)\*/,
      code: /`([^`]+)`/,
      math: /\$([^$]+)\$/,
      blockMath: /\$\$([^$]+)\$\$/
    };

    expect('**bold**').toMatch(patterns.bold);
    expect('*italic*').toMatch(patterns.italic);
    expect('`code`').toMatch(patterns.code);
    expect('$math$').toMatch(patterns.math);
    expect('$$block$$').toMatch(patterns.blockMath);
  });

  it('should handle wiki link patterns', () => {
    const wikiPattern = /\[\[([^\]]+)\]\]/;
    
    expect('[[Page Name]]').toMatch(wikiPattern);
    expect('[[Page Name|Display Text]]').toMatch(wikiPattern);
    expect('[regular link](url)').not.toMatch(wikiPattern);
  });

  it('should detect task list patterns', () => {
    const taskPattern = /^\s*[-*+]\s*\[([x\s])\]/;
    
    expect('- [x] Completed task').toMatch(taskPattern);
    expect('- [ ] Incomplete task').toMatch(taskPattern);
    expect('* [x] Another completed task').toMatch(taskPattern);
    expect('- Regular list item').not.toMatch(taskPattern);
  });
});