/**
 * @fileoverview Editor API types
 */

import type { Disposable, Event } from '../utilities.js'


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

import type {
  Position,
  Range,
  Selection,
  TextDocument,
  TextEditor,
  TextEditorEdit,
  ViewColumn,
  EndOfLine,
  TextEditorOptions,
  TextEditorCursorStyle,
  TextEditorLineNumbersStyle,
  TextEditorEditOptions,
  SnippetString,
  TextEditorInsertOptions,
  TextEditorDecorationType,
  DecorationOptions,
  DecorationInstanceRenderOptions,
  ThemableDecorationAttachmentRenderOptions,
  ThemeColor,
  MarkdownString,
  TextEditorRevealType,
  ThemeIcon,
  CancellationToken,
  TextLine,
  DocumentSelector,
  OpenDocumentOptions,
  ShowDocumentOptions,
  UntitledDocumentOptions,
  CompletionItemProvider,
  HoverProvider,
  DefinitionProvider,
  CodeActionProvider,
  CodeActionProviderMetadata,
  DocumentFormattingEditProvider,
  DocumentRangeFormattingEditProvider,
  DocumentSemanticTokensProvider,
  SemanticTokensLegend,
  FoldingRangeProvider,
  DocumentLinkProvider,
  TextDocumentChangeEvent,
  TextEditorSelectionChangeEvent,
  TextEditorVisibleRangesChangeEvent
} from '../models.js'
