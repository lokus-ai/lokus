/**
 * Daily Notes MCP Tool
 *
 * Provides daily notes functionality for the MCP server
 * Actions: today, yesterday, tomorrow, date, list
 */

import { readFile, writeFile, readdir, mkdir, stat } from 'fs/promises';
import { join, basename } from 'path';

// Date formatting helpers (no external dependency)
const formatDate = (date, format = 'yyyy-MM-dd') => {
  const d = new Date(date);
  const pad = (n) => n.toString().padStart(2, '0');

  const tokens = {
    yyyy: d.getFullYear(),
    MM: pad(d.getMonth() + 1),
    dd: pad(d.getDate()),
    EEEE: d.toLocaleDateString('en-US', { weekday: 'long' }),
    EEE: d.toLocaleDateString('en-US', { weekday: 'short' }),
    MMMM: d.toLocaleDateString('en-US', { month: 'long' }),
    MMM: d.toLocaleDateString('en-US', { month: 'short' }),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes()),
    ss: pad(d.getSeconds())
  };

  let result = format;
  for (const [token, value] of Object.entries(tokens)) {
    result = result.replace(new RegExp(token, 'g'), value);
  }
  return result;
};

const parseDate = (dateString, format = 'yyyy-MM-dd') => {
  // Simple parser for yyyy-MM-dd format
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Default configuration
const DEFAULT_CONFIG = {
  format: 'yyyy-MM-dd',
  folder: 'Daily Notes'
};

/**
 * Get or create a daily note
 */
async function getDailyNote(workspace, date, config = DEFAULT_CONFIG) {
  const folderPath = join(workspace, config.folder);
  const fileName = `${formatDate(date, config.format)}.md`;
  const filePath = join(folderPath, fileName);

  // Ensure folder exists
  try {
    await mkdir(folderPath, { recursive: true });
  } catch (error) {
    // Folder might already exist
  }

  // Check if file exists
  let content = null;
  let created = false;

  try {
    content = await readFile(filePath, 'utf-8');
  } catch (error) {
    // File doesn't exist, create it
    const dayName = formatDate(date, 'EEEE');
    const dateStr = formatDate(date, config.format);
    content = `# ${dateStr} - ${dayName}\n\n`;

    await writeFile(filePath, content, 'utf-8');
    created = true;
  }

  return {
    path: filePath,
    date: formatDate(date, config.format),
    dayName: formatDate(date, 'EEEE'),
    content,
    created
  };
}

/**
 * List all daily notes
 */
async function listDailyNotes(workspace, config = DEFAULT_CONFIG, limit = 30) {
  const folderPath = join(workspace, config.folder);

  try {
    const entries = await readdir(folderPath);
    const notes = [];

    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;

      const name = entry.replace(/\.md$/, '');
      const date = parseDate(name, config.format);

      if (date) {
        const filePath = join(folderPath, entry);
        const stats = await stat(filePath);

        notes.push({
          path: filePath,
          name: entry,
          date: formatDate(date, config.format),
          dayName: formatDate(date, 'EEEE'),
          modified: stats.mtime.toISOString()
        });
      }
    }

    // Sort by date descending and limit
    notes.sort((a, b) => b.date.localeCompare(a.date));
    return notes.slice(0, limit);
  } catch (error) {
    // Folder doesn't exist yet
    return [];
  }
}

// Tool definitions
export const dailyNotesTools = [
  {
    name: 'daily_note',
    description: 'Manage daily notes - open today, yesterday, tomorrow, or a specific date. Daily notes are automatically created if they don\'t exist.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['today', 'yesterday', 'tomorrow', 'date', 'list'],
          description: 'Action to perform: today (get/create today\'s note), yesterday, tomorrow, date (specific date), list (list all daily notes)'
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (required for "date" action)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of notes to return for "list" action (default: 30)'
        }
      },
      required: ['action']
    }
  }
];

/**
 * Execute daily notes tool
 */
export async function executeDailyNotesTool(toolName, args, workspace) {
  if (toolName !== 'daily_note') {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const { action, date: dateStr, limit = 30 } = args;

  let result;

  switch (action) {
    case 'today': {
      const note = await getDailyNote(workspace, new Date());
      result = {
        success: true,
        action: 'today',
        ...note,
        message: note.created
          ? `Created today's daily note: ${note.path}`
          : `Opened today's daily note: ${note.path}`
      };
      break;
    }

    case 'yesterday': {
      const note = await getDailyNote(workspace, addDays(new Date(), -1));
      result = {
        success: true,
        action: 'yesterday',
        ...note,
        message: note.created
          ? `Created yesterday's daily note: ${note.path}`
          : `Opened yesterday's daily note: ${note.path}`
      };
      break;
    }

    case 'tomorrow': {
      const note = await getDailyNote(workspace, addDays(new Date(), 1));
      result = {
        success: true,
        action: 'tomorrow',
        ...note,
        message: note.created
          ? `Created tomorrow's daily note: ${note.path}`
          : `Opened tomorrow's daily note: ${note.path}`
      };
      break;
    }

    case 'date': {
      if (!dateStr) {
        throw new Error('Date parameter required for "date" action (format: YYYY-MM-DD)');
      }

      const date = parseDate(dateStr);
      if (!date) {
        throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD format.`);
      }

      const note = await getDailyNote(workspace, date);
      result = {
        success: true,
        action: 'date',
        ...note,
        message: note.created
          ? `Created daily note for ${dateStr}: ${note.path}`
          : `Opened daily note for ${dateStr}: ${note.path}`
      };
      break;
    }

    case 'list': {
      const notes = await listDailyNotes(workspace, DEFAULT_CONFIG, limit);
      result = {
        success: true,
        action: 'list',
        count: notes.length,
        notes,
        message: notes.length > 0
          ? `Found ${notes.length} daily notes`
          : 'No daily notes found. Use action "today" to create one.'
      };
      break;
    }

    default:
      throw new Error(`Unknown action: ${action}. Use: today, yesterday, tomorrow, date, or list`);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2)
    }]
  };
}

export default { dailyNotesTools, executeDailyNotesTool };
