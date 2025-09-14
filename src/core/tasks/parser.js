/**
 * Smart Task Parser
 * Extracts and analyzes tasks from various content formats
 */

import { TASK_STATUSES, TASK_PRIORITIES } from './manager.js'

// Task pattern matchers
const TASK_PATTERNS = {
  // Checkbox patterns: - [ ] Task, - [x] Task, - [/] In progress
  CHECKBOX: /^(\s*)-\s*\[([x X/!?\->]|\s)\]\s*(.+)$/gm,
  
  // Heading task patterns: ## TODO: Fix bug
  HEADING_TASK: /^(#{1,6})\s*(TODO|FIXME|URGENT|BUG|HACK|NOTE|QUESTION)\s*[:]\s*(.+)$/gm,
  
  // Natural language patterns
  NATURAL_LANGUAGE: /(need to|must do|should complete|have to|got to|remember to|don't forget to)\s+(.{3,})/gi,
  
  // Deadline patterns
  DEADLINE: /(by|due|deadline|until|before)\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2}|next week|this week)/gi,
  
  // Priority indicators
  PRIORITY: /(urgent|high priority|important|asap|critical|low priority)/gi,
  
  // Time estimates
  TIME_ESTIMATE: /(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)/gi,
  
  // Person mentions (for delegation)
  MENTION: /@(\w+)/g,
  
  // Tags
  TAG: /#(\w+)/g
}

// Task status mapping from symbols
const STATUS_MAPPING = {
  ' ': TASK_STATUSES.TODO,
  'x': TASK_STATUSES.COMPLETED,
  'X': TASK_STATUSES.COMPLETED,
  '/': TASK_STATUSES.IN_PROGRESS,
  '!': TASK_STATUSES.URGENT,
  '?': TASK_STATUSES.QUESTION,
  '-': TASK_STATUSES.CANCELLED,
  '>': TASK_STATUSES.DELEGATED
}

// Keyword to status mapping
const KEYWORD_STATUS_MAPPING = {
  'TODO': TASK_STATUSES.TODO,
  'FIXME': TASK_STATUSES.TODO,
  'BUG': TASK_STATUSES.URGENT,
  'URGENT': TASK_STATUSES.URGENT,
  'HACK': TASK_STATUSES.TODO,
  'NOTE': TASK_STATUSES.TODO,
  'QUESTION': TASK_STATUSES.QUESTION
}

// Priority keyword mapping
const PRIORITY_MAPPING = {
  'urgent': TASK_PRIORITIES.URGENT,
  'high priority': TASK_PRIORITIES.HIGH,
  'important': TASK_PRIORITIES.HIGH,
  'asap': TASK_PRIORITIES.URGENT,
  'critical': TASK_PRIORITIES.URGENT,
  'low priority': TASK_PRIORITIES.LOW
}

/**
 * Parse tasks from content
 */
export function parseTasksFromContent(content, notePath = null) {
  const tasks = []
  const lines = content.split('\n')
  
  lines.forEach((line, lineNumber) => {
    const extractedTasks = extractTasksFromLine(line, lineNumber, notePath)
    tasks.push(...extractedTasks)
  })

  return tasks
}

/**
 * Extract tasks from a single line
 */
function extractTasksFromLine(line, lineNumber, notePath) {
  const tasks = []
  const trimmed = line.trim()
  
  // Skip empty lines
  if (!trimmed) return tasks

  // 1. Check for checkbox tasks
  const checkboxTask = extractCheckboxTask(line, lineNumber, notePath)
  if (checkboxTask) {
    tasks.push(checkboxTask)
    return tasks // Don't double-process checkbox lines
  }

  // 2. Check for heading tasks
  const headingTask = extractHeadingTask(line, lineNumber, notePath)
  if (headingTask) {
    tasks.push(headingTask)
    return tasks
  }

  // 3. Check for natural language tasks
  const naturalTasks = extractNaturalLanguageTasks(line, lineNumber, notePath)
  tasks.push(...naturalTasks)

  return tasks
}

/**
 * Extract checkbox-style tasks: - [ ] Task
 */
function extractCheckboxTask(line, lineNumber, notePath) {
  const match = line.match(/^(\s*)-\s*\[([x X/!?\->]|\s)\]\s*(.+)$/)
  if (!match) return null

  const [, indent, symbol, title] = match
  const status = STATUS_MAPPING[symbol] || TASK_STATUSES.TODO
  
  const task = createTaskFromMatch(title, status, lineNumber, notePath, line)
  task.indent_level = Math.floor(indent.length / 2) // Estimate indentation level
  
  return task
}

/**
 * Extract heading-style tasks: ## TODO: Fix bug
 */
function extractHeadingTask(line, lineNumber, notePath) {
  const match = line.match(/^(#{1,6})\s*(TODO|FIXME|URGENT|BUG|HACK|NOTE|QUESTION)\s*[:]\s*(.+)$/)
  if (!match) return null

  const [, hashes, keyword, title] = match
  const status = KEYWORD_STATUS_MAPPING[keyword] || TASK_STATUSES.TODO
  const priority = keyword === 'URGENT' ? TASK_PRIORITIES.URGENT : TASK_PRIORITIES.NORMAL
  
  const task = createTaskFromMatch(title, status, lineNumber, notePath, line)
  task.priority = priority
  task.heading_level = hashes.length
  task.source_type = 'heading'
  
  return task
}

/**
 * Extract natural language tasks: "need to call client"
 */
function extractNaturalLanguageTasks(line, lineNumber, notePath) {
  const tasks = []
  const naturalMatches = [...line.matchAll(TASK_PATTERNS.NATURAL_LANGUAGE)]
  
  naturalMatches.forEach(match => {
    const [, trigger, taskText] = match
    
    // Filter out very short or very long tasks
    if (taskText.length < 5 || taskText.length > 200) return
    
    // Skip if it looks like part of a sentence (contains conjunctions)
    if (/\b(and|but|or|because|since|when|while|although|however)\b/i.test(taskText)) return
    
    // Skip if it's part of a quote or example
    if (line.includes('"') || line.includes("'") || line.toLowerCase().includes('example')) return
    
    const task = createTaskFromMatch(taskText.trim(), TASK_STATUSES.TODO, lineNumber, notePath, line)
    task.source_type = 'natural_language'
    task.trigger = trigger
    
    tasks.push(task)
  })

  return tasks
}

/**
 * Create a task object from matched content
 */
function createTaskFromMatch(title, status, lineNumber, notePath, originalLine) {
  const task = {
    title: title.trim(),
    status,
    priority: TASK_PRIORITIES.NORMAL,
    note_path: notePath,
    note_position: lineNumber + 1, // 1-based line numbers
    original_line: originalLine,
    source_type: 'checkbox',
    tags: [],
    mentions: [],
    metadata: {}
  }

  // Extract additional metadata
  extractMetadata(task, title)
  
  return task
}

/**
 * Extract metadata from task text (priorities, deadlines, etc.)
 */
function extractMetadata(task, text) {
  // Extract priority indicators
  const priorityMatches = [...text.matchAll(TASK_PATTERNS.PRIORITY)]
  priorityMatches.forEach(match => {
    const priorityText = match[0].toLowerCase()
    const priority = PRIORITY_MAPPING[priorityText]
    if (priority && priority > task.priority) {
      task.priority = priority
    }
  })

  // Extract deadlines
  const deadlineMatches = [...text.matchAll(TASK_PATTERNS.DEADLINE)]
  deadlineMatches.forEach(match => {
    const [fullMatch, preposition, timeRef] = match
    task.metadata.deadline = {
      original: fullMatch,
      preposition,
      time_reference: timeRef,
      parsed_date: parseTimeReference(timeRef)
    }
  })

  // Extract time estimates
  const timeMatches = [...text.matchAll(TASK_PATTERNS.TIME_ESTIMATE)]
  timeMatches.forEach(match => {
    const [, amount, unit] = match
    task.metadata.time_estimate = {
      amount: parseInt(amount),
      unit: unit,
      minutes: convertToMinutes(amount, unit)
    }
  })

  // Extract mentions
  const mentionMatches = [...text.matchAll(TASK_PATTERNS.MENTION)]
  task.mentions = mentionMatches.map(match => match[1])

  // Extract tags
  const tagMatches = [...text.matchAll(TASK_PATTERNS.TAG)]
  task.tags = tagMatches.map(match => match[1])

  // Clean title by removing metadata
  let cleanTitle = text
  cleanTitle = cleanTitle.replace(TASK_PATTERNS.PRIORITY, '').trim()
  cleanTitle = cleanTitle.replace(TASK_PATTERNS.DEADLINE, '').trim()
  cleanTitle = cleanTitle.replace(TASK_PATTERNS.TIME_ESTIMATE, '').trim()
  
  if (cleanTitle !== text) {
    task.title = cleanTitle
    task.metadata.original_title = text
  }
}

/**
 * Parse time references into dates
 */
function parseTimeReference(timeRef) {
  const today = new Date()
  const lowerRef = timeRef.toLowerCase()
  
  switch (lowerRef) {
    case 'today':
      return today
    
    case 'tomorrow':
      const tomorrow = new Date(today)
      tomorrow.setDate(today.getDate() + 1)
      return tomorrow
    
    case 'next week':
      const nextWeek = new Date(today)
      nextWeek.setDate(today.getDate() + 7)
      return nextWeek
    
    case 'this week':
      const thisWeekEnd = new Date(today)
      thisWeekEnd.setDate(today.getDate() + (7 - today.getDay()))
      return thisWeekEnd
    
    default:
      // Try to parse weekday names
      const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const dayIndex = weekdays.indexOf(lowerRef)
      
      if (dayIndex !== -1) {
        const targetDay = new Date(today)
        const daysUntil = (dayIndex - today.getDay() + 7) % 7 || 7
        targetDay.setDate(today.getDate() + daysUntil)
        return targetDay
      }
      
      // Try to parse MM/DD format
      const dateMatch = timeRef.match(/^(\d{1,2})[\/\-](\d{1,2})$/)
      if (dateMatch) {
        const [, month, day] = dateMatch
        const date = new Date(today.getFullYear(), parseInt(month) - 1, parseInt(day))
        
        // If the date has passed this year, assume next year
        if (date < today) {
          date.setFullYear(today.getFullYear() + 1)
        }
        
        return date
      }
      
      return null
  }
}

/**
 * Convert time units to minutes
 */
function convertToMinutes(amount, unit) {
  const num = parseInt(amount)
  
  switch (unit.toLowerCase()) {
    case 'minute':
    case 'minutes':
    case 'min':
    case 'mins':
      return num
    
    case 'hour':
    case 'hours':
    case 'hr':
    case 'hrs':
      return num * 60
    
    case 'day':
    case 'days':
      return num * 60 * 24
    
    default:
      return num
  }
}

/**
 * Analyze task complexity and suggest improvements
 */
export function analyzeTaskComplexity(task) {
  const analysis = {
    complexity: 'simple',
    suggestions: [],
    score: 0
  }

  const title = task.title.toLowerCase()
  
  // Check for multiple actions
  const actionWords = ['and', 'then', 'also', 'plus', 'including']
  const hasMultipleActions = actionWords.some(word => title.includes(` ${word} `))
  
  if (hasMultipleActions) {
    analysis.complexity = 'complex'
    analysis.score += 2
    analysis.suggestions.push('Consider breaking this into multiple tasks')
  }

  // Check for vague language
  const vagueWords = ['maybe', 'probably', 'might', 'could', 'sort of', 'kind of']
  const hasVagueLanguage = vagueWords.some(word => title.includes(word))
  
  if (hasVagueLanguage) {
    analysis.score += 1
    analysis.suggestions.push('Make the task more specific and actionable')
  }

  // Check for missing context
  const contextWords = ['what', 'how', 'where', 'when', 'why', 'which']
  const needsContext = contextWords.some(word => title.includes(word)) || 
                       title.length < 10 ||
                       !title.includes(' ')
  
  if (needsContext) {
    analysis.score += 1
    analysis.suggestions.push('Add more context about what needs to be done')
  }

  // Check for time sensitivity
  if (task.metadata.deadline && !task.priority) {
    analysis.suggestions.push('Consider setting a priority level for this deadline')
  }

  // Determine overall complexity
  if (analysis.score >= 3) {
    analysis.complexity = 'complex'
  } else if (analysis.score >= 1) {
    analysis.complexity = 'moderate'
  }

  return analysis
}

/**
 * Extract actionable tasks from various content formats
 */
export function extractActionableTasks(content, notePath, options = {}) {
  const tasks = parseTasksFromContent(content, notePath)
  
  // Filter by options
  let filtered = tasks
  
  if (options.minComplexity) {
    filtered = filtered.filter(task => {
      const analysis = analyzeTaskComplexity(task)
      return analysis.complexity !== 'simple' || options.includeSimple
    })
  }

  if (options.requireDeadline) {
    filtered = filtered.filter(task => task.metadata.deadline)
  }

  if (options.excludeCompleted) {
    filtered = filtered.filter(task => task.status !== TASK_STATUSES.COMPLETED)
  }

  // Add analysis to each task
  return filtered.map(task => ({
    ...task,
    analysis: analyzeTaskComplexity(task),
    confidence: calculateExtractionConfidence(task)
  }))
}

/**
 * Calculate confidence score for task extraction
 */
function calculateExtractionConfidence(task) {
  let confidence = 0.5 // Base confidence
  
  // Higher confidence for explicit task formats
  if (task.source_type === 'checkbox') confidence += 0.4
  if (task.source_type === 'heading') confidence += 0.3
  
  // Lower confidence for natural language
  if (task.source_type === 'natural_language') confidence = 0.3
  
  // Adjust based on task quality
  const titleWords = task.title.split(' ').length
  if (titleWords >= 3 && titleWords <= 15) confidence += 0.1
  
  // Has specific metadata
  if (task.metadata.deadline) confidence += 0.1
  if (task.metadata.time_estimate) confidence += 0.1
  
  // Contains action verbs
  const actionVerbs = ['create', 'update', 'fix', 'implement', 'review', 'test', 'deploy', 'write', 'call', 'email', 'send', 'finish', 'complete']
  const hasActionVerb = actionVerbs.some(verb => 
    task.title.toLowerCase().includes(verb)
  )
  if (hasActionVerb) confidence += 0.1
  
  return Math.min(confidence, 1.0)
}

export default {
  parseTasksFromContent,
  extractActionableTasks,
  analyzeTaskComplexity,
  TASK_PATTERNS,
  STATUS_MAPPING,
  KEYWORD_STATUS_MAPPING
}