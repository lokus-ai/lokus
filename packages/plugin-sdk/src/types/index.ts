/**
 * @fileoverview Comprehensive TypeScript type definitions for Lokus Plugin SDK
 *
 * This file exports all the type definitions needed for plugin development,
 * providing type safety and IntelliSense support for the entire plugin API.
 */

// 1. Core Models (The Foundation)
export * from './models.js';

// 2. Events (Canonical Source)
export * from './events.js';

// 3. Lifecycle
export type {
    PluginContext,
    PluginActivateContext,
    PluginDeactivateContext
} from './lifecycle.js';

// 4. Manifest
export type {
    PluginManifest,
    PluginAuthor,
    PluginRepository,
    PluginContributions,
    ManifestCommand as Command, // Export ManifestCommand from manifest as the primary Command type
    Keybinding,
    MenuItem,
    Theme as ManifestTheme,
    Language,
    Grammar,
    Snippet,
    FileAssociation,
    View,
    ViewContainer,
    ProblemMatcher,
    ProblemPattern,
    TaskDefinition,
    Debugger,
    Breakpoint,
    Folding,
    SemanticTokenType,
    SemanticTokenModifier,
    SemanticTokenScope,
    ThemeIcon as ManifestThemeIcon,
    ConfigurationSchema,
    ConfigurationProperty,
    WebResources,
    PublishConfig
} from './manifest.js';

// 5. Permissions
export * from './permissions.js';

// 6. Plugin Interface
export * from './plugin.js';

// 7. APIs
export * from './api/commands.js';
export * from './api/editor.js';

// api/ui.js exports Terminal types which conflict with models.js (if models exports them)
// or api/terminal.js. We exclude them here.
export type {
    UIAPI,
    NotificationType,
    NotificationAction,
    DialogOptions,
    DialogButton,
    DialogResult,
    QuickPickItem,
    QuickPickOptions,
    InputBoxOptions,
    OpenDialogOptions,
    SaveDialogOptions,
    PanelDefinition,
    WebviewPanelDefinition,
    WebviewOptions,
    WebviewPanel,
    Webview,
    WebviewPanelOptions,
    WebviewPanelOnDidChangeViewStateEvent,
    QuickInputButton,
    MenuDefinition,
    ToolbarDefinition,
    ToolbarItem,
    StatusBarItemDefinition,
    StatusBarItem,
    StatusBarAlignment,
    AccessibilityInformation,
    TreeDataProvider,
    TreeItem,
    TreeItemLabel,
    TreeItemCollapsibleState,
    OutputChannel,
    ProgressOptions,
    ProgressLocation,
    Progress,
    ProgressReport
} from './api/ui.js';

export * from './api/workspace.js';
export * from './api/filesystem.js';
export * from './api/network.js';
export * from './api/storage.js';
export * from './api/configuration.js';
export * from './api/tasks.js';
export * from './api/debug.js';

export type {
    LanguageAPI,
    CompletionProvider,
    HoverProvider
} from './api/languages.js';

export * from './api/themes.js';
export * from './api/terminal.js';

// 8. API Common
export type {
    LokusAPI,
    APIVersion,
    APICompatibility,
    APIRequestOptions,
    APIResponse,
    PaginatedRequestOptions,
    ProgressCallback,
    ProgressReporter,
    LongRunningOperationOptions
} from './api/index.js';

export { LogLevel, APIErrorCode, APIError } from './api/index.js';

// 9. Utilities
// Exclude Event as it conflicts with events.js
export type {
    Disposable,
    URI,
    Thenable,
    ReadonlyArray,
    DeepReadonly,
    PartialDeep,
    RequiredDeep,
    JSONValue,
    JSONObject,
    JSONArray,
    Constructor,
    ClassDecorator,
    MethodDecorator,
    PropertyDecorator,
    ParameterDecorator
} from './utilities.js';

// 10. Templates
export type { TemplateConfig, TemplateGenerator } from '../templates/index.js';
export { PluginTemplate } from '../templates/index.js';