/**
 * Tasks MCP Tool
 *
 * Provides task management functionality for the MCP server
 * Actions: list, search, update, stats
 *
 * Parses tasks from markdown files using checkbox syntax:
 * - [ ] Todo
 * - [x] Completed
 * - [/] In Progress
 * - [!] Urgent
 * - [?] Question
 * - [-] Cancelled
 * - [>] Delegated
 */

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, relative, extname } from 'path';

// Task status constants
const TASK_STATUSES = {
  TODO: 'todo',
  IN_PROGRESS: 'in-progress',
  URGENT: 'urgent',
  QUESTION: 'question',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DELEGATED: 'delegated'
};

// Symbol to status mapping
const SYMBOL_TO_STATUS = {
  ' ': TASK_STATUSES.TODO,
  'x': TASK_STATUSES.COMPLETED,
  'X': TASK_STATUSES.COMPLETED,
  '/': TASK_STATUSES.IN_PROGRESS,
  '!': TASK_STATUSES.URGENT,
  '?': TASK_STATUSES.QUESTION,
  '-': TASK_STATUSES.CANCELLED,
  '>': TASK_STATUSES.DELEGATED
};

// Status to symbol mapping
const STATUS_TO_SYMBOL = {
  [TASK_STATUSES.TODO]: ' ',
  [TASK_STATUSES.COMPLETED]: 'x',
  [TASK_STATUSES.IN_PROGRESS]: '/',
  [TASK_STATUSES.URGENT]: '!',
  [TASK_STATUSES.QUESTION]: '?',
  [TASK_STATUSES.CANCELLED]: '-',
  [TASK_STATUSES.DELEGATED]: '>'
};

// Task checkbox regex
const TASK_REGEX = /^(\s*)-\s*\[([x X/!?\->]|\s)\]\s*(.+)$/;

/**
 * Parse a task from a line
 */
function parseTaskLine(line, lineNumber) {
  const match = line.match(TASK_REGEX);
  if (!match) return null;

  const [, indent, symbol, title] = match;
  const status = SYMBOL_TO_STATUS[symbol] || TASK_STATUSES.TODO;

  // Extract tags (#tag)
  const tags = [];
  const tagMatches = title.matchAll(/#(\w+)/g);
  for (const m of tagMatches) {
    tags.push(m[1]);
  }

  // Extract mentions (@person)
  const mentions = [];
  const mentionMatches = title.matchAll(/@(\w+)/g);
  for (const m of mentionMatches) {
    mentions.push(m[1]);
  }

  // Check for priority keywords
  let priority = 'normal';
  if (/\b(urgent|asap|critical)\b/i.test(title)) priority = 'urgent';
  else if (/\b(high priority|important)\b/i.test(title)) priority = 'high';
  else if (/\b(low priority)\b/i.test(title)) priority = 'low';

  return {
    title: title.trim(),
    status,
    symbol,
    priority,
    tags,
    mentions,
    lineNumber: lineNumber + 1, // 1-based
    indent: indent.length,
    originalLine: line
  };
}

/**
 * Extract all tasks from a file
 */
async function extractTasksFromFile(filePath, workspacePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const tasks = [];

    lines.forEach((line, index) => {
      const task = parseTaskLine(line, index);
      if (task) {
        task.notePath = relative(workspacePath, filePath);
        task.id = `${task.notePath}:${task.lineNumber}`;
        tasks.push(task);
      }
    });

    return tasks;
  } catch (error) {
    return [];
  }
}

/**
 * Recursively scan directory for markdown files
 */
async function scanDirectory(dirPath, files = []) {
  try {
    const entries = await readdir(dirPath);

    for (const entry of entries) {
      // Skip hidden files/folders and common non-note directories
      if (entry.startsWith('.') || entry === 'node_modules') continue;

      const fullPath = join(dirPath, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        await scanDirectory(fullPath, files);
      } else if (extname(entry) === '.md') {
        files.push(fullPath);
      }
    }

    return files;
  } catch (error) {
    return files;
  }
}

/**
 * Get all tasks from workspace
 */
async function getAllTasks(workspace, options = {}) {
  const { status, tag, limit = 100, includeCompleted = false } = options;

  const files = await scanDirectory(workspace);
  let allTasks = [];

  for (const file of files) {
    const tasks = await extractTasksFromFile(file, workspace);
    allTasks.push(...tasks);
  }

  // Filter by status
  if (status) {
    allTasks = allTasks.filter(t => t.status === status);
  } else if (!includeCompleted) {
    // By default, exclude completed and cancelled
    allTasks = allTasks.filter(t =>
      t.status !== TASK_STATUSES.COMPLETED &&
      t.status !== TASK_STATUSES.CANCELLED
    );
  }

  // Filter by tag
  if (tag) {
    allTasks = allTasks.filter(t => t.tags.includes(tag));
  }

  // Sort: urgent first, then in-progress, then todo, then by file
  const statusOrder = {
    [TASK_STATUSES.URGENT]: 0,
    [TASK_STATUSES.IN_PROGRESS]: 1,
    [TASK_STATUSES.QUESTION]: 2,
    [TASK_STATUSES.TODO]: 3,
    [TASK_STATUSES.DELEGATED]: 4,
    [TASK_STATUSES.COMPLETED]: 5,
    [TASK_STATUSES.CANCELLED]: 6
  };

  allTasks.sort((a, b) => {
    const orderDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    if (orderDiff !== 0) return orderDiff;
    return a.notePath.localeCompare(b.notePath);
  });

  return allTasks.slice(0, limit);
}

/**
 * Update a task's status in its file
 */
async function updateTaskStatus(workspace, taskId, newStatus) {
  const [notePath, lineNum] = taskId.split(':');
  const lineNumber = parseInt(lineNum);

  if (!notePath || isNaN(lineNumber)) {
    throw new Error(`Invalid task ID format: ${taskId}`);
  }

  const filePath = join(workspace, notePath);
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  const lineIndex = lineNumber - 1;
  if (lineIndex < 0 || lineIndex >= lines.length) {
    throw new Error(`Line ${lineNumber} not found in file`);
  }

  const line = lines[lineIndex];
  const task = parseTaskLine(line, lineIndex);

  if (!task) {
    throw new Error(`Line ${lineNumber} is not a task`);
  }

  // Get new symbol
  const newSymbol = STATUS_TO_SYMBOL[newStatus];
  if (!newSymbol && newSymbol !== ' ') {
    throw new Error(`Invalid status: ${newStatus}. Valid: ${Object.keys(STATUS_TO_SYMBOL).join(', ')}`);
  }

  // Replace the symbol in the line
  const newLine = line.replace(/\[([x X/!?\->]|\s)\]/, `[${newSymbol}]`);
  lines[lineIndex] = newLine;

  await writeFile(filePath, lines.join('\n'), 'utf-8');

  return {
    id: taskId,
    title: task.title,
    oldStatus: task.status,
    newStatus,
    notePath,
    lineNumber
  };
}

/**
 * Get task statistics
 */
async function getTaskStats(workspace) {
  const files = await scanDirectory(workspace);
  let allTasks = [];

  for (const file of files) {
    const tasks = await extractTasksFromFile(file, workspace);
    allTasks.push(...tasks);
  }

  const stats = {
    total: allTasks.length,
    byStatus: {},
    byPriority: {},
    byTag: {},
    filesWithTasks: new Set()
  };

  for (const task of allTasks) {
    // By status
    stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;

    // By priority
    stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;

    // By tag
    for (const tag of task.tags) {
      stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
    }

    // Track files
    stats.filesWithTasks.add(task.notePath);
  }

  stats.filesWithTasks = stats.filesWithTasks.size;

  // Calculate completion rate
  const completed = stats.byStatus[TASK_STATUSES.COMPLETED] || 0;
  const cancelled = stats.byStatus[TASK_STATUSES.CANCELLED] || 0;
  const active = stats.total - completed - cancelled;
  stats.completionRate = stats.total > 0
    ? Math.round((completed / stats.total) * 100)
    : 0;
  stats.activeTasks = active;

  return stats;
}

// Tool definitions
export const tasksTools = [
  {
    name: 'manage_tasks',
    description: 'Manage tasks extracted from markdown notes. Tasks use checkbox syntax: - [ ] todo, - [x] done, - [/] in progress, - [!] urgent, - [?] question, - [-] cancelled, - [>] delegated',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'search', 'update', 'stats'],
          description: 'Action: list (all tasks), search (filter by query/tag/status), update (change status), stats (statistics)'
        },
        taskId: {
          type: 'string',
          description: 'Task ID for update action (format: path/to/note.md:lineNumber)'
        },
        status: {
          type: 'string',
          enum: ['todo', 'in-progress', 'urgent', 'question', 'completed', 'cancelled', 'delegated'],
          description: 'Filter by status (list/search) or new status (update)'
        },
        tag: {
          type: 'string',
          description: 'Filter tasks by tag (without #)'
        },
        query: {
          type: 'string',
          description: 'Search query to filter task titles'
        },
        includeCompleted: {
          type: 'boolean',
          description: 'Include completed tasks in list (default: false)'
        },
        limit: {
          type: 'number',
          description: 'Maximum tasks to return (default: 100)'
        }
      },
      required: ['action']
    }
  }
];

/**
 * Execute tasks tool
 */
export async function executeTasksTool(toolName, args, workspace) {
  if (toolName !== 'manage_tasks') {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const { action, taskId, status, tag, query, includeCompleted = false, limit = 100 } = args;

  let result;

  switch (action) {
    case 'list': {
      const tasks = await getAllTasks(workspace, { status, tag, limit, includeCompleted });
      result = {
        success: true,
        action: 'list',
        count: tasks.length,
        tasks,
        message: tasks.length > 0
          ? `Found ${tasks.length} tasks`
          : 'No tasks found'
      };
      break;
    }

    case 'search': {
      let tasks = await getAllTasks(workspace, { status, tag, limit: 500, includeCompleted });

      // Filter by query
      if (query) {
        const lowerQuery = query.toLowerCase();
        tasks = tasks.filter(t =>
          t.title.toLowerCase().includes(lowerQuery) ||
          t.notePath.toLowerCase().includes(lowerQuery)
        );
      }

      tasks = tasks.slice(0, limit);

      result = {
        success: true,
        action: 'search',
        query: query || null,
        status: status || null,
        tag: tag || null,
        count: tasks.length,
        tasks,
        message: `Found ${tasks.length} matching tasks`
      };
      break;
    }

    case 'update': {
      if (!taskId) {
        throw new Error('taskId required for update action');
      }
      if (!status) {
        throw new Error('status required for update action');
      }

      const updated = await updateTaskStatus(workspace, taskId, status);
      result = {
        success: true,
        action: 'update',
        ...updated,
        message: `Task updated: ${updated.oldStatus} -> ${updated.newStatus}`
      };
      break;
    }

    case 'stats': {
      const stats = await getTaskStats(workspace);
      result = {
        success: true,
        action: 'stats',
        ...stats,
        message: `${stats.total} tasks across ${stats.filesWithTasks} files (${stats.completionRate}% complete)`
      };
      break;
    }

    default:
      throw new Error(`Unknown action: ${action}. Use: list, search, update, or stats`);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2)
    }]
  };
}

export default { tasksTools, executeTasksTool };
