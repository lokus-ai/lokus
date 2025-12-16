import type { Disposable } from '../utilities.js'
import type {
  Terminal,
  TerminalOptions
} from '../models.js'

/**
 * Terminal API interface
 */
export interface TerminalAPI {
  // TODO: Add terminal API methods
  createTerminal(options: TerminalOptions): Terminal
  sendText(terminalId: string, text: string, addNewLine?: boolean): void
}
