import { InputRule, inputRules } from 'prosemirror-inputrules'

/**
 * Creates the TaskCreationTrigger ProseMirror plugin.
 *
 * Triggers the task creation modal when the user types "!task " (with a trailing space).
 * The input rule deletes the typed text and dispatches a custom DOM event to open
 * the modal.
 *
 * @returns {import('prosemirror-state').Plugin}
 */
export function createTaskCreationTriggerPlugin() {
  return inputRules({
    rules: [
      new InputRule(/!task\s$/, (state, match, start, end) => {
        // Delete the !task text
        const tr = state.tr.delete(start, end)

        // Emit event to open the task creation modal after the transaction settles
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('lokus:open-task-modal'))
        }, 10)

        return tr
      }),
    ],
  })
}

export default createTaskCreationTriggerPlugin
