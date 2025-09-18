import { Extension } from '@tiptap/core';
import * as suggestionMod from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
const suggestion = suggestionMod.default ?? suggestionMod;
const SLASH_SUGGESTION_KEY = new PluginKey('slashCommandSuggestion');
import slashCommand from './slash-command.jsx';

const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      suggestion({
        pluginKey: SLASH_SUGGESTION_KEY,
        editor: this.editor,
        char: '/',
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        ...slashCommand,
      }),
    ];
  },
});

export default SlashCommand;