/**
 * Kanban Board Tools for MCP
 * Tools for working with Lokus Kanban boards
 */

import { readFile, writeFile, readdir, mkdir } from "fs/promises";
import { join } from "path";

export const kanbanTools = [
  {
    name: "list_boards",
    description: "List all kanban boards in the workspace",
    inputSchema: {
      type: "object",
      properties: {},
    }
  },
  {
    name: "get_board",
    description: "Get kanban board with columns and cards",
    inputSchema: {
      type: "object",
      properties: {
        boardId: {
          type: "string",
          description: "Board ID or name"
        }
      },
      required: ["boardId"]
    }
  },
  {
    name: "create_board",
    description: "Create a new kanban board. Supports automatic date-based column creation.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Board name"
        },
        columns: {
          type: "array",
          items: { type: "string" },
          description: "Column names (e.g., ['To Do', 'In Progress', 'Done'])"
        },
        dateType: {
          type: "string",
          enum: ["monthly", "quarterly", "yearly", "custom"],
          description: "Type of date-based columns to create (optional)"
        },
        startDate: {
          type: "string",
          description: "Start date for date-based columns (YYYY-MM-DD format, optional)"
        },
        endDate: {
          type: "string",
          description: "End date for date-based columns (YYYY-MM-DD format, optional)"
        },
        additionalColumns: {
          type: "array",
          items: { type: "string" },
          description: "Additional status columns (e.g., ['Applied', 'Accepted', 'Rejected'])"
        }
      },
      required: ["name"]
    }
  },
  {
    name: "add_card",
    description: "Add a card to a kanban column",
    inputSchema: {
      type: "object",
      properties: {
        boardId: {
          type: "string",
          description: "Board ID"
        },
        column: {
          type: "string",
          description: "Column name"
        },
        card: {
          type: "object",
          description: "Card data (title, description, tags, etc)"
        }
      },
      required: ["boardId", "column", "card"]
    }
  },
  {
    name: "move_card",
    description: "Move a card between columns",
    inputSchema: {
      type: "object",
      properties: {
        boardId: {
          type: "string",
          description: "Board ID"
        },
        cardId: {
          type: "string",
          description: "Card ID"
        },
        fromColumn: {
          type: "string",
          description: "Source column"
        },
        toColumn: {
          type: "string",
          description: "Target column"
        }
      },
      required: ["boardId", "cardId", "fromColumn", "toColumn"]
    }
  },
  {
    name: "update_card",
    description: "Update card properties",
    inputSchema: {
      type: "object",
      properties: {
        boardId: {
          type: "string",
          description: "Board ID"
        },
        cardId: {
          type: "string",
          description: "Card ID"
        },
        updates: {
          type: "object",
          description: "Fields to update"
        }
      },
      required: ["boardId", "cardId", "updates"]
    }
  },
  {
    name: "get_board_stats",
    description: "Get statistics for a kanban board",
    inputSchema: {
      type: "object",
      properties: {
        boardId: {
          type: "string",
          description: "Board ID"
        }
      },
      required: ["boardId"]
    }
  }
];

export async function executeKanbanTool(tool, args, workspace, apiUrl) {
  switch (tool) {
    case "list_boards":
      return await listBoards(workspace);

    case "get_board":
      return await getBoard(workspace, args.boardId);

    case "create_board":
      return await createBoard(workspace, args);

    case "add_card":
      return await addCard(workspace, args);

    case "move_card":
      return await moveCard(workspace, args);

    case "update_card":
      return await updateCard(workspace, args);

    case "get_board_stats":
      return await getBoardStats(workspace, args.boardId);

    default:
      throw new Error(`Unknown kanban tool: ${tool}`);
  }
}

async function listBoards(workspace) {
  const kanbanDir = join(workspace, '.lokus', 'kanban');

  try {
    const entries = await readdir(kanbanDir, { withFileTypes: true });
    const boards = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const boardId = entry.name.replace('.json', '');
        try {
          const content = await readFile(join(kanbanDir, entry.name), 'utf-8');
          const board = JSON.parse(content);

          const totalCards = Object.values(board.columns || {})
            .reduce((sum, col) => sum + (col.cards?.length || 0), 0);

          boards.push({
            id: boardId,
            name: board.name || boardId,
            columns: Object.keys(board.columns || {}).length,
            cards: totalCards,
            modified: board.modified
          });
        } catch (e) {
          // Skip invalid boards
        }
      }
    }

    return {
      content: [{
        type: "text",
        text: `**Kanban Boards:**\n\n${
          boards.length > 0
            ? boards.map(b => `📋 **${b.name}**\n  - ID: ${b.id}\n  - Columns: ${b.columns}\n  - Cards: ${b.cards}\n  - Modified: ${b.modified || 'Unknown'}`).join('\n\n')
            : 'No kanban boards found'
        }`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: "Kanban feature not configured in this workspace"
      }]
    };
  }
}

async function getBoard(workspace, boardId) {
  const boardPath = join(workspace, '.lokus', 'kanban', `${boardId}.json`);

  try {
    const content = await readFile(boardPath, 'utf-8');
    const board = JSON.parse(content);

    let output = `**Kanban Board: ${board.name || boardId}**\n\n`;

    for (const [columnName, column] of Object.entries(board.columns || {})) {
      const cards = column.cards || [];
      output += `**${columnName}** (${cards.length} cards)\n`;

      cards.slice(0, 5).forEach(card => {
        output += `  • ${card.title}`;
        if (card.tags?.length) output += ` [${card.tags.join(', ')}]`;
        if (card.assignee) output += ` @${card.assignee}`;
        output += '\n';
      });

      if (cards.length > 5) {
        output += `  ... and ${cards.length - 5} more cards\n`;
      }
      output += '\n';
    }

    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: `Board "${boardId}" not found`
      }]
    };
  }
}

async function createBoard(workspace, { name, columns, dateType, startDate, endDate, additionalColumns = [] }) {
  const kanbanDir = join(workspace, '.lokus', 'kanban');
  await mkdir(kanbanDir, { recursive: true });

  const boardId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const boardPath = join(kanbanDir, `${boardId}.json`);

  const now = new Date().toISOString();

  const board = {
    version: "1.0.0",
    name,
    columns: {},
    settings: {
      card_template: {},
      automations: [],
      custom_fields: []
    },
    metadata: {
      created: now,
      modified: now,
      created_with: "Lokus MCP"
    }
  };

  let finalColumns = columns || ['To Do', 'In Progress', 'Done'];

  // Generate date-based columns if requested
  if (dateType && startDate) {
    finalColumns = generateDateColumns(dateType, startDate, endDate);
    // Add additional status columns at the end
    if (additionalColumns.length > 0) {
      finalColumns = [...finalColumns, ...additionalColumns];
    }
  }

  // Initialize columns
  for (let i = 0; i < finalColumns.length; i++) {
    const columnName = finalColumns[i];
    const columnId = columnName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    board.columns[columnId] = {
      name: columnName,
      order: i,
      cards: []
    };
  }

  await writeFile(boardPath, JSON.stringify(board, null, 2));

  return {
    content: [{
      type: "text",
      text: `✅ Kanban board "${name}" created with ${Object.keys(board.columns).length} columns:\n${finalColumns.map(c => `  - ${c}`).join('\n')}`
    }]
  };
}

function generateDateColumns(dateType, startDateStr, endDateStr) {
  const columns = [];
  const startDate = new Date(startDateStr);
  const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate.getFullYear() + 1, startDate.getMonth(), 1);

  if (dateType === 'monthly') {
    let current = new Date(startDate);
    while (current <= endDate) {
      const monthName = current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      columns.push(`📅 ${monthName}`);
      current.setMonth(current.getMonth() + 1);
    }
  } else if (dateType === 'quarterly') {
    let current = new Date(startDate);
    let quarter = Math.floor(current.getMonth() / 3) + 1;
    while (current <= endDate) {
      columns.push(`📅 Q${quarter} ${current.getFullYear()}`);
      current.setMonth(current.getMonth() + 3);
      quarter = Math.floor(current.getMonth() / 3) + 1;
    }
  } else if (dateType === 'yearly') {
    let year = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    while (year <= endYear) {
      columns.push(`📅 ${year}`);
      year++;
    }
  }

  return columns;
}

async function addCard(workspace, { boardId, column, card }) {
  const boardPath = join(workspace, '.lokus', 'kanban', `${boardId}.json`);

  try {
    const content = await readFile(boardPath, 'utf-8');
    const board = JSON.parse(content);

    if (!board.columns[column]) {
      throw new Error(`Column "${column}" not found`);
    }

    const now = new Date().toISOString();

    const newCard = {
      id: card.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
      title: card.title || 'Untitled',
      description: card.description || '',
      tags: card.tags || [],
      assignee: card.assignee || null,
      priority: card.priority || 'normal',
      due_date: card.due_date || card.dueDate || null,
      linked_notes: card.linked_notes || [],
      checklist: card.checklist || [],
      created: now,
      modified: now
    };

    board.columns[column].cards = board.columns[column].cards || [];
    board.columns[column].cards.push(newCard);
    board.metadata.modified = now;

    await writeFile(boardPath, JSON.stringify(board, null, 2));

    return {
      content: [{
        type: "text",
        text: `✅ Card "${newCard.title}" added to column "${column}" with ID: ${newCard.id}`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: `❌ Failed to add card: ${e.message}`
      }]
    };
  }
}

async function moveCard(workspace, { boardId, cardId, fromColumn, toColumn }) {
  const boardPath = join(workspace, '.lokus', 'kanban', `${boardId}.json`);

  try {
    const content = await readFile(boardPath, 'utf-8');
    const board = JSON.parse(content);

    if (!board.columns[fromColumn] || !board.columns[toColumn]) {
      throw new Error('Column not found');
    }

    // Find and remove card from source column
    const cardIndex = board.columns[fromColumn].cards?.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      throw new Error(`Card ${cardId} not found in column ${fromColumn}`);
    }

    const [card] = board.columns[fromColumn].cards.splice(cardIndex, 1);
    card.modified = new Date().toISOString();

    // Add to target column
    board.columns[toColumn].cards = board.columns[toColumn].cards || [];
    board.columns[toColumn].cards.push(card);
    board.metadata.modified = new Date().toISOString();

    await writeFile(boardPath, JSON.stringify(board, null, 2));

    return {
      content: [{
        type: "text",
        text: `✅ Card "${card.title}" moved from "${fromColumn}" to "${toColumn}"`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: `❌ Failed to move card: ${e.message}`
      }]
    };
  }
}

async function updateCard(workspace, { boardId, cardId, updates }) {
  const boardPath = join(workspace, '.lokus', 'kanban', `${boardId}.json`);

  try {
    const content = await readFile(boardPath, 'utf-8');
    const board = JSON.parse(content);

    let cardFound = false;

    for (const column of Object.values(board.columns || {})) {
      const cardIndex = column.cards?.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        column.cards[cardIndex] = {
          ...column.cards[cardIndex],
          ...updates,
          id: cardId,
          modified: new Date().toISOString()
        };
        cardFound = true;
        break;
      }
    }

    if (!cardFound) {
      throw new Error(`Card ${cardId} not found`);
    }

    board.metadata.modified = new Date().toISOString();
    await writeFile(boardPath, JSON.stringify(board, null, 2));

    return {
      content: [{
        type: "text",
        text: `✅ Card ${cardId} updated successfully`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: `❌ Failed to update card: ${e.message}`
      }]
    };
  }
}

async function getBoardStats(workspace, boardId) {
  const boardPath = join(workspace, '.lokus', 'kanban', `${boardId}.json`);

  try {
    const content = await readFile(boardPath, 'utf-8');
    const board = JSON.parse(content);

    const stats = {
      columnCount: Object.keys(board.columns || {}).length,
      totalCards: 0,
      cardsByColumn: {},
      cardsByPriority: { high: 0, normal: 0, low: 0 },
      cardsByAssignee: {},
      overdueTasks: 0
    };

    const now = new Date();

    for (const [columnName, column] of Object.entries(board.columns || {})) {
      const cards = column.cards || [];
      stats.totalCards += cards.length;
      stats.cardsByColumn[columnName] = cards.length;

      for (const card of cards) {
        // Count by priority
        stats.cardsByPriority[card.priority || 'normal']++;

        // Count by assignee
        if (card.assignee) {
          stats.cardsByAssignee[card.assignee] = (stats.cardsByAssignee[card.assignee] || 0) + 1;
        }

        // Check overdue
        if (card.dueDate && new Date(card.dueDate) < now) {
          stats.overdueTasks++;
        }
      }
    }

    return {
      content: [{
        type: "text",
        text: `**Board Statistics: ${board.name || boardId}**\n
📊 Total Cards: ${stats.totalCards}
📋 Columns: ${stats.columnCount}
⚠️ Overdue Tasks: ${stats.overdueTasks}

**Cards by Column:**
${Object.entries(stats.cardsByColumn).map(([col, count]) => `  - ${col}: ${count}`).join('\n')}

**Cards by Priority:**
  - High: ${stats.cardsByPriority.high}
  - Normal: ${stats.cardsByPriority.normal}
  - Low: ${stats.cardsByPriority.low}

**Cards by Assignee:**
${Object.entries(stats.cardsByAssignee).map(([assignee, count]) => `  - @${assignee}: ${count}`).join('\n') || '  No assignments'}`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: `❌ Failed to get stats: ${e.message}`
      }]
    };
  }
}