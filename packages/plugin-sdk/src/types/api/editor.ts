/**
 * @fileoverview Editor API types
 */

import type { Disposable } from '../utilities.js'
import type { Position, Range, Selection, TextDocument, TextEditor } from './commands.js'

/**
 * Editor API interface
 */
export interface EditorAPI {
  /**
   * Get current active editor
   */
  getActiveEditor(): Promise<TextEditor | undefined>
  
  /**
   * Get all visible editors
   */
  getVisibleEditors(): Promise<TextEditor[]>
  
  /**
   * Get active text document
   */
  getActiveDocument(): Promise<TextDocument | undefined>
  
  /**
   * Get all open documents
   */
  getOpenDocuments(): Promise<TextDocument[]>
  
  /**
   * Open document
   */
  openDocument(uri: string, options?: OpenDocumentOptions): Promise<TextDocument>
  
  /**
   * Show document in editor
   */
  showDocument(document: TextDocument, options?: ShowDocumentOptions): Promise<TextEditor>
  
  /**
   * Create untitled document
   */
  createUntitledDocument(options?: UntitledDocumentOptions): Promise<TextDocument>
  
  /**
   * Get current content
   */
  getContent(): Promise<string>
  
  /**
   * Set editor content
   */
  setContent(content: string): Promise<void>
  
  /**
   * Insert content at cursor
   */
  insertContent(content: string): Promise<void>
  
  /**
   * Get current selection
   */
  getSelection(): Promise<Selection | undefined>
  
  /**
   * Set selection
   */
  setSelection(selection: Selection): Promise<void>
  
  /**
   * Get all selections
   */
  getSelections(): Promise<Selection[]>
  
  /**
   * Set multiple selections
   */
  setSelections(selections: Selection[]): Promise<void>
  
  /**
   * Replace text in range
   */
  replaceText(range: Range, text: string): Promise<void>
  
  /**
   * Get text in range
   */
  getTextInRange(range: Range): Promise<string>
  
  /**
   * Register completion provider
   */
  registerCompletionProvider(selector: DocumentSelector, provider: CompletionItemProvider, ...triggerCharacters: string[]): Disposable
  
  /**
   * Register hover provider
   */
  registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable
  
  /**
   * Register definition provider
   */
  registerDefinitionProvider(selector: DocumentSelector, provider: DefinitionProvider): Disposable
  
  /**
   * Register code action provider
   */
  registerCodeActionProvider(selector: DocumentSelector, provider: CodeActionProvider, metadata?: CodeActionProviderMetadata): Disposable
  
  /**
   * Register formatter
   */
  registerFormatter(selector: DocumentSelector, provider: DocumentFormattingEditProvider): Disposable
  
  /**
   * Register range formatter
   */
  registerRangeFormatter(selector: DocumentSelector, provider: DocumentRangeFormattingEditProvider): Disposable
  
  /**
   * Register semantic tokens provider
   */
  registerSemanticTokensProvider(selector: DocumentSelector, provider: DocumentSemanticTokensProvider, legend: SemanticTokensLegend): Disposable
  
  /**
   * Register folding range provider
   */
  registerFoldingRangeProvider(selector: DocumentSelector, provider: FoldingRangeProvider): Disposable
  
  /**
   * Register document link provider
   */
  registerDocumentLinkProvider(selector: DocumentSelector, provider: DocumentLinkProvider): Disposable
  
  /**
   * Listen to document changes
   */
  onDidChangeActiveTextEditor(listener: (editor: TextEditor | undefined) => void): Disposable
  
  /**
   * Listen to document content changes
   */
  onDidChangeTextDocument(listener: (event: TextDocumentChangeEvent) => void): Disposable
  
  /**
   * Listen to selection changes
   */
  onDidChangeTextEditorSelection(listener: (event: TextEditorSelectionChangeEvent) => void): Disposable
  
  /**
   * Listen to visible range changes
   */
  onDidChangeTextEditorVisibleRanges(listener: (event: TextEditorVisibleRangesChangeEvent) => void): Disposable
}

/**
 * Document selector
 */
export type DocumentSelector = string | DocumentFilter | Array<string | DocumentFilter>

/**
 * Document filter
 */
export interface DocumentFilter {
  /** Language ID */
  language?: string
  
  /** File scheme */
  scheme?: string
  
  /** File pattern */
  pattern?: string
  
  /** Notebook type */
  notebookType?: string
}

/**
 * Open document options
 */
export interface OpenDocumentOptions {
  /** Preview mode */
  preview?: boolean
  
  /** Selection to reveal */
  selection?: Range
  
  /** Preserve focus */
  preserveFocus?: boolean
  
  /** View column */
  viewColumn?: ViewColumn
}

/**
 * Show document options
 */
export interface ShowDocumentOptions extends OpenDocumentOptions {
  /** External application */
  external?: boolean
  
  /** Take focus */
  takeFocus?: boolean
}

/**
 * Untitled document options
 */
export interface UntitledDocumentOptions {
  /** Language ID */
  language?: string
  
  /** Initial content */
  content?: string
}

/**
 * Completion item provider
 */
export interface CompletionItemProvider {
  /**
   * Provide completion items
   */
  provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    context: CompletionContext
  ): CompletionItem[] | Promise<CompletionItem[]> | CompletionList | Promise<CompletionList>
  
  /**
   * Resolve completion item
   */
  resolveCompletionItem?(
    item: CompletionItem,
    token: CancellationToken
  ): CompletionItem | Promise<CompletionItem>
}

/**
 * Completion context
 */
export interface CompletionContext {
  /** Trigger kind */
  triggerKind: CompletionTriggerKind
  
  /** Trigger character */
  triggerCharacter?: string
}

/**
 * Completion trigger kind
 */
export enum CompletionTriggerKind {
  Invoke = 0,
  TriggerCharacter = 1,
  TriggerForIncompleteCompletions = 2
}

/**
 * Completion item
 */
export interface CompletionItem {
  /** Label */
  label: string | CompletionItemLabel
  
  /** Kind */
  kind?: CompletionItemKind
  
  /** Tags */
  tags?: CompletionItemTag[]
  
  /** Detail */
  detail?: string
  
  /** Documentation */
  documentation?: string | MarkdownString
  
  /** Sort text */
  sortText?: string
  
  /** Filter text */
  filterText?: string
  
  /** Preselect */
  preselect?: boolean
  
  /** Insert text */
  insertText?: string | SnippetString
  
  /** Text edit */
  textEdit?: TextEdit | InsertReplaceEdit
  
  /** Additional text edits */
  additionalTextEdits?: TextEdit[]
  
  /** Command */
  command?: Command
  
  /** Commit characters */
  commitCharacters?: string[]
}

/**
 * Completion item label
 */
export interface CompletionItemLabel {
  /** Label text */
  label: string
  
  /** Description */
  description?: string
  
  /** Detail */
  detail?: string
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
  Folder = 18,
  EnumMember = 19,
  Constant = 20,
  Struct = 21,
  Event = 22,
  Operator = 23,
  TypeParameter = 24,
  User = 25,
  Issue = 26
}

/**
 * Completion item tag
 */
export enum CompletionItemTag {
  Deprecated = 1
}

/**
 * Completion list
 */
export interface CompletionList {
  /** Is incomplete */
  isIncomplete: boolean
  
  /** Items */
  items: CompletionItem[]
}

/**
 * Hover provider
 */
export interface HoverProvider {
  /**
   * Provide hover information
   */
  provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Hover | undefined | Promise<Hover | undefined>
}

/**
 * Hover information
 */
export interface Hover {
  /** Contents */
  contents: MarkdownString[] | MarkdownString | string[]
  
  /** Range */
  range?: Range
}

/**
 * Definition provider
 */
export interface DefinitionProvider {
  /**
   * Provide definition
   */
  provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Definition | Promise<Definition>
}

/**
 * Definition
 */
export type Definition = Location | Location[] | LocationLink[]

/**
 * Location
 */
export interface Location {
  /** URI */
  uri: string
  
  /** Range */
  range: Range
}

/**
 * Location link
 */
export interface LocationLink {
  /** Origin selection range */
  originSelectionRange?: Range
  
  /** Target URI */
  targetUri: string
  
  /** Target range */
  targetRange: Range
  
  /** Target selection range */
  targetSelectionRange?: Range
}

/**
 * Code action provider
 */
export interface CodeActionProvider {
  /**
   * Provide code actions
   */
  provideCodeActions(
    document: TextDocument,
    range: Range | Selection,
    context: CodeActionContext,
    token: CancellationToken
  ): CodeAction[] | Promise<CodeAction[]>
  
  /**
   * Resolve code action
   */
  resolveCodeAction?(
    codeAction: CodeAction,
    token: CancellationToken
  ): CodeAction | Promise<CodeAction>
}

/**
 * Code action context
 */
export interface CodeActionContext {
  /** Diagnostics */
  diagnostics: Diagnostic[]
  
  /** Only kinds */
  only?: CodeActionKind[]
  
  /** Trigger kind */
  triggerKind?: CodeActionTriggerKind
}

/**
 * Code action
 */
export interface CodeAction {
  /** Title */
  title: string
  
  /** Edit */
  edit?: WorkspaceEdit
  
  /** Diagnostics */
  diagnostics?: Diagnostic[]
  
  /** Kind */
  kind?: CodeActionKind
  
  /** Is preferred */
  isPreferred?: boolean
  
  /** Disabled */
  disabled?: {
    reason: string
  }
  
  /** Command */
  command?: Command
}

/**
 * Additional types would continue here...
 * For brevity, I'm including the essential interfaces
 */

export interface TextEdit {
  range: Range
  newText: string
}

export interface InsertReplaceEdit {
  newText: string
  insert: Range
  replace: Range
}

export interface Command {
  title: string
  command: string
  tooltip?: string
  arguments?: unknown[]
}

export interface CancellationToken {
  isCancellationRequested: boolean
  onCancellationRequested: Event<any>
}

export interface Event<T> {
  (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]): Disposable
}

export interface ViewColumn {
  // Defined in commands.ts
}

export interface MarkdownString {
  value: string
  isTrusted?: boolean
  supportThemeIcons?: boolean
}

export interface SnippetString {
  value: string
}

export interface WorkspaceEdit {
  // Simplified for now
  changes?: { [uri: string]: TextEdit[] }
}

export interface Diagnostic {
  range: Range
  message: string
  severity?: DiagnosticSeverity
  source?: string
  code?: string | number
  relatedInformation?: DiagnosticRelatedInformation[]
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3
}

export interface DiagnosticRelatedInformation {
  location: Location
  message: string
}

export interface CodeActionKind {
  value: string
}

export enum CodeActionTriggerKind {
  Invoke = 1,
  Automatic = 2
}

export interface CodeActionProviderMetadata {
  providedCodeActionKinds?: CodeActionKind[]
  documentation?: CodeActionDocumentation[]
}

export interface CodeActionDocumentation {
  kind: CodeActionKind
  command: Command
}

export interface DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(
    document: TextDocument,
    options: FormattingOptions,
    token: CancellationToken
  ): TextEdit[] | Promise<TextEdit[]>
}

export interface DocumentRangeFormattingEditProvider {
  provideDocumentRangeFormattingEdits(
    document: TextDocument,
    range: Range,
    options: FormattingOptions,
    token: CancellationToken
  ): TextEdit[] | Promise<TextEdit[]>
}

export interface FormattingOptions {
  tabSize: number
  insertSpaces: boolean
  [key: string]: boolean | number | string
}

export interface DocumentSemanticTokensProvider {
  provideDocumentSemanticTokens(
    document: TextDocument,
    token: CancellationToken
  ): SemanticTokens | Promise<SemanticTokens>
  
  provideDocumentSemanticTokensEdits?(
    document: TextDocument,
    previousResultId: string,
    token: CancellationToken
  ): SemanticTokens | SemanticTokensEdits | Promise<SemanticTokens | SemanticTokensEdits>
}

export interface SemanticTokens {
  resultId?: string
  data: Uint32Array
}

export interface SemanticTokensEdits {
  resultId?: string
  edits: SemanticTokensEdit[]
}

export interface SemanticTokensEdit {
  start: number
  deleteCount: number
  data?: Uint32Array
}

export interface SemanticTokensLegend {
  tokenTypes: string[]
  tokenModifiers: string[]
}

export interface FoldingRangeProvider {
  provideFoldingRanges(
    document: TextDocument,
    context: FoldingContext,
    token: CancellationToken
  ): FoldingRange[] | Promise<FoldingRange[]>
}

export interface FoldingRange {
  start: number
  end: number
  kind?: FoldingRangeKind
  collapsedText?: string
}

export enum FoldingRangeKind {
  Comment = 1,
  Imports = 2,
  Region = 3
}

export interface FoldingContext {
  maxRanges: number
}

export interface DocumentLinkProvider {
  provideDocumentLinks(
    document: TextDocument,
    token: CancellationToken
  ): DocumentLink[] | Promise<DocumentLink[]>
  
  resolveDocumentLink?(
    link: DocumentLink,
    token: CancellationToken
  ): DocumentLink | Promise<DocumentLink>
}

export interface DocumentLink {
  range: Range
  target?: string
  tooltip?: string
}

export interface TextDocumentChangeEvent {
  document: TextDocument
  contentChanges: TextDocumentContentChangeEvent[]
  reason?: TextDocumentChangeReason
}

export interface TextDocumentContentChangeEvent {
  range?: Range
  rangeOffset?: number
  rangeLength?: number
  text: string
}

export enum TextDocumentChangeReason {
  Undo = 1,
  Redo = 2
}

export interface TextEditorSelectionChangeEvent {
  textEditor: TextEditor
  selections: Selection[]
  kind?: TextEditorSelectionChangeKind
}

export enum TextEditorSelectionChangeKind {
  Keyboard = 1,
  Mouse = 2,
  Command = 3
}

export interface TextEditorVisibleRangesChangeEvent {
  textEditor: TextEditor
  visibleRanges: Range[]
}