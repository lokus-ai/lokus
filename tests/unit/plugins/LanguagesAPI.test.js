/**
 * LanguagesAPI Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LanguagesAPI } from '../../../src/plugins/api/LanguagesAPI.js';

describe('LanguagesAPI', () => {
  let languagesAPI;
  let mockLanguageManager;

  beforeEach(() => {
    mockLanguageManager = {
      registerLanguage: vi.fn(),
      unregisterLanguage: vi.fn(),
      setLanguageConfiguration: vi.fn(),
      removeLanguageConfiguration: vi.fn()
    };

    languagesAPI = new LanguagesAPI(mockLanguageManager);
    languagesAPI.currentPluginId = 'test-plugin';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registerCompletionProvider()', () => {
    it('should register completion provider', () => {
      const provider = { provideCompletionItems: vi.fn() };
      const disposable = languagesAPI.registerCompletionProvider('markdown', provider, '.');

      expect(languagesAPI.providers.size).toBe(1);
      expect(disposable).toHaveProperty('dispose');

      const registration = Array.from(languagesAPI.providers.values())[0];
      expect(registration.type).toBe('completion');
      expect(registration.selector).toBe('markdown');
      expect(registration.provider).toBe(provider);
      expect(registration.pluginId).toBe('test-plugin');
    });

    it('should dispose completion provider', () => {
      const provider = { provideCompletionItems: vi.fn() };
      const disposable = languagesAPI.registerCompletionProvider('markdown', provider);

      expect(languagesAPI.providers.size).toBe(1);

      disposable.dispose();

      expect(languagesAPI.providers.size).toBe(0);
    });

    it('should support trigger characters', () => {
      const provider = { provideCompletionItems: vi.fn() };
      languagesAPI.registerCompletionProvider('javascript', provider, '.', ':');

      const registration = Array.from(languagesAPI.providers.values())[0];
      expect(registration.triggerCharacters).toEqual(['.', ':']);
    });
  });

  describe('registerHoverProvider()', () => {
    it('should register hover provider', () => {
      const provider = { provideHover: vi.fn() };
      const disposable = languagesAPI.registerHoverProvider('markdown', provider);

      expect(languagesAPI.providers.size).toBe(1);
      expect(disposable).toHaveProperty('dispose');

      const registration = Array.from(languagesAPI.providers.values())[0];
      expect(registration.type).toBe('hover');
      expect(registration.selector).toBe('markdown');
    });

    it('should dispose hover provider', () => {
      const provider = { provideHover: vi.fn() };
      const disposable = languagesAPI.registerHoverProvider('markdown', provider);

      disposable.dispose();

      expect(languagesAPI.providers.size).toBe(0);
    });
  });

  describe('registerDefinitionProvider()', () => {
    it('should register definition provider', () => {
      const provider = { provideDefinition: vi.fn() };
      const disposable = languagesAPI.registerDefinitionProvider('javascript', provider);

      expect(languagesAPI.providers.size).toBe(1);

      const registration = Array.from(languagesAPI.providers.values())[0];
      expect(registration.type).toBe('definition');
    });

    it('should dispose definition provider', () => {
      const provider = { provideDefinition: vi.fn() };
      const disposable = languagesAPI.registerDefinitionProvider('javascript', provider);

      disposable.dispose();

      expect(languagesAPI.providers.size).toBe(0);
    });
  });

  describe('registerCodeActionProvider()', () => {
    it('should register code action provider', () => {
      const provider = { provideCodeActions: vi.fn() };
      const metadata = { providedCodeActionKinds: ['quickfix'] };
      const disposable = languagesAPI.registerCodeActionProvider('typescript', provider, metadata);

      expect(languagesAPI.providers.size).toBe(1);

      const registration = Array.from(languagesAPI.providers.values())[0];
      expect(registration.type).toBe('codeAction');
      expect(registration.metadata).toBe(metadata);
    });

    it('should dispose code action provider', () => {
      const provider = { provideCodeActions: vi.fn() };
      const disposable = languagesAPI.registerCodeActionProvider('typescript', provider);

      disposable.dispose();

      expect(languagesAPI.providers.size).toBe(0);
    });
  });

  describe('registerDocumentFormattingProvider()', () => {
    it('should register document formatting provider', () => {
      const provider = { provideDocumentFormattingEdits: vi.fn() };
      const disposable = languagesAPI.registerDocumentFormattingProvider('javascript', provider);

      expect(languagesAPI.providers.size).toBe(1);
      expect(disposable).toHaveProperty('dispose');

      const registration = Array.from(languagesAPI.providers.values())[0];
      expect(registration.type).toBe('formatting');
      expect(registration.selector).toBe('javascript');
      expect(registration.provider).toBe(provider);
      expect(registration.pluginId).toBe('test-plugin');
    });

    it('should dispose document formatting provider', () => {
      const provider = { provideDocumentFormattingEdits: vi.fn() };
      const disposable = languagesAPI.registerDocumentFormattingProvider('javascript', provider);

      expect(languagesAPI.providers.size).toBe(1);

      disposable.dispose();

      expect(languagesAPI.providers.size).toBe(0);
    });
  });

  describe('registerRangeFormattingProvider()', () => {
    it('should register range formatting provider', () => {
      const provider = { provideDocumentRangeFormattingEdits: vi.fn() };
      const disposable = languagesAPI.registerRangeFormattingProvider('python', provider);

      expect(languagesAPI.providers.size).toBe(1);
      expect(disposable).toHaveProperty('dispose');

      const registration = Array.from(languagesAPI.providers.values())[0];
      expect(registration.type).toBe('rangeFormatting');
      expect(registration.selector).toBe('python');
      expect(registration.provider).toBe(provider);
      expect(registration.pluginId).toBe('test-plugin');
    });

    it('should dispose range formatting provider', () => {
      const provider = { provideDocumentRangeFormattingEdits: vi.fn() };
      const disposable = languagesAPI.registerRangeFormattingProvider('python', provider);

      disposable.dispose();

      expect(languagesAPI.providers.size).toBe(0);
    });
  });

  describe('registerLanguage()', () => {
    it('should register a language', () => {
      const language = {
        id: 'mylang',
        extensions: ['.ml'],
        aliases: ['MyLang', 'mylang']
      };

      const disposable = languagesAPI.registerLanguage(language);

      expect(languagesAPI.languages.has('mylang')).toBe(true);
      expect(disposable).toHaveProperty('dispose');
      expect(mockLanguageManager.registerLanguage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mylang',
          extensions: ['.ml'],
          aliases: ['MyLang', 'mylang'],
          pluginId: 'test-plugin'
        })
      );
    });

    it('should throw error if language id is missing', () => {
      expect(() => {
        languagesAPI.registerLanguage({ extensions: ['.txt'] });
      }).toThrow('Language must have an id');
    });

    it('should throw error if language already exists', () => {
      const language = { id: 'mylang', extensions: ['.ml'] };
      languagesAPI.registerLanguage(language);

      expect(() => {
        languagesAPI.registerLanguage(language);
      }).toThrow("Language 'mylang' already exists");
    });

    it('should emit language_registered event', () => {
      const listener = vi.fn();
      languagesAPI.on('language_registered', listener);

      const language = { id: 'mylang', extensions: ['.ml'] };
      languagesAPI.registerLanguage(language);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          language: expect.objectContaining({ id: 'mylang' })
        })
      );
    });

    it('should emit did_change_languages event', () => {
      const listener = vi.fn();
      languagesAPI.on('did_change_languages', listener);

      const language = { id: 'mylang', extensions: ['.ml'] };
      languagesAPI.registerLanguage(language);

      expect(listener).toHaveBeenCalled();
    });

    it('should dispose language registration', () => {
      const language = { id: 'mylang', extensions: ['.ml'] };
      const disposable = languagesAPI.registerLanguage(language);

      expect(languagesAPI.languages.has('mylang')).toBe(true);

      disposable.dispose();

      expect(languagesAPI.languages.has('mylang')).toBe(false);
      expect(mockLanguageManager.unregisterLanguage).toHaveBeenCalledWith('mylang');
    });

    it('should work without language manager', () => {
      const apiWithoutManager = new LanguagesAPI(null);
      apiWithoutManager.currentPluginId = 'test-plugin';

      const language = { id: 'mylang', extensions: ['.ml'] };
      expect(() => apiWithoutManager.registerLanguage(language)).not.toThrow();
      expect(apiWithoutManager.languages.has('mylang')).toBe(true);
    });
  });

  describe('getLanguages()', () => {
    it('should return all registered languages', () => {
      languagesAPI.registerLanguage({ id: 'lang1', extensions: ['.l1'] });
      languagesAPI.registerLanguage({ id: 'lang2', extensions: ['.l2'], aliases: ['Lang2'] });

      const languages = languagesAPI.getLanguages();

      expect(languages).toHaveLength(2);
      expect(languages[0]).toEqual({
        id: 'lang1',
        extensions: ['.l1'],
        aliases: [],
        configuration: undefined
      });
      expect(languages[1]).toEqual({
        id: 'lang2',
        extensions: ['.l2'],
        aliases: ['Lang2'],
        configuration: undefined
      });
    });

    it('should return empty array when no languages', () => {
      const languages = languagesAPI.getLanguages();
      expect(languages).toEqual([]);
    });
  });

  describe('setLanguageConfiguration()', () => {
    it('should set language configuration', () => {
      const config = {
        comments: {
          lineComment: '//',
          blockComment: ['/*', '*/']
        },
        brackets: [
          ['{', '}'],
          ['[', ']']
        ]
      };

      const disposable = languagesAPI.setLanguageConfiguration('javascript', config);

      expect(languagesAPI.configurations.has('javascript')).toBe(true);
      expect(disposable).toHaveProperty('dispose');
      expect(mockLanguageManager.setLanguageConfiguration).toHaveBeenCalledWith('javascript', config);
    });

    it('should throw error if language id is missing', () => {
      expect(() => {
        languagesAPI.setLanguageConfiguration('', {});
      }).toThrow('Language ID is required');
    });

    it('should emit language_configuration_set event', () => {
      const listener = vi.fn();
      languagesAPI.on('language_configuration_set', listener);

      const config = { comments: { lineComment: '//' } };
      languagesAPI.setLanguageConfiguration('javascript', config);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          languageId: 'javascript',
          configuration: config
        })
      );
    });

    it('should dispose language configuration', () => {
      const config = { comments: { lineComment: '//' } };
      const disposable = languagesAPI.setLanguageConfiguration('javascript', config);

      expect(languagesAPI.configurations.has('javascript')).toBe(true);

      disposable.dispose();

      expect(languagesAPI.configurations.has('javascript')).toBe(false);
      expect(mockLanguageManager.removeLanguageConfiguration).toHaveBeenCalledWith('javascript');
    });

    it('should work without language manager', () => {
      const apiWithoutManager = new LanguagesAPI(null);
      apiWithoutManager.currentPluginId = 'test-plugin';

      const config = { comments: { lineComment: '//' } };
      expect(() => apiWithoutManager.setLanguageConfiguration('javascript', config)).not.toThrow();
      expect(apiWithoutManager.configurations.has('javascript')).toBe(true);
    });
  });

  describe('onDidChangeLanguages()', () => {
    it('should subscribe to language changes', () => {
      const listener = vi.fn();
      const disposable = languagesAPI.onDidChangeLanguages(listener);

      languagesAPI.registerLanguage({ id: 'mylang', extensions: ['.ml'] });

      expect(listener).toHaveBeenCalled();
      expect(disposable).toHaveProperty('dispose');
    });

    it('should unsubscribe when disposed', () => {
      const listener = vi.fn();
      const disposable = languagesAPI.onDidChangeLanguages(listener);
      disposable.dispose();

      languagesAPI.registerLanguage({ id: 'mylang', extensions: ['.ml'] });

      // Should only be called once during registration, not after dispose
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('unregisterAll()', () => {
    it('should unregister all providers for a plugin', () => {
      const provider1 = { provideCompletionItems: vi.fn() };
      const provider2 = { provideHover: vi.fn() };

      languagesAPI.registerCompletionProvider('markdown', provider1);
      languagesAPI.registerHoverProvider('markdown', provider2);

      const otherAPI = new LanguagesAPI(mockLanguageManager);
      otherAPI.currentPluginId = 'other-plugin';
      const provider3 = { provideCompletionItems: vi.fn() };
      otherAPI.registerCompletionProvider('javascript', provider3);

      // Merge providers for testing
      for (const [id, provider] of otherAPI.providers) {
        languagesAPI.providers.set(id, provider);
      }

      expect(languagesAPI.providers.size).toBe(3);

      languagesAPI.unregisterAll('test-plugin');

      // Only other plugin's provider should remain
      expect(languagesAPI.providers.size).toBe(1);
      const remaining = Array.from(languagesAPI.providers.values())[0];
      expect(remaining.pluginId).toBe('other-plugin');
    });

    it('should unregister all languages for a plugin', () => {
      languagesAPI.registerLanguage({ id: 'lang1', extensions: ['.l1'] });
      languagesAPI.registerLanguage({ id: 'lang2', extensions: ['.l2'] });

      const otherAPI = new LanguagesAPI(mockLanguageManager);
      otherAPI.currentPluginId = 'other-plugin';
      otherAPI.registerLanguage({ id: 'lang3', extensions: ['.l3'] });

      // Merge languages for testing
      for (const [id, lang] of otherAPI.languages) {
        languagesAPI.languages.set(id, lang);
      }

      expect(languagesAPI.languages.size).toBe(3);

      languagesAPI.unregisterAll('test-plugin');

      expect(languagesAPI.languages.has('lang1')).toBe(false);
      expect(languagesAPI.languages.has('lang2')).toBe(false);
      expect(languagesAPI.languages.has('lang3')).toBe(true);
    });

    it('should unregister all configurations for a plugin', () => {
      languagesAPI.setLanguageConfiguration('javascript', { comments: { lineComment: '//' } });
      languagesAPI.setLanguageConfiguration('python', { comments: { lineComment: '#' } });

      const otherAPI = new LanguagesAPI(mockLanguageManager);
      otherAPI.currentPluginId = 'other-plugin';
      otherAPI.setLanguageConfiguration('ruby', { comments: { lineComment: '#' } });

      // Merge configurations for testing
      for (const [id, config] of otherAPI.configurations) {
        languagesAPI.configurations.set(id, config);
      }

      expect(languagesAPI.configurations.size).toBe(3);

      languagesAPI.unregisterAll('test-plugin');

      expect(languagesAPI.configurations.has('javascript')).toBe(false);
      expect(languagesAPI.configurations.has('python')).toBe(false);
      expect(languagesAPI.configurations.has('ruby')).toBe(true);
    });

    it('should emit did_change_languages event', () => {
      const listener = vi.fn();
      languagesAPI.on('did_change_languages', listener);

      languagesAPI.registerLanguage({ id: 'lang1', extensions: ['.l1'] });
      listener.mockClear(); // Clear the registration call

      languagesAPI.unregisterAll('test-plugin');

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('multiple providers', () => {
    it('should support multiple providers of different types', () => {
      const completionProvider = { provideCompletionItems: vi.fn() };
      const hoverProvider = { provideHover: vi.fn() };
      const definitionProvider = { provideDefinition: vi.fn() };
      const formattingProvider = { provideDocumentFormattingEdits: vi.fn() };

      languagesAPI.registerCompletionProvider('markdown', completionProvider);
      languagesAPI.registerHoverProvider('markdown', hoverProvider);
      languagesAPI.registerDefinitionProvider('markdown', definitionProvider);
      languagesAPI.registerDocumentFormattingProvider('markdown', formattingProvider);

      expect(languagesAPI.providers.size).toBe(4);

      const types = Array.from(languagesAPI.providers.values()).map(p => p.type);
      expect(types).toContain('completion');
      expect(types).toContain('hover');
      expect(types).toContain('definition');
      expect(types).toContain('formatting');
    });
  });
});
