import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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

// Initialize markdown renderer
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
});


const formatDateTime = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const getNowLocalISOString =() => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};


// Individual task card component
function TaskCard({ task, onUpdate, onDelete, isDragging }) {
  const [mode, setMode] = useState("view"); // view | edit

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [dueDate, setDueDate] = useState(
    task.due_date ? task.due_date.slice(0, 10) : ""
  );

  const [showMenu, setShowMenu] = useState(false);

  const menuRef = useRef(null);


  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    data: { type: "card", task },
  });

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
    setDueDate(task.due_date ? task.due_date.slice(0, 10) : "");
  }, [task]);

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const saveAll = async () => {
    try {
       if (dueDate && new Date(dueDate) < new Date()) {
          toast.error("⛔ Due date cannot be in the past");
          return;
        }

      await onUpdate(task.id, {
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      });
      setMode("view");
    } catch {
      toast.error("Failed to save task");
    }
  };

  const cancelEdit = () => {
    setTitle(task.title);
    setDescription(task.description || "");
    setDueDate(task.due_date ? task.due_date.slice(0, 10) : "");
    setMode("view");
  };

  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
}, [showMenu]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border p-3 mb-2
        bg-app-bg border-app-border
        hover:shadow-lg transition
        ${isDragging ? "opacity-50 scale-[0.97]" : ""}`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1 top-3 cursor-grab opacity-0 group-hover:opacity-100"
      >
        <GripVertical className="w-4 h-4 text-app-muted" />
      </div>

      {/* Header */}
      <div className="flex items-start gap-2 pl-4">
        {mode === "edit" ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 bg-blue-50/10 border border-blue-500/30
              rounded-md px-2 py-1 text-sm font-semibold outline-none"
          />
        ) : (
          <div className="flex-1 text-sm font-semibold tracking-wide">
            {task.title}
          </div>
        )}

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="p-1 rounded hover:bg-app-hover"
          >
            <MoreHorizontal className="w-4 h-4 text-app-muted" />
          </button>

          {showMenu && (
            <div
              ref={menuRef}
              className="absolute right-0 top-7 z-20 min-w-40
                rounded-lg border bg-app-panel shadow-xl p-1"
            >
              <button
                onClick={() => {
                  setMode((prev)=> prev === "edit" ? "view" : "edit");
                  setShowMenu(false);
                }}
                className="menu-item flex items-center gap-2 hover:text-blue-500"
              >
                Edit
              </button>

              <button
                onClick={() => onDelete(task.id)}
                className="menu-item flex items-center gap-2
                  text-red-500 hover:bg-red-500/10"
              >
                Delete
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Description */}
      {mode === "edit" ? (
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add description…"
          className="mt-3 w-full rounded-lg border
            bg-slate-900/40 p-2 text-xs outline-none"
        />
      ) : task.description ? (
        <div className="mt-3 text-xs text-app-muted bg-app-panel/30
          rounded-lg px-2 py-1 max-h-16 overflow-hidden">
           {task.description}
        </div>
      ) : null}

      {/* Footer */}
      <div className="mt-3 flex justify-between text-[11px] text-app-muted">
        {/* Due */}
        <div className="flex flex-col gap-1">
          <span className="uppercase text-[10px]">Due</span>
          {mode === "edit" ? (
            <input
              type="datetime-local"
              value={dueDate}
              min={getNowLocalISOString()}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-md border bg-yellow-500/10
                border-yellow-500/30  py-0.5 text-xs outline-none"
            />
          ) : task.due_date ? (
            <span className="rounded-full bg-yellow-500/15
              px-2 py-0.5 text-yellow-400">
              {formatDateTime(task.due_date)}
            </span>
          ) : (
            <span className="opacity-40">—</span>
          )}
        </div>

        {/* Created */}
        <div className="flex flex-col gap-1">
          <span className="uppercase text-[10px]">Created</span>
          <span className="rounded-full bg-app-panel/40 px-2 py-0.5">
            {formatDateTime(task.created)}
          </span>
        </div>
      </div>

      {/* Actions */}
      {mode === "edit" && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={cancelEdit}
            className="px-3 py-1 rounded-md text-xs
               text-red-400 hover:opacity-80"
          >
             Cancel
          </button>
          <button
            onClick={saveAll}
            className="px-3 py-1 rounded-md text-xs
              text-app-muted hover:text-app-text "
          >
             Save
          </button>
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
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [columnName, setColumnName] = useState(column.name);
  const [showMenu, setShowMenu] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: { type: "column", columnId },
  });

  const handleAddTask = useCallback(async () => {
    if (!newTaskTitle.trim()) return;
    
     if (dueDate && new Date(dueDate) < new Date()) {
    toast.error("⛔ Due date cannot be in the past");
    return;
    }
    {
        try {
          await onAddTask(
            newTaskTitle.trim(),
            columnId,
            newTaskDescription.trim() || null,
            dueDate ? new Date(dueDate).toISOString() : null
          );
          setNewTaskTitle("");
          setNewTaskDescription("");
          setDueDate("");
          setIsAdding(false);
        } catch (error) {
          console.error(error);
          toast.error(`Add task failed: ${error.message || "Unknown error"}`);
        }
      }
  }, [newTaskTitle, newTaskDescription, dueDate, columnId, onAddTask]);

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

  const cancelAdd = () => {
    setNewTaskTitle("");
    setNewTaskDescription("");
    setDueDate("");
    setIsAdding(false);
  };


  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        if (isAdding) handleAddTask();
        else if (isRenaming) handleRename();
      } else if (e.key === "Escape") {
        if (isAdding) {
         cancelAdd();
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
          <div className="p-3 mt-2 rounded-xl border
            bg-app-panel/40 border-app-border flex flex-col gap-2">

            {/* Title */}
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Task title"
              autoFocus
              className="w-full bg-blue-500/10 border border-blue-500/30
                rounded-md px-3 py-2 text-sm outline-none"
            />

            {/* Description */}
            <textarea
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full bg-slate-500/10 border border-slate-500/30
                rounded-md px-3 py-2 text-xs resize-none outline-none"
            />

            {/* Due Date */}
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={dueDate}
                min={getNowLocalISOString()}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 bg-yellow-500/10 border
                  border-yellow-500/30 rounded-md px-2 py-1 text-xs outline-none"
              />
              {dueDate && (
                <button
                  onClick={() => setDueDate("")}
                  className="text-xs text-red-400 hover:opacity-80"
                  title="Clear due date"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between mt-1 text-xs">
              <button
                onClick={cancelAdd}
                className="text-red-400 hover:opacity-80"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim()}
                className="text-app-muted hover:text-app-text font-medium
                  disabled:opacity-40"
              >
                ➕ Add Task
              </button>
            </div>
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

  console.log("board", board);
  
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
    async (title, columnId, description, dueDate) => {
      if (!board || !boardPath) return;

      try {
        const newCard = {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2),
          title,
          description,
          tags: [],
          assignee: null,
          priority: "normal",
          due_date: dueDate,
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
