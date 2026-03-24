import { describe, expect, it } from 'vitest'
import { parseTasksFromContent } from './parser.js'

describe('task parser due dates', () => {
  it('extracts all-day due dates from explicit date syntax', () => {
    const [task] = parseTasksFromContent('- [ ] Submit report due 2026-03-25')

    expect(task.title).toBe('Submit report')
    expect(task.due_date_is_all_day).toBe(true)

    const dueDate = new Date(task.due_date)
    expect(dueDate.getFullYear()).toBe(2026)
    expect(dueDate.getMonth()).toBe(2)
    expect(dueDate.getDate()).toBe(25)
  })

  it('extracts timed due dates from explicit date-time syntax', () => {
    const [task] = parseTasksFromContent('- [ ] Join review due 2026-03-25 17:30')

    expect(task.title).toBe('Join review')
    expect(task.due_date_is_all_day).toBe(false)

    const dueDate = new Date(task.due_date)
    expect(dueDate.getFullYear()).toBe(2026)
    expect(dueDate.getMonth()).toBe(2)
    expect(dueDate.getDate()).toBe(25)
    expect(dueDate.getHours()).toBe(17)
    expect(dueDate.getMinutes()).toBe(30)
  })
})
