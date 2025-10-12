import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// Extension to visually highlight task syntax (!task and @task[board])
export const TaskSyntaxHighlight = Extension.create({
  name: 'taskSyntaxHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('taskSyntaxHighlight'),
        props: {
          decorations: (state) => {
            const decorations = []
            const doc = state.doc

            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return

              const text = node.text

              // Match !task pattern
              const simpleTaskRegex = /!task\s+/g
              let match
              while ((match = simpleTaskRegex.exec(text)) !== null) {
                const from = pos + match.index
                const to = from + match[0].length

                decorations.push(
                  Decoration.inline(from, to, {
                    class: 'task-syntax task-syntax-simple',
                    'data-task-type': 'simple'
                  })
                )
              }

              // Match @task[board] pattern
              const linkedTaskRegex = /@task\[[^\]]+\]\s*/g
              while ((match = linkedTaskRegex.exec(text)) !== null) {
                const from = pos + match.index
                const to = from + match[0].length

                // Extract board name for tooltip
                const boardMatch = match[0].match(/@task\[([^\]]+)\]/)
                const boardName = boardMatch ? boardMatch[1] : ''

                decorations.push(
                  Decoration.inline(from, to, {
                    class: 'task-syntax task-syntax-linked',
                    'data-task-type': 'linked',
                    'data-board': boardName,
                    title: `Linked to board: ${boardName}`
                  })
                )
              }
            })

            return DecorationSet.create(doc, decorations)
          },
        },
      }),
    ]
  },
})

export default TaskSyntaxHighlight
