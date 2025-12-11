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

import type {
  WorkspaceFolder,
  WorkspaceFoldersChangeEvent,
  WorkspaceEdit,
  TextDocument,
  TextDocumentChangeEvent,
  CancellationToken
} from '../models.js'
