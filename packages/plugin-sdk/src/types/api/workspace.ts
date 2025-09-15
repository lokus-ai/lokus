/**
 * @fileoverview Workspace API types
 */

import type { Disposable } from '../utilities.js'

export interface WorkspaceAPI {
  readonly workspaceFolders: ReadonlyArray<WorkspaceFolder> | undefined
  readonly name: string | undefined
  readonly workspaceFile: string | undefined
  
  getWorkspaceFolder(uri: string): WorkspaceFolder | undefined
  asRelativePath(pathOrUri: string, includeWorkspaceFolder?: boolean): string
  findFiles(include: string, exclude?: string, maxResults?: number, token?: CancellationToken): Promise<string[]>
  saveAll(includeUntitled?: boolean): Promise<boolean>
  applyEdit(edit: WorkspaceEdit): Promise<boolean>
  
  openTextDocument(uri: string): Promise<TextDocument>
  openTextDocument(options: { language?: string; content?: string }): Promise<TextDocument>
  
  onDidChangeWorkspaceFolders(listener: (event: WorkspaceFoldersChangeEvent) => void): Disposable
  onDidOpenTextDocument(listener: (document: TextDocument) => void): Disposable
  onDidCloseTextDocument(listener: (document: TextDocument) => void): Disposable
  onDidSaveTextDocument(listener: (document: TextDocument) => void): Disposable
  onDidChangeTextDocument(listener: (event: TextDocumentChangeEvent) => void): Disposable
}

export interface WorkspaceFolder {
  readonly uri: string
  readonly name: string
  readonly index: number
}

export interface WorkspaceFoldersChangeEvent {
  readonly added: ReadonlyArray<WorkspaceFolder>
  readonly removed: ReadonlyArray<WorkspaceFolder>
}

export interface WorkspaceEdit {
  // Simplified for now
  changes?: { [uri: string]: TextEdit[] }
}

// Forward declarations
export interface TextDocument { uri: string; languageId: string; version: number; getText(): string }
export interface TextEdit { range: Range; newText: string }
export interface Range { start: Position; end: Position }
export interface Position { line: number; character: number }
export interface CancellationToken { isCancellationRequested: boolean }
export interface TextDocumentChangeEvent { document: TextDocument }