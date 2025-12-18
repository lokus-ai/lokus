/**
 * ThemeAPI Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeAPI } from '../../../src/plugins/api/ThemeAPI.js';

describe('ThemeAPI', () => {
  let themeAPI;
  let mockThemeManager;

  beforeEach(() => {
    mockThemeManager = {
      registerTheme: vi.fn(),
      unregisterTheme: vi.fn(),
      getActiveTheme: vi.fn().mockResolvedValue('vs-dark'),
      setActiveTheme: vi.fn().mockResolvedValue(undefined)
    };

    themeAPI = new ThemeAPI(mockThemeManager);
    themeAPI.currentPluginId = 'test-plugin';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registerTheme()', () => {
    it('should register a theme with required properties', () => {
      const theme = {
        id: 'my-theme',
        label: 'My Theme',
        uiTheme: 'vs-dark'
      };

      const disposable = themeAPI.registerTheme(theme);

      expect(themeAPI.themes.has('my-theme')).toBe(true);
      expect(disposable).toHaveProperty('dispose');
      expect(mockThemeManager.registerTheme).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'my-theme',
          label: 'My Theme',
          uiTheme: 'vs-dark',
          pluginId: 'test-plugin'
        })
      );
    });

    it('should register theme with colors and tokenColors', () => {
      const theme = {
        id: 'custom-theme',
        label: 'Custom Theme',
        uiTheme: 'vs',
        colors: { 'editor.background': '#ffffff' },
        tokenColors: [{ scope: 'comment', settings: { foreground: '#888888' } }]
      };

      themeAPI.registerTheme(theme);

      const registered = themeAPI.themes.get('custom-theme');
      expect(registered.colors).toEqual({ 'editor.background': '#ffffff' });
      expect(registered.tokenColors).toHaveLength(1);
    });

    it('should throw error if theme id is missing', () => {
      expect(() => {
        themeAPI.registerTheme({ label: 'Theme', uiTheme: 'vs-dark' });
      }).toThrow('Theme must have an id');
    });

    it('should throw error if theme label is missing', () => {
      expect(() => {
        themeAPI.registerTheme({ id: 'theme', uiTheme: 'vs-dark' });
      }).toThrow('Theme must have a label');
    });

    it('should throw error if uiTheme is invalid', () => {
      expect(() => {
        themeAPI.registerTheme({ id: 'theme', label: 'Theme', uiTheme: 'invalid' });
      }).toThrow("Theme uiTheme must be one of: 'vs', 'vs-dark', 'hc-black', 'hc-light'");
    });

    it('should throw error if theme id already exists', () => {
      const theme = { id: 'theme', label: 'Theme', uiTheme: 'vs-dark' };
      themeAPI.registerTheme(theme);

      expect(() => {
        themeAPI.registerTheme(theme);
      }).toThrow("Theme 'theme' already exists");
    });

    it('should accept all valid uiTheme values', () => {
      const validThemes = ['vs', 'vs-dark', 'hc-black', 'hc-light'];

      validThemes.forEach((uiTheme, index) => {
        const theme = {
          id: `theme-${index}`,
          label: `Theme ${index}`,
          uiTheme
        };
        expect(() => themeAPI.registerTheme(theme)).not.toThrow();
      });
    });

    it('should emit theme_registered event', () => {
      const listener = vi.fn();
      themeAPI.on('theme_registered', listener);

      const theme = { id: 'theme', label: 'Theme', uiTheme: 'vs-dark' };
      themeAPI.registerTheme(theme);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'theme',
          theme: expect.objectContaining({ id: 'theme' })
        })
      );
    });

    it('should return disposable that unregisters the theme', () => {
      const theme = { id: 'theme', label: 'Theme', uiTheme: 'vs-dark' };
      const disposable = themeAPI.registerTheme(theme);

      expect(themeAPI.themes.has('theme')).toBe(true);

      disposable.dispose();

      expect(themeAPI.themes.has('theme')).toBe(false);
      expect(mockThemeManager.unregisterTheme).toHaveBeenCalledWith('theme');
    });

    it('should work without theme manager', () => {
      const apiWithoutManager = new ThemeAPI(null);
      apiWithoutManager.currentPluginId = 'test-plugin';

      const theme = { id: 'theme', label: 'Theme', uiTheme: 'vs-dark' };
      expect(() => apiWithoutManager.registerTheme(theme)).not.toThrow();
      expect(apiWithoutManager.themes.has('theme')).toBe(true);
    });
  });

  describe('getActiveTheme()', () => {
    it('should get active theme from theme manager', async () => {
      mockThemeManager.getActiveTheme.mockResolvedValue('my-theme');

      const result = await themeAPI.getActiveTheme();

      expect(result).toBe('my-theme');
      expect(mockThemeManager.getActiveTheme).toHaveBeenCalled();
    });

    it('should return default theme if no manager', async () => {
      const apiWithoutManager = new ThemeAPI(null);

      const result = await apiWithoutManager.getActiveTheme();

      expect(result).toBe('vs-dark');
    });

    it('should return stored active theme', async () => {
      const apiWithoutManager = new ThemeAPI(null);
      apiWithoutManager.activeThemeId = 'custom-theme';

      const result = await apiWithoutManager.getActiveTheme();

      expect(result).toBe('custom-theme');
    });
  });

  describe('setActiveTheme()', () => {
    beforeEach(() => {
      const theme = { id: 'my-theme', label: 'My Theme', uiTheme: 'vs-dark' };
      themeAPI.registerTheme(theme);
    });

    it('should set active theme', async () => {
      await themeAPI.setActiveTheme('my-theme');

      expect(themeAPI.activeThemeId).toBe('my-theme');
      expect(mockThemeManager.setActiveTheme).toHaveBeenCalledWith('my-theme');
    });

    it('should throw error if theme not found', async () => {
      await expect(themeAPI.setActiveTheme('nonexistent')).rejects.toThrow(
        "Theme 'nonexistent' not found"
      );
    });

    it('should emit did_change_active_theme event', async () => {
      const listener = vi.fn();
      themeAPI.on('did_change_active_theme', listener);

      await themeAPI.setActiveTheme('my-theme');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          themeId: 'my-theme',
          previousThemeId: null
        })
      );
    });

    it('should emit event with previous theme', async () => {
      themeAPI.activeThemeId = 'old-theme';
      const listener = vi.fn();
      themeAPI.on('did_change_active_theme', listener);

      await themeAPI.setActiveTheme('my-theme');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          themeId: 'my-theme',
          previousThemeId: 'old-theme'
        })
      );
    });

    it('should work without theme manager', async () => {
      const apiWithoutManager = new ThemeAPI(null);
      apiWithoutManager.currentPluginId = 'test-plugin';
      const theme = { id: 'theme', label: 'Theme', uiTheme: 'vs-dark' };
      apiWithoutManager.registerTheme(theme);

      await expect(apiWithoutManager.setActiveTheme('theme')).resolves.not.toThrow();
      expect(apiWithoutManager.activeThemeId).toBe('theme');
    });
  });

  describe('getThemes()', () => {
    it('should return all registered themes', () => {
      themeAPI.registerTheme({ id: 'theme1', label: 'Theme 1', uiTheme: 'vs' });
      themeAPI.registerTheme({ id: 'theme2', label: 'Theme 2', uiTheme: 'vs-dark' });

      const themes = themeAPI.getThemes();

      expect(themes).toHaveLength(2);
      expect(themes[0]).toEqual({
        id: 'theme1',
        label: 'Theme 1',
        uiTheme: 'vs',
        pluginId: 'test-plugin'
      });
      expect(themes[1]).toEqual({
        id: 'theme2',
        label: 'Theme 2',
        uiTheme: 'vs-dark',
        pluginId: 'test-plugin'
      });
    });

    it('should return empty array when no themes', () => {
      const themes = themeAPI.getThemes();
      expect(themes).toEqual([]);
    });
  });

  describe('getTheme()', () => {
    it('should get specific theme by id', () => {
      const theme = { id: 'my-theme', label: 'My Theme', uiTheme: 'vs-dark' };
      themeAPI.registerTheme(theme);

      const result = themeAPI.getTheme('my-theme');

      expect(result).toMatchObject({
        id: 'my-theme',
        label: 'My Theme',
        uiTheme: 'vs-dark'
      });
    });

    it('should return undefined for non-existent theme', () => {
      const result = themeAPI.getTheme('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('onDidChangeActiveTheme()', () => {
    it('should subscribe to active theme changes', async () => {
      const theme = { id: 'my-theme', label: 'My Theme', uiTheme: 'vs-dark' };
      themeAPI.registerTheme(theme);

      const listener = vi.fn();
      const disposable = themeAPI.onDidChangeActiveTheme(listener);

      await themeAPI.setActiveTheme('my-theme');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ themeId: 'my-theme' })
      );
      expect(disposable).toHaveProperty('dispose');
    });

    it('should unsubscribe when disposed', async () => {
      const theme = { id: 'my-theme', label: 'My Theme', uiTheme: 'vs-dark' };
      themeAPI.registerTheme(theme);

      const listener = vi.fn();
      const disposable = themeAPI.onDidChangeActiveTheme(listener);
      disposable.dispose();

      await themeAPI.setActiveTheme('my-theme');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('unregisterAll()', () => {
    it('should unregister all themes for a plugin', () => {
      themeAPI.registerTheme({ id: 'theme1', label: 'Theme 1', uiTheme: 'vs' });
      themeAPI.registerTheme({ id: 'theme2', label: 'Theme 2', uiTheme: 'vs-dark' });

      const otherAPI = new ThemeAPI(mockThemeManager);
      otherAPI.currentPluginId = 'other-plugin';
      otherAPI.registerTheme({ id: 'theme3', label: 'Theme 3', uiTheme: 'vs' });

      // Merge the themes for testing
      for (const [id, theme] of otherAPI.themes) {
        themeAPI.themes.set(id, theme);
      }

      expect(themeAPI.themes.size).toBe(3);

      themeAPI.unregisterAll('test-plugin');

      expect(themeAPI.themes.has('theme1')).toBe(false);
      expect(themeAPI.themes.has('theme2')).toBe(false);
      expect(themeAPI.themes.has('theme3')).toBe(true); // Other plugin's theme remains
    });

    it('should emit theme_unregistered events', () => {
      const listener = vi.fn();
      themeAPI.on('theme_unregistered', listener);

      themeAPI.registerTheme({ id: 'theme1', label: 'Theme 1', uiTheme: 'vs' });
      themeAPI.unregisterAll('test-plugin');

      expect(listener).toHaveBeenCalledWith({ id: 'theme1' });
    });

    it('should call theme manager unregister', () => {
      themeAPI.registerTheme({ id: 'theme1', label: 'Theme 1', uiTheme: 'vs' });
      themeAPI.unregisterAll('test-plugin');

      expect(mockThemeManager.unregisterTheme).toHaveBeenCalledWith('theme1');
    });
  });

  describe('theme path support', () => {
    it('should support theme path', () => {
      const theme = {
        id: 'file-theme',
        label: 'File Theme',
        uiTheme: 'vs-dark',
        path: '/themes/my-theme.json'
      };

      themeAPI.registerTheme(theme);

      const registered = themeAPI.themes.get('file-theme');
      expect(registered.path).toBe('/themes/my-theme.json');
    });
  });
});
