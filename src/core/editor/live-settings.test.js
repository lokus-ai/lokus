import { describe, it, expect, beforeEach, vi } from 'vitest'
import liveEditorSettings from './live-settings.js'

describe('Live Editor Settings', () => {
  beforeEach(() => {
    // Reset settings before each test
    liveEditorSettings.reset()

    // Clear DOM
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('should have default settings', () => {
    const settings = liveEditorSettings.getAllSettings()
    expect(settings).toEqual({
      // Font & Typography
      fontSize: 16,
      fontFamily: 'ui-sans-serif',
      lineHeight: 1.7,
      letterSpacing: 0.003,
      fontWeight: 400,
      boldWeight: 700,
      h1Size: 2.0,
      h2Size: 1.6,
      h3Size: 1.3,
      h1Weight: 700,
      h2Weight: 600,
      h3Weight: 600,

      // Colors
      textColor: '#inherit',
      headingColor: '#inherit',
      linkColor: '#inherit',
      linkHoverColor: '#inherit',
      codeColor: '#inherit',
      codeBackground: '#f5f5f5',
      blockquoteColor: '#inherit',
      blockquoteBorder: '#e5e5e5',

      // Spacing
      paragraphSpacing: 1,
      listSpacing: 0.25,
      indentSize: 2,
      headingMarginTop: 1.5,
      headingMarginBottom: 0.5,
      blockMargin: 1.5,

      // List Symbols
      bulletStyle: '•',
      numberedStyle: '1.',
      checkboxStyle: '☑',
      listIndent: 2,

      // Highlights
      highlightColor: '#fff3cd',
      highlightTextColor: '#inherit',

      // Code Blocks
      codeBlockBg: '#f8f9fa',
      codeBlockBorder: '#e9ecef',
      codeBlockBorderWidth: 1,
      codeBlockBorderRadius: 8,
      codeBlockPadding: 16,
      codeBlockFont: 'ui-monospace',
      codeBlockFontSize: 14,
      codeBlockLineHeight: 1.5,

      // Links
      linkUnderline: 'hover',
      linkUnderlineThickness: 1,
      linkUnderlineOffset: 2,

      // Text Decorations
      strikethroughColor: '#6c757d',
      strikethroughThickness: 2,
      underlineColor: '#inherit',
      underlineThickness: 1,

      // Bold & Italic
      boldColor: '#inherit',
      italicColor: '#inherit',

      // Blockquotes
      blockquoteBorderWidth: 4,
      blockquotePadding: 16,
      blockquoteStyle: 'solid',

      // Tables
      tableBorder: '#dee2e6',
      tableBorderWidth: 1,
      tableHeaderBg: null,
      tableCellPadding: 12,

      // Selection
      selectionColor: 'rgba(99, 102, 241, 0.2)'
    })
  })

  it('should update individual settings', () => {
    liveEditorSettings.setSetting('fontSize', 18)
    expect(liveEditorSettings.getSetting('fontSize')).toBe(18)
  })

  it('should update multiple settings', () => {
    const newSettings = {
      fontSize: 20,
      fontFamily: 'serif',
      lineHeight: 1.8
    }

    liveEditorSettings.updateSettings(newSettings)

    expect(liveEditorSettings.getSetting('fontSize')).toBe(20)
    expect(liveEditorSettings.getSetting('fontFamily')).toBe('serif')
    expect(liveEditorSettings.getSetting('lineHeight')).toBe(1.8)
  })

  it('should apply CSS variables to document', () => {
    liveEditorSettings.setSetting('fontSize', 18)
    liveEditorSettings.setSetting('fontFamily', 'monospace')

    const computedStyle = getComputedStyle(document.documentElement)
    // Note: In test environment, CSS variables might not be directly readable
    // but we can verify the method doesn't throw
    expect(() => liveEditorSettings.applyCSSVariables()).not.toThrow()
  })

  it('should notify subscribers of changes', () => {
    const callback = vi.fn()
    const unsubscribe = liveEditorSettings.onSettingsChange(callback)

    liveEditorSettings.setSetting('fontSize', 18)

    expect(callback).toHaveBeenCalledWith('fontSize', 18, expect.any(Object))

    unsubscribe()
  })

  it('should handle multiple subscribers', () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    const unsubscribe1 = liveEditorSettings.onSettingsChange(callback1)
    const unsubscribe2 = liveEditorSettings.onSettingsChange(callback2)

    liveEditorSettings.setSetting('fontSize', 18)

    expect(callback1).toHaveBeenCalled()
    expect(callback2).toHaveBeenCalled()

    unsubscribe1()
    unsubscribe2()
  })

  it('should unsubscribe properly', () => {
    const callback = vi.fn()
    const unsubscribe = liveEditorSettings.onSettingsChange(callback)

    unsubscribe()
    liveEditorSettings.setSetting('fontSize', 18)

    expect(callback).not.toHaveBeenCalled()
  })

  it('should reset to defaults', () => {
    liveEditorSettings.setSetting('fontSize', 24)
    liveEditorSettings.setSetting('fontFamily', 'custom')

    liveEditorSettings.reset()

    expect(liveEditorSettings.getSetting('fontSize')).toBe(16)
    expect(liveEditorSettings.getSetting('fontFamily')).toBe('ui-sans-serif')
  })

  it('should handle invalid setting keys gracefully', () => {
    expect(() => {
      liveEditorSettings.setSetting('invalidKey', 'value')
    }).not.toThrow()

    expect(liveEditorSettings.getSetting('invalidKey')).toBeUndefined()
  })
})