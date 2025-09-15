import { BasePlugin, PluginContext, PluginActivationContext } from '@lokus/plugin-sdk';
import { {{pluginNamePascalCase}}LanguageServer } from './language-server';
import { {{pluginNamePascalCase}}DocumentProvider } from './document-provider';

/**
 * {{pluginNamePascalCase}} - {{description}}
 * 
 * Provides language support including syntax highlighting, IntelliSense,
 * code completion, and other language features.
 * 
 * @author {{author}}
 * @version 0.1.0
 */
export class {{pluginNamePascalCase}} extends BasePlugin {
  private languageServer?: {{pluginNamePascalCase}}LanguageServer;
  private documentProvider?: {{pluginNamePascalCase}}DocumentProvider;

  constructor(context: PluginContext) {
    super(context);
    this.logger.info('{{pluginNamePascalCase}} language support plugin initialized');
  }

  async activate(context: PluginActivationContext): Promise<void> {
    this.logger.info('Activating {{pluginNamePascalCase}} language support...');

    try {
      // Register language configuration
      await this.registerLanguageConfiguration(context);
      
      // Start language server
      await this.startLanguageServer(context);
      
      // Register document providers
      await this.registerDocumentProviders(context);
      
      // Register language-specific commands
      await this.registerLanguageCommands(context);
      
      this.logger.info('{{pluginNamePascalCase}} language support activated successfully');
    } catch (error) {
      this.logger.error('Failed to activate language support:', error);
      throw error;
    }
  }

  async deactivate(): Promise<void> {
    this.logger.info('Deactivating {{pluginNamePascalCase}} language support...');

    try {
      // Stop language server
      if (this.languageServer) {
        await this.languageServer.stop();
      }
      
      // Clean up document providers
      if (this.documentProvider) {
        this.documentProvider.dispose();
      }
      
      this.logger.info('{{pluginNamePascalCase}} language support deactivated successfully');
    } catch (error) {
      this.logger.error('Error during language support deactivation:', error);
    }
  }

  private async registerLanguageConfiguration(context: PluginActivationContext): Promise<void> {
    // Register language configuration
    const languageConfig = {
      id: 'mylang',
      aliases: ['My Language', 'mylang'],
      extensions: ['.mylang', '.ml'],
      configuration: {
        comments: {
          lineComment: '//',
          blockComment: ['/*', '*/']
        },
        brackets: [
          ['{', '}'],
          ['[', ']'],
          ['(', ')']
        ],
        autoClosingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ],
        surroundingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ],
        wordPattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
        indentationRules: {
          increaseIndentPattern: /^.*\{[^}]*$/,
          decreaseIndentPattern: /^.*\}.*$/
        }
      }
    };

    const languageDisposable = context.languages.registerLanguage(languageConfig);
    this.disposables.add(languageDisposable);
  }

  private async startLanguageServer(context: PluginActivationContext): Promise<void> {
    this.languageServer = new {{pluginNamePascalCase}}LanguageServer(this.context);
    
    // Register language client
    const clientOptions = {
      documentSelector: [
        { scheme: 'file', language: 'mylang' },
        { scheme: 'untitled', language: 'mylang' }
      ],
      synchronize: {
        fileEvents: context.workspace.createFileSystemWatcher('**/*.mylang')
      }
    };

    const clientDisposable = await this.languageServer.start(clientOptions);
    this.disposables.add(clientDisposable);
  }

  private async registerDocumentProviders(context: PluginActivationContext): Promise<void> {
    this.documentProvider = new {{pluginNamePascalCase}}DocumentProvider(this.context);

    // Register hover provider
    const hoverDisposable = context.languages.registerHoverProvider(
      { language: 'mylang' },
      this.documentProvider
    );

    // Register completion provider
    const completionDisposable = context.languages.registerCompletionItemProvider(
      { language: 'mylang' },
      this.documentProvider,
      '.' // Trigger character
    );

    // Register definition provider
    const definitionDisposable = context.languages.registerDefinitionProvider(
      { language: 'mylang' },
      this.documentProvider
    );

    // Register document highlight provider
    const highlightDisposable = context.languages.registerDocumentHighlightProvider(
      { language: 'mylang' },
      this.documentProvider
    );

    this.disposables.add(
      hoverDisposable,
      completionDisposable,
      definitionDisposable,
      highlightDisposable
    );
  }

  private async registerLanguageCommands(context: PluginActivationContext): Promise<void> {
    // Format document command
    const formatDisposable = context.commands.registerCommand(
      '{{pluginNameCamelCase}}.formatDocument',
      () => this.formatActiveDocument()
    );

    // Validate document command
    const validateDisposable = context.commands.registerCommand(
      '{{pluginNameCamelCase}}.validateDocument',
      () => this.validateActiveDocument()
    );

    // Show syntax tree command
    const syntaxTreeDisposable = context.commands.registerCommand(
      '{{pluginNameCamelCase}}.showSyntaxTree',
      () => this.showSyntaxTree()
    );

    this.disposables.add(formatDisposable, validateDisposable, syntaxTreeDisposable);
  }

  private async formatActiveDocument(): Promise<void> {
    const activeEditor = this.context.workspace.activeTextEditor;
    if (!activeEditor || activeEditor.document.languageId !== 'mylang') {
      this.context.ui.showWarningMessage('No My Language document is currently active');
      return;
    }

    try {
      await this.context.commands.executeCommand('editor.action.formatDocument');
      this.logger.info('Document formatted successfully');
    } catch (error) {
      this.logger.error('Failed to format document:', error);
      this.context.ui.showErrorMessage('Failed to format document');
    }
  }

  private async validateActiveDocument(): Promise<void> {
    const activeEditor = this.context.workspace.activeTextEditor;
    if (!activeEditor || activeEditor.document.languageId !== 'mylang') {
      this.context.ui.showWarningMessage('No My Language document is currently active');
      return;
    }

    try {
      if (this.languageServer) {
        const diagnostics = await this.languageServer.validateDocument(activeEditor.document);
        
        if (diagnostics.length === 0) {
          this.context.ui.showInformationMessage('Document validation passed');
        } else {
          this.context.ui.showWarningMessage(`Found ${diagnostics.length} issue(s)`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to validate document:', error);
      this.context.ui.showErrorMessage('Failed to validate document');
    }
  }

  private async showSyntaxTree(): Promise<void> {
    const activeEditor = this.context.workspace.activeTextEditor;
    if (!activeEditor || activeEditor.document.languageId !== 'mylang') {
      this.context.ui.showWarningMessage('No My Language document is currently active');
      return;
    }

    try {
      if (this.languageServer) {
        const syntaxTree = await this.languageServer.getSyntaxTree(activeEditor.document);
        
        // Create and show syntax tree in a new document
        const doc = await this.context.workspace.openTextDocument({
          content: JSON.stringify(syntaxTree, null, 2),
          language: 'json'
        });
        
        await this.context.window.showTextDocument(doc);
      }
    } catch (error) {
      this.logger.error('Failed to show syntax tree:', error);
      this.context.ui.showErrorMessage('Failed to show syntax tree');
    }
  }
}

export default {{pluginNamePascalCase}};