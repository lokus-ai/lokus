import React, { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  Plus,
  X,
  MoreHorizontal,
  GripVertical,
  Pencil,
  Trash2,
  RefreshCw,
  FileText,
} from "lucide-react";
import MarkdownIt from "markdown-it";
import { toast } from "sonner";
import { isDesktop } from '../platform/index.js';

// Initialize markdown renderer
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
});

// Individual task card component
function TaskCard({ task, onUpdate, onDelete, isDragging }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [showMenu, setShowMenu] = useState(false);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    data: { type: "card", task },
  });

  // Sync state when task prop changes
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
  }, [task.title, task.description]);

  // Render markdown description
  const renderedDescription = useMemo(() => {
    if (!task.description) return null;
    return md.render(task.description);
  }, [task.description]);

  const handleSave = useCallback(async () => {
    if (title.trim() && title !== task.title) {
      try {
        await onUpdate(task.id, { title: title.trim() });
      } catch (error) {
        console.error(error);
        toast.error(
          `Failed to save description: ${error.message || "Unknown errror"}`
        );
        setTitle(task.title);
      }
    }
    setIsEditing(false);
  }, [task.id, task.title, title, onUpdate]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        handleSave();
      } else if (e.key === "Escape") {
        setTitle(task.title);
        setIsEditing(false);
      }
    },
    [task.title, handleSave]
  );

  const handleSaveDescription = useCallback(async () => {
    const trimmedDesc = description.trim();
    if (trimmedDesc !== (task.description || "")) {
      try {
        await onUpdate(task.id, { description: trimmedDesc || null });
      } catch (error) {
        console.error(error);
        toast.error(
          `Description save failed: ${error.message || "Unknown error"}`
        );
        setDescription(task.description || "");
      }
    }
    setIsEditingDescription(false);
  }, [task.id, task.description, description, onUpdate]);

  const handleDescriptionKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        setDescription(task.description || "");
        setIsEditingDescription(false);
      }
      // Allow Enter for newlines in textarea, Cmd/Ctrl+Enter to save
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSaveDescription();
      }
    },
    [task.description, handleSaveDescription]
  );

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-app-bg border border-app-border rounded-lg p-3 mb-2 transition-all hover:shadow-md hover:border-app-accent/50 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-app-muted" />
        </div>

        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-app-text"
            autoFocus
          />
        ) : (
          <div
            className="flex-1 text-sm font-medium text-app-text cursor-pointer"
            onClick={() => setIsEditing(true)}
          >
            {task.title}
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-app-hover text-app-muted hover:text-app-text opacity-0 group-hover:opacity-100 transition-opacity"
            title="Task options"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-6 bg-app-panel border border-app-border rounded-lg shadow-xl z-20 min-w-40 overflow-hidden">
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-app-hover text-app-text flex items-center gap-2"
                >
                  <Pencil className="w-3 h-3" />
                  Edit Title
                </button>
                <button
                  onClick={() => {
                    setIsEditingDescription(true);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-app-hover text-app-text flex items-center gap-2"
                >
                  <FileText className="w-3 h-3" />
                  {task.description ? "Edit Description" : "Add Description"}
                </button>
                <button
                  onClick={() => {
                    onDelete(task.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-app-hover text-red-500 flex items-center gap-2"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {isEditingDescription ? (
        <div className="mt-2">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSaveDescription}
            onKeyDown={handleDescriptionKeyDown}
            placeholder="Add a description... (Markdown supported)"
            className="w-full bg-app-bg border border-app-accent rounded-lg px-2 py-1.5 text-xs text-app-text outline-none resize-none min-h-16 max-h-48"
            rows={3}
            autoFocus
          />
          <div className="text-[10px] text-app-muted mt-1">
            {isDesktop()
              ? 'Press Cmd/Ctrl+Enter to save, Escape to cancel'
              : 'Tap outside the box to save, or cancel'}
          </div>
        </div>
      ) : task.description ? (
        <div
          className="mt-2 text-xs text-app-muted kanban-card-markdown max-h-48 overflow-y-auto cursor-pointer hover:bg-app-hover/50 rounded p-1 -m-1"
          onClick={() => setIsEditingDescription(true)}
          dangerouslySetInnerHTML={{ __html: renderedDescription }}
        />
      ) : null}

      {task.due_date && (
        <div className="mt-2 text-xs text-app-muted/70 flex items-center gap-1">
          <span>📅</span>
          {new Date(task.due_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      )}
    </div>
  );
}

// Column component with droppable area
function KanbanColumn({
  column,
  columnId,
  tasks,
  onTaskUpdate,
  onTaskDelete,
  onAddTask,
  onRenameColumn,
  onDeleteColumn,
  canDelete,
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [columnName, setColumnName] = useState(column.name);
  const [showMenu, setShowMenu] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: { type: "column", columnId },
  });

  const handleAddTask = useCallback(async () => {
    if (newTaskTitle.trim()) {
      try {
        await onAddTask(newTaskTitle.trim(), columnId);
        setNewTaskTitle("");
        setIsAdding(false);
      } catch (error) {
        console.error(error);
        toast.error(`Add task failed: ${error.message || "Unknown error"}`);
      }
    }
  }, [newTaskTitle, columnId, onAddTask]);

  const handleRename = useCallback(async () => {
    if (columnName.trim() && columnName !== column.name) {
      try {
        await onRenameColumn(columnId, columnName.trim());
      } catch (error) {
        console.error(error);
        toast.error(`Rename failed: ${error.message || "Unknown error"}`);
        setColumnName(column.name);
      }
    }
    setIsRenaming(false);
  }, [columnId, columnName, column.name, onRenameColumn]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        if (isAdding) handleAddTask();
        else if (isRenaming) handleRename();
      } else if (e.key === "Escape") {
        if (isAdding) {
          setNewTaskTitle("");
          setIsAdding(false);
        } else if (isRenaming) {
          setColumnName(column.name);
          setIsRenaming(false);
        }
      }
    },
    [isAdding, isRenaming, handleAddTask, handleRename, column.name]
  );

  return (
    <div className="bg-app-panel/30 backdrop-blur-sm border border-app-border rounded-xl p-4 min-w-80 max-w-80 flex flex-col">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-app-border/50">
        {isRenaming ? (
          <input
            type="text"
            value={columnName}
            onChange={(e) => setColumnName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-app-bg border border-app-accent rounded px-2 py-1 text-sm font-semibold text-app-text outline-none"
            autoFocus
          />
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <h3 className="font-semibold text-sm text-app-text">
              {column.name}
            </h3>
            <span className="px-2 py-0.5 bg-app-border/40 rounded-full text-xs text-app-muted">
              {tasks.length}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsAdding(true)}
            className="p-1.5 rounded-lg hover:bg-app-hover text-app-muted hover:text-app-text transition-colors"
            title="Add task"
          >
            <Plus className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg hover:bg-app-hover text-app-muted hover:text-app-text transition-colors"
              title="Column options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-8 bg-app-panel border border-app-border rounded-lg shadow-xl z-20 min-w-40 overflow-hidden">
                  <button
                    onClick={() => {
                      setIsRenaming(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-app-hover text-app-text flex items-center gap-2"
                  >
                    <Pencil className="w-3 h-3" />
                    Rename
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => {
                        onDeleteColumn(columnId);
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-app-hover text-red-500 flex items-center gap-2"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete Column
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Droppable Area */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto min-h-32 rounded-lg transition-colors ${
          isOver
            ? "bg-app-accent/10 border-2 border-dashed border-app-accent"
            : ""
        }`}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onUpdate={onTaskUpdate}
            onDelete={onTaskDelete}
          />
        ))}

        {isAdding && (
          <div className="bg-app-bg border border-app-accent rounded-lg p-3 mb-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onBlur={handleAddTask}
              onKeyDown={handleKeyDown}
              placeholder="Task title..."
              className="w-full bg-transparent border-none outline-none text-sm text-app-text placeholder:text-app-muted"
              autoFocus
            />
          </div>
        )}

        {tasks.length === 0 && !isAdding && (
          <div className="flex flex-col items-center justify-center py-8 text-app-muted/50">
            <div className="text-xs">No tasks yet</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Kanban Board component
export default function KanbanBoard({ workspacePath, boardPath, onFileOpen }) {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCard, setActiveCard] = useState(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Load board from file
  const loadBoard = useCallback(async () => {
    if (!boardPath) return;

    try {
      setLoading(true);
      const loadedBoard = await invoke("open_kanban_board", {
        filePath: boardPath,
      });
      setBoard(loadedBoard);
      setError(null);
    } catch (error) {
      console.error(error);
      toast.error(
        `Failed to load kanban board: ${error.message || "Unknown error"}`
      );
      setError("Failed to load kanban board");
    } finally {
      setLoading(false);
    }
  }, [boardPath]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // Save board to file
  const saveBoard = useCallback(
    async (updatedBoard) => {
      if (!boardPath) return;

      try {
        await invoke("save_kanban_board", {
          filePath: boardPath,
          board: updatedBoard,
        });
        setBoard(updatedBoard);
      } catch (err) {
        throw err;
      }
    },
    [boardPath]
  );

  // Add new card to column
  const handleAddTask = useCallback(
    async (title, columnId) => {
      if (!board || !boardPath) return;

      try {
        const newCard = {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2),
          title,
          description: "",
          tags: [],
          assignee: null,
          priority: "normal",
          due_date: null,
          linked_notes: [],
          checklist: [],
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        };

        const updatedBoard = { ...board };
        if (!updatedBoard.columns[columnId]) {
          updatedBoard.columns[columnId] = {
            name: columnId,
            order: 0,
            cards: [],
          };
        }
        updatedBoard.columns[columnId].cards.push(newCard);
        updatedBoard.metadata.modified = new Date().toISOString();

        await saveBoard(updatedBoard);
      } catch (error) {
        console.error("Add task to board failed:", error);
        throw error;
      }
    },
    [board, boardPath, saveBoard]
  );

  // Update card
  const handleTaskUpdate = useCallback(
    async (cardId, updates) => {
      if (!board || !boardPath) return;

      try {
        const updatedBoard = { ...board };
        let found = false;

        for (const [columnId, column] of Object.entries(updatedBoard.columns)) {
          const cardIndex = column.cards.findIndex((c) => c.id === cardId);
          if (cardIndex !== -1) {
            updatedBoard.columns[columnId].cards[cardIndex] = {
              ...updatedBoard.columns[columnId].cards[cardIndex],
              ...updates,
              id: cardId,
              modified: new Date().toISOString(),
            };
            found = true;
            break;
          }
        }

        if (found) {
          updatedBoard.metadata.modified = new Date().toISOString();
          await saveBoard(updatedBoard);
        }
      } catch (error) {
        console.error("Task update to board failed:", error);
        throw error;
      }
    },
    [board, boardPath, saveBoard]
  );

  // Delete card
  const handleTaskDelete = useCallback(
    async (cardId) => {
      if (!board || !boardPath) return;

      try {
        const updatedBoard = { ...board };

        for (const [columnId, column] of Object.entries(updatedBoard.columns)) {
          const cardIndex = column.cards.findIndex((c) => c.id === cardId);
          if (cardIndex !== -1) {
            updatedBoard.columns[columnId].cards.splice(cardIndex, 1);
            updatedBoard.metadata.modified = new Date().toISOString();
            await saveBoard(updatedBoard);
            break;
          }
        }
      } catch (error) {
        console.error(error);
        toast.error(
          `Failed to update kanban board : ${error.message || "Unknown error"}`
        );
      }
    },
    [board, boardPath, saveBoard]
  );

  // Add new column
  const handleAddColumn = useCallback(async () => {
    if (!board || !boardPath || !newColumnName.trim()) return;

    try {
      const updatedBoard = { ...board };
      const columnId = newColumnName.toLowerCase().replace(/\s+/g, "-");
      const maxOrder = Math.max(
        ...Object.values(updatedBoard.columns).map((col) => col.order),
        -1
      );

      updatedBoard.columns[columnId] = {
        name: newColumnName.trim(),
        order: maxOrder + 1,
        cards: [],
      };
      updatedBoard.metadata.modified = new Date().toISOString();

      await saveBoard(updatedBoard);
      setNewColumnName("");
      setIsAddingColumn(false);
    } catch (error) {
      console.error(error);
      toast.error(
        `Failed to add column in kanban board : ${error.message || "Unknown error"}`
      );
    }
  }, [board, boardPath, newColumnName, saveBoard]);

  // Rename column
  const handleRenameColumn = useCallback(
    async (columnId, newName) => {
      if (!board || !boardPath) return;

      try {
        const updatedBoard = { ...board };
        updatedBoard.columns[columnId].name = newName;
        updatedBoard.metadata.modified = new Date().toISOString();
        await saveBoard(updatedBoard);
      } catch (error) {
        console.error("Rename column failed in board:", error);
        throw error;
      }
    },
    [board, boardPath, saveBoard]
  );

  // Delete column
  const handleDeleteColumn = useCallback(
    async (columnId) => {
      if (!board || !boardPath) return;

      try {
        const updatedBoard = { ...board };
        delete updatedBoard.columns[columnId];
        updatedBoard.metadata.modified = new Date().toISOString();
        await saveBoard(updatedBoard);
      } catch (error) {
        console.error(error);
        toast.error(
          `Failed to delete column kanban board : ${error.message || "Unknown error"}`
        );
      }
    },
    [board, boardPath, saveBoard]
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (event) => {
      const { active } = event;
      const activeTask = Object.values(board.columns)
        .flatMap((col) => col.cards)
        .find((card) => card.id === active.id);
      setActiveCard(activeTask);
    },
    [board]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      setActiveCard(null);

      if (!over || active.id === over.id || !board || !boardPath) return;

      const cardId = active.id;
      const targetColumnId = over.id;

      try {
        const updatedBoard = { ...board };
        let sourceColumnId = null;
        let card = null;

        // Find source column and card
        for (const [columnId, column] of Object.entries(updatedBoard.columns)) {
          const cardIndex = column.cards.findIndex((c) => c.id === cardId);
          if (cardIndex !== -1) {
            sourceColumnId = columnId;
            card = column.cards[cardIndex];
            updatedBoard.columns[columnId].cards.splice(cardIndex, 1);
            break;
          }
        }

        // Add to target column
        if (card && updatedBoard.columns[targetColumnId]) {
          card.modified = new Date().toISOString();
          updatedBoard.columns[targetColumnId].cards.push(card);
          updatedBoard.metadata.modified = new Date().toISOString();
          await saveBoard(updatedBoard);
        }
      } catch (error) {
        console.log(error);
        toast.error(`Failed to move card: ${error.message || "Unknown error"}`);
      }
    },
    [board, boardPath, saveBoard]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-app-muted mx-auto mb-2" />
          <div className="text-sm text-app-muted">Loading board...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-500 mb-3">{error}</div>
          <button
            onClick={loadBoard}
            className="px-4 py-2 text-sm rounded-lg bg-app-accent text-app-accent-fg hover:bg-app-accent/80 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-app-muted">No board loaded</div>
      </div>
    );
  }

  const columns = Object.entries(board.columns).sort(
    (a, b) => a[1].order - b[1].order
  );
  const totalCards = columns.reduce(
    (sum, [_, col]) => sum + (col.cards?.length || 0),
    0
  );

  return (
    <div className="h-full flex flex-col bg-app-bg">
      {/* Header */}
      <div className="p-4 border-b border-app-border bg-app-panel/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-app-text">
              {board.name || "Kanban Board"}
            </h2>
            <span className="px-2.5 py-1 bg-app-accent/20 text-app-accent rounded-full text-xs font-medium">
              {totalCards} {totalCards === 1 ? "card" : "cards"}
            </span>
          </div>
          <button
            onClick={loadBoard}
            className="p-2 rounded-lg hover:bg-app-hover text-app-muted hover:text-app-text transition-colors"
            title="Refresh board"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Board Content */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 p-4 h-full">
            {columns.map(([columnId, column]) => (
              <KanbanColumn
                key={columnId}
                columnId={columnId}
                column={column}
                tasks={column.cards || []}
                onTaskUpdate={handleTaskUpdate}
                onTaskDelete={handleTaskDelete}
                onAddTask={handleAddTask}
                onRenameColumn={handleRenameColumn}
                onDeleteColumn={handleDeleteColumn}
                canDelete={columns.length > 1}
              />
            ))}

            {/* Add Column Button */}
            {isAddingColumn ? (
              <div className="bg-app-panel/30 border border-app-border rounded-xl p-4 min-w-80 max-w-80">
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onBlur={() => {
                    if (!newColumnName.trim()) setIsAddingColumn(false);
                    else handleAddColumn();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddColumn();
                    else if (e.key === "Escape") {
                      setNewColumnName("");
                      setIsAddingColumn(false);
                    }
                  }}
                  placeholder="Column name..."
                  className="w-full bg-app-bg border border-app-accent rounded-lg px-3 py-2 text-sm font-semibold text-app-text outline-none"
                  autoFocus
                />
              </div>
            ) : (
              <button
                onClick={() => setIsAddingColumn(true)}
                className="bg-app-panel/20 border-2 border-dashed border-app-border rounded-xl p-4 min-w-80 max-w-80 hover:bg-app-panel/30 hover:border-app-accent/50 transition-all flex flex-col items-center justify-center gap-2 text-app-muted hover:text-app-text"
              >
                <Plus className="w-6 h-6" />
                <span className="text-sm font-medium">Add Column</span>
              </button>
            )}
          </div>

          <DragOverlay>
            {activeCard ? (
              <div className="bg-app-bg border border-app-accent shadow-2xl rounded-lg p-3 opacity-90 rotate-3">
                <div className="text-sm font-medium text-app-text">
                  {activeCard.title}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
