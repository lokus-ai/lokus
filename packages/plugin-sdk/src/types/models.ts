/**
 * @fileoverview Shared data models and types for Lokus Plugin SDK
 */

import type { Disposable, Event } from './utilities.js'

/**
 * Position in a text document
 */
export interface Position {
    line: number
    character: number
}

/**
 * Range in a text document
 */
export interface Range {
    start: Position
    end: Position
}

/**
 * Selection in a text editor
 */
export interface Selection extends Range {
    anchor: Position
    active: Position
}

/**
 * Text line in a document
 */
export interface TextLine {
    lineNumber: number
    text: string
    range: Range
    rangeIncludingLineBreak: Range
    firstNonWhitespaceCharacterIndex: number
    isEmptyOrWhitespace: boolean
}

/**
 * View column for editor layout
 */
export enum ViewColumn {
    Active = -1,
    Beside = -2,
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7,
    Eight = 8,
    Nine = 9
}

/**
 * End of line character
 */
export enum EndOfLine {
    LF = 1,
    CRLF = 2
}

/**
 * Text editor cursor style
 */
export enum TextEditorCursorStyle {
    Line = 1,
    Block = 2,
    Underline = 3,
    LineThin = 4,
    BlockOutline = 5,
    UnderlineThin = 6
}

/**
 * Text editor line numbers style
 */
export enum TextEditorLineNumbersStyle {
    Off = 0,
    On = 1,
    Relative = 2
}

/**
 * Text editor options
 */
export interface TextEditorOptions {
    tabSize?: number
    insertSpaces?: boolean
    cursorStyle?: TextEditorCursorStyle
    lineNumbers?: TextEditorLineNumbersStyle
}

/**
 * Text editor decoration type
 */
export interface TextEditorDecorationType {
    key: string
    dispose(): void
}

/**
 * Decoration options
 */
export interface DecorationOptions {
    range: Range
    hoverMessage?: string | MarkdownString | Array<string | MarkdownString>
    renderOptions?: DecorationInstanceRenderOptions
}

/**
 * Decoration render options
 */
export interface DecorationInstanceRenderOptions {
    before?: ThemableDecorationAttachmentRenderOptions
    after?: ThemableDecorationAttachmentRenderOptions
}

/**
 * Themable decoration attachment render options
 */
export interface ThemableDecorationAttachmentRenderOptions {
    contentText?: string
    contentIconPath?: string
    border?: string
    borderColor?: string | ThemeColor
    fontStyle?: string
    fontWeight?: string
    textDecoration?: string
    color?: string | ThemeColor
    backgroundColor?: string | ThemeColor
    margin?: string
    width?: string
    height?: string
}

/**
 * Theme color
 */
export interface ThemeColor {
    id: string
}

/**
 * Theme icon
 */
export interface ThemeIcon {
    id: string
    color?: string
    light?: string
    dark?: string
}

/**
 * Markdown string
 */
export interface MarkdownString {
    value: string
    isTrusted?: boolean
    supportThemeIcons?: boolean
    supportHtml?: boolean
    baseUri?: string
}

/**
 * Snippet string
 */
export interface SnippetString {
    value: string
    appendText(string: string): SnippetString
    appendTabstop(number?: number): SnippetString
    appendPlaceholder(value: string | ((snippet: SnippetString) => any), number?: number): SnippetString
    appendChoice(values: string[], number?: number): SnippetString
    appendVariable(name: string, defaultValue: string | ((snippet: SnippetString) => any)): SnippetString
}

/**
 * Text edit
 */
export interface TextEdit {
    range: Range
    newText: string
}

/**
 * Insert replace edit
 */
export interface InsertReplaceEdit {
    newText: string
    insert: Range
    replace: Range
}

/**
 * Workspace edit
 */
export interface WorkspaceEdit {
    changes?: { [uri: string]: TextEdit[] }
}

/**
 * Cancellation token
 */
export interface CancellationToken {
    isCancellationRequested: boolean
    onCancellationRequested: Event<any>
}

/**
 * Text document interface
 */
export interface TextDocument {
    uri: string
    fileName: string
    languageId: string
    version: number
    isDirty: boolean
    isClosed: boolean
    getText(range?: Range): string
    positionAt(offset: number): Position
    offsetAt(position: Position): number
    lineCount: number
    lineAt(line: number | Position): TextLine
    save(): Promise<boolean>
    validateRange(range: Range): Range
    validatePosition(position: Position): Position
    getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined
}

/**
 * Text editor interface
 */
export interface TextEditor {
    document: TextDocument
    selection: Selection
    selections: Selection[]
    visibleRanges: Range[]
    options: TextEditorOptions
    viewColumn?: ViewColumn
    edit(callback: (editBuilder: TextEditorEdit) => void, options?: TextEditorEditOptions): Promise<boolean>
    insertSnippet(snippet: SnippetString, location?: Position | Range | Position[] | Range[], options?: TextEditorInsertOptions): Promise<boolean>
    setDecorations(decorationType: TextEditorDecorationType, rangesOrOptions: Range[] | DecorationOptions[]): void
    revealRange(range: Range, revealType?: TextEditorRevealType): void
    show(column?: ViewColumn): void
    hide(): void
}

/**
 * Text editor edit interface
 */
export interface TextEditorEdit {
    replace(location: Position | Range | Selection, value: string): void
    insert(location: Position, value: string): void
    delete(location: Range | Selection): void
    setEndOfLine(endOfLine: EndOfLine): void
}

/**
 * Text editor edit options
 */
export interface TextEditorEditOptions {
    undoStopBefore?: boolean
    undoStopAfter?: boolean
}

/**
 * Text editor insert options
 */
export interface TextEditorInsertOptions {
    undoStopBefore?: boolean
    undoStopAfter?: boolean
}

/**
 * Text editor reveal type
 */
export enum TextEditorRevealType {
    Default = 0,
    InCenter = 1,
    InCenterIfOutsideViewport = 2,
    AtTop = 3
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
    notebookType?: string
}

/**
 * Open document options
 */
export interface OpenDocumentOptions {
    preview?: boolean
    selection?: Range
    preserveFocus?: boolean
    viewColumn?: ViewColumn
}

/**
 * Show document options
 */
export interface ShowDocumentOptions extends OpenDocumentOptions {
    external?: boolean
    takeFocus?: boolean
}

/**
 * Untitled document options
 */
export interface UntitledDocumentOptions {
    language?: string
    content?: string
}

/**
 * Completion item provider
 */
export interface CompletionItemProvider {
    provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext
    ): CompletionItem[] | Promise<CompletionItem[]> | CompletionList | Promise<CompletionList>

    resolveCompletionItem?(
        item: CompletionItem,
        token: CancellationToken
    ): CompletionItem | Promise<CompletionItem>
}

/**
 * Completion context
 */
export interface CompletionContext {
    triggerKind: CompletionTriggerKind
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
    label: string | CompletionItemLabel
    kind?: CompletionItemKind
    tags?: CompletionItemTag[]
    detail?: string
    documentation?: string | MarkdownString
    sortText?: string
    filterText?: string
    preselect?: boolean
    insertText?: string | SnippetString
    textEdit?: TextEdit | InsertReplaceEdit
    additionalTextEdits?: TextEdit[]
    command?: LokusCommand
    commitCharacters?: string[]
}

/**
 * Completion item label
 */
export interface CompletionItemLabel {
    label: string
    description?: string
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
    isIncomplete: boolean
    items: CompletionItem[]
}

/**
 * Hover provider
 */
export interface HoverProvider {
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
    contents: MarkdownString[] | MarkdownString | string[]
    range?: Range
}

/**
 * Definition provider
 */
export interface DefinitionProvider {
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
    uri: string
    range: Range
}

/**
 * Location link
 */
export interface LocationLink {
    originSelectionRange?: Range
    targetUri: string
    targetRange: Range
    targetSelectionRange?: Range
}

/**
 * Code action provider
 */
export interface CodeActionProvider {
    provideCodeActions(
        document: TextDocument,
        range: Range | Selection,
        context: CodeActionContext,
        token: CancellationToken
    ): CodeAction[] | Promise<CodeAction[]>

    resolveCodeAction?(
        codeAction: CodeAction,
        token: CancellationToken
    ): CodeAction | Promise<CodeAction>
}

/**
 * Code action context
 */
export interface CodeActionContext {
    diagnostics: Diagnostic[]
    only?: CodeActionKind[]
    triggerKind?: CodeActionTriggerKind
}

/**
 * Code action
 */
export interface CodeAction {
    title: string
    edit?: WorkspaceEdit
    diagnostics?: Diagnostic[]
    kind?: CodeActionKind
    isPreferred?: boolean
    disabled?: {
        reason: string
    }
    command?: LokusCommand
}

/**
 * Command interface (minimal)
 */
/**
 * Command interface (minimal)
 */
export interface LokusCommand {
    title: string
    command: string
    tooltip?: string
    arguments?: unknown[]
}

/**
 * Diagnostic
 */
export interface Diagnostic {
    range: Range
    message: string
    severity?: DiagnosticSeverity
    source?: string
    code?: string | number
    relatedInformation?: DiagnosticRelatedInformation[]
}

/**
 * Diagnostic severity
 */
export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3
}

/**
 * Diagnostic related information
 */
export interface DiagnosticRelatedInformation {
    location: Location
    message: string
}

/**
 * Code action kind
 */
export interface CodeActionKind {
    value: string
}

/**
 * Code action trigger kind
 */
export enum CodeActionTriggerKind {
    Invoke = 1,
    Automatic = 2
}

/**
 * Code action provider metadata
 */
export interface CodeActionProviderMetadata {
    providedCodeActionKinds?: CodeActionKind[]
    documentation?: CodeActionDocumentation[]
}

/**
 * Code action documentation
 */
export interface CodeActionDocumentation {
    kind: CodeActionKind
    command: LokusCommand
}

/**
 * Document formatting edit provider
 */
export interface DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(
        document: TextDocument,
        options: FormattingOptions,
        token: CancellationToken
    ): TextEdit[] | Promise<TextEdit[]>
}

/**
 * Document range formatting edit provider
 */
export interface DocumentRangeFormattingEditProvider {
    provideDocumentRangeFormattingEdits(
        document: TextDocument,
        range: Range,
        options: FormattingOptions,
        token: CancellationToken
    ): TextEdit[] | Promise<TextEdit[]>
}

/**
 * Formatting options
 */
export interface FormattingOptions {
    tabSize: number
    insertSpaces: boolean
    [key: string]: boolean | number | string
}

/**
 * Document semantic tokens provider
 */
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

/**
 * Semantic tokens
 */
export interface SemanticTokens {
    resultId?: string
    data: Uint32Array
}

/**
 * Semantic tokens edits
 */
export interface SemanticTokensEdits {
    resultId?: string
    edits: SemanticTokensEdit[]
}

/**
 * Semantic tokens edit
 */
export interface SemanticTokensEdit {
    start: number
    deleteCount: number
    data?: Uint32Array
}

/**
 * Semantic tokens legend
 */
export interface SemanticTokensLegend {
    tokenTypes: string[]
    tokenModifiers: string[]
}

/**
 * Folding range provider
 */
export interface FoldingRangeProvider {
    provideFoldingRanges(
        document: TextDocument,
        context: FoldingContext,
        token: CancellationToken
    ): FoldingRange[] | Promise<FoldingRange[]>
}

/**
 * Folding range
 */
export interface FoldingRange {
    start: number
    end: number
    kind?: FoldingRangeKind
    collapsedText?: string
}

/**
 * Folding range kind
 */
export enum FoldingRangeKind {
    Comment = 1,
    Imports = 2,
    Region = 3
}

/**
 * Folding context
 */
export interface FoldingContext {
    maxRanges: number
}

/**
 * Document link provider
 */
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

/**
 * Document link
 */
export interface DocumentLink {
    range: Range
    target?: string
    tooltip?: string
}

/**
 * Text document change event
 */
export interface TextDocumentChangeEvent {
    document: TextDocument
    contentChanges: TextDocumentContentChangeEvent[]
    reason?: TextDocumentChangeReason
}

/**
 * Text document content change event
 */
export interface TextDocumentContentChangeEvent {
    range?: Range
    rangeOffset?: number
    rangeLength?: number
    text: string
}

/**
 * Text document change reason
 */
export enum TextDocumentChangeReason {
    Undo = 1,
    Redo = 2
}

/**
 * Text editor selection change event
 */
export interface TextEditorSelectionChangeEvent {
    textEditor: TextEditor
    selections: Selection[]
    kind?: TextEditorSelectionChangeKind
}

/**
 * Text editor selection change kind
 */
export enum TextEditorSelectionChangeKind {
    Keyboard = 1,
    Mouse = 2,
    Command = 3
}

/**
 * Text editor visible ranges change event
 */
export interface TextEditorVisibleRangesChangeEvent {
    textEditor: TextEditor
    visibleRanges: Range[]
}

/**
 * Terminal options
 */
export interface TerminalOptions {
    name?: string
    shellPath?: string
    shellArgs?: string[] | string
    cwd?: string
    env?: { [key: string]: string | null }
    strictEnv?: boolean
    hideFromUser?: boolean
    message?: string
    iconPath?: string | ThemeIcon
    color?: ThemeColor
    location?: TerminalLocation
    isTransient?: boolean
}

/**
 * Terminal interface
 */
export interface Terminal extends Disposable {
    name: string
    processId: Promise<number | undefined>
    creationOptions: Readonly<TerminalOptions>
    exitStatus: TerminalExitStatus | undefined
    state: TerminalState
    sendText(text: string, shouldExecute?: boolean): void
    show(preserveFocus?: boolean): void
    hide(): void
    dispose(): void
}

/**
 * Terminal exit status
 */
export interface TerminalExitStatus {
    code: number | undefined
    reason: TerminalExitReason
}

/**
 * Terminal exit reason
 */
export enum TerminalExitReason {
    Unknown = 0,
    Shutdown = 1,
    Process = 2,
    User = 3,
    Extension = 4
}

/**
 * Terminal state
 */
export interface TerminalState {
    isInteractedWith: boolean
}

/**
 * Terminal location
 */
export interface TerminalLocation {
    // Simplified
}

/**
 * Workspace folder
 */
export interface WorkspaceFolder {
    readonly uri: string
    readonly name: string
    readonly index: number
}

/**
 * Workspace folders change event
 */
export interface WorkspaceFoldersChangeEvent {
    readonly added: ReadonlyArray<WorkspaceFolder>
    readonly removed: ReadonlyArray<WorkspaceFolder>
}
