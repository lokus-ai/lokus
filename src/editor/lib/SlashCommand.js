import { createSuggestionPlugin, PluginKey } from './suggestion-plugin.js';
import slashCommand from './slash-command.jsx';

const SLASH_SUGGESTION_KEY = new PluginKey('slashCommandSuggestion');

/**
 * Create the slash command suggestion plugin.
 *
 * @param {import('prosemirror-view').EditorView} view - The ProseMirror EditorView
 * @returns {import('prosemirror-state').Plugin}
 */
export function createSlashCommandPlugin(view) {
  return createSuggestionPlugin({
    pluginKey: SLASH_SUGGESTION_KEY,
    editor: view,
    char: '/',
    allowSpaces: false,
    startOfLine: false,
    command: ({ editor, range, props }) => {
      props.command({ editor, range });
    },
    ...slashCommand,
  });
}

export default createSlashCommandPlugin;
