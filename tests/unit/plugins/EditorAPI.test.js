/**
 * Unit tests for EditorAPI
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorPluginAPI } from '../../../src/plugins/api/EditorAPI.js';

describe('EditorAPI', () => {
  let editorAPI;
  let mockEditor;

  beforeEach(() => {
    editorAPI = new EditorPluginAPI();

    // Create mock TipTap editor
    mockEditor = {
      state: {
        doc: {
          textContent: 'Line 1\nLine 2\nLine 3',
          textBetween: vi.fn((from, to) => {
            const text = 'Line 1\nLine 2\nLine 3';
            return text.substring(from, to);
          })
        },
        selection: {
          from: 0,
          to: 6
        }
      },
      commands: {
        setContent: vi.fn(),
        setTextSelection: vi.fn()
      },
      on: vi.fn(),
      off: vi.fn(),
      view: {}
    };

    editorAPI.setEditorInstance(mockEditor);
  });

  afterEach(() => {
    editorAPI.clearCaches();
  });

  describe('getContent()', () => {
    test('should get editor content', async () => {
      mockEditor.getHTML = vi.fn(() => '<p>Test content</p>');

      const content = await editorAPI.getContent();

      expect(mockEditor.getHTML).toHaveBeenCalled();
      expect(content).toBe('<p>Test content</p>');
    });

    test('should throw error if editor not initialized', async () => {
      editorAPI.setEditorInstance(null);

      await expect(editorAPI.getContent()).rejects.toThrow('Editor not initialized');
    });
  });

  describe('setContent()', () => {
    test('should set editor content', async () => {
      const content = 'New content';
      await editorAPI.setContent(content);

      expect(mockEditor.commands.setContent).toHaveBeenCalledWith(content);
    });

    test('should emit content-changed event', async () => {
      const listener = vi.fn();
      editorAPI.on('content-changed', listener);

      await editorAPI.setContent('New content');

      expect(listener).toHaveBeenCalledWith({ content: 'New content' });
    });

    test('should throw error if editor not initialized', async () => {
      editorAPI.setEditorInstance(null);

      await expect(editorAPI.setContent('test')).rejects.toThrow('Editor not initialized');
    });
  });

  describe('insertContent()', () => {
    test('should insert content at cursor', async () => {
      mockEditor.commands.insertContent = vi.fn();
      const content = 'Inserted text';

      await editorAPI.insertContent(content);

      expect(mockEditor.commands.insertContent).toHaveBeenCalledWith(content);
    });

    test('should emit content-inserted event', async () => {
      mockEditor.commands.insertContent = vi.fn();
      const listener = vi.fn();
      editorAPI.on('content-inserted', listener);

      await editorAPI.insertContent('Test');

      expect(listener).toHaveBeenCalledWith({ content: 'Test' });
    });

    test('should throw error if editor not initialized', async () => {
      editorAPI.setEditorInstance(null);

      await expect(editorAPI.insertContent('test')).rejects.toThrow('Editor not initialized');
    });
  });

  describe('setSelection()', () => {
    test('should set selection with start and end', async () => {
      const selection = {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 6 }
      };

      await editorAPI.setSelection(selection);

      expect(mockEditor.commands.setTextSelection).toHaveBeenCalled();
    });

    test('should set selection with anchor and active', async () => {
      const selection = {
        anchor: { line: 0, character: 0 },
        active: { line: 0, character: 6 }
      };

      await editorAPI.setSelection(selection);

      expect(mockEditor.commands.setTextSelection).toHaveBeenCalled();
    });

    test('should emit selection-changed event', async () => {
      const listener = vi.fn();
      editorAPI.on('selection-changed', listener);

      await editorAPI.setSelection({
        start: { line: 0, character: 0 },
        end: { line: 0, character: 6 }
      });

      expect(listener).toHaveBeenCalled();
    });

    test('should throw error if editor not initialized', async () => {
      editorAPI.setEditorInstance(null);

      await expect(editorAPI.setSelection({ start: { line: 0, character: 0 }, end: { line: 0, character: 6 } }))
        .rejects.toThrow('Editor not initialized');
    });
  });

  describe('getTextInRange()', () => {
    test('should extract text in range', async () => {
      const range = {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 6 }
      };

      const text = await editorAPI.getTextInRange(range);

      expect(mockEditor.state.doc.textBetween).toHaveBeenCalled();
      expect(text).toBeDefined();
    });

    test('should throw error if editor not initialized', async () => {
      editorAPI.setEditorInstance(null);

      await expect(editorAPI.getTextInRange({ start: { line: 0, character: 0 }, end: { line: 0, character: 6 } }))
        .rejects.toThrow('Editor not initialized');
    });
  });

  describe('_positionToOffset()', () => {
    test('should convert position to offset', () => {
      const position = { line: 1, character: 3 };
      const offset = editorAPI._positionToOffset(position);

      expect(typeof offset).toBe('number');
      expect(offset).toBeGreaterThanOrEqual(0);
    });

    test('should handle line 0', () => {
      const position = { line: 0, character: 3 };
      const offset = editorAPI._positionToOffset(position);

      expect(offset).toBe(3);
    });

    test('should return position if already a number', () => {
      const offset = editorAPI._positionToOffset(10);
      expect(offset).toBe(10);
    });

    test('should return 0 if editor not initialized', () => {
      editorAPI.setEditorInstance(null);
      const offset = editorAPI._positionToOffset({ line: 0, character: 0 });
      expect(offset).toBe(0);
    });
  });

  describe('_offsetToPosition()', () => {
    test('should convert offset to position', () => {
      const position = editorAPI._offsetToPosition(10);

      expect(position).toHaveProperty('line');
      expect(position).toHaveProperty('character');
      expect(typeof position.line).toBe('number');
      expect(typeof position.character).toBe('number');
    });

    test('should handle offset 0', () => {
      const position = editorAPI._offsetToPosition(0);

      expect(position.line).toBe(0);
      expect(position.character).toBe(0);
    });

    test('should return default position if editor not initialized', () => {
      editorAPI.setEditorInstance(null);
      const position = editorAPI._offsetToPosition(10);

      expect(position).toEqual({ line: 0, character: 0 });
    });
  });

  describe('onDidChangeActiveTextEditor()', () => {
    test('should register listener for editor changes', () => {
      const listener = vi.fn();
      const disposable = editorAPI.onDidChangeActiveTextEditor(listener);

      expect(disposable).toHaveProperty('dispose');
      expect(typeof disposable.dispose).toBe('function');
    });

    test('should call listener when editor changes', () => {
      const listener = vi.fn();
      editorAPI.onDidChangeActiveTextEditor(listener);

      editorAPI.emit('editor-changed', mockEditor);

      expect(listener).toHaveBeenCalled();
    });

    test('should dispose listener correctly', () => {
      const listener = vi.fn();
      const disposable = editorAPI.onDidChangeActiveTextEditor(listener);

      disposable.dispose();
      editorAPI.emit('editor-changed', mockEditor);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('onDidChangeTextEditorSelection()', () => {
    test('should register listener for selection changes', () => {
      const listener = vi.fn();
      const disposable = editorAPI.onDidChangeTextEditorSelection(listener);

      expect(disposable).toHaveProperty('dispose');
      expect(typeof disposable.dispose).toBe('function');
    });

    test('should handle editor not initialized', () => {
      editorAPI.setEditorInstance(null);
      const listener = vi.fn();
      const disposable = editorAPI.onDidChangeTextEditorSelection(listener);

      expect(disposable).toHaveProperty('dispose');
    });
  });

  describe('_createSelectionFromEditor()', () => {
    test('should create selection from editor state', () => {
      const selection = editorAPI._createSelectionFromEditor(mockEditor);

      expect(selection).toHaveProperty('start');
      expect(selection).toHaveProperty('end');
      expect(selection).toHaveProperty('anchor');
      expect(selection).toHaveProperty('active');
      expect(selection).toHaveProperty('isEmpty');
      expect(selection).toHaveProperty('isSingleLine');
    });

    test('should detect empty selection', () => {
      mockEditor.state.selection.from = 5;
      mockEditor.state.selection.to = 5;

      const selection = editorAPI._createSelectionFromEditor(mockEditor);

      expect(selection.isEmpty).toBe(true);
    });

    test('should detect non-empty selection', () => {
      mockEditor.state.selection.from = 0;
      mockEditor.state.selection.to = 6;

      const selection = editorAPI._createSelectionFromEditor(mockEditor);

      expect(selection.isEmpty).toBe(false);
    });
  });

  describe('_createDocumentAdapter()', () => {
    test('should create document adapter with correct properties', () => {
      const doc = editorAPI._createDocumentAdapter(mockEditor.state);

      expect(doc).toHaveProperty('uri');
      expect(doc).toHaveProperty('fileName');
      expect(doc).toHaveProperty('languageId');
      expect(doc).toHaveProperty('getText');
      expect(doc).toHaveProperty('lineAt');
      expect(doc).toHaveProperty('offsetAt');
      expect(doc).toHaveProperty('positionAt');
    });

    test('should implement getText without range', () => {
      const doc = editorAPI._createDocumentAdapter(mockEditor.state);
      const text = doc.getText();

      expect(text).toBe('Line 1\nLine 2\nLine 3');
    });

    test('should implement getText with range', () => {
      const doc = editorAPI._createDocumentAdapter(mockEditor.state);
      const range = {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 6 }
      };
      const text = doc.getText(range);

      expect(typeof text).toBe('string');
    });

    test('should implement lineAt with line number', () => {
      const doc = editorAPI._createDocumentAdapter(mockEditor.state);
      const line = doc.lineAt(0);

      expect(line).toHaveProperty('lineNumber');
      expect(line).toHaveProperty('text');
      expect(line).toHaveProperty('range');
      expect(line.lineNumber).toBe(0);
    });

    test('should implement lineAt with position', () => {
      const doc = editorAPI._createDocumentAdapter(mockEditor.state);
      const line = doc.lineAt({ line: 1, character: 0 });

      expect(line.lineNumber).toBe(1);
    });

    test('should implement offsetAt correctly', () => {
      const doc = editorAPI._createDocumentAdapter(mockEditor.state);
      const offset = doc.offsetAt({ line: 0, character: 3 });

      expect(typeof offset).toBe('number');
      expect(offset).toBe(3);
    });

    test('should implement positionAt correctly', () => {
      const doc = editorAPI._createDocumentAdapter(mockEditor.state);
      const position = doc.positionAt(3);

      expect(position).toHaveProperty('line');
      expect(position).toHaveProperty('character');
    });

    test('should calculate line count correctly', () => {
      const doc = editorAPI._createDocumentAdapter(mockEditor.state);

      expect(doc.lineCount).toBe(3);
    });
  });

  describe('getSelections()', () => {
    test('should get current selections', async () => {
      const selections = await editorAPI.getSelections();

      expect(Array.isArray(selections)).toBe(true);
      expect(selections.length).toBeGreaterThan(0);
      expect(selections[0]).toHaveProperty('start');
      expect(selections[0]).toHaveProperty('end');
    });

    test('should throw error if editor not initialized', async () => {
      editorAPI.setEditorInstance(null);

      await expect(editorAPI.getSelections()).rejects.toThrow('Editor not initialized');
    });
  });

  describe('setSelections()', () => {
    test('should set multiple selections', async () => {
      const selections = [
        {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 6 }
        }
      ];

      await editorAPI.setSelections(selections);

      expect(mockEditor.commands.setTextSelection).toHaveBeenCalled();
    });

    test('should handle empty selections array', async () => {
      await editorAPI.setSelections([]);

      // Should not throw
      expect(mockEditor.commands.setTextSelection).not.toHaveBeenCalled();
    });

    test('should throw error if editor not initialized', async () => {
      editorAPI.setEditorInstance(null);

      await expect(editorAPI.setSelections([{ start: { line: 0, character: 0 }, end: { line: 0, character: 6 } }]))
        .rejects.toThrow('Editor not initialized');
    });
  });

  describe('replaceText()', () => {
    test('should replace text in range', async () => {
      const mockChain = {
        focus: vi.fn(() => mockChain),
        deleteRange: vi.fn(() => mockChain),
        insertContentAt: vi.fn(() => mockChain),
        run: vi.fn()
      };

      mockEditor.chain = vi.fn(() => mockChain);

      const range = {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 6 }
      };

      await editorAPI.replaceText(range, 'New text');

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockChain.focus).toHaveBeenCalled();
      expect(mockChain.deleteRange).toHaveBeenCalled();
      expect(mockChain.insertContentAt).toHaveBeenCalled();
      expect(mockChain.run).toHaveBeenCalled();
    });

    test('should emit text-replaced event', async () => {
      const mockChain = {
        focus: vi.fn(() => mockChain),
        deleteRange: vi.fn(() => mockChain),
        insertContentAt: vi.fn(() => mockChain),
        run: vi.fn()
      };

      mockEditor.chain = vi.fn(() => mockChain);

      const listener = vi.fn();
      editorAPI.on('text-replaced', listener);

      const range = {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 6 }
      };

      await editorAPI.replaceText(range, 'New text');

      expect(listener).toHaveBeenCalledWith({ range, text: 'New text' });
    });

    test('should throw error if editor not initialized', async () => {
      editorAPI.setEditorInstance(null);

      await expect(editorAPI.replaceText({ start: { line: 0, character: 0 }, end: { line: 0, character: 6 } }, 'test'))
        .rejects.toThrow('Editor not initialized');
    });
  });

  describe('onDidChangeTextDocument()', () => {
    test('should register listener for document changes', () => {
      const listener = vi.fn();
      const disposable = editorAPI.onDidChangeTextDocument(listener);

      expect(disposable).toHaveProperty('dispose');
      expect(typeof disposable.dispose).toBe('function');
    });

    test('should handle editor not initialized', () => {
      editorAPI.setEditorInstance(null);
      const listener = vi.fn();
      const disposable = editorAPI.onDidChangeTextDocument(listener);

      expect(disposable).toHaveProperty('dispose');
    });

    test('should dispose listener correctly', () => {
      const listener = vi.fn();
      const disposable = editorAPI.onDidChangeTextDocument(listener);

      expect(() => disposable.dispose()).not.toThrow();
    });
  });

  describe('onDidChangeTextEditorVisibleRanges()', () => {
    test('should register listener for visible range changes', () => {
      const listener = vi.fn();
      const disposable = editorAPI.onDidChangeTextEditorVisibleRanges(listener);

      expect(disposable).toHaveProperty('dispose');
      expect(typeof disposable.dispose).toBe('function');
    });

    test('should handle editor not initialized', () => {
      editorAPI.setEditorInstance(null);
      const listener = vi.fn();
      const disposable = editorAPI.onDidChangeTextEditorVisibleRanges(listener);

      expect(disposable).toHaveProperty('dispose');
    });

    test('should dispose listener correctly', () => {
      const listener = vi.fn();
      const disposable = editorAPI.onDidChangeTextEditorVisibleRanges(listener);

      expect(() => disposable.dispose()).not.toThrow();
    });
  });

  describe('Provider Registration Methods', () => {
    beforeEach(() => {
      editorAPI.currentPluginId = 'test-plugin';
    });

    describe('registerCompletionProvider()', () => {
      test('should register completion provider', () => {
        const provider = {
          provideCompletionItems: vi.fn()
        };

        const disposable = editorAPI.registerCompletionProvider('markdown', provider, '.', '@');

        expect(disposable).toHaveProperty('dispose');
        expect(editorAPI.providers.size).toBe(1);
      });

      test('should emit completion-provider-registered event', () => {
        const listener = vi.fn();
        editorAPI.on('completion-provider-registered', listener);

        const provider = { provideCompletionItems: vi.fn() };
        editorAPI.registerCompletionProvider('markdown', provider);

        expect(listener).toHaveBeenCalled();
        expect(listener.mock.calls[0][0]).toHaveProperty('type', 'completion');
      });

      test('should dispose completion provider correctly', () => {
        const provider = { provideCompletionItems: vi.fn() };
        const disposable = editorAPI.registerCompletionProvider('markdown', provider);

        expect(editorAPI.providers.size).toBe(1);
        disposable.dispose();
        expect(editorAPI.providers.size).toBe(0);
      });

      test('should track trigger characters', () => {
        const provider = { provideCompletionItems: vi.fn() };
        editorAPI.registerCompletionProvider('markdown', provider, '.', '@', '#');

        const registered = Array.from(editorAPI.providers.values())[0];
        expect(registered.triggerCharacters).toEqual(['.', '@', '#']);
      });
    });

    describe('registerHoverProvider()', () => {
      test('should register hover provider', () => {
        const provider = { provideHover: vi.fn() };
        const disposable = editorAPI.registerHoverProvider('markdown', provider);

        expect(disposable).toHaveProperty('dispose');
        expect(editorAPI.providers.size).toBe(1);
      });

      test('should emit hover-provider-registered event', () => {
        const listener = vi.fn();
        editorAPI.on('hover-provider-registered', listener);

        const provider = { provideHover: vi.fn() };
        editorAPI.registerHoverProvider('markdown', provider);

        expect(listener).toHaveBeenCalled();
        expect(listener.mock.calls[0][0]).toHaveProperty('type', 'hover');
      });

      test('should dispose hover provider correctly', () => {
        const provider = { provideHover: vi.fn() };
        const disposable = editorAPI.registerHoverProvider('markdown', provider);

        expect(editorAPI.providers.size).toBe(1);
        disposable.dispose();
        expect(editorAPI.providers.size).toBe(0);
      });
    });

    describe('registerDefinitionProvider()', () => {
      test('should register definition provider', () => {
        const provider = { provideDefinition: vi.fn() };
        const disposable = editorAPI.registerDefinitionProvider('markdown', provider);

        expect(disposable).toHaveProperty('dispose');
        expect(editorAPI.providers.size).toBe(1);
      });

      test('should emit definition-provider-registered event', () => {
        const listener = vi.fn();
        editorAPI.on('definition-provider-registered', listener);

        const provider = { provideDefinition: vi.fn() };
        editorAPI.registerDefinitionProvider('markdown', provider);

        expect(listener).toHaveBeenCalled();
        expect(listener.mock.calls[0][0]).toHaveProperty('type', 'definition');
      });

      test('should dispose definition provider correctly', () => {
        const provider = { provideDefinition: vi.fn() };
        const disposable = editorAPI.registerDefinitionProvider('markdown', provider);

        expect(editorAPI.providers.size).toBe(1);
        disposable.dispose();
        expect(editorAPI.providers.size).toBe(0);
      });
    });

    describe('registerCodeActionProvider()', () => {
      test('should register code action provider', () => {
        const provider = { provideCodeActions: vi.fn() };
        const metadata = { providedCodeActionKinds: ['quickfix'] };
        const disposable = editorAPI.registerCodeActionProvider('markdown', provider, metadata);

        expect(disposable).toHaveProperty('dispose');
        expect(editorAPI.providers.size).toBe(1);
      });

      test('should emit code-action-provider-registered event', () => {
        const listener = vi.fn();
        editorAPI.on('code-action-provider-registered', listener);

        const provider = { provideCodeActions: vi.fn() };
        editorAPI.registerCodeActionProvider('markdown', provider);

        expect(listener).toHaveBeenCalled();
        expect(listener.mock.calls[0][0]).toHaveProperty('type', 'codeAction');
      });

      test('should store metadata', () => {
        const provider = { provideCodeActions: vi.fn() };
        const metadata = { providedCodeActionKinds: ['refactor'] };
        editorAPI.registerCodeActionProvider('markdown', provider, metadata);

        const registered = Array.from(editorAPI.providers.values())[0];
        expect(registered.metadata).toEqual(metadata);
      });

      test('should dispose code action provider correctly', () => {
        const provider = { provideCodeActions: vi.fn() };
        const disposable = editorAPI.registerCodeActionProvider('markdown', provider);

        expect(editorAPI.providers.size).toBe(1);
        disposable.dispose();
        expect(editorAPI.providers.size).toBe(0);
      });
    });

    describe('registerDocumentFormattingProvider()', () => {
      test('should register formatting provider', () => {
        const provider = { provideDocumentFormattingEdits: vi.fn() };
        const disposable = editorAPI.registerDocumentFormattingProvider('markdown', provider);

        expect(disposable).toHaveProperty('dispose');
        expect(editorAPI.providers.size).toBe(1);
      });

      test('should emit formatting-provider-registered event', () => {
        const listener = vi.fn();
        editorAPI.on('formatting-provider-registered', listener);

        const provider = { provideDocumentFormattingEdits: vi.fn() };
        editorAPI.registerDocumentFormattingProvider('markdown', provider);

        expect(listener).toHaveBeenCalled();
        expect(listener.mock.calls[0][0]).toHaveProperty('type', 'formatting');
      });

      test('should dispose formatting provider correctly', () => {
        const provider = { provideDocumentFormattingEdits: vi.fn() };
        const disposable = editorAPI.registerDocumentFormattingProvider('markdown', provider);

        expect(editorAPI.providers.size).toBe(1);
        disposable.dispose();
        expect(editorAPI.providers.size).toBe(0);
      });
    });

    describe('registerFoldingRangeProvider()', () => {
      test('should register folding range provider', () => {
        const provider = { provideFoldingRanges: vi.fn() };
        const disposable = editorAPI.registerFoldingRangeProvider('markdown', provider);

        expect(disposable).toHaveProperty('dispose');
        expect(editorAPI.providers.size).toBe(1);
      });

      test('should emit folding-provider-registered event', () => {
        const listener = vi.fn();
        editorAPI.on('folding-provider-registered', listener);

        const provider = { provideFoldingRanges: vi.fn() };
        editorAPI.registerFoldingRangeProvider('markdown', provider);

        expect(listener).toHaveBeenCalled();
        expect(listener.mock.calls[0][0]).toHaveProperty('type', 'folding');
      });

      test('should dispose folding range provider correctly', () => {
        const provider = { provideFoldingRanges: vi.fn() };
        const disposable = editorAPI.registerFoldingRangeProvider('markdown', provider);

        expect(editorAPI.providers.size).toBe(1);
        disposable.dispose();
        expect(editorAPI.providers.size).toBe(0);
      });
    });

    describe('registerDocumentLinkProvider()', () => {
      test('should register document link provider', () => {
        const provider = { provideDocumentLinks: vi.fn() };
        const disposable = editorAPI.registerDocumentLinkProvider('markdown', provider);

        expect(disposable).toHaveProperty('dispose');
        expect(editorAPI.providers.size).toBe(1);
      });

      test('should emit link-provider-registered event', () => {
        const listener = vi.fn();
        editorAPI.on('link-provider-registered', listener);

        const provider = { provideDocumentLinks: vi.fn() };
        editorAPI.registerDocumentLinkProvider('markdown', provider);

        expect(listener).toHaveBeenCalled();
        expect(listener.mock.calls[0][0]).toHaveProperty('type', 'link');
      });

      test('should dispose document link provider correctly', () => {
        const provider = { provideDocumentLinks: vi.fn() };
        const disposable = editorAPI.registerDocumentLinkProvider('markdown', provider);

        expect(editorAPI.providers.size).toBe(1);
        disposable.dispose();
        expect(editorAPI.providers.size).toBe(0);
      });
    });

    describe('getProviders()', () => {
      test('should get providers by type', () => {
        const completionProvider = { provideCompletionItems: vi.fn() };
        const hoverProvider = { provideHover: vi.fn() };

        editorAPI.registerCompletionProvider('markdown', completionProvider);
        editorAPI.registerHoverProvider('markdown', hoverProvider);

        const completionProviders = editorAPI.getProviders('completion');
        const hoverProviders = editorAPI.getProviders('hover');

        expect(completionProviders.length).toBe(1);
        expect(hoverProviders.length).toBe(1);
        expect(completionProviders[0].type).toBe('completion');
        expect(hoverProviders[0].type).toBe('hover');
      });

      test('should return empty array if no providers of type exist', () => {
        const providers = editorAPI.getProviders('definition');
        expect(providers).toEqual([]);
      });

      test('should return multiple providers of same type', () => {
        const provider1 = { provideCompletionItems: vi.fn() };
        const provider2 = { provideCompletionItems: vi.fn() };

        editorAPI.registerCompletionProvider('markdown', provider1);
        editorAPI.registerCompletionProvider('javascript', provider2);

        const completionProviders = editorAPI.getProviders('completion');
        expect(completionProviders.length).toBe(2);
      });
    });

    describe('unregisterAllProviders()', () => {
      test('should unregister all providers for a plugin', () => {
        editorAPI.currentPluginId = 'plugin-1';
        const provider1 = { provideCompletionItems: vi.fn() };
        const provider2 = { provideHover: vi.fn() };

        editorAPI.registerCompletionProvider('markdown', provider1);
        editorAPI.registerHoverProvider('markdown', provider2);

        editorAPI.currentPluginId = 'plugin-2';
        const provider3 = { provideDefinition: vi.fn() };
        editorAPI.registerDefinitionProvider('markdown', provider3);

        expect(editorAPI.providers.size).toBe(3);

        editorAPI.unregisterAllProviders('plugin-1');
        expect(editorAPI.providers.size).toBe(1);

        const remaining = Array.from(editorAPI.providers.values());
        expect(remaining[0].pluginId).toBe('plugin-2');
      });

      test('should emit unregistered events', () => {
        const listener = vi.fn();
        editorAPI.on('completion-provider-unregistered', listener);

        editorAPI.currentPluginId = 'plugin-1';
        const provider = { provideCompletionItems: vi.fn() };
        editorAPI.registerCompletionProvider('markdown', provider);

        editorAPI.unregisterAllProviders('plugin-1');
        expect(listener).toHaveBeenCalled();
      });

      test('should handle plugin with no providers', () => {
        expect(() => editorAPI.unregisterAllProviders('nonexistent')).not.toThrow();
      });
    });

    describe('getStats()', () => {
      test('should include provider count in stats', () => {
        const provider = { provideCompletionItems: vi.fn() };
        editorAPI.registerCompletionProvider('markdown', provider);

        const stats = editorAPI.getStats();
        expect(stats).toHaveProperty('providers');
        expect(stats.providers).toBe(1);
      });
    });
  });
});
