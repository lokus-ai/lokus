/**
 * @fileoverview Languages API types
 */

import type { Disposable } from '../utilities.js'

/**
 * Language API interface
 */
export interface LanguageAPI {
  // TODO: Add language API methods
  registerCompletionProvider(selector: DocumentSelector, provider: CompletionProvider): Disposable
  registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable
}

/**
 * Document selector
 */
export type DocumentSelector = string | DocumentFilter | Array<string | DocumentFilter>

/**
 * Document filter
 */
export interface DocumentFilter {
  language?: string
  scheme?: string
  pattern?: string
}

/**
 * Completion provider
 */
export interface CompletionProvider {
  provideCompletionItems(document: TextDocument, position: Position): Promise<CompletionItem[]>
}

/**
 * Hover provider
 */
export interface HoverProvider {
  provideHover(document: TextDocument, position: Position): Promise<Hover | undefined>
}

/**
 * Text document interface (stub)
 */
export interface TextDocument {
  uri: string
  languageId: string
  version: number
  getText(): string
}

/**
 * Position interface (stub)
 */
export interface Position {
  line: number
  character: number
}

/**
 * Completion item
 */
export interface CompletionItem {
  label: string
  kind?: CompletionItemKind
  detail?: string
  documentation?: string
  insertText?: string
}

/**
 * Completion item kind
 */
export enum CompletionItemKind {
  Text = 0,
  Method = 1,
  Function = 2,
  Constructor = 3,
  Field = 4,
  Variable = 5,
  Class = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Unit = 10,
  Value = 11,
  Enum = 12,
  Keyword = 13,
  Snippet = 14,
  Color = 15,
  Reference = 17,
  File = 16,
  Folder = 18
}

/**
 * Hover information
 */
export interface Hover {
  contents: string | string[]
  range?: Range
}

/**
 * Range interface (stub)
 */
export interface Range {
  start: Position
  end: Position
}

/**
 * Language type (for re-export compatibility)
 */
export interface Language {
  id: string
  aliases?: string[]
  extensions?: string[]
}
