import { createSuggestionPlugin, PluginKey } from '../lib/suggestion-plugin.js'
import { ReactPopup } from '../lib/react-pm-helpers.jsx'
import TaskMentionList from '../components/TaskMentionList.jsx'
import { invoke } from '@tauri-apps/api/core'

const TASK_MENTION_KEY = new PluginKey('taskMention')

// Get all tasks from all kanban boards
async function getAllTasks() {
  try {
    // Get workspace path
    const workspacePath = globalThis.__LOKUS_WORKSPACE_PATH__ || localStorage.getItem('workspace_path')

    if (!workspacePath) {
      return []
    }

    const boardInfos = await invoke('list_kanban_boards', { workspacePath })

    const allTasks = []
    for (const boardInfo of boardInfos) {
      try {
        const board = await invoke('open_kanban_board', { filePath: boardInfo.path })

        if (board && board.columns) {
          // Flatten all tasks from all columns (columns is a HashMap)
          for (const [columnId, column] of Object.entries(board.columns)) {
            if (column.cards && Array.isArray(column.cards)) {
              for (const card of column.cards) {
                allTasks.push({
                  id: card.id,
                  title: card.title,
                  boardName: boardInfo.name,
                  columnName: column.name,
                })
              }
            }
          }
        }
      } catch { }
    }
    return allTasks
  } catch { }
  return []
}

// Cache tasks with refresh mechanism
let tasksCache = []
let lastFetch = 0
const CACHE_DURATION = 2000 // 2 seconds

async function getCachedTasks(force = false) {
  const now = Date.now()
  if (force || now - lastFetch > CACHE_DURATION) {
    tasksCache = await getAllTasks()
    lastFetch = now
  }
  return tasksCache
}

// Score and filter tasks based on query
function scoreTask(task, query) {
  const title = task.title.toLowerCase()
  const q = query.toLowerCase()
  let score = 0

  // Exact match
  if (title === q) score += 100

  // Prefix match
  if (title.startsWith(q)) score += 50

  // Substring match
  if (title.includes(q)) score += 20

  // Shorter titles preferred
  score -= Math.min(title.length, 50) * 0.1

  return score
}

/**
 * Create the task mention suggestion plugin.
 *
 * @param {import('prosemirror-view').EditorView} view - The ProseMirror EditorView
 * @returns {import('prosemirror-state').Plugin}
 */
export function createTaskMentionSuggestPlugin(view) {
  return createSuggestionPlugin({
    pluginKey: TASK_MENTION_KEY,
    editor: view,
    char: '@',
    allowSpaces: true,
    startOfLine: false,

    allow: ({ state, range }) => {
      // Get text before the cursor in the current node
      const $from = state.doc.resolve(range.from)
      const textBefore = $from.parent.textBetween(
        Math.max(0, $from.parentOffset - 200),
        $from.parentOffset,
        null,
        '\ufffc'
      )

      // Check if we're typing right after the trigger character
      // The range.from is where @ was typed
      const charBeforeTrigger = textBefore.slice(-1)

      // Don't trigger if:
      // 1. We're inside an incomplete @task[...
      if (/@task\[[^\]]*$/.test(textBefore)) {
        return false
      }

      // 2. We're typing after a completed @task[...]
      // Check if there's a @task[...] and the @ we're on is part of it
      if (textBefore.includes('@task[')) {
        // Find the last @task[
        const lastTaskMentionStart = textBefore.lastIndexOf('@task[')
        const textAfterLastTaskMention = textBefore.slice(lastTaskMentionStart)

        // If there's a closing ], the mention is complete
        // Only allow if we've typed something after the ]
        if (textAfterLastTaskMention.includes(']')) {
          const closingBracketIndex = textAfterLastTaskMention.indexOf(']')
          const afterClosing = textAfterLastTaskMention.slice(closingBracketIndex + 1)

          // Only allow if there's some whitespace or text after the ]
          // This prevents triggering on the @ in @task itself
          if (afterClosing.trim().length === 0) {
            return false
          }
        } else {
          // No closing bracket means we're inside the mention
          return false
        }
      }

      return true
    },

    items: async ({ query }) => {
      // Use cache without forcing refresh - only refresh if stale
      const tasks = await getCachedTasks(false)

      // If no query, show all tasks
      if (!query) {
        return tasks.slice(0, 10)
      }

      // Filter tasks by title
      const filtered = tasks.filter(task =>
        task.title.toLowerCase().includes(query.toLowerCase())
      )

      const sorted = filtered.sort((a, b) =>
        scoreTask(b, query) - scoreTask(a, query)
      )

      return sorted.slice(0, 10)
    },

    command: ({ editor: editorView, range, props }) => {
      const task = props
      const { state } = editorView

      // Delete the '@task...' and query, then insert the task mention
      const tr = state.tr.delete(range.from, range.to)
      const insertPos = tr.mapping.map(range.from)
      tr.insertText(`@task[${task.boardName}:${task.title}] `, insertPos)
      tr.scrollIntoView()

      editorView.dom.focus({ preventScroll: true })
      editorView.dispatch(tr)
    },

    render: () => {
      let component
      let container

      const place = (rect) => {
        if (!container || !rect) return
        container.style.left = `${Math.max(8, rect.left)}px`
        container.style.top = `${Math.min(window.innerHeight - 16, rect.bottom + 6)}px`
      }

      return {
        onStart: (props) => {
          // Refresh tasks cache when opening
          getCachedTasks(true)

          component = new ReactPopup(TaskMentionList, props)

          container = document.createElement('div')
          container.style.position = 'fixed'
          container.style.zIndex = '2147483647'
          container.style.pointerEvents = 'auto'
          container.appendChild(component.element)
          document.body.appendChild(container)

          if (props.clientRect) place(props.clientRect())
        },

        onUpdate: (props) => {
          component.updateProps(props)
          if (props.clientRect) place(props.clientRect())
        },

        onKeyDown: (props) => {
          if (props.event.key === 'Escape') {
            if (container?.parentNode) container.parentNode.removeChild(container)
            container = null
            return true
          }

          return component.ref?.onKeyDown(props)
        },

        onExit: () => {
          try {
            if (container?.parentNode) container.parentNode.removeChild(container)
          } catch {}
          container = null
          if (component) component.destroy()
        },
      }
    },
  })
}

export default createTaskMentionSuggestPlugin
