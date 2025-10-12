import { Extension } from '@tiptap/core'
import { InputRule } from '@tiptap/core'

// Simple task extension - just inserts the syntax as plain text
// Tasks are now managed through kanban boards, not the old modal system
export const SimpleTask = Extension.create({
  name: 'simpleTask',

  addInputRules() {
    return [
      // !task -> just insert as plain text (for standalone tasks)
      new InputRule({
        find: /!task\s$/,
        handler: ({ chain, range }) => {
          // Keep the !task text as-is - it will be parsed by the backend
          return false // Don't intercept, let it type naturally
        },
      }),

      // @task[board] -> just insert as plain text (for kanban-linked tasks)
      new InputRule({
        find: /@task\[/,
        handler: ({ chain, range }) => {
          // Keep the @task[...] text as-is - it will be parsed by the backend
          return false // Don't intercept, let it type naturally
        },
      })
    ]
  },
})

export default SimpleTask
