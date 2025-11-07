/**
 * @fileoverview Terminal API types
 */

import type { Disposable } from '../utilities.js'

/**
 * Terminal API interface
 */
export interface TerminalAPI {
  // TODO: Add terminal API methods
  createTerminal(options: TerminalOptions): Terminal
  sendText(terminalId: string, text: string, addNewLine?: boolean): void
}

/**
 * Terminal options
 */
export interface TerminalOptions {
  name?: string
  shellPath?: string
  shellArgs?: string[]
  cwd?: string
  env?: Record<string, string>
}

/**
 * Terminal interface
 */
export interface Terminal extends Disposable {
  name: string
  processId: Promise<number | undefined>
  sendText(text: string, addNewLine?: boolean): void
  show(preserveFocus?: boolean): void
  hide(): void
}
