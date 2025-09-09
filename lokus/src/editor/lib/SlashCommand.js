import { Extension } from '@tiptap/core';
import * as suggestionMod from '@tiptap/suggestion';
const suggestion = suggestionMod.default ?? suggestionMod;
import slashCommand from './slash-command.jsx';

const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      suggestion({
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
