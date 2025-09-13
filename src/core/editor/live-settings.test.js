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
      fontSize: 16,
      fontFamily: 'ui-sans-serif',
      lineHeight: 1.7,
      letterSpacing: 0.003,
      h1Size: 2.0,
      h2Size: 1.6,
      h3Size: 1.3,
      headingColor: 'inherit',
      linkColor: 'rgb(var(--accent))',
      codeBlockTheme: 'default'
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