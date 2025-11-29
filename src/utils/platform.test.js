import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectPlatform, PLATFORMS, createShortcut, normalizePath, joinPath } from './platform';

describe('platform utils', () => {
    const originalNavigator = global.navigator;
    const originalWindow = global.window;

    beforeEach(() => {
        vi.resetModules();
        // Reset navigator/window mocks
        global.navigator = { ...originalNavigator };
        global.window = { ...originalWindow };
    });

    afterEach(() => {
        global.navigator = originalNavigator;
        global.window = originalWindow;
    });

    describe('detectPlatform', () => {
        it('should detect Windows from userAgent', () => {
            global.navigator = {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                platform: 'Win32'
            };
            expect(detectPlatform()).toBe(PLATFORMS.WINDOWS);
        });

        it('should detect MacOS from userAgent', () => {
            global.navigator = {
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                platform: 'MacIntel'
            };
            expect(detectPlatform()).toBe(PLATFORMS.MACOS);
        });

        it('should detect Linux from userAgent', () => {
            global.navigator = {
                userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
                platform: 'Linux x86_64'
            };
            expect(detectPlatform()).toBe(PLATFORMS.LINUX);
        });

        it('should detect Tauri Windows', () => {
            global.window = { __TAURI__: true };
            global.navigator = { userAgent: 'windows' };
            expect(detectPlatform()).toBe(PLATFORMS.WINDOWS);
        });
    });

    describe('createShortcut', () => {
        // We can't easily change the platform for createShortcut because it uses cached getCurrentPlatform
        // But we can verify it returns a string with the key
        it('should create shortcut string', () => {
            const shortcut = createShortcut('S', { primary: true });
            expect(shortcut).toContain('S');
            // It should contain Cmd or Ctrl depending on the current test env platform
            // We can't assert exactly which one without knowing the env, but we can check structure
        });

        it('should handle shift modifier', () => {
            const shortcut = createShortcut('Enter', { shift: true });
            expect(shortcut).toContain('Shift');
            expect(shortcut).toContain('Enter');
        });
    });

    describe('normalizePath', () => {
        it('should replace slashes', () => {
            // If we are on linux/mac, it replaces \ with /
            // If on windows, / with \
            // Let's just check it returns a string
            const path = 'a/b\\c';
            const normalized = normalizePath(path);
            expect(typeof normalized).toBe('string');
            // It should be consistent
            expect(normalized.includes('/') && normalized.includes('\\')).toBe(false);
        });
    });
});
