import { Extension } from '@tiptap/core'
import { InputRule } from '@tiptap/pm/inputrules'

// Convert leading `[ ] ` or `[x] ` into a Task List item
export const TaskMarkdownInput = Extension.create({
  name: 'taskMarkdownInput',
  addInputRules() {
    return [
      new InputRule({
        find: /^\s*\[( |x|X)\]\s$/,
        handler: ({ chain, range, match, editor }) => {
          const checked = /[xX]/.test(match[1] || '')
          chain().deleteRange(range).toggleTaskList().run()
          if (checked) editor.commands.updateAttributes('taskItem', { checked: true })
        },
      }),
    ]
  },
})

export default TaskMarkdownInput

