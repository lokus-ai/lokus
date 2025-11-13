/**
 * @fileoverview Themes API types
 */

import type { Disposable } from '../utilities.js'

/**
 * Theme API interface
 */
export interface ThemeAPI {
  // TODO: Add theme API methods
  registerTheme(theme: ThemeContribution): Disposable
  getActiveTheme(): Promise<string>
  setActiveTheme(themeId: string): Promise<void>
}

/**
 * Theme contribution
 */
export interface ThemeContribution {
  id: string
  label: string
  uiTheme: 'vs' | 'vs-dark' | 'hc-black' | 'hc-light'
  path?: string
  colors?: Record<string, string>
  tokenColors?: TokenColor[]
}

/**
 * Token color
 */
export interface TokenColor {
  name?: string
  scope?: string | string[]
  settings: {
    foreground?: string
    background?: string
    fontStyle?: string
  }
}
