import { Extension } from '@tiptap/core'
import { InputRule } from '@tiptap/core'

// Extension to trigger task creation modal when typing !task
const TaskCreationTrigger = Extension.create({
  name: 'taskCreationTrigger',

  addInputRules() {
    return [
      new InputRule({
        find: /!task\s$/,
        handler: ({ state, range, match, chain }) => {
          // Delete the !task text
          chain().deleteRange(range).run()

          // Emit event to open the task creation modal
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('lokus:open-task-modal'))
          }, 10)
        },
      }),
    ]
  },
})

export default TaskCreationTrigger
