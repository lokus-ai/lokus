import type { Disposable } from '../utilities.js'
import type {
  TextDocument,
  Position,
  Range,
  CompletionItem,
  CompletionItemKind,
  Hover,
  CompletionList,
  DocumentSelector
} from '../models.js'

/**
 * Language API interface
 */
export interface LanguageAPI {
  // TODO: Add language API methods
  registerCompletionProvider(selector: DocumentSelector, provider: CompletionProvider): Disposable
  registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable
}

/**
 * Completion provider
 */
export interface CompletionProvider {
  provideCompletionItems(document: TextDocument, position: Position): Promise<CompletionItem[] | CompletionList>
}

/**
 * Hover provider
 */
export interface HoverProvider {
  provideHover(document: TextDocument, position: Position): Promise<Hover | undefined>
}

/**
 * Language type (for re-export compatibility)
 */
export interface Language {
  id: string
  aliases?: string[]
  extensions?: string[]
}
