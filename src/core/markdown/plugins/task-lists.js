/**
 * Custom markdown-it plugin for TipTap-compatible task lists
 * Generates HTML that matches TipTap's TaskItem expectations
 *
 * Supports 8 task states from SmartTask extension:
 * - [ ] todo
 * - [x] completed
 * - [/] in-progress
 * - [!] urgent
 * - [?] question
 * - [-] cancelled
 * - [>] delegated
 */

// Task state configuration matching SmartTask extension
const TASK_STATES = {
  // Basic states
  ' ': { checked: false, state: 'todo', class: 'task-todo' },
  'x': { checked: true, state: 'completed', class: 'task-completed' },
  'X': { checked: true, state: 'completed', class: 'task-completed' },
  '/': { checked: false, state: 'in-progress', class: 'task-in-progress' },
  '!': { checked: false, state: 'urgent', class: 'task-urgent' },
  '?': { checked: false, state: 'question', class: 'task-question' },
  '-': { checked: false, state: 'cancelled', class: 'task-cancelled' },
  '>': { checked: false, state: 'delegated', class: 'task-delegated' },

  // High frequency states
  '*': { checked: false, state: 'starred', class: 'task-starred' },
  '~': { checked: false, state: 'paused', class: 'task-paused' },
  '<': { checked: false, state: 'scheduled', class: 'task-scheduled' },
  '"': { checked: false, state: 'quote', class: 'task-quote' },
  'i': { checked: false, state: 'info', class: 'task-info' },
  'b': { checked: false, state: 'blocked', class: 'task-blocked' },

  // Medium frequency states
  '+': { checked: false, state: 'added', class: 'task-added' },
  'w': { checked: false, state: 'waiting', class: 'task-waiting' },
  '@': { checked: false, state: 'mentioned', class: 'task-mentioned' },
  'R': { checked: false, state: 'review', class: 'task-review' },
  'D': { checked: false, state: 'duplicate', class: 'task-duplicate' },
  'S': { checked: false, state: 'started', class: 'task-started' }
}

// Regex to detect task list items: [x] Text or [ ] Text
// Supports all 23 task state symbols
const TASK_REGEX = /^\[([x X/!?\->\s*~<"ib+w@RDS])\]\s+(.*)$/

// Debug: Test regex on startup
console.log('[TASK-DEBUG] Testing regex pattern on all 23 symbols:')
const testCases = [
  '[ ] Todo', '[x] Completed', '[X] Completed', '[/] In Progress',
  '[!] Urgent', '[?] Question', '[-] Cancelled', '[>] Delegated',
  '[*] Starred', '[~] Paused', '[<] Scheduled', '["] Quote',
  '[i] Info', '[b] Blocked', '[+] Added', '[w] Waiting',
  '[@] Mentioned', '[R] Review', '[D] Duplicate', '[S] Started'
]
testCases.forEach(test => {
  const match = TASK_REGEX.test(test)
  console.log(`  ${test}: ${match ? '✓' : '✗'}`)
})

export default function markdownItTaskLists(md) {
  // Process tokens after inline parsing to detect and transform task lists
  md.core.ruler.after('inline', 'task-lists', state => {
    const tokens = state.tokens
    let i = 0

    while (i < tokens.length) {
      const token = tokens[i]

      // Look for bullet_list_open tokens
      if (token.type === 'bullet_list_open') {
        // Check if this list contains task items
        const hasTaskItems = checkForTaskItems(tokens, i)

        if (hasTaskItems) {
          // Add data-type="taskList" to the <ul>
          token.attrPush(['data-type', 'taskList'])

          // Process all list items in this list
          processTaskList(tokens, i)
        }
      }

      i++
    }
  })
}

/**
 * Check if a bullet list contains any task items
 */
function checkForTaskItems(tokens, startIdx) {
  let depth = 0

  for (let i = startIdx; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'bullet_list_open') {
      depth++
    } else if (token.type === 'bullet_list_close') {
      depth--
      if (depth === 0) break
    } else if (token.type === 'inline' && depth === 1) {
      // Check if this inline content starts with task syntax
      console.log('[TASK-DEBUG] Checking inline content:', JSON.stringify(token.content))
      const match = token.content.match(TASK_REGEX)
      if (match) {
        console.log('[TASK-DEBUG] ✓ MATCHED! Symbol:', JSON.stringify(match[1]), 'Text:', JSON.stringify(match[2]))
        return true
      } else {
        console.log('[TASK-DEBUG] ✗ NO MATCH for:', JSON.stringify(token.content))
      }
    }
  }

  return false
}

/**
 * Process all list items in a task list
 */
function processTaskList(tokens, startIdx) {
  let depth = 0

  for (let i = startIdx; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'bullet_list_open') {
      depth++
    } else if (token.type === 'bullet_list_close') {
      depth--
      if (depth === 0) break
    } else if (token.type === 'list_item_open' && depth === 1) {
      // Look ahead to find the inline content of this list item
      const inlineToken = findInlineToken(tokens, i)

      if (inlineToken) {
        const match = inlineToken.content.match(TASK_REGEX)

        if (match) {
          const symbol = match[1]
          const text = match[2]
          const config = TASK_STATES[symbol] || TASK_STATES[' ']

          console.log('[TASK-DEBUG] Processing task item - Symbol:', JSON.stringify(symbol), 'State:', config.state, 'Text:', JSON.stringify(text))

          // Add TipTap-compatible attributes to the <li>
          token.attrPush(['data-type', 'taskItem'])
          token.attrPush(['data-checked', String(config.checked)])
          token.attrPush(['data-task-state', config.state])
          token.attrPush(['class', config.class])

          // Remove the checkbox syntax from the content
          inlineToken.content = text

          // Update child tokens if they exist
          if (inlineToken.children && inlineToken.children.length > 0) {
            const firstChild = inlineToken.children[0]
            if (firstChild && firstChild.type === 'text') {
              const textMatch = firstChild.content.match(TASK_REGEX)
              if (textMatch) {
                firstChild.content = textMatch[2]
              }
            }
          }
        } else {
          console.log('[TASK-DEBUG] No match in processTaskList for:', JSON.stringify(inlineToken.content))
        }
      }
    }
  }
}

/**
 * Find the inline token for a list item
 */
function findInlineToken(tokens, listItemIdx) {
  // The inline token should be shortly after the list_item_open
  for (let i = listItemIdx + 1; i < Math.min(listItemIdx + 10, tokens.length); i++) {
    if (tokens[i].type === 'inline') {
      return tokens[i]
    }
    if (tokens[i].type === 'list_item_close') {
      break
    }
  }
  return null
}
